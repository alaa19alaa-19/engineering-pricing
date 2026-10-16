"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";

// =====================================================================
//  التسعير التقريبي الذكي
//  - يدوّر على بنود مسعّرة مشابهة (في أي مشروع) بنفس "أساس الحساب" (م² / م / م³ / عدد...)
//  - لو البند عدد (No) وله مساحة فتحة، الأساس هو سعر المتر المربع
//  - يطبّق بريك داون مخصص قابل للتعديل لكل بند، ويعلّم البنود بأنها "تقريبية"
//  - لما تعدّل بند من العيلة، البنود التقريبية الباقية بتتحدّث (propagateFrom في page.tsx)
// =====================================================================

export type TItem = {
  id?: string | number;
  item_code: string;
  description: string;
  unit: string;
  quantity: number;
  raw_qty?: number;
  area_per_unit?: number | null;
  sheet_name?: string;
};

export type SrcInfo = {
  id: string | number;
  item_code: string;
  description: string;
  unit: string;
  area_per_unit?: number | null;
  unit_price: number;
  isCustom: boolean;
  templateLines?: any[];
};

type Basis = { unit: string; perUnit: number; kind: "area" | "plain" };
type Ratios = { wastage: number; overhead: number; risk: number; profit: number };

const DEFAULT_RATIOS: Ratios = { wastage: 5, overhead: 18, risk: 3, profit: 10 };

// ---------- الوحدات والمساحة ----------
export const normUnit = (u: string) => {
  const t = (u || "")
    .toLowerCase()
    .replace(/[.\s]/g, "")
    .replace("²", "2")
    .replace("³", "3");
  if (/^(m2|sqm|م2|متر2|مترمربع)$/.test(t)) return "m2";
  if (/^(m3|cum|م3|مترمكعب)$/.test(t)) return "m3";
  if (/^(m|lm|rm|م|مط|متر|مترطولي)$/.test(t)) return "m";
  if (/^(no|nos|ea|each|pc|pcs|عدد|نمرة)$/.test(t)) return "no";
  return t;
};

const SIZE_RE = /size\s*:?\s*(\d{3,4}(?:\.\d+)?)\s*[x×*]\s*(\d{3,4}(?:\.\d+)?)/i;
const WH_RE = /w\s*:?\s*(\d{3,4}(?:\.\d+)?)\s*(?:mm)?\s*[x×*]\s*h\s*:?\s*(\d{3,4}(?:\.\d+)?)/i;
const DIM_RE = /(\d{3,4}(?:\.\d+)?)\s*[x×*]\s*(\d{3,4}(?:\.\d+)?)\s*mm/i;

export function areaOfItem(x: {
  unit: string;
  description: string;
  area_per_unit?: number | null;
}): number | null {
  if (x.area_per_unit && Number(x.area_per_unit) > 0) return Number(x.area_per_unit);
  if (normUnit(x.unit) !== "no") return null;
  const d = x.description || "";
  const m = d.match(SIZE_RE) || d.match(WH_RE) || d.match(DIM_RE);
  if (!m) return null;
  const a = (parseFloat(m[1]) / 1000) * (parseFloat(m[2]) / 1000);
  return a > 0 && a < 100 ? Math.round(a * 1000) / 1000 : null;
}

export function basisOf(x: {
  unit: string;
  description: string;
  area_per_unit?: number | null;
}): Basis {
  const u = normUnit(x.unit);
  const a = u === "no" ? areaOfItem(x) : null;
  return a
    ? { unit: "m2", perUnit: a, kind: "area" }
    : { unit: u, perUnit: 1, kind: "plain" };
}

const factorOf = (r: Ratios) =>
  (1 + r.wastage / 100) * (1 + (r.overhead + r.risk) / 100) * (1 + r.profit / 100);

const round2 = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

// ---------- تشابه النصوص (TF-IDF + cosine) ----------
const STOP = new Set(
  (
    "supply install installing installation apply applying and the of for with to in on at by as per all any or be is are " +
    "shall will include includes including included rate rates work works material materials activity activities required " +
    "require requires complete completely accessories according approved approval approve engineer engineers contractor " +
    "submitted submit samples sample samps shop drawings drawing specifications specification spec item items etc other finish " +
    "whole full unit units instructions manufacturer manufacturers project that this from not less than more mm cm kg m2 m3 " +
    "no nos each provide providing provided furnish furnishing but also its their they which where when under over between " +
    "within without after before size type"
  ).split(" ")
);

