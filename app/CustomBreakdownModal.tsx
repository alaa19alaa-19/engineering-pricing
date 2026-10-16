"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";

type CType = "خامات" | "مصنعيات" | "معدات" | "محملات";
const TYPES: CType[] = ["خامات", "مصنعيات", "معدات", "محملات"];

const KIND: Record<CType, string> = {
  خامات: "material",
  مصنعيات: "labor",
  معدات: "equipment",
  محملات: "material",
};

type Line = {
  key: string;
  component_type: CType;
  price_key: string | null;
  name_ar: string;
  unit: string;
  qty: number;
  rate: number;
  is_new: boolean;
};

type BankRow = { kind: string; code: string; name_ar: string; unit: string; rate: number };

type Props = {
  item: {
    id?: string | number;
    item_code: string;
    description: string;
    unit: string;
    quantity: number;
    area_per_unit?: number | null;
  };
  projectId?: string;
  onClose: () => void;
  onSaved: (r: { unit_price: number; total_price: number }) => void;
};

const fmt = (n: number) => Math.round(n).toLocaleString("ar-EG");
const uid = () => `l-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// ═══════════════════════════════════════════════════════════════
// 🆕 دوال مساعدة للتصميم الاحترافي
// ═══════════════════════════════════════════════════════════════
const chipStyle = (bg: string, color: string): React.CSSProperties => ({
  background: bg,
  color,
  padding: "3px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 600,
  display: "inline-flex",
  alignItems: "center",
  border: "1px solid rgba(0,0,0,0.04)",
});

function ItemHeaderCard({
  itemCode,
  description,
  unit,
  quantity,
  areaPerUnit,
  totalQty,
}: {
  itemCode?: string;
  description?: string;
  unit?: string;
  quantity?: number | string;
  areaPerUnit?: number | null;
  totalQty?: number;
}) {
  return (
    <div
      dir="auto"
      style={{
        background: "linear-gradient(135deg, #f8fafc 0%, #eef2f7 100%)",
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        padding: "14px 18px",
        margin: "10px 0 14px",
        fontSize: 13.5,
        lineHeight: 1.85,
        color: "#1e293b",
        maxHeight: 220,
        overflowY: "auto",
        boxShadow: "inset 0 1px 2px rgba(255,255,255,0.8)",
      }}
    >
      {/* شريط المعلومات العلوي (chips) */}
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 10,
          paddingBottom: 10,
          borderBottom: "1px dashed #cbd5e1",
        }}
      >
        <span style={chipStyle("#dbeafe", "#1e40af")}>
          <strong>كود:</strong>&nbsp;{itemCode || "—"}
        </span>
        <span style={chipStyle("#dcfce7", "#166534")}>
          <strong>الوحدة:</strong>&nbsp;{unit || "—"}
        </span>
        {quantity !== undefined && quantity !== null && (
          <span style={chipStyle("#fef3c7", "#92400e")}>
            <strong>الكمية:</strong>&nbsp;{quantity}
          </span>
        )}
        {areaPerUnit ? (
          <span style={chipStyle("#ede9fe", "#5b21b6")}>
            <strong>مساحة الوحدة:</strong>&nbsp;{areaPerUnit} م²
          </span>
        ) : null}
        {areaPerUnit && totalQty ? (
          <span style={chipStyle("#fce7f3", "#9d174d")}>
            <strong>الإجمالي:</strong>&nbsp;{totalQty.toFixed(3)} م²
          </span>
        ) : null}
      </div>

      {/* الوصف الكامل */}
      <div
        style={{
          fontWeight: 500,
          color: "#0f172a",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          letterSpacing: "0.1px",
        }}
      >
        {description || "—"}
      </div>
    </div>
  );
}

export default function CustomBreakdownModal({ item, projectId, onClose, onSaved }: Props) {
  const [itemId, setItemId] = useState<string | number | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [ratios, setRatios] = useState({ wastage: 5, overhead: 18, risk: 3, profit: 10 });
  const [saving, setSaving] = useState(false);
  const [applySimilar, setApplySimilar] = useState(true);
  const [msg, setMsg] = useState("");

  const [adding, setAdding] = useState(false);
  const [tab, setTab] = useState<CType>("خامات");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<BankRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [newUnit, setNewUnit] = useState("");
  const [newRate, setNewRate] = useState(0);

  const defaultQty = item.area_per_unit ?? 1;
  const defaultUnit = item.area_per_unit ? "م²" : "NO";

  const totalQty = item.area_per_unit
    ? item.area_per_unit * (item.quantity || 1)
    : item.quantity || 1;

  // 🆕 نعتمد على item.id أولاً، ولو مش موجود نجيبه من Supabase
  useEffect(() => {
    (async () => {
      let id: string | number | null = item.id ?? null;

      if (id == null && projectId) {
        const { data: row } = await supabase
          .from("boq_items")
          .select("id")
          .eq("project_id", projectId)
          .eq("item_code", item.item_code)
          .limit(1)
          .maybeSingle();
        id = row?.id ?? null;
      }

      if (id == null) {
        setMsg("⚠️ البند غير موجود في Supabase — اضغط «تحميل من Supabase» أو أعد الاستيراد");
        return;
      }
      setItemId(id);

      const { data: saved, error: loadErr } = await supabase.rpc("load_custom_breakdown", {
        p_item: id,
      });

      if (loadErr) {
        console.error("load_custom_breakdown error:", loadErr);
        return;
      }

      if (saved?.lines && saved.lines.length > 0) {
        setLines(
          saved.lines.map((l: any) => ({
            ...l,
            key: uid(),
            price_key: l.price_key || null,
          }))
        );
        if (saved.ratios) setRatios(saved.ratios);
      }
    })();
  }, [item.id, item.item_code, projectId]);

  useEffect(() => {
    if (!adding) return;
    const t = setTimeout(async () => {
      setSearching(true);
      let q = supabase
        .from("price_bank")
        .select("kind,code,name_ar,unit,rate")
        .eq("kind", KIND[tab])
        .limit(30);
      if (search.trim()) q = q.ilike("name_ar", `%${search.trim()}%`);
      const { data } = await q;
      setResults((data as BankRow[]) || []);
      setSearching(false);
    }, 250);
    return () => clearTimeout(t);
  }, [adding, tab, search]);

  const totals = useMemo(() => {
    const direct = lines.reduce((s, l) => s + l.qty * l.rate, 0);
    const w = (direct * ratios.wastage) / 100;
    const sub = direct + w;
    const o = (sub * ratios.overhead) / 100;
    const r = (sub * ratios.risk) / 100;
    const p = ((sub + o + r) * ratios.profit) / 100;
    const unit = Math.ceil(sub + o + r + p);
    const total = unit * totalQty;
    return { direct, w, sub, o, r, p, unit, total };
  }, [lines, ratios, totalQty]);

  const addFromBank = (b: BankRow) => {
    setLines((p) => [
      ...p,
      {
        key: uid(),
        component_type: tab,
        price_key: b.code,
        name_ar: b.name_ar,
        unit: defaultUnit,
        qty: defaultQty,
        rate: Number(b.rate) || 0,
        is_new: false,
      },
    ]);
  };

  const addNew = () => {
    if (!search.trim()) return;
    setLines((p) => [
      ...p,
      {
        key: uid(),
        component_type: tab,
        price_key: null,
        name_ar: search.trim(),
        unit: newUnit.trim() || defaultUnit,
        qty: defaultQty,
        rate: newRate,
        is_new: true,
      },
    ]);
    setSearch("");
    setNewUnit("");
    setNewRate(0);
  };

  const patch = (key: string, f: Partial<Line>) =>
    setLines((p) => p.map((l) => (l.key === key ? { ...l, ...f } : l)));

  const save = async () => {
    if (!itemId) {
      alert("⚠️ البند غير موجود في Supabase — لا يمكن الحفظ");
      return;
    }
    if (lines.length === 0) return alert("⚠️ أضف مكوّنًا واحدًا على الأقل");
    setSaving(true);
    const payload = lines.map(({ key, ...rest }) => rest);
    const { data, error } = await supabase.rpc("save_custom_breakdown", {
      p_item: itemId,
      p_lines: payload,
      p_ratios: ratios,
      p_qty: totalQty,
    });
    setSaving(false);
    if (error || !data?.ok) return alert("❌ فشل الحفظ: " + (error?.message || "unknown"));

    let extra = "";
    if (applySimilar) {
      const { data: ap } = await supabase.rpc("apply_custom_to_similar", { p_item: itemId });
      if (ap?.ok) extra = `\n🔁 تم تطبيقه على ${ap.applied} بند مشابه`;
    }

    onSaved({ unit_price: data.unit_price, total_price: data.total_price });
    if (extra) alert("✅ تم الحفظ" + extra + "\nاضغط «📊 تحميل من Supabase» لتحديث الجدول.");
    else alert("✅ تم الحفظ");
    onClose();
  };

  const num = (v: string) => parseFloat(v) || 0;
  const cell: React.CSSProperties = {
    padding: "4px 6px",
    border: "1px solid #d5dbdb",
    borderRadius: 4,
    fontSize: 12,
    textAlign: "center",
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* ═══════════════════════════════════════════════════════════
            🆕 رأس المودال — sticky مع كارت الوصف الكامل
            ═══════════════════════════════════════════════════════════ */}
        <div
          className="modal-header"
          style={{
            position: "sticky",
            top: 0,
            zIndex: 10,
            background: "white",
            borderBottom: "1px solid #e2e8f0",
            paddingBottom: 12,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 2,
              }}
            >
              <h2 style={{ margin: 0 }}>✏️ بريك داون مخصص</h2>
            </div>

            {/* 🆕 كارت الوصف الكامل */}
            <ItemHeaderCard
              itemCode={item.item_code}
              description={item.description}
              unit={item.unit}
              quantity={item.quantity}
              areaPerUnit={item.area_per_unit ?? null}
              totalQty={totalQty}
            />
          </div>
          <button
            className="modal-close"
            onClick={onClose}
            style={{ alignSelf: "flex-start", marginTop: 4 }}
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          {msg && <div className="error-box">{msg}</div>}

          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>المكوّنات ({lines.length})</h3>
            <button
              className="btn-primary"
              type="button"
              style={{ fontSize: 12, padding: "6px 12px" }}
              onClick={() => setAdding((v) => !v)}
            >
              {adding ? "✖ إغلاق" : "➕ إضافة بند"}
            </button>
          </div>

          {adding && (
            <div
              style={{
                background: "#fff9e6",
                border: "1px dashed #f39c12",
                borderRadius: 8,
                padding: 12,
                marginBottom: 12,
              }}
            >
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                {TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={tab === t ? "btn-primary" : "btn-secondary"}
                    style={{ fontSize: 12, padding: "6px 12px" }}
                    onClick={() => setTab(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <input
                className="answer-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`ابحث في ${tab} أو اكتب اسمًا جديدًا`}
              />

              <div style={{ maxHeight: 180, overflowY: "auto", marginTop: 8 }}>
                {searching && <p className="empty-note">⏳ جاري البحث...</p>}
                {!searching &&
                  results.map((b) => (
                    <div
                      key={b.code}
                      onClick={() => addFromBank(b)}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 8,
                        padding: "8px 10px",
                        borderBottom: "1px solid #eee",
                        cursor: "pointer",
                        fontSize: 13,
                      }}
                    >
                      <span>{b.name_ar}</span>
                      <span style={{ color: "#666", whiteSpace: "nowrap" }}>
                        {b.unit} • {Number(b.rate).toLocaleString("ar-EG")} ج.م
                      </span>
                    </div>
                  ))}
                {!searching && results.length === 0 && (
                  <p className="empty-note">لا توجد نتائج في بنك {tab}</p>
                )}
              </div>

              {search.trim() && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr auto",
                    gap: 8,
                    marginTop: 8,
                    alignItems: "end",
                  }}
                >
                  <div>
                    <label style={{ fontSize: 11, color: "#666" }}>الوحدة</label>
                    <input
                      className="answer-input"
                      value={newUnit}
                      onChange={(e) => setNewUnit(e.target.value)}
                      placeholder={defaultUnit}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: "#666" }}>سعر الوحدة</label>
                    <input
                      className="answer-input"
                      type="number"
                      step="0.01"
                      value={newRate}
                      onChange={(e) => setNewRate(num(e.target.value))}
                    />
                  </div>
                  <button
                    className="btn-success"
                    type="button"
                    onClick={addNew}
                    style={{ fontSize: 12, padding: "8px 12px" }}
                  >
                    ➕ أضف «{search.trim().slice(0, 18)}» كجديد
                  </button>
                </div>
              )}
            </div>
          )}

          {lines.length === 0 ? (
            <p className="empty-note">
              لا توجد مكونات — اضغط «➕ إضافة بند» واختر من البنك أو اكتب جديدًا
            </p>
          ) : (
            <div className="table-wrapper">
              <table className="components-table">
                <thead>
                  <tr>
                    <th>الفئة</th>
                    <th>المكوّن</th>
                    <th>الكمية</th>
                    <th>الوحدة</th>
                    <th>السعر</th>
                    <th>الإجمالي</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.key} style={{ background: l.is_new ? "#fff9e6" : undefined }}>
                      <td>
                        <select
                          value={l.component_type}
                          style={cell}
                          onChange={(e) =>
                            patch(l.key, { component_type: e.target.value as CType })
                          }
                        >
                          {TYPES.map((t) => (
                            <option key={t}>{t}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        {l.name_ar}
                        {l.is_new && (
                          <span
                            style={{
                              marginRight: 6,
                              background: "#f39c12",
                              color: "#fff",
                              padding: "1px 6px",
                              borderRadius: 4,
                              fontSize: 10,
                            }}
                          >
                            جديد
                          </span>
                        )}
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.001"
                          value={l.qty}
                          style={{ ...cell, width: 80 }}
                          onChange={(e) => patch(l.key, { qty: num(e.target.value) })}
                        />
                      </td>
                      <td>
                        <input
                          value={l.unit}
                          style={{ ...cell, width: 60 }}
                          onChange={(e) => patch(l.key, { unit: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          value={l.rate}
                          style={{ ...cell, width: 90 }}
                          onChange={(e) => patch(l.key, { rate: num(e.target.value) })}
                        />
                      </td>
                      <td className="total-cell">{fmt(l.qty * l.rate)}</td>
                      <td>
                        <button
                          type="button"
                          title="حذف"
                          onClick={() => setLines((p) => p.filter((x) => x.key !== l.key))}
                          style={{
                            background: "#fee",
                            color: "#c0392b",
                            border: "1px solid #f5b7b1",
                            borderRadius: 6,
                            padding: "4px 10px",
                            cursor: "pointer",
                          }}
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div
            style={{
              background: "#f8f9fa",
              border: "1px solid #e0e0e0",
              borderRadius: 8,
              padding: 12,
              margin: "12px 0",
            }}
          >
            <h4 style={{ margin: "0 0 10px 0", fontSize: 14 }}>⚙️ النسب (قابلة للتعديل)</h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
              {(
                [
                  ["wastage", "الهالك %"],
                  ["overhead", "المصاريف العامة %"],
                  ["risk", "المخاطر %"],
                  ["profit", "الربح %"],
                ] as const
              ).map(([k, label]) => (
                <div key={k}>
                  <label style={{ fontSize: 12, color: "#666" }}>{label}</label>
                  <input
                    type="number"
                    step="0.1"
                    className="answer-input"
                    value={ratios[k]}
                    onChange={(e) => setRatios({ ...ratios, [k]: num(e.target.value) })}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="cost-summary">
            <h4>💰 ملخص التكاليف</h4>
            <div className="summary-row">
              <span>التكلفة المباشرة</span>
              <span>{fmt(totals.direct)} ج.م</span>
            </div>
            <div className="summary-row">
              <span>الهالك ({ratios.wastage}%)</span>
              <span>{fmt(totals.w)} ج.م</span>
            </div>
            <div className="summary-row subtotal">
              <span>الإجمالي الفرعي</span>
              <span>{fmt(totals.sub)} ج.م</span>
            </div>
            <div className="summary-row">
              <span>المصاريف العامة ({ratios.overhead}%)</span>
              <span>{fmt(totals.o)} ج.م</span>
            </div>
            <div className="summary-row">
              <span>المخاطر ({ratios.risk}%)</span>
              <span>{fmt(totals.r)} ج.م</span>
            </div>
            <div className="summary-row">
              <span>الربح ({ratios.profit}%)</span>
              <span>{fmt(totals.p)} ج.م</span>
            </div>
            <div className="summary-row total">
              <span>سعر الوحدة (مقرّب لأعلى)</span>
              <span>{fmt(totals.unit)} ج.م</span>
            </div>
            <div className="summary-row grand-total">
              <span>
                الإجمالي ({item.quantity} × {item.area_per_unit ?? 1}{" "}
                {item.area_per_unit ? "م²" : item.unit})
              </span>
              <span>{fmt(totals.total)} ج.م</span>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <label style={{ fontSize: 13, display: "flex", gap: 6, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={applySimilar}
              onChange={(e) => setApplySimilar(e.target.checked)}
            />
            طبّق على البنود المشابهة (نفس الوصف والوحدة)
          </label>
          <button
            className="btn-success"
            type="button"
            onClick={save}
            disabled={saving || !itemId || lines.length === 0}
          >
            {saving ? "⏳ جاري الحفظ..." : "✅ احفظ وسعّر البند"}
          </button>
          <button className="btn-ghost" type="button" onClick={onClose}>
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}