const tokenize = (s: string) =>
  (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, " ")
    .split(" ")
    .filter((t) => t.length > 1 && !STOP.has(t));

type Vec = { v: Map<string, number>; norm: number };

function buildIdf(docs: string[][]) {
  const df = new Map<string, number>();
  for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) || 0) + 1);
  const N = docs.length;
  return (t: string) => Math.log((N + 1) / ((df.get(t) || 0) + 1)) + 1;
}

function toVec(tokens: string[], idf: (t: string) => number): Vec {
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
  const v = new Map<string, number>();
  let norm = 0;
  for (const [t, c] of tf) {
    const w = (1 + Math.log(c)) * idf(t);
    v.set(t, w);
    norm += w * w;
  }
  return { v, norm: Math.sqrt(norm) || 1 };
}

function cosine(a: Vec, b: Vec) {
  const [s, l] = a.v.size < b.v.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [t, w] of s.v) {
    const o = l.v.get(t);
    if (o) dot += w * o;
  }
  return dot / (a.norm * b.norm);
}

// =====================================================================
//  تطبيق بريك داون بند مصدر على بنود هدف (مع تناسب المساحة)
// =====================================================================
export async function applyFromSource(
  src: SrcInfo,
  targets: TItem[],
  opts: {
    family?: string;
    approx?: boolean;
    similarity?: Record<string, number>;
    onProgress?: (i: number, n: number, code: string) => void;
  } = {}
): Promise<{ ok: number; failed: string[] }> {
  const srcBasis = basisOf(src);
  let lines: any[] = [];
  let ratios: Ratios = DEFAULT_RATIOS;

  if (src.isCustom) {
    const { data } = await supabase.rpc("load_custom_breakdown", { p_item: src.id });
    if (data?.lines?.length) {
      lines = data.lines;
      if (data.ratios) ratios = { ...DEFAULT_RATIOS, ...data.ratios };
    }
  } else if (src.templateLines?.length) {
    lines = src.templateLines.map((l: any) => ({
      component_type: l.component_type,
      price_key: l.price_key ?? null,
      name_ar: l.name,
      unit: l.unit,
      qty: Number(l.quantity),
      rate: Number(l.unit_rate),
      is_new: false,
    }));
  }

  const factor = factorOf(ratios);
  let useLines = lines.length > 0;

  // بند من قالب: لو تفاصيله مش بتطلّع نفس سعره (±5%) نستخدم سطر واحد بالسعر الفعلي
  if (useLines && !src.isCustom) {
    const direct = lines.reduce((s, l) => s + Number(l.qty) * Number(l.rate), 0);
    const est = direct * factor;
    if (!(src.unit_price > 0) || Math.abs(est - src.unit_price) / src.unit_price > 0.05) {
      useLines = false;
    }
  }

  const srcRate = src.unit_price / srcBasis.perUnit; // سعر الأساس (م² أو الوحدة)
  let ok = 0;
  const failed: string[] = [];

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    opts.onProgress?.(i + 1, targets.length, t.item_code);
    if (t.id == null) {
      failed.push(t.item_code);
      continue;
    }

    const tb = basisOf(t);
    const k = srcBasis.kind === "area" && tb.kind === "area" ? tb.perUnit / srcBasis.perUnit : 1;

    let tl: any[];
    if (useLines) {
      tl = lines.map((l: any) => {
        // نشيل أي حقول زيادة جاية من الجدول
        const { id, item_id, created_at, updated_at, ...rest } = l;
        const isAreaLine = /^(m2|م2|م²)$/i.test(String(l.unit || "").trim());
        return {
          ...rest,
          qty:
            srcBasis.kind === "area" && isAreaLine
              ? round3(Number(l.qty) * k)
              : Number(l.qty),
        };
      });
    } else {
      const unitPrice = srcRate * tb.perUnit;
      const direct = unitPrice / factor;
      const qty = tb.kind === "area" ? tb.perUnit : 1;
      tl = [
        {
          component_type: "خامات",
          price_key: null,
          name_ar: `تسعير تقريبي — مشابه للبند ${src.item_code}`,
          unit: tb.kind === "area" ? "م²" : t.unit || "—",
          qty,
          rate: round2(direct / qty),
          is_new: true,
        },
      ];
    }

    const totalQty =
      tb.kind === "area" ? (t.raw_qty ?? t.quantity ?? 1) * tb.perUnit : t.quantity || 1;

    const { data, error } = await supabase.rpc("save_custom_breakdown", {
      p_item: t.id,
      p_lines: tl,
      p_ratios: ratios,
      p_qty: totalQty,
    });
    if (error || !data?.ok) {
      failed.push(t.item_code);
      continue;
    }
    ok++;

    // علامة "تقريبي" + العيلة (عشان تعديل بند واحد يحدّث الباقي)
    if (opts.approx) {
      try {
        const { data: cur } = await supabase
          .from("boq_items")
          .select("price_result")
          .eq("id", t.id)
          .maybeSingle();
        await supabase
          .from("boq_items")
          .update({
            price_result: {
              ...(cur?.price_result || {}),
              approx: {
                family: opts.family ?? String(src.id),
                source_id: src.id,
                source_code: src.item_code,
                similarity: opts.similarity?.[String(t.id)],
                confirmed: false,
                basis: tb.unit,
              },
            },
          })
          .eq("id", t.id);
      } catch (e) {
        console.warn("فشل حفظ علامة التقريبي:", e);
      }
    }
  }

  return { ok, failed };
}

// بند تقريبي اتعدّل بإيدك: يبقى "مؤكد" ويبقى مرجع لباقي العيلة
export async function markApproxConfirmed(id: string | number) {
  try {
    const { data: cur } = await supabase
      .from("boq_items")
      .select("price_result")
      .eq("id", id)
      .maybeSingle();
    const pr = cur?.price_result;
    if (pr?.approx && !pr.approx.confirmed) {
      await supabase
        .from("boq_items")
        .update({ price_result: { ...pr, approx: { ...pr.approx, confirmed: true } } })
        .eq("id", id);
    }
  } catch (e) {
    console.warn("markApproxConfirmed:", e);
  }
}

// =====================================================================
//  النافذة
// =====================================================================
type RefItem = {
  id: string | number;
  project_id: string;
  item_code: string;
  description: string;
  unit: string;
  area_per_unit?: number | null;
  template_key?: string | null;
  price_result: any;
  unitPrice: number;
  basis: Basis;
  isCustom: boolean;
};

type Cand = { p: RefItem; sc: number };

type Props = {
  targets: TItem[];
  projectId: string;
  onClose: () => void;
  onDone: () => void;
};

export default function SmartPricingModal({ targets, projectId, onClose, onDone }: Props) {
  const [pool, setPool] = useState<RefItem[] | null>(null);
  const [err, setErr] = useState("");
  const [minSim, setMinSim] = useState(0.3);
  const [sameProjectOnly, setSameProjectOnly] = useState(false);
  const [choice, setChoice] = useState<Record<string, number>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");

  // بنك الأسعار المرجعي: كل البنود المسعّرة في كل المشاريع (عدا التقريبي غير المؤكد)
  useEffect(() => {
    (async () => {
      try {
        const all: any[] = [];
        for (let from = 0; from < 6000; from += 1000) {
          const { data, error } = await supabase
            .from("boq_items")
            .select(
              "id,project_id,item_code,description,unit,area_per_unit,template_key,price_result"
            )
            .eq("status", "priced")
            .range(from, from + 999);
          if (error) throw new Error(error.message);
          all.push(...(data || []));
          if (!data || data.length < 1000) break;
        }
        const refs: RefItem[] = [];
        for (const r of all) {
          const pr = r.price_result || {};
          const up = Number(pr.unit_price || 0);
          if (!(up > 0)) continue;
          if (pr.approx && !pr.approx.confirmed) continue;
          refs.push({
            id: r.id,
            project_id: String(r.project_id),
            item_code: r.item_code || "",
            description: r.description || "",
            unit: r.unit || "",
            area_per_unit: r.area_per_unit ?? null,
            template_key: r.template_key,
            price_result: pr,
            unitPrice: up,
            basis: basisOf({
              unit: r.unit || "",
              description: r.description || "",
              area_per_unit: r.area_per_unit ?? null,
            }),
            isCustom: pr.custom === true || r.template_key === "CUSTOM",
          });
        }
        setPool(refs);
      } catch (e: any) {
        setErr(e.message || String(e));
      }
    })();
  }, []);

  const key = (t: TItem) => String(t.id);

  const rows = useMemo(() => {
    if (!pool) return [];
    const poolDocs = pool.map((p) => tokenize(p.description));
    const tgtDocs = targets.map((t) => tokenize(t.description));
    const idf = buildIdf([...poolDocs, ...tgtDocs]);
    const poolVecs = poolDocs.map((d) => toVec(d, idf));

    return targets.map((t, ti) => {
      const tb = basisOf(t);
      const tv = toVec(tgtDocs[ti], idf);
      const cands: Cand[] = [];
      if (tb.unit) {
        for (let i = 0; i < pool.length; i++) {
          const p = pool[i];
          if (p.basis.unit !== tb.unit) continue;
          if (sameProjectOnly && p.project_id !== projectId) continue;
          if (String(p.id) === String(t.id)) continue;
          const sc = cosine(tv, poolVecs[i]);
          if (sc >= minSim) cands.push({ p, sc });
        }
        cands.sort((a, b) => b.sc - a.sc);
      }
      return { t, tb, cands: cands.slice(0, 3) };
    });
  }, [pool, targets, minSim, sameProjectOnly, projectId]);

  const pickedOf = (r: (typeof rows)[number]) =>
    r.cands[Math.min(choice[key(r.t)] ?? 0, r.cands.length - 1)];
  const isChecked = (r: (typeof rows)[number]) =>
    r.cands.length > 0 && (checked[key(r.t)] ?? pickedOf(r).sc >= 0.45);
  const selectedRows = rows.filter(isChecked);

  const estimate = (r: (typeof rows)[number], c: Cand) =>
    (c.p.unitPrice / c.p.basis.perUnit) * r.tb.perUnit;

  const apply = async () => {
    if (selectedRows.length === 0) {
      alert("مفيش بنود محددة");
      return;
    }
    if (
      !confirm(
        `هتسعّر ${selectedRows.length} بند تقريبياً من بنود مشابهة؟\n\n` +
          `كل بند هياخد بريك داون مخصص قابل للتعديل، ولما تعدّل واحد منهم باقي بنود نفس العيلة بتتحدّث تلقائياً.`
      )
    )
      return;

    setBusy(true);
    try {
      const groups = new Map<string, { c: Cand; items: TItem[]; sims: Record<string, number> }>();
      for (const r of selectedRows) {
        const c = pickedOf(r);
        const g = groups.get(String(c.p.id)) ?? { c, items: [], sims: {} };
        g.items.push(r.t);
        g.sims[key(r.t)] = Math.round(c.sc * 100) / 100;
        groups.set(String(c.p.id), g);
      }

      let ok = 0;
      const failed: string[] = [];
      for (const g of groups.values()) {
        const p = g.c.p;
        const res = await applyFromSource(
          {
            id: p.id,
            item_code: p.item_code,
            description: p.description,
            unit: p.unit,
            area_per_unit: p.area_per_unit,
            unit_price: p.unitPrice,
            isCustom: p.isCustom,
            templateLines: Array.isArray(p.price_result?.lines) ? p.price_result.lines : undefined,
          },
          g.items,
          {
            approx: true,
            family: p.price_result?.approx?.family ?? String(p.id),
            similarity: g.sims,
            onProgress: (i, n, code) => setProgress(`${code} (${i}/${n})`),
          }
        );
        ok += res.ok;
        failed.push(...res.failed);
      }

      alert(
        `تم التسعير التقريبي لـ ${ok} بند` +
          (failed.length ? `\nفشل: ${failed.join("، ")}` : "") +
          `\n\nراجع البنود المعلّمة "تقريبي ≈" وعدّل أي واحد، والباقي هيتحدّث تلقائياً.`
      );
      onDone();
      onClose();
    } finally {
      setBusy(false);
      setProgress("");
    }
  };

  const projectsCount = pool ? new Set(pool.map((p) => p.project_id)).size : 0;

  return (
    <div className="modal-overlay" onClick={() => !busy && onClose()}>
      <div
        className="modal-content"
        style={{ maxWidth: 1150, width: "96%" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2>التسعير التقريبي الذكي</h2>
            <p className="modal-subtitle">
              {pool
                ? `بنك مرجعي: ${pool.length} بند مسعّر من ${projectsCount} مشروع — ${targets.length} بند غير مسعّر`
                : "جاري تحميل البنود المسعّرة..."}
            </p>
          </div>
          <button className="modal-close" onClick={() => !busy && onClose()}>
            x
          </button>
        </div>

        <div className="modal-body">
          {err && <div className="error-box">خطأ: {err}</div>}

          <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
            <label style={{ fontSize: 12, color: "#666" }}>
              أقل نسبة تشابه: <strong>{Math.round(minSim * 100)}%</strong>{" "}
              <input
                type="range"
                min={0.15}
                max={0.8}
                step={0.05}
                value={minSim}
                onChange={(e) => {
                  setMinSim(parseFloat(e.target.value));
                  setChecked({});
                  setChoice({});
                }}
              />
            </label>
            <label style={{ fontSize: 12, color: "#666" }}>
              <input
                type="checkbox"
                checked={sameProjectOnly}
                onChange={(e) => {
                  setSameProjectOnly(e.target.checked);
                  setChecked({});
                  setChoice({});
                }}
              />{" "}
              المشروع الحالي فقط
            </label>
            <button
              type="button"
              className="btn-secondary"
              style={{ fontSize: 12, padding: "4px 10px" }}
              onClick={() =>
                setChecked(Object.fromEntries(rows.map((r) => [key(r.t), r.cands.length > 0])))
              }
            >
              تحديد الكل
            </button>
            <button
              type="button"
              className="btn-secondary"
              style={{ fontSize: 12, padding: "4px 10px" }}
              onClick={() => setChecked(Object.fromEntries(rows.map((r) => [key(r.t), false])))}
            >
              إلغاء التحديد
            </button>
          </div>

          <p style={{ fontSize: 12, color: "#666", margin: "0 0 8px" }}>
            المقارنة بنفس أساس الحساب (م² أو م أو م³ أو عدد). البنود اللي بالعدد ولها مقاس (مثل أبواب
            وشبابيك) بتتسعّر بسعر المتر المربع × مساحة كل فتحة. المحدد تلقائياً هو اللي تشابهه 45% فأكثر.
          </p>

          {pool && rows.length > 0 && (
            <div className="table-wrapper" style={{ maxHeight: 420, overflowY: "auto" }}>
              <table className="components-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>الكود</th>
                    <th>الوصف</th>
                    <th>الأساس</th>
                    <th>أقرب بند مشابه</th>
                    <th>التشابه</th>
                    <th>سعر الوحدة التقريبي</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const c = r.cands.length ? pickedOf(r) : null;
                    return (
                      <tr key={key(r.t)} style={{ background: isChecked(r) ? "#eafaf1" : undefined }}>
                        <td>
                          <input
                            type="checkbox"
                            disabled={!c}
                            checked={isChecked(r)}
                            onChange={(e) =>
                              setChecked((prev) => ({ ...prev, [key(r.t)]: e.target.checked }))
                            }
                          />
                        </td>
                        <td>{r.t.item_code}</td>
                        <td dir="auto" title={r.t.description} style={{ fontSize: 12, maxWidth: 320 }}>
                          {r.t.description.length > 120
                            ? "…" + r.t.description.slice(-120)
                            : r.t.description}
                        </td>
                        <td style={{ fontSize: 12 }}>
                          {r.tb.kind === "area"
                            ? `م² (${r.tb.perUnit} م² × ${r.t.raw_qty ?? r.t.quantity})`
                            : r.tb.unit || "—"}
                        </td>
                        <td style={{ maxWidth: 340 }}>
                          {c ? (
                            <select
                              value={Math.min(choice[key(r.t)] ?? 0, r.cands.length - 1)}
                              onChange={(e) =>
                                setChoice((prev) => ({ ...prev, [key(r.t)]: parseInt(e.target.value, 10) }))
                              }
                              style={{ width: "100%", fontSize: 11, padding: 3 }}
                            >
                              {r.cands.map((x, i) => (
                                <option key={String(x.p.id)} value={i}>
                                  {Math.round(x.sc * 100)}% — {x.p.item_code} —{" "}
                                  {x.p.description.slice(0, 60)} —{" "}
                                  {x.p.project_id === projectId ? "هذا المشروع" : "مشروع سابق"}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span style={{ color: "#aaa", fontSize: 12 }}>مفيش بند مشابه</span>
                          )}
                        </td>
                        <td>{c ? `${Math.round(c.sc * 100)}%` : "—"}</td>
                        <td className="total-cell">
                          {c ? `≈ ${Math.round(estimate(r, c)).toLocaleString("ar-EG")} ج.م` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            className="btn-success"
            type="button"
            onClick={apply}
            disabled={busy || !pool || selectedRows.length === 0}
          >
            {busy ? `جاري التطبيق... ${progress}` : `سعّر ${selectedRows.length} بند تقريبياً`}
          </button>
          <button className="btn-ghost" type="button" onClick={() => !busy && onClose()}>
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
