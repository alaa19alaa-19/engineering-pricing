"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { supabase } from "./supabase";
import { parseBoqFile, BoqItem } from "./parseBoq";
import CustomBreakdownModal from "./CustomBreakdownModal";
import SmartPricingModal, { TItem } from "./SmartPricingModal";

type ComponentType = "خامات" | "مصنعيات" | "معدات" | "محملات";

type Project = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

type BreakdownLine = {
  id?: string;
  component_type: string;
  price_key: string;
  name: string;
  quantity: number;
  unit: string;
  unit_rate: number;
  total_cost: number;
  isCustom?: boolean;
  original_rate?: number;
};

type BreakdownDetails = {
  ok: boolean;
  template?: string;
  name?: string;
  unit?: string;
  direct_cost?: number;
  wastage_cost?: number;
  subtotal?: number;
  overhead_cost?: number;
  risk_cost?: number;
  profit_cost?: number;
  unit_price?: number;
  total_price?: number;
  components_count?: number;
  lines?: BreakdownLine[];
  error?: string;
};

type Question = {
  id: number;
  template_item_code: string;
  question_text: string;
  question_type: string;
  options: any;
  default_answer: any;
  unit_hint: string | null;
  sort_order: number;
};

type PricingResult = {
  id?: string | number;
  sheet_id?: string | number;
  sheet_name?: string;
  db_status?: string;
  area_per_unit?: number | null;
  raw_qty?: number;
  item_code: string;
  description: string;
  unit: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  template_code: string;
  template_name: string;
  status: "priced" | "unpriced" | "error";
  error?: string;
  lines?: BreakdownLine[];
  estimated?: boolean;
  estimated_confidence?: string;
  estimated_basis?: string;
  estimated_rationale?: string;
  estimated_assumptions?: string;
};

const COMPONENT_TYPES: ComponentType[] = ["خامات", "مصنعيات", "معدات", "محملات"];

const TYPE_TO_TABLE: Record<string, { table: string; rateColumn: string }> = {
  خامات: { table: "materials", rateColumn: "price" },
  مصنعيات: { table: "labor_rates", rateColumn: "unit_rate" },
  معدات: { table: "equipment_rates", rateColumn: "rental_rate" },
  محملات: { table: "materials", rateColumn: "price" },
};

const PROJECTS_KEY = "boq_projects";
const CURRENT_PROJECT_KEY = "boq_current_project";

const STATUS_LABEL: Record<string, string> = {
  priced: "مسعر",
  matched: "مطابق - لم يسعّر",
  new: "جديد",
  review: "يحتاج مراجعة",
  optional: "اختياري",
  no_match: "بدون قالب",
  unpriced: "بدون قالب مناسب",
  unmatched: "بدون قالب",
  error: "خطأ",
};

const statusText = (r: PricingResult) => {
  if (r.estimated) return "تقديري ⚠";
  return (
    STATUS_LABEL[r.db_status || ""] ||
    r.db_status ||
    (r.status === "priced" ? "مسعر" : r.status === "unpriced" ? "غير مسعر" : "خطأ")
  );
};

const sameItem = (
  x: { id?: string | number; item_code: string },
  y: { id?: string | number; item_code: string }
) =>
  x.id != null && y.id != null
    ? String(x.id) === String(y.id)
    : x.item_code === y.item_code;

const toBoqItem = (r: PricingResult, forCustom = false): BoqItem => {
  const area = areaOf(r);
  return {
    id: r.id,
    item_code: r.item_code,
    description: r.description,
    unit: r.unit,
    quantity: forCustom && area && r.raw_qty ? r.raw_qty : r.quantity,
    area_per_unit: area,
  } as BoqItem;
};

function unitPriceFromDirect(direct: number, a: Record<string, any>) {
  const wPct = Number(a._wastage_pct ?? 5);
  const oPct = Number(a._overhead_pct ?? 18);
  const rPct = Number(a._risk_pct ?? 3);
  const pPct = Number(a._profit_pct ?? 10);
  const w = (direct * wPct) / 100;
  const sub = direct + w;
  const o = (sub * oPct) / 100;
  const r = (sub * rPct) / 100;
  const p = ((sub + o + r) * pPct) / 100;
  return Math.round(sub + o + r + p);
}

type Pkg = { key: string; label: string; sheet: RegExp; desc: RegExp; keywords: string[] };
const PACKAGES: Pkg[] = [
  { key: "earth", label: "أعمال ترابية", sheet: /earth|excav|site\s?work|division\s*0?2\b|ترابي|حفر/i, desc: /excavat|backfill|compaction|حفر|ردم/i, keywords: ["حفر", "ردم", "رمل", "نقل"] },
  { key: "concrete", label: "أعمال خرسانة", sheet: /concrete|خرسان/i, desc: /concrete|rebar|reinforc|formwork|خرسان/i, keywords: ["حديد", "خرسانة", "أسمنت", "شدة", "نجار"] },
  { key: "metals", label: "أعمال معدنية", sheet: /metal|steel|حداد|معدن/i, desc: /steel|iron|metal|handrail|حديد/i, keywords: ["حديد", "لحام", "دهان", "حداد"] },
  { key: "wood", label: "نجارة / خشب", sheet: /wood|carpent|joiner|نجار|خشب/i, desc: /wood|timber|pine|teak|mdf|خشب/i, keywords: ["خشب", "نجار", "ورنيش", "دهان"] },
  { key: "alu", label: "ألوميتال وزجاج", sheet: /alumin|glass|door|window|opening|division\s*8\b|ألوميتال|الوميتال|زجاج/i, desc: /alumin|glass|curtain wall|ألوميتال|الوميتال/i, keywords: ["ميتال", "زجاج", "خردوات", "تركيب"] },
  { key: "insul", label: "عزل", sheet: /thermal|insul|waterproof|عزل/i, desc: /waterproof|insulation|bitumen|عزل/i, keywords: ["عزل", "بيتومين", "مونة", "لحام"] },
  { key: "finish", label: "تشطيبات", sheet: /finish|paint|tile|plaster|ceiling|floor|تشطيب/i, desc: /paint|tile|plaster|ceramic|gypsum|ceiling|بلاط|دهان/i, keywords: ["دهان", "سيراميك", "بلاط", "بياض", "جبس"] },
];

const packageOf = (r: { sheet_name?: string; description: string }): string => {
  const sn = r.sheet_name || "";
  for (const p of PACKAGES) if (p.sheet.test(sn)) return p.key;
  for (const p of PACKAGES) if (p.desc.test(r.description || "")) return p.key;
  return "other";
};

const escapeRe = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const COUNT_UNIT_RE = /^(no|nos|ea|each|pc|pcs|set|عدد)\.?$/i;
const SIZE_RE = /size\s*:?\s*(\d{3,4}(?:\.\d+)?)\s*[x×*]\s*(\d{3,4}(?:\.\d+)?)/i;
const DIM_RE = /(\d{3,4}(?:\.\d+)?)\s*[x×*]\s*(\d{3,4}(?:\.\d+)?)\s*mm/i;

function parseAreaFromDesc(d: string): number | null {
  const m = (d || "").match(SIZE_RE) || (d || "").match(DIM_RE);
  if (!m) return null;
  const a = (parseFloat(m[1]) / 1000) * (parseFloat(m[2]) / 1000);
  return a > 0 && a < 100 ? Math.round(a * 1000) / 1000 : null;
}

const areaOf = (r: PricingResult): number | null => {
  if (r.area_per_unit && Number(r.area_per_unit) > 0) return Number(r.area_per_unit);
  if (COUNT_UNIT_RE.test((r.unit || "").trim())) return parseAreaFromDesc(r.description);
  return null;
};

const detectKeyword = (d: string) =>
  /alumin|ألوميتال|الوميتال/i.test(d)
    ? "alumin"
    : /wood|timber|pine|teak|mdf|خشب/i.test(d)
    ? "wood|timber|pine|teak|mdf"
    : /steel|iron|metal|حديد/i.test(d)
    ? "steel|iron|metal"
    : "";
export default function Home() {
  const [pricingResults, setPricingResults] = useState<PricingResult[]>([]);
  const [localItems, setLocalItems] = useState<BoqItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [debugMsg, setDebugMsg] = useState<string>("");
  const [filter, setFilter] = useState<
    "all" | "priced" | "unpriced" | "review" | "error" | "pending" | "estimated"
  >("all");
  const [pkg, setPkg] = useState<string>("all");
  const [reportType, setReportType] = useState<string>("all");
  const [reportSearch, setReportSearch] = useState<string>("");
  const [genSource, setGenSource] = useState<PricingResult | null>(null);
  const [genKeyword, setGenKeyword] = useState<string>("");
  const [genOverride, setGenOverride] = useState<Record<string, boolean>>({});
  const [genBusy, setGenBusy] = useState(false);
  const [sheetFilter, setSheetFilter] = useState<string>("all");
  const [smartTargets, setSmartTargets] = useState<TItem[]>([]);

  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string>("");
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const projRef = useRef("");
  projRef.current = currentProjectId;

  const [showReport, setShowReport] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<BoqItem | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [breakdownDetails, setBreakdownDetails] = useState<BreakdownDetails | null>(null);
  const [loadingBreakdown, setLoadingBreakdown] = useState(false);
  const [approving, setApproving] = useState(false);

  const [customLines, setCustomLines] = useState<BreakdownLine[]>([]);
  const [deletedLineIndices, setDeletedLineIndices] = useState<Set<number>>(new Set());
  const [editedLines, setEditedLines] = useState<
    Record<number, { quantity?: number; unit_rate?: number }>
  >({});

  const [tempSavedLines, setTempSavedLines] = useState<Set<number>>(new Set());

  const [customItem, setCustomItem] = useState<BoqItem | null>(null);

  const [wastagePct, setWastagePct] = useState<number>(5);
  const [overheadPct, setOverheadPct] = useState<number>(18);
  const [riskPct, setRiskPct] = useState<number>(3);
  const [profitPct, setProfitPct] = useState<number>(10);

  const [showAddLineForm, setShowAddLineForm] = useState(false);
  const [newLine, setNewLine] = useState<{
    component_type: ComponentType;
    name: string;
    quantity: number;
    unit: string;
    unit_rate: number;
  }>({
    component_type: "خامات",
    name: "",
    quantity: 1,
    unit: "",
    unit_rate: 0,
  });

  const makeId = () =>
    `proj-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const storageKeys = (projectId: string) => ({
    boq: `boqItems_${projectId}`,
    pricing: `pricingResults_${projectId}`,
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PROJECTS_KEY);
      let list: Project[] = raw ? JSON.parse(raw) : [];

      if (!Array.isArray(list) || list.length === 0) {
        const legacyBoq = localStorage.getItem("boqItems");
        const legacyPricing = localStorage.getItem("pricingResults");
        const id = makeId();
        list = [
          {
            id,
            name: "المشروع الحالي",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ];
        if (legacyBoq) localStorage.setItem(`boqItems_${id}`, legacyBoq);
        if (legacyPricing)
          localStorage.setItem(`pricingResults_${id}`, legacyPricing);
        localStorage.setItem(PROJECTS_KEY, JSON.stringify(list));
      }

      setProjects(list);
      const savedCurrent = localStorage.getItem(CURRENT_PROJECT_KEY);
      const valid = list.find((p) => p.id === savedCurrent);
      setCurrentProjectId(valid ? valid.id : list[0].id);
    } catch (e) {
      console.error("فشل تحميل المشروعات:", e);
    }
  }, []);

  useEffect(() => {
    if (!currentProjectId) return;
    try {
      const { boq, pricing } = storageKeys(currentProjectId);
      const savedBoq = localStorage.getItem(boq);
      const savedPricing = localStorage.getItem(pricing);
      setLocalItems(savedBoq ? JSON.parse(savedBoq) : []);
      setPricingResults(savedPricing ? JSON.parse(savedPricing) : []);
    } catch (e) {
      console.error("فشل تحميل بيانات المشروع:", e);
    }
    setHydrated(true);
  }, [currentProjectId]);

  useEffect(() => {
    if (!hydrated || !currentProjectId) return;
    try {
      const { boq } = storageKeys(currentProjectId);
      localStorage.setItem(boq, JSON.stringify(localItems));
    } catch (e) {
      console.error("فشل حفظ boqItems:", e);
    }
  }, [localItems, hydrated, currentProjectId]);

  useEffect(() => {
    if (!hydrated || !currentProjectId) return;
    try {
      const { pricing } = storageKeys(currentProjectId);
      localStorage.setItem(pricing, JSON.stringify(pricingResults));
    } catch (e) {
      console.error("فشل حفظ pricingResults:", e);
    }
  }, [pricingResults, hydrated, currentProjectId]);

  useEffect(() => {
    if (!hydrated || !currentProjectId) return;
    handleLoadFromSupabase(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, currentProjectId]);

  const switchProject = (id: string) => {
    if (id === currentProjectId) {
      setShowProjectMenu(false);
      return;
    }
    setCurrentProjectId(id);
    localStorage.setItem(CURRENT_PROJECT_KEY, id);
    setShowProjectMenu(false);
    setDebugMsg("تم التبديل للمشروع");
  };

  const createProject = () => {
    const name = prompt("اسم المشروع الجديد:");
    if (!name?.trim()) return;
    const id = makeId();
    const newProj: Project = {
      id,
      name: name.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = [...projects, newProj];
    setProjects(updated);
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(updated));
    setCurrentProjectId(id);
    localStorage.setItem(CURRENT_PROJECT_KEY, id);
    setDebugMsg(`تم إنشاء مشروع: ${newProj.name}`);
  };

  const renameProject = (id: string) => {
    const proj = projects.find((p) => p.id === id);
    if (!proj) return;
    const name = prompt("الاسم الجديد:", proj.name);
    if (!name?.trim()) return;
    const updated = projects.map((p) =>
      p.id === id
        ? { ...p, name: name.trim(), updatedAt: new Date().toISOString() }
        : p
    );
    setProjects(updated);
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(updated));
  };

  const deleteProject = (id: string) => {
    if (projects.length === 1) {
      alert("لازم يفضل مشروع واحد على الأقل");
      return;
    }
    if (!confirm("متأكد؟ هيتم حذف كل بيانات المشروع ده نهائيًا")) return;
    const updated = projects.filter((p) => p.id !== id);
    setProjects(updated);
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(updated));

    const { boq, pricing } = storageKeys(id);
    localStorage.removeItem(boq);
    localStorage.removeItem(pricing);

    if (currentProjectId === id) {
      const next = updated[0].id;
      setCurrentProjectId(next);
      localStorage.setItem(CURRENT_PROJECT_KEY, next);
    }
  };

  const scoped = useMemo(
    () =>
      pkg === "all"
        ? pricingResults
        : pricingResults.filter((r) => packageOf(r) === pkg),
    [pricingResults, pkg]
  );

  const aggregateComponents = useMemo(() => {
    const map = new Map<
      string,
      {
        component_type: string;
        price_key: string;
        name: string;
        unit: string;
        total_quantity: number;
        total_cost: number;
        items_count: number;
      }
    >();

    for (const r of scoped) {
      if (r.status !== "priced" || !r.lines) continue;
      const boqQty = r.quantity || 1;

      for (const line of r.lines) {
        const key = `${line.component_type}::${line.price_key}`;
        const prev = map.get(key);
        const lineQty = (line.quantity || 0) * boqQty;
        const lineCost = (line.total_cost || 0) * boqQty;

        if (prev) {
          prev.total_quantity += lineQty;
          prev.total_cost += lineCost;
          prev.items_count += 1;
        } else {
          map.set(key, {
            component_type: line.component_type,
            price_key: line.price_key,
            name: line.name,
            unit: line.unit,
            total_quantity: lineQty,
            total_cost: lineCost,
            items_count: 1,
          });
        }
      }
    }

    const byType: Record<string, Array<any>> = {
      خامات: [],
      مصنعيات: [],
      معدات: [],
      محملات: [],
    };

    for (const v of map.values()) {
      if (!byType[v.component_type]) byType[v.component_type] = [];
      byType[v.component_type].push(v);
    }

    for (const t of Object.keys(byType)) {
      byType[t].sort((a, b) => b.total_cost - a.total_cost);
    }

    return byType;
  }, [scoped]);

  const originalLines = breakdownDetails?.lines || [];
  const finalLines = [
    ...originalLines
      .map((line, idx) => {
        if (deletedLineIndices.has(idx)) return null;
        const edit = editedLines[idx];
        if (edit) {
          const q = edit.quantity ?? line.quantity;
          const r = edit.unit_rate ?? line.unit_rate;
          return {
            ...line,
            quantity: q,
            unit_rate: r,
            total_cost: Math.round(q * r * 100) / 100,
            original_rate: line.unit_rate,
          };
        }
        return line;
      })
      .filter((l): l is BreakdownLine => l !== null),
    ...customLines,
  ];

  const changedRateLines = finalLines.filter((l) => {
    if (l.isCustom) return false;
    return l.original_rate !== undefined && l.original_rate !== l.unit_rate;
  });

  const recalc = useCallback(() => {
    if (!breakdownDetails) return null;

    const direct = finalLines.reduce((s, l) => s + (l.total_cost || 0), 0);
    const w = (direct * wastagePct) / 100;
    const sub = direct + w;
    const o = (sub * overheadPct) / 100;
    const r = (sub * riskPct) / 100;
    const p = ((sub + o + r) * profitPct) / 100;
    const unitPrice = sub + o + r + p;
    const qty = selectedItem?.quantity || 1;
    const totalPrice = unitPrice * qty;

    return {
      direct_cost: Math.round(direct * 100) / 100,
      wastage_cost: Math.round(w * 100) / 100,
      subtotal: Math.round(sub * 100) / 100,
      overhead_cost: Math.round(o * 100) / 100,
      risk_cost: Math.round(r * 100) / 100,
      profit_cost: Math.round(p * 100) / 100,
      unit_price: Math.round(unitPrice * 100) / 100,
      total_price: Math.round(totalPrice * 100) / 100,
      unit_price_rounded: Math.round(unitPrice),
      total_price_rounded: Math.round(totalPrice),
    };
  }, [
    breakdownDetails,
    finalLines,
    selectedItem,
    wastagePct,
    overheadPct,
    riskPct,
    profitPct,
  ]);

  const handleTempSaveLine = (idx: number) => {
    setTempSavedLines((prev) => {
      const next = new Set(prev);
      next.add(idx);
      return next;
    });
  };

  const persistPrice = async (
    id: string | number | undefined,
    templateCode: string,
    templateName: string,
    unitPrice: number,
    totalPrice: number
  ) => {
    if (id == null) return;
    try {
      const { data: cur } = await supabase
        .from("boq_items")
        .select("price_result")
        .eq("id", id)
        .maybeSingle();
      const merged = {
        ...(cur?.price_result || {}),
        unit_price: unitPrice,
        total_price: totalPrice,
        name: templateName,
      };
      const { error } = await supabase
        .from("boq_items")
        .update({
          status: "priced",
          template_key: templateCode,
          price_result: merged,
        })
        .eq("id", id);
      if (error) console.warn("فشل حفظ السعر في Supabase:", error.message);
    } catch (e) {
      console.warn("فشل حفظ السعر في Supabase:", e);
    }
  };

  const openSmartPricing = () => {
    const targets: TItem[] = scoped
      .filter((r) => r.status !== "priced" && r.id != null)
      .map((r) => ({
        id: r.id,
        item_code: r.item_code,
        description: r.description,
        unit: r.unit,
        quantity: r.quantity,
        raw_qty: r.raw_qty,
        area_per_unit: areaOf(r),
        sheet_name: r.sheet_name,
      }));

    if (targets.length === 0) {
      alert("مفيش بنود غير مسعّرة في الباقة الحالية");
      return;
    }
    setSmartTargets(targets);
  };

  const estimateUnpriced = async (opts: { silent?: boolean; force?: boolean } = {}) => {
    if (!currentProjectId) return;
    setEstimating(true);
    try {
      let remaining = 1, guard = 0;
      const tot = { by_template: 0, by_ai: 0, by_anchor: 0, by_ratebook: 0, failed: 0 };
      const reasons = new Set<string>();
      const failedItems = new Set<string>();
      const skip: string[] = [];

      while (remaining > 0 && guard++ < 80) {
        setDebugMsg(
          `تسعير تقديري... قوالب ${tot.by_template} | مشابهة ${tot.by_anchor} | جدول ${tot.by_ratebook}` +
            (guard > 1 ? ` (متبقي ${remaining})` : "")
        );
        const res = await fetch("/api/boq/estimate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ project_id: currentProjectId, force: opts.force, skip_ids: skip }),
        });
        const j = await res.json();
        console.log("ESTIMATE RESPONSE", j);
        if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);

        tot.by_template += j.by_template || 0;
        tot.by_ai += j.by_ai || 0;
        tot.by_anchor += j.by_anchor || 0;
        tot.by_ratebook += j.by_ratebook || 0;
        tot.failed += j.failed || 0;
        (j.reasons ?? []).forEach((r: string) => reasons.add(r));
        (j.failed_items ?? []).forEach((x: string) => failedItems.add(x));
        skip.push(...(j.failed_ids ?? []));
        remaining = j.remaining || 0;
        if (!(j.processed > 0) && !(j.failed_ids?.length)) break;
      }

      await handleLoadFromSupabase(true);
      const done = tot.by_template + tot.by_ai + tot.by_anchor + tot.by_ratebook;
      const msg =
        `تم تسعير ${done} بند تقديريا: من القوالب ${tot.by_template} | AI ${tot.by_ai} | بنود مشابهة ${tot.by_anchor} | جدول مرجعي ${tot.by_ratebook}` +
        (tot.failed ? ` | تعذّر ${tot.failed}` : "") +
        (reasons.size ? `\n\n${Array.from(reasons).join("\n")}` : "");
      if (failedItems.size) console.log("BOQ ITEMS WITHOUT PRICE:\n" + Array.from(failedItems).join("\n"));
      setDebugMsg(msg.split("\n")[0]);
      if (!opts.silent || tot.failed || done === 0) alert(msg);
    } catch (err: any) {
      alert("خطأ في التسعير التقديري: " + err.message);
      setDebugMsg("خطأ: " + err.message);
    } finally {
      setEstimating(false);
    }
  };

  const handleImportToSupabase = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    if (!currentProjectId) {
      alert("مفيش مشروع محدد - اختار مشروع اولا");
      return;
    }

    setLoading(true);
    const summary: string[] = [];
    const problems: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setDebugMsg(`جاري استيراد ${i + 1}/${files.length}: ${file.name}`);

        try {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("project_id", currentProjectId);

          const res = await fetch("/api/boq/import", {
            method: "POST",
            body: formData,
          });
          const data = await res.json();

          if (!res.ok) {
            problems.push(
              `${file.name}: ${data.error || "unknown"}\n${(data.warnings || []).join("\n")}`
            );
            continue;
          }

          const names = (data.sheets || [])
            .map((x: any) => `${x.sheet} (${x.items})`)
            .join("، ");
          summary.push(`${file.name}: ${names}`);
        } catch (err: any) {
          problems.push(`${file.name}: ${err.message}`);
        }
      }

      await handleLoadFromSupabase(true);

      setDebugMsg(
        `تم استيراد ${summary.length} ملف من ${files.length}` +
          (summary.length ? " — " + summary.join(" | ") : "")
      );

      await estimateUnpriced({ silent: true });

      if (problems.length) alert("مشاكل في بعض الملفات:\n\n" + problems.join("\n\n"));
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  const handleLoadFromSupabase = async (silent = false) => {
    if (!currentProjectId) {
      if (!silent) alert("مفيش مشروع محدد");
      return;
    }

    const pid = currentProjectId;
    if (!silent) setLoading(true);
    try {
      const { data: sheetRows } = await supabase
        .from("boq_sheets")
        .select("id,sheet_name")
        .eq("project_id", pid);
      const sheetNames = new Map<string, string>(
        (sheetRows ?? []).map((x: any) => [String(x.id), x.sheet_name as string])
      );

      const all: any[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from("boq_items")
          .select("*")
          .eq("project_id", pid)
          .order("sheet_id", { ascending: true })
          .order("row_no", { ascending: true })
          .range(from, from + 999);

        if (error) {
          if (!silent) alert("فشل التحميل: " + error.message);
          else console.warn("فشل التحميل:", error.message);
          return;
        }
        all.push(...(data || []));
        if (!data || data.length < 1000) break;
      }

      if (projRef.current !== pid) return;

      if (all.length === 0) {
        if (!silent) {
          setDebugMsg(
            `مفيش بنود للمشروع ده في Supabase (project_id: ${pid})`
          );
          setPricingResults([]);
        }
        return;
      }

      const results: PricingResult[] = all.map((r: any) => {
        const pr = r.price_result || {};
        const qty = Number(r.qty || 0);
        const unitPrice = Number(pr.unit_price || 0);
        const totalPrice =
          pr.custom === true || pr.estimated === true
            ? Number(pr.total_price || 0)
            : unitPrice * qty;
        return {
          id: r.id,
          sheet_id: r.sheet_id,
          sheet_name: sheetNames.get(String(r.sheet_id)) || "",
          db_status: r.status || "",
          area_per_unit: r.area_per_unit ?? null,
          raw_qty: qty,
          item_code: r.item_code || "",
          description: r.description || "",
          unit: r.unit || "",
          quantity: qty,
          unit_price: unitPrice,
          total_price: totalPrice,
          template_code:
            pr.estimated === true
              ? "ESTIMATED"
              : pr.custom === true
              ? "CUSTOM"
              : r.template_key || "",
          template_name: pr.name || "",
          status:
            r.status === "priced" || pr.estimated === true
              ? "priced"
              : r.status === "error"
              ? "error"
              : "unpriced",
          error:
            r.error_reason ||
            (pr.ok === false ? pr.error || undefined : undefined),
          lines: Array.isArray(pr.lines) ? pr.lines : undefined,
          estimated: pr.estimated === true,
          estimated_confidence: pr.confidence,
          estimated_basis: pr.basis,
          estimated_rationale: pr.rationale,
          estimated_assumptions: pr.assumptions,
        };
      });

      setPricingResults((prev) => {
        const linesById = new Map<string, BreakdownLine[]>();
        for (const p of prev) {
          if (p.id != null && p.lines) linesById.set(String(p.id), p.lines);
        }
        return results.map((r) => {
          const l = linesById.get(String(r.id));
          return !r.lines && l ? { ...r, lines: l } : r;
        });
      });
      setDebugMsg(`تم تحميل ${results.length} بند للمشروع الحالي`);
    } catch (err: any) {
      if (!silent) alert("خطأ: " + err.message);
      else console.warn(err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleRepriceAllFromSupabase = async () => {
    if (!confirm("هيعيد المطابقة والتسعير لبنود المشروع الحالي فقط؟")) return;

    setLoading(true);
    setDebugMsg("جاري المطابقة وإعادة التسعير");
    try {
      const { data: sheets, error: sErr } = await supabase
        .from("boq_sheets")
        .select("id")
        .eq("project_id", currentProjectId);
      if (sErr) throw new Error(sErr.message);

      const ids = (sheets ?? []).map((s: any) => s.id);
      if (ids.length === 0) {
        alert("مفيش شيتات للمشروع ده - استورد ملف الأول");
        return;
      }

      const m = await supabase.rpc("match_boq_items", {
        p_sheet_ids: ids,
        p_auto: 0.75,
        p_review: 0.45,
        p_margin: 0.1,
      });
      if (m.error) throw new Error("match: " + m.error.message);

      const p = await supabase.rpc("price_matched_items", {
        p_sheet_ids: ids,
        p_answers: {},
      });
      if (p.error) throw new Error("price: " + p.error.message);

      await handleLoadFromSupabase(true);

      await estimateUnpriced({ silent: true });

      setDebugMsg("تم إعادة المطابقة والتسعير + التقدير التلقائي");
    } catch (err: any) {
      alert("خطأ: " + err.message);
      setDebugMsg("خطأ: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRepriceItem = async (
    item: BoqItem,
    opts: { silent?: boolean; template?: string } = {}
  ): Promise<boolean> => {
    const { silent = false, template } = opts;
    try {
      if (template === "CUSTOM" || template === "ESTIMATED") {
        if (!silent)
          alert(
            `البند ${item.item_code} مسعّر ${
              template === "ESTIMATED" ? "تقديريًا" : "ببريك داون مخصص"
            } — افتح ${
              template === "ESTIMATED" ? "«اعتماد/تعديل»" : "«مخصص»"
            } لتعديله`
          );
        return false;
      }

      let templateCode = template || "";
      let candidateName = "";

      if (!templateCode) {
        const { data: matchData, error: matchError } = await supabase.rpc(
          "resolve_breakdown_template",
          {
            p_item_code: item.item_code || "",
            p_desc: item.description || "",
            p_unit: item.unit || "",
          }
        );

        if (matchError || !matchData?.template) {
          if (!silent) alert(`مفيش قالب مناسب للبند ${item.item_code}`);
          return false;
        }
        templateCode = matchData.template;
        candidateName = matchData.candidates?.[0]?.name || "";
      }

      const { data: defaultAns } = await supabase
        .from("template_default_answers")
        .select("answers")
        .eq("template_item_code", templateCode)
        .maybeSingle();

      const approvedAnswers = defaultAns?.answers || {};

      const { data: priceData, error: priceError } = await supabase.rpc(
        "price_recipe_for_boq",
        {
          p_template: templateCode,
          p_desc: item.description || "",
          p_unit: item.unit || "",
          p_qty: item.quantity || 1,
          p_answers: approvedAnswers,
        }
      );

      if (priceError || !priceData?.ok) {
        if (!silent) alert(`فشل: ${priceData?.error || priceError?.message}`);
        return false;
      }

      const unitPrice = unitPriceFromDirect(
        priceData.direct_cost || 0,
        approvedAnswers
      );
      const totalPrice = Math.round(unitPrice * (item.quantity || 1));
      const name = priceData.name || candidateName || templateCode;

      setPricingResults((prev) =>
        prev.map((x) =>
          sameItem(x, item)
            ? {
                ...x,
                unit_price: unitPrice,
                total_price: totalPrice,
                template_code: templateCode,
                template_name: name,
                status: "priced",
                db_status: "priced",
                error: undefined,
                lines: priceData.lines || [],
                estimated: false,
              }
            : x
        )
      );

      await persistPrice(item.id, templateCode, name, unitPrice, totalPrice);

      if (!silent)
        alert(
          `تم إعادة تسعير ${item.item_code}\n` +
            `سعر الوحدة: ${unitPrice.toLocaleString("ar-EG")} ج.م\n` +
            `الإجمالي: ${totalPrice.toLocaleString("ar-EG")} ج.م`
        );
      return true;
    } catch (err: any) {
      if (!silent) alert("خطأ: " + err.message);
      return false;
    }
  };

  const handleAddLine = () => {
    if (!newLine.name.trim()) {
      alert("اكتب اسم المكوّن");
      return;
    }
    if (newLine.quantity <= 0) {
      alert("الكمية لازم تكون أكبر من 0");
      return;
    }

    const line: BreakdownLine = {
      id: `custom-${Date.now()}-${Math.random()}`,
      component_type: newLine.component_type,
      price_key: `custom-${Date.now()}`,
      name: newLine.name.trim(),
      quantity: newLine.quantity,
      unit: newLine.unit.trim() || "—",
      unit_rate: newLine.unit_rate,
      total_cost: Math.round(newLine.quantity * newLine.unit_rate * 100) / 100,
      isCustom: true,
    };

    setCustomLines((prev) => [...prev, line]);
    setNewLine({
      component_type: "خامات",
      name: "",
      quantity: 1,
      unit: "",
      unit_rate: 0,
    });
    setShowAddLineForm(false);
  };

  const handleEditOriginalLine = (
    idx: number,
    field: "quantity" | "unit_rate",
    value: number
  ) => {
    setEditedLines((prev) => ({
      ...prev,
      [idx]: { ...prev[idx], [field]: value },
    }));
  };

  const handleDeleteOriginalLine = (idx: number) => {
    if (!confirm("متأكد إنك عايز تحذف السطر ده؟")) return;
    setDeletedLineIndices((prev) => {
      const next = new Set(prev);
      next.add(idx);
      return next;
    });
    setTempSavedLines((prev) => {
      const next = new Set(prev);
      next.delete(idx);
      return next;
    });
  };

  const handleDeleteCustomLine = (id?: string) => {
    if (!id) return;
    if (!confirm("متأكد إنك عايز تحذف السطر ده؟")) return;
    setCustomLines((prev) => prev.filter((l) => l.id !== id));
  };

  const handleResetLines = () => {
    if (!confirm("هترجع لكل السطور الأصلية؟")) return;
    setCustomLines([]);
    setDeletedLineIndices(new Set());
    setEditedLines({});
    setTempSavedLines(new Set());
    setWastagePct(5);
    setOverheadPct(18);
    setRiskPct(3);
    setProfitPct(10);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setDebugMsg("جاري قراءة الملف");
    try {
      const items = await parseBoqFile(file);
      setLocalItems(items);
      setPricingResults([]);
      try {
        if (currentProjectId) {
          const { pricing } = storageKeys(currentProjectId);
          localStorage.removeItem(pricing);
        }
      } catch {}
      setDebugMsg(`تم رفع ${items.length} بند - جاهز للتسعير`);
    } catch (err: any) {
      alert("فشل قراءة الملف: " + err.message);
      setDebugMsg("فشل قراءة الملف: " + err.message);
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  const handleAutoPricing = async () => {
    setDebugMsg(`بدأ التسعير - عدد البنود: ${localItems.length}`);
    if (localItems.length === 0) {
      alert("مفيش بنود - ارفع ملف BOQ اولا");
      return;
    }

    setLoading(true);
    setProgress({ current: 0, total: localItems.length });
    const results: PricingResult[] = [];

    for (let i = 0; i < localItems.length; i++) {
      const item = localItems[i];
      setProgress({ current: i + 1, total: localItems.length });

      const base = {
        item_code: item.item_code,
        description: item.description,
        unit: item.unit,
        quantity: item.quantity,
      };

      try {
        const { data: matchData, error: matchError } = await supabase.rpc(
          "resolve_breakdown_template",
          {
            p_item_code: item.item_code || "",
            p_desc: item.description || "",
            p_unit: item.unit || "",
          }
        );

        if (matchError || !matchData?.template) {
          results.push({
            ...base,
            unit_price: 0,
            total_price: 0,
            template_code: "",
            template_name: "",
            status: "unpriced",
            error: matchData?.error || matchError?.message || "no_template",
          });
          continue;
        }

        const templateCode = matchData.template;

        const { data: defaultAns } = await supabase
          .from("template_default_answers")
          .select("answers")
          .eq("template_item_code", templateCode)
          .maybeSingle();

        const approvedAnswers = defaultAns?.answers || {};

        const { data: priceData, error: priceError } = await supabase.rpc(
          "price_recipe_for_boq",
          {
            p_template: templateCode,
            p_desc: item.description || "",
            p_unit: item.unit || "",
            p_qty: item.quantity || 1,
            p_answers: approvedAnswers,
          }
        );

        if (priceError || !priceData?.ok) {
          results.push({
            ...base,
            unit_price: 0,
            total_price: 0,
            template_code: templateCode,
            template_name:
              matchData.candidates?.[0]?.name || matchData.template || "",
            status: "error",
            error: priceData?.error || priceError?.message || "pricing_failed",
          });
          continue;
        }

        const unitPrice = unitPriceFromDirect(
          priceData.direct_cost || 0,
          approvedAnswers
        );
        const totalPrice = Math.round(unitPrice * (item.quantity || 1));

        results.push({
          ...base,
          unit_price: unitPrice,
          total_price: totalPrice,
          template_code: templateCode,
          template_name:
            priceData.name ||
            matchData.candidates?.[0]?.name ||
            matchData.template ||
            "",
          status: "priced",
          lines: priceData.lines || [],
          estimated: false,
        });
      } catch (err: any) {
        results.push({
          ...base,
          unit_price: 0,
          total_price: 0,
          template_code: "",
          template_name: "",
          status: "error",
          error: err.message,
        });
      }
    }

    const pricedCount = results.filter((r) => r.status === "priced").length;
    const unpricedCount = results.filter((r) => r.status === "unpriced").length;
    const errorCount = results.filter((r) => r.status === "error").length;
    const totalVal = results
      .filter((r) => r.status === "priced")
      .reduce((s, r) => s + r.total_price, 0);

    setDebugMsg(
      `خلص - مسعر: ${pricedCount} | غير مسعر: ${unpricedCount} | اخطاء: ${errorCount} | الإجمالي: ${Math.round(
        totalVal
      ).toLocaleString("ar-EG")} ج.م`
    );

    setPricingResults(results);
    setLoading(false);
  };

  const openBreakdownModal = async (r: PricingResult) => {
    const item = toBoqItem(r);

    if (r.template_code === "CUSTOM" || r.template_code === "ESTIMATED") {
      setCustomItem(toBoqItem(r, true));
      return;
    }

    setSelectedItem(item);
    setIsModalOpen(true);
    setBreakdownDetails(null);
    setAnswers({});
    setQuestions([]);
    setLoadingQuestions(true);
    setLoadingBreakdown(true);
    setCustomLines([]);
    setDeletedLineIndices(new Set());
    setEditedLines({});
    setTempSavedLines(new Set());
    setShowAddLineForm(false);
    setWastagePct(5);
    setOverheadPct(18);
    setRiskPct(3);
    setProfitPct(10);

    const goCustom = () => {
      setBreakdownDetails(null);
      setIsModalOpen(false);
      setLoadingQuestions(false);
      setLoadingBreakdown(false);
      setCustomItem(toBoqItem(r, true));
    };

    try {
      let templateCode: string | null = r.template_code || null;

      try {
        let q = supabase.from("boq_items").select("template_key");
        q =
          item.id != null
            ? q.eq("id", item.id)
            : q
                .eq("item_code", item.item_code || "")
                .eq("unit", item.unit || "")
                .eq("project_id", currentProjectId);
        const { data: boqRow } = await q.limit(1).maybeSingle();
        if (boqRow?.template_key) templateCode = boqRow.template_key;
      } catch (e) {
        console.warn("فشل قراءة boq_items:", e);
      }

      if (templateCode === "CUSTOM" || templateCode === "ESTIMATED") {
        goCustom();
        return;
      }

      if (!templateCode) {
        const { data: matchData, error: matchError } = await supabase.rpc(
          "resolve_breakdown_template",
          {
            p_item_code: item.item_code || "",
            p_desc: item.description || "",
            p_unit: item.unit || "",
          }
        );

        if (matchError || !matchData?.template) {
          goCustom();
          return;
        }
        templateCode = matchData.template;
      }

      if (!templateCode) {
        goCustom();
        return;
      }

      setSelectedTemplate(templateCode);

      const { data: qData } = await supabase
        .from("breakdown_questions")
        .select("*")
        .eq("template_item_code", templateCode)
        .order("sort_order", { ascending: true });

      setQuestions(qData || []);
      setLoadingQuestions(false);

      const { data: defaultAns } = await supabase
        .from("template_default_answers")
        .select("answers")
        .eq("template_item_code", templateCode)
        .maybeSingle();

      const approvedAnswers = defaultAns?.answers || {};

      if (approvedAnswers._wastage_pct !== undefined)
        setWastagePct(Number(approvedAnswers._wastage_pct));
      if (approvedAnswers._overhead_pct !== undefined)
        setOverheadPct(Number(approvedAnswers._overhead_pct));
      if (approvedAnswers._risk_pct !== undefined)
        setRiskPct(Number(approvedAnswers._risk_pct));
      if (approvedAnswers._profit_pct !== undefined)
        setProfitPct(Number(approvedAnswers._profit_pct));

      const initialAnswers: Record<string, any> = { ...approvedAnswers };
      (qData || []).forEach((q: Question) => {
        if (initialAnswers[q.id] === undefined && q.default_answer !== null) {
          initialAnswers[q.id] = q.default_answer;
        }
      });
      setAnswers(initialAnswers);

      await calculateBreakdown(templateCode, item, initialAnswers);
    } catch (err: any) {
      setBreakdownDetails({ ok: false, error: err.message });
      setLoadingQuestions(false);
      setLoadingBreakdown(false);
    }
  };

  const calculateBreakdown = useCallback(
    async (
      templateCode: string,
      item: BoqItem,
      currentAnswers: Record<string, any>
    ) => {
      setLoadingBreakdown(true);
      try {
        const { data, error } = await supabase.rpc("price_recipe_for_boq", {
          p_template: templateCode,
          p_desc: item.description || "",
          p_unit: item.unit || "",
          p_qty: item.quantity || 1,
          p_answers: currentAnswers,
        });

        if (error) {
          setBreakdownDetails({ ok: false, error: error.message });
          return;
        }

        if (data && data.ok === true) {
          setBreakdownDetails(data as BreakdownDetails);
        } else {
          setBreakdownDetails({
            ok: false,
            error: data?.error || "unknown_error",
          });
        }
      } catch (err: any) {
        setBreakdownDetails({ ok: false, error: err.message });
      } finally {
        setLoadingBreakdown(false);
      }
    },
    []
  );

  const handleReanalyze = async () => {
    if (!selectedTemplate || !selectedItem) return;
    setCustomLines([]);
    setDeletedLineIndices(new Set());
    setEditedLines({});
    setTempSavedLines(new Set());
    await calculateBreakdown(selectedTemplate, selectedItem, answers);
  };

  const handleApprove = async () => {
    if (!selectedTemplate || !selectedItem) return;

    const qtyOverrides: Record<string, number> = {};
    Object.entries(editedLines).forEach(([idxStr, edit]) => {
      const idx = parseInt(idxStr, 10);
      const originalLine = originalLines[idx];
      if (originalLine && edit.quantity !== undefined) {
        const key = `${originalLine.component_type}:${originalLine.price_key}`;
        qtyOverrides[key] = edit.quantity;
      }
    });

    const confirmMsg =
      `هل أنت متأكد من الاعتماد النهائي؟\n\n` +
      `- هيتسجل النسب والإجابات\n` +
      `- هيتسجل ${changedRateLines.length} سعر في بنك الأسعار\n` +
      `- هيتسجل ${Object.keys(qtyOverrides).length} تعديل كمية\n` +
      `- هيتسعر البنود المسعّرة بالفعل (عدا المخصصة وعدا اللي تحتاج مراجعة)\n\n` +
      (customLines.length > 0 || deletedLineIndices.size > 0
        ? `تنبيه: فيه ${customLines.length} سطر مضاف و ${deletedLineIndices.size} سطر محذوف ` +
          `ومش هيتحفظوا بالاعتماد ده (الاعتماد بيحفظ النسب والإجابات وتعديل الأسعار الموجودة بس).\n` +
          `لحفظ الإضافات والحذف اضغط إلغاء ثم «حفظ كبريك داون مخصص».\n\n`
        : "") +
      `هذا الإجراء يؤثر على كل المقايسة.`;

    if (!confirm(confirmMsg)) return;

    setApproving(true);
    try {
      const answersWithPcts = {
        ...answers,
        _wastage_pct: wastagePct,
        _overhead_pct: overheadPct,
        _risk_pct: riskPct,
        _profit_pct: profitPct,
        _line_qty: qtyOverrides,
      };

      const { error } = await supabase
        .from("template_default_answers")
        .upsert(
          {
            template_item_code: selectedTemplate,
            answers: answersWithPcts,
            approved_at: new Date().toISOString(),
            approved_by: "user",
          },
          { onConflict: "template_item_code" }
        );

      if (error) {
        alert("فشل حفظ الإجابات: " + error.message);
        return;
      }

      let savedRatesCount = 0;
      const failedTables: string[] = [];

      for (const line of changedRateLines) {
        if (!line.price_key || line.isCustom) continue;

        const mapping = TYPE_TO_TABLE[line.component_type];
        if (!mapping) continue;

        const { table, rateColumn } = mapping;

        const { error: rateError } = await supabase
          .from(table)
          .update({ [rateColumn]: line.unit_rate })
          .eq("code", line.price_key);

        if (!rateError) savedRatesCount++;
        else failedTables.push(table);
      }

      setDebugMsg(`جاري إعادة تسعير كل البنود`);
      const newResults = [...pricingResults];
      let updatedCount = 0;

      for (let i = 0; i < newResults.length; i++) {
        const r = newResults[i];
        setDebugMsg(`${i + 1}/${newResults.length} - ${r.item_code}`);

        if (r.template_code === "CUSTOM" || r.template_code === "ESTIMATED") continue;
        if (r.status !== "priced") continue;

        try {
          let templateCode = r.template_code;
          let candidateName = "";

          if (!templateCode) {
            const { data: matchData } = await supabase.rpc(
              "resolve_breakdown_template",
              {
                p_item_code: r.item_code || "",
                p_desc: r.description || "",
                p_unit: r.unit || "",
              }
            );
            if (!matchData?.template) continue;
            templateCode = matchData.template;
            candidateName = matchData.candidates?.[0]?.name || "";
          }

          const { data: defaultAns } = await supabase
            .from("template_default_answers")
            .select("answers")
            .eq("template_item_code", templateCode)
            .maybeSingle();

          const approvedAnswers = defaultAns?.answers || {};

          const { data: priceData } = await supabase.rpc(
            "price_recipe_for_boq",
            {
              p_template: templateCode,
              p_desc: r.description || "",
              p_unit: r.unit || "",
              p_qty: r.quantity || 1,
              p_answers: approvedAnswers,
            }
          );

          if (!priceData?.ok) continue;

          const unitPrice = unitPriceFromDirect(
            priceData.direct_cost || 0,
            approvedAnswers
          );
          const totalPrice = Math.round(unitPrice * (r.quantity || 1));
          const name = priceData.name || candidateName || templateCode;

          newResults[i] = {
            ...r,
            unit_price: unitPrice,
            total_price: totalPrice,
            template_code: templateCode,
            template_name: name,
            status: "priced",
            db_status: "priced",
            error: undefined,
            lines: priceData.lines || [],
            estimated: false,
          };
          await persistPrice(r.id, templateCode, name, unitPrice, totalPrice);
          updatedCount++;
        } catch (err) {
          console.error(`فشل إعادة تسعير ${r.item_code}:`, err);
        }
      }

      setPricingResults(newResults);

      let msg =
        `تم الاعتماد بنجاح\n\n` +
        `تم حفظ ${savedRatesCount} سعر في بنك الأسعار\n` +
        `تم حفظ ${Object.keys(qtyOverrides).length} تعديل كمية\n` +
        `تم إعادة تسعير ${updatedCount} بند\n`;

      if (failedTables.length > 0) {
        msg += `\nفشل تحديث جداول: ${[...new Set(failedTables)].join(", ")}`;
      }

      setDebugMsg(`خلص - ${updatedCount} بند اتحدث`);
      alert(msg);

      setTempSavedLines(new Set());
    } finally {
      setApproving(false);
    }
  };

  const handleSaveAsCustom = async () => {
    if (!selectedItem) return;
    if (selectedItem.id == null) {
      alert("البند غير موجود في Supabase — استورد الملف الأول");
      return;
    }
    if (finalLines.length === 0) {
      alert("مفيش مكوّنات للحفظ");
      return;
    }
    const applySimilar = confirm(
      "تطبّق نفس البريك داون على البنود المشابهة (نفس الوصف والوحدة)؟\n\nموافق = نعم، إلغاء = للبند ده فقط"
    );

    setApproving(true);
    try {
      const r = pricingResults.find((x) => sameItem(x, selectedItem));
      const totalQty =
        r?.area_per_unit && r?.raw_qty
          ? r.raw_qty * r.area_per_unit
          : selectedItem.quantity || 1;

      const lines = finalLines.map((l) => ({
        component_type: l.component_type,
        price_key: l.isCustom ? null : l.price_key,
        name_ar: l.name,
        unit: l.unit,
        qty: l.quantity,
        rate: l.unit_rate,
        is_new: !!l.isCustom,
      }));

      const { data, error } = await supabase.rpc("save_custom_breakdown", {
        p_item: selectedItem.id,
        p_lines: lines,
        p_ratios: {
          wastage: wastagePct,
          overhead: overheadPct,
          risk: riskPct,
          profit: profitPct,
        },
        p_qty: totalQty,
      });

      if (error || !data?.ok) {
        alert("فشل الحفظ: " + (error?.message || "unknown"));
        return;
      }

      let extra = "";
      if (applySimilar) {
        const { data: ap } = await supabase.rpc("apply_custom_to_similar", {
          p_item: selectedItem.id,
        });
        if (ap?.ok) extra = `\nتم تطبيقه على ${ap.applied} بند مشابه`;
      }

      setPricingResults((prev) =>
        prev.map((x) =>
          sameItem(x, selectedItem)
            ? {
                ...x,
                unit_price: data.unit_price,
                total_price: data.total_price,
                template_code: "CUSTOM",
                template_name: "بريك داون مخصص",
                status: "priced",
                db_status: "priced",
                error: undefined,
                estimated: false,
              }
            : x
        )
      );
      setIsModalOpen(false);
      await handleLoadFromSupabase(true);
      alert(
        `تم الحفظ كبريك داون مخصص\nسعر الوحدة: ${Number(
          data.unit_price
        ).toLocaleString("ar-EG")} ج.م` + extra
      );
    } finally {
      setApproving(false);
    }
  };

  const updateAnswer = (questionId: number, value: any) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleExport = async () => {
    if (pricingResults.length === 0) {
      alert("لا توجد نتائج للتصدير");
      return;
    }

    const XLSX = await import("xlsx");

    const exportData = pricingResults.map((r) => ({
      "كود البند": r.item_code,
      الوصف: r.description,
      الوحدة: r.unit,
      الكمية: r.quantity,
      "سعر الوحدة": Math.round(r.unit_price),
      الإجمالي: Math.round(r.total_price),
      القالب: r.template_code,
      "اسم القالب": r.template_name,
      الحالة: statusText(r),
      تقديري: r.estimated ? "نعم" : "لا",
      "ثقة التقدير": r.estimated_confidence || "",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "BOQ Pricing");

    const allAgg: any[] = [];
    for (const t of Object.keys(aggregateComponents)) {
      for (const c of aggregateComponents[t]) {
        allAgg.push({
          النوع: c.component_type,
          الاسم: c.name,
          الوحدة: c.unit,
          "الكمية الإجمالية": Math.round(c.total_quantity * 100) / 100,
          "التكلفة الإجمالية": Math.round(c.total_cost),
          "عدد البنود": c.items_count,
        });
      }
    }
    if (allAgg.length > 0) {
      const ws2 = XLSX.utils.json_to_sheet(allAgg);
      XLSX.utils.book_append_sheet(wb, ws2, "تجميع الخامات");
    }

    const proj = projects.find((p) => p.id === currentProjectId);
    const safeName = (proj?.name || "BOQ").replace(/[\\/:*?"<>|]/g, "_");
    XLSX.writeFile(
      wb,
      `${safeName}_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  const clearStorage = async () => {
    if (!confirm("هتمسح كل بيانات المشروع الحالي (المحلي + Supabase)؟")) return;
    if (!currentProjectId) return;

    try {
      const { boq, pricing } = storageKeys(currentProjectId);
      localStorage.removeItem(boq);
      localStorage.removeItem(pricing);
    } catch {}

    try {
      const { error: e1 } = await supabase
        .from("boq_sheets")
        .delete()
        .eq("project_id", currentProjectId);
      if (e1) console.warn("فشل مسح الشيتات:", e1.message);

      const { error: e2 } = await supabase
        .from("boq_items")
        .delete()
        .eq("project_id", currentProjectId);
      if (e2) console.warn("فشل مسح البنود:", e2.message);
    } catch (e) {
      console.warn("فشل مسح Supabase:", e);
    }

    setLocalItems([]);
    setPricingResults([]);
    setDebugMsg("تم مسح بيانات المشروع من المتصفح و Supabase");
  };

  const isReview = (r: PricingResult) =>
    r.db_status === "review" && !r.estimated;

  const stats = {
    total: scoped.length,
    priced: scoped.filter((r) => r.status === "priced" && !r.estimated).length,
    estimated: scoped.filter((r) => r.estimated === true).length,
    review: scoped.filter(isReview).length,
    unpriced: scoped.filter((r) => r.status === "unpriced" && !isReview(r)).length,
    errors: scoped.filter((r) => r.status === "error").length,
    totalValue: scoped
      .filter((r) => r.status === "priced" && !r.estimated)
      .reduce((sum, r) => sum + r.total_price, 0),
    estimatedValue: scoped
      .filter((r) => r.estimated === true)
      .reduce((sum, r) => sum + r.total_price, 0),
  };

  const pkgCounts: Record<string, number> = {};
  for (const r of pricingResults) {
    const k = packageOf(r);
    pkgCounts[k] = (pkgCounts[k] || 0) + 1;
  }

  const sheetOptions = Array.from(
    new Set(scoped.map((r) => r.sheet_name).filter(Boolean))
  ) as string[];

  const matchFilter = (r: PricingResult) =>
    filter === "all"
      ? true
      : filter === "estimated"
      ? r.estimated === true
      : filter === "priced"
      ? r.status === "priced" && !r.estimated
      : filter === "error"
      ? r.status === "error"
      : filter === "review"
      ? isReview(r)
      : filter === "unpriced"
      ? r.status === "unpriced" && !isReview(r)
      : r.status !== "priced";

  const visibleResults = scoped.filter(
    (r) => matchFilter(r) && (sheetFilter === "all" || r.sheet_name === sheetFilter)
  );

  const genCandidates = useMemo(() => {
    if (!genSource) return [] as PricingResult[];
    const words = genKeyword.split("|").map((w) => w.trim()).filter(Boolean);
    if (words.length === 0) return [] as PricingResult[];
    const re = new RegExp(words.map(escapeRe).join("|"), "i");
    return pricingResults.filter(
      (x) =>
        x.id != null &&
        !sameItem(x, genSource) &&
        x.template_code !== "CUSTOM" &&
        x.template_code !== "ESTIMATED" &&
        re.test(x.description) &&
        areaOf(x) != null
    );
  }, [genSource, genKeyword, pricingResults]);

  const genChecked = (x: PricingResult) =>
    genOverride[String(x.id)] ?? x.status !== "priced";
  const genSelected = genCandidates.filter(genChecked);

  const handleGeneralize = async () => {
    if (!genSource) return;
    const srcArea = areaOf(genSource);
    if (!srcArea) {
      alert("مساحة البند المصدر غير معروفة");
      return;
    }
    if (genSelected.length === 0) {
      alert("مفيش بنود محددة");
      return;
    }
    if (!confirm(`هتطبّق البريك داون على ${genSelected.length} بند؟`)) return;

    setGenBusy(true);
    try {
      const { data: saved, error } = await supabase.rpc("load_custom_breakdown", {
        p_item: genSource.id,
      });
      if (error || !saved?.lines?.length) {
        alert("فشل تحميل بريك داون المصدر: " + (error?.message || "مفيش مكونات"));
        return;
      }
      const ratios = saved.ratios || { wastage: 5, overhead: 18, risk: 3, profit: 10 };

      let ok = 0;
      const failed: string[] = [];
      for (let i = 0; i < genSelected.length; i++) {
        const t = genSelected[i];
        setDebugMsg(`تعميم ${i + 1}/${genSelected.length} - ${t.item_code}`);
        const area = areaOf(t) as number;
        const k = area / srcArea;
        const lines = saved.lines.map((l: any) => ({
          ...l,
          qty: /^(m2|م2|م²)$/i.test(String(l.unit || "").trim())
            ? Math.round(Number(l.qty) * k * 1000) / 1000
            : l.qty,
        }));
        const totalQty = t.raw_qty ? t.raw_qty * area : t.quantity || 1;
        const { data, error: e } = await supabase.rpc("save_custom_breakdown", {
          p_item: t.id,
          p_lines: lines,
          p_ratios: ratios,
          p_qty: totalQty,
        });
        if (e || !data?.ok) failed.push(t.item_code);
        else ok++;
      }

      await handleLoadFromSupabase(true);
      setDebugMsg(`تم تعميم البريك داون على ${ok} بند`);
      alert(
        `تم تسعير ${ok} بند من ${genSelected.length}` +
          (failed.length ? `\nفشل: ${failed.join("، ")}` : "")
      );
      setGenSource(null);
    } finally {
      setGenBusy(false);
    }
  };

  const localOnly =
    pricingResults.length > 0 && pricingResults.every((r) => r.id == null);

  const totals = recalc();
  const currentProject = projects.find((p) => p.id === currentProjectId);

  // ═══════════════════════════════════════════════════════════
  // 🆕 دالة مساعدة: كارت رأس المودال (يستخدم في مكانين)
  // ═══════════════════════════════════════════════════════════
  const renderItemHeaderCard = (opts: {
    code?: string;
    description?: string;
    unit?: string;
    quantity?: number | string;
  }) => (
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
        maxHeight: 200,
        overflowY: "auto",
        boxShadow: "inset 0 1px 2px rgba(255,255,255,0.8)",
      }}
    >
      {/* شريط المعلومات العلوي */}
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
          <strong>كود:</strong>&nbsp;{opts.code || "—"}
        </span>
        <span style={chipStyle("#dcfce7", "#166534")}>
          <strong>الوحدة:</strong>&nbsp;{opts.unit || "—"}
        </span>
        {opts.quantity !== undefined && opts.quantity !== null && (
          <span style={chipStyle("#fef3c7", "#92400e")}>
            <strong>الكمية:</strong>&nbsp;{opts.quantity}
          </span>
        )}
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
        {opts.description || "—"}
      </div>
    </div>
  );

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
  return (
    <div className="container">
      {/* ═══ شريط المشروع ═══ */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 14px",
          background: "#f8f9fa",
          border: "1px solid #e0e0e0",
          borderRadius: 10,
          marginBottom: 16,
          position: "relative",
        }}
      >
        <span style={{ fontSize: 13, color: "#666", fontWeight: 600 }}>
          المشروع:
        </span>

        <div style={{ position: "relative" }}>
          <button
            className="btn-secondary"
            onClick={() => setShowProjectMenu((v) => !v)}
            type="button"
            style={{ minWidth: 180, textAlign: "right" }}
          >
            {currentProject?.name || "—"} v
          </button>

          {showProjectMenu && (
            <>
              <div
                onClick={() => setShowProjectMenu(false)}
                style={{ position: "fixed", inset: 0, zIndex: 40 }}
              />
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  right: 0,
                  marginTop: 6,
                  background: "white",
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
                  minWidth: 280,
                  zIndex: 50,
                  maxHeight: 320,
                  overflowY: "auto",
                }}
              >
                {projects.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "8px 12px",
                      borderBottom: "1px solid #f0f0f0",
                      background:
                        p.id === currentProjectId ? "#eaf4fc" : "transparent",
                    }}
                  >
                    <button
                      onClick={() => switchProject(p.id)}
                      type="button"
                      style={{
                        flex: 1,
                        textAlign: "right",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        fontSize: 13,
                        fontWeight: p.id === currentProjectId ? 700 : 400,
                      }}
                    >
                      {p.id === currentProjectId ? "[x] " : ""}
                      {p.name}
                    </button>
                    <button
                      onClick={() => renameProject(p.id)}
                      type="button"
                      title="إعادة تسمية"
                      style={{
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        padding: 4,
                      }}
                    >
                      تعديل
                    </button>
                    <button
                      onClick={() => deleteProject(p.id)}
                      type="button"
                      title="حذف"
                      style={{
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        padding: 4,
                      }}
                    >
                      حذف
                    </button>
                  </div>
                ))}
                <div
                  style={{
                    padding: 10,
                    borderTop: "2px solid #eee",
                    background: "#fafafa",
                  }}
                >
                  <button
                    className="btn-primary"
                    onClick={() => {
                      createProject();
                      setShowProjectMenu(false);
                    }}
                    type="button"
                    style={{ width: "100%", fontSize: 13 }}
                  >
                    + مشروع جديد
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <span style={{ fontSize: 12, color: "#888", marginRight: "auto" }}>
          {projects.length} مشروع - الحالي: {currentProject?.name}
        </span>
      </div>

      <header className="header">
        <h1>تسعير BOQ تلقائيا</h1>
        <p className="subtitle">Breakdown Templates + تقرير الخامات</p>
      </header>

      <div className="toolbar">
        <label className="file-upload">
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
            disabled={loading}
          />
          <span>رفع محلي</span>
        </label>

        <label
          className="file-upload"
          style={{ background: "#e8f4fd", borderColor: "#3498db" }}
        >
          <input
            type="file"
            multiple
            accept=".xlsx,.xls,.csv"
            onChange={handleImportToSupabase}
            disabled={loading}
          />
          <span>استيراد إلى Supabase</span>
        </label>

        <button
          className="btn-secondary"
          onClick={() => handleLoadFromSupabase()}
          disabled={loading}
          type="button"
        >
          تحميل من Supabase
        </button>

        <button
          className="btn-secondary"
          onClick={handleRepriceAllFromSupabase}
          disabled={loading}
          type="button"
        >
          إعادة تسعير كل البنود
        </button>

        <button
          className="btn-primary"
          onClick={handleAutoPricing}
          disabled={loading}
          type="button"
        >
          {loading ? "جاري التسعير..." : "تسعير تلقائي (محلي)"}
        </button>

        <button
          className="btn-secondary"
          onClick={openSmartPricing}
          disabled={loading || scoped.filter((r) => r.status !== "priced").length === 0}
          type="button"
          style={{ background: "#e8f5e9", borderColor: "#4caf50", fontWeight: 600 }}
          title="يقترح أسعار من بنود مشابهة مسعّرة في مشاريع أخرى"
        >
          🧠 تسعير تقريبي ذكي
        </button>

        <button
          className="btn-secondary"
          onClick={() => estimateUnpriced({})}
          disabled={estimating || loading}
          type="button"
          style={{ background: "#fce4ec", borderColor: "#e91e63", fontWeight: 600 }}
          title="يقدّر أسعار البنود اللي مفيش لها قالب باستخدام Claude AI"
        >
          {estimating ? "🧮 جاري التقدير..." : "🧮 تسعير تقديري (AI)"}
        </button>

        <button
          className="btn-secondary"
          onClick={handleExport}
          disabled={pricingResults.length === 0}
          type="button"
        >
          تصدير Excel
        </button>

        <button
          className="btn-secondary"
          onClick={() => setShowReport((v) => !v)}
          disabled={pricingResults.length === 0}
          type="button"
          style={{ background: "#fff4e6", borderColor: "#f39c12" }}
        >
          {showReport ? "إخفاء تقرير الخامات" : "عرض تقرير الخامات"}
        </button>

        <button
          className="btn-ghost"
          onClick={clearStorage}
          type="button"
          title="امسح بيانات المشروع الحالي"
          style={{ fontSize: 12 }}
        >
          مسح بيانات المشروع
        </button>
      </div>

      {debugMsg && (
        <div
          style={{
            padding: "12px 16px",
            background: "#eaf4fc",
            border: "1px solid #3498db",
            borderRadius: "8px",
            marginBottom: "16px",
            fontSize: "14px",
            color: "#2c3e50",
            fontWeight: 600,
          }}
        >
          {debugMsg}
        </div>
      )}

      {localOnly && (
        <div
          style={{
            padding: "12px 16px",
            background: "#fff3cd",
            border: "1px solid #ffc107",
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 13,
            color: "#856404",
            fontWeight: 600,
          }}
        >
          الجدول ده نسخة محلية قديمة من المتصفح ومش موجودة في Supabase للمشروع
          الحالي، فالبريك داون المخصص مش هيقدر يحفظ. اضغط «مسح بيانات المشروع»
          ثم «استيراد إلى Supabase» وارفع الملف تاني.
        </div>
      )}

      {loading && progress.total > 0 && (
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${(progress.current / progress.total) * 100}%` }}
          />
          <span className="progress-text">
            {progress.current} / {progress.total}
          </span>
        </div>
      )}

      {showReport && pricingResults.length > 0 && (
        <div
          style={{
            background: "#fffbf0",
            border: "2px solid #f39c12",
            borderRadius: 12,
            padding: 16,
            marginBottom: 20,
          }}
        >
          <h2 style={{ marginTop: 0 }}>
            تقرير تجميع الخامات - {currentProject?.name}
          </h2>
          <p style={{ color: "#666", fontSize: 13, marginTop: -8 }}>
            مجموع الكميات من كل البنود المسعرة ({stats.priced} بند)
            {pkg !== "all" && " — " + (PACKAGES.find((p) => p.key === pkg)?.label || "أخرى")}
          </p>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", margin: "8px 0 6px" }}>
            {["all", ...COMPONENT_TYPES].map((t) => (
              <button
                key={t}
                type="button"
                className={reportType === t ? "btn-primary" : "btn-secondary"}
                style={{ fontSize: 12, padding: "5px 12px" }}
                onClick={() => setReportType(t)}
              >
                {t === "all" ? "كل الأنواع" : t}
              </button>
            ))}
            <input
              className="answer-input"
              style={{ maxWidth: 220 }}
              value={reportSearch}
              onChange={(e) => setReportSearch(e.target.value)}
              placeholder="بحث: حديد، خرسانة، مصنعية..."
            />
            {(PACKAGES.find((p) => p.key === pkg)?.keywords || []).map((k) => (
              <button
                key={k}
                type="button"
                className={reportSearch === k ? "btn-primary" : "btn-ghost"}
                style={{ fontSize: 12, padding: "5px 10px" }}
                onClick={() => setReportSearch(reportSearch === k ? "" : k)}
              >
                {k}
              </button>
            ))}
          </div>
          <p style={{ color: "#999", fontSize: 11, margin: "0 0 12px" }}>
            البنود المسعّرة ببريك داون مخصص (CUSTOM) مش بتظهر تفاصيل مكوناتها هنا.
          </p>

          {Object.keys(aggregateComponents)
            .filter((t) => reportType === "all" || t === reportType)
            .map((type) => {
            const q = reportSearch.trim();
            const list = (aggregateComponents[type] || []).filter(
              (c) => !q || c.name.includes(q)
            );
            if (!list || list.length === 0) return null;
            const typeTotal = list.reduce((s, c) => s + c.total_cost, 0);

            return (
              <div key={type} style={{ marginBottom: 20 }}>
                <h3
                  style={{
                    background: "#f39c12",
                    color: "white",
                    padding: "6px 12px",
                    borderRadius: 6,
                    fontSize: 15,
                    marginBottom: 8,
                  }}
                >
                  {type} — {list.length} مكوّن — إجمالي:{" "}
                  {Math.round(typeTotal).toLocaleString("ar-EG")} ج.م
                </h3>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 13,
                    background: "white",
                  }}
                >
                  <thead>
                    <tr style={{ background: "#f8f9fa" }}>
                      <th style={{ padding: 8, border: "1px solid #e0e0e0", textAlign: "right" }}>
                        المكوّن
                      </th>
                      <th style={{ padding: 8, border: "1px solid #e0e0e0", textAlign: "center" }}>
                        الوحدة
                      </th>
                      <th style={{ padding: 8, border: "1px solid #e0e0e0", textAlign: "center" }}>
                        الكمية الإجمالية
                      </th>
                      <th style={{ padding: 8, border: "1px solid #e0e0e0", textAlign: "center" }}>
                        التكلفة
                      </th>
                      <th style={{ padding: 8, border: "1px solid #e0e0e0", textAlign: "center" }}>
                        عدد البنود
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((c, i) => (
                      <tr key={i}>
                        <td style={{ padding: 8, border: "1px solid #e0e0e0" }}>
                          {c.name}
                        </td>
                        <td style={{ padding: 8, border: "1px solid #e0e0e0", textAlign: "center" }}>
                          {c.unit}
                        </td>
                        <td
                          style={{
                            padding: 8,
                            border: "1px solid #e0e0e0",
                            textAlign: "center",
                            fontWeight: 700,
                            color: "#2c3e50",
                          }}
                        >
                          {Math.round(c.total_quantity * 100) / 100}
                        </td>
                        <td style={{ padding: 8, border: "1px solid #e0e0e0", textAlign: "center" }}>
                          {Math.round(c.total_cost).toLocaleString("ar-EG")} ج.م
                        </td>
                        <td style={{ padding: 8, border: "1px solid #e0e0e0", textAlign: "center", color: "#888" }}>
                          {c.items_count}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}

          {Object.values(aggregateComponents).every(
            (list) => !list || list.length === 0
          ) && (
            <p style={{ color: "#888", textAlign: "center" }}>
              مفيش بيانات - البنود لازم تتسعّر من هنا (إعادة / البريك داون) عشان
              تظهر تفاصيل المكونات
            </p>
          )}
        </div>
      )}

      {pricingResults.length > 0 && (
        <div className="stats">
          {(
            [
              ["all", "إجمالي البنود", stats.total, "stat-card"],
              ["priced", "مسعر (قالب)", stats.priced, "stat-card success"],
              ["estimated", "تقديري ⚠", stats.estimated, "stat-card warning"],
              ["unpriced", "غير مسعر", stats.unpriced, "stat-card warning"],
              ["review", "تحتاج مراجعة", stats.review, "stat-card warning"],
              ["error", "اخطاء", stats.errors, "stat-card danger"],
            ] as const
          ).map(([key, label, val, cls]) => (
            <div
              key={key}
              className={cls}
              role="button"
              tabIndex={0}
              title="اضغط لعرض هذه البنود فقط"
              onClick={() =>
                setFilter(filter === key && key !== "all" ? "all" : key)
              }
              style={{
                cursor: "pointer",
                outline: filter === key ? "2px solid #2c3e50" : undefined,
              }}
            >
              <span className="stat-label">{label}</span>
              <span className="stat-value">{val}</span>
            </div>
          ))}
          <div className="stat-card total">
            <span className="stat-label">الإجمالي (رسمي)</span>
            <span className="stat-value">
              {Math.round(stats.totalValue).toLocaleString("ar-EG")} ج.م
            </span>
          </div>
          {stats.estimated > 0 && (
            <div className="stat-card total" style={{ background: "#fce4ec" }}>
              <span className="stat-label">إجمالي تقديري</span>
              <span className="stat-value">
                {Math.round(stats.estimatedValue).toLocaleString("ar-EG")} ج.م
              </span>
            </div>
          )}
        </div>
      )}

      {pricingResults.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            {[
              { key: "all", label: "كل الباقات" },
              ...PACKAGES.map((p) => ({ key: p.key, label: p.label })),
              { key: "other", label: "أخرى" },
            ]
              .filter((p) => p.key === "all" || (pkgCounts[p.key] || 0) > 0)
              .map((p) => (
                <button
                  key={p.key}
                  type="button"
                  className={pkg === p.key ? "btn-primary" : "btn-secondary"}
                  style={{ fontSize: 12, padding: "6px 12px" }}
                  onClick={() => {
                    setPkg(p.key);
                    setSheetFilter("all");
                    setReportSearch("");
                  }}
                >
                  {p.label} ({p.key === "all" ? pricingResults.length : pkgCounts[p.key] || 0})
                </button>
              ))}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, color: "#666" }}>عرض:</span>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #d5dbdb" }}
            >
              <option value="all">كل البنود</option>
              <option value="pending">غير مسعّر (بالأخطاء)</option>
              <option value="unpriced">بدون قالب فقط</option>
              <option value="review">تحتاج مراجعة</option>
              <option value="estimated">تقديري فقط ⚠</option>
              <option value="error">أخطاء</option>
              <option value="priced">المسعّر (قالب) فقط</option>
            </select>
            {sheetOptions.length > 1 && (
              <select
                value={sheetFilter}
                onChange={(e) => setSheetFilter(e.target.value)}
                style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #d5dbdb" }}
              >
                <option value="all">كل الشيتات ({sheetOptions.length})</option>
                {sheetOptions.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            )}
            <span style={{ fontSize: 12, color: "#888" }}>
              {visibleResults.length} بند
            </span>
          </div>
        </div>
      )}

      {pricingResults.length > 0 && (
        <div className="table-wrapper">
          <table className="boq-table">
            <thead>
              <tr>
                <th>#</th>
                <th>الشيت</th>
                <th>كود البند</th>
                <th>الوصف</th>
                <th>الوحدة</th>
                <th>الكمية</th>
                <th>سعر الوحدة</th>
                <th>الإجمالي</th>
                <th>القالب</th>
                <th>الحالة</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {visibleResults.map((r, idx) => (
                <tr key={r.id ?? `${r.item_code}-${idx}`} className={r.status}>
                  <td>{idx + 1}</td>
                  <td style={{ fontSize: 11, color: "#888" }} dir="auto">{r.sheet_name}</td>
                  <td>{r.item_code}</td>
                  <td className="desc-cell" title={r.description} dir="auto">
                    {r.description}
                  </td>
                  <td>{r.unit}</td>
                  <td>{r.quantity}</td>
                  <td>{Math.round(r.unit_price).toLocaleString("ar-EG")}</td>
                  <td className="total-cell">
                    {Math.round(r.total_price).toLocaleString("ar-EG")}
                  </td>
                  <td>
                    <span className="template-badge">
                      {r.template_code || "—"}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`status-badge ${r.status}`}
                      title={
                        r.estimated
                          ? `تقديري (${r.estimated_confidence || "?"} — ${r.estimated_basis || "?"})\n${r.estimated_rationale || ""}\n${r.estimated_assumptions || ""}`
                          : r.error || r.db_status || ""
                      }
                      style={
                        r.estimated
                          ? { background: "#fce4ec", color: "#880e4f", fontWeight: 700 }
                          : undefined
                      }
                    >
                      {statusText(r)}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button
                        className="btn-breakdown"
                        onClick={() => openBreakdownModal(r)}
                        type="button"
                      >
                        البريك داون
                      </button>
                      <button
                        className="btn-secondary"
                        type="button"
                        style={{ fontSize: 12, padding: "6px 10px" }}
                        onClick={() => setCustomItem(toBoqItem(r, true))}
                        title="فتح بريك داون مخصص"
                      >
                        مخصص
                      </button>
                      {r.template_code === "CUSTOM" && r.id != null && areaOf(r) != null && (
                        <button
                          className="btn-secondary"
                          type="button"
                          style={{ fontSize: 12, padding: "6px 10px", background: "#eafaf1", borderColor: "#27ae60" }}
                          onClick={() => {
                            setGenSource(r);
                            setGenKeyword(detectKeyword(r.description));
                            setGenOverride({});
                          }}
                          title="طبّق نفس البريك داون على بنود مشابهة بحسب مساحة كل فتحة"
                        >
                          عمّم
                        </button>
                      )}
                      <button
                        className="btn-secondary"
                        style={{ fontSize: 12, padding: "6px 10px" }}
                        onClick={() =>
                          handleRepriceItem(toBoqItem(r), {
                            template: r.template_code || undefined,
                          })
                        }
                        type="button"
                        disabled={loading}
                        title="أعد تسعير هذا البند"
                      >
                        إعادة
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          🆕 مودال البريك داون (مع كارت الوصف الاحترافي)
          ═══════════════════════════════════════════════════════ */}
      {isModalOpen && selectedItem && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            {/* ═══ رأس المودال — sticky مع الكارت الكامل ═══ */}
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
                  <h2 style={{ margin: 0 }}>البريك داون</h2>
                  <span
                    style={{
                      background: "#eef2ff",
                      color: "#3730a3",
                      padding: "2px 10px",
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {selectedTemplate}
                  </span>
                </div>

                {/* 🆕 كارت الوصف الكامل */}
                {renderItemHeaderCard({
                  code: selectedItem.item_code,
                  description: selectedItem.description,
                  unit: selectedItem.unit,
                  quantity: selectedItem.quantity,
                })}
              </div>
              <button
                className="modal-close"
                onClick={() => setIsModalOpen(false)}
                style={{ alignSelf: "flex-start", marginTop: 4 }}
              >
                x
              </button>
            </div>

            <div className="modal-body">
              {loadingBreakdown && (
                <div className="loading-box">
                  جاري حساب تفاصيل التكلفة...
                </div>
              )}

              {!loadingBreakdown && breakdownDetails?.ok && (
                <div className="breakdown-details">
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 12,
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <h3 style={{ margin: 0 }}>
                        البريك داون - تفاصيل التكلفة
                      </h3>
                      <p className="subtitle" style={{ margin: 0 }}>
                        {breakdownDetails.name} — الوحدة:{" "}
                        {breakdownDetails.unit}
                      </p>
                    </div>
                    <div
                      style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
                    >
                      <button
                        className="btn-secondary"
                        onClick={handleResetLines}
                        type="button"
                        style={{ fontSize: 12, padding: "6px 12px" }}
                        disabled={
                          customLines.length === 0 &&
                          deletedLineIndices.size === 0 &&
                          Object.keys(editedLines).length === 0
                        }
                      >
                        إلغاء التعديلات
                      </button>
                      <button
                        className="btn-primary"
                        onClick={() => setShowAddLineForm((v) => !v)}
                        type="button"
                        style={{ fontSize: 12, padding: "6px 12px" }}
                      >
                        {showAddLineForm ? "إغلاق" : "+ إضافة بند"}
                      </button>
                    </div>
                  </div>

                  {changedRateLines.length > 0 && (
                    <div
                      style={{
                        background: "#fff3cd",
                        border: "1px solid #ffc107",
                        borderRadius: 8,
                        padding: "10px 14px",
                        marginBottom: 12,
                        fontSize: 13,
                        color: "#856404",
                        fontWeight: 600,
                      }}
                    >
                      فيه {changedRateLines.length} مكوّن سعره اتغير.
                      <br />
                      <span style={{ fontWeight: 400, fontSize: 12 }}>
                        اضغط "حفظ مؤقت" بجانب السطر لحفظه في الجلسة، أو "اعتماد
                        الإجابات + حفظ دائم" لتثبيت كل حاجة.
                      </span>
                    </div>
                  )}

                  {showAddLineForm && (
                    <div
                      style={{
                        background: "#fff9e6",
                        border: "1px dashed #f39c12",
                        borderRadius: 8,
                        padding: 12,
                        marginBottom: 12,
                      }}
                    >
                      <h4 style={{ margin: "0 0 8px 0", fontSize: 14 }}>
                        إضافة بند جديد
                      </h4>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 2fr 1fr 1fr 1fr auto",
                          gap: 8,
                          alignItems: "end",
                        }}
                      >
                        <div>
                          <label style={{ fontSize: 11, color: "#666" }}>
                            النوع
                          </label>
                          <select
                            className="answer-input"
                            value={newLine.component_type}
                            onChange={(e) =>
                              setNewLine({
                                ...newLine,
                                component_type: e.target
                                  .value as ComponentType,
                              })
                            }
                          >
                            {COMPONENT_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: 11, color: "#666" }}>
                            اسم المكوّن
                          </label>
                          <input
                            className="answer-input"
                            type="text"
                            value={newLine.name}
                            onChange={(e) =>
                              setNewLine({ ...newLine, name: e.target.value })
                            }
                            placeholder="مثال: أسمنت"
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, color: "#666" }}>
                            الكمية
                          </label>
                          <input
                            className="answer-input"
                            type="number"
                            step="0.01"
                            value={newLine.quantity}
                            onChange={(e) =>
                              setNewLine({
                                ...newLine,
                                quantity: parseFloat(e.target.value) || 0,
                              })
                            }
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, color: "#666" }}>
                            الوحدة
                          </label>
                          <input
                            className="answer-input"
                            type="text"
                            value={newLine.unit}
                            onChange={(e) =>
                              setNewLine({ ...newLine, unit: e.target.value })
                            }
                            placeholder="م3"
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, color: "#666" }}>
                            سعر الوحدة
                          </label>
                          <input
                            className="answer-input"
                            type="number"
                            step="0.01"
                            value={newLine.unit_rate}
                            onChange={(e) =>
                              setNewLine({
                                ...newLine,
                                unit_rate: parseFloat(e.target.value) || 0,
                              })
                            }
                          />
                        </div>
                        <button
                          className="btn-success"
                          onClick={handleAddLine}
                          type="button"
                          style={{ fontSize: 12, padding: "8px 14px" }}
                        >
                          أضف
                        </button>
                      </div>
                    </div>
                  )}

                  {finalLines.length > 0 ? (
                    <table className="components-table">
                      <thead>
                        <tr>
                          <th>النوع</th>
                          <th>المكوّن</th>
                          <th>الكمية</th>
                          <th>الوحدة</th>
                          <th>سعر الوحدة</th>
                          <th>الإجمالي</th>
                          <th>حفظ مؤقت</th>
                          <th>إجراء</th>
                        </tr>
                      </thead>
                      <tbody>
                        {originalLines.map((line, idx) => {
                          if (deletedLineIndices.has(idx)) return null;

                          const edit = editedLines[idx] || {};
                          const q = edit.quantity ?? line.quantity;
                          const r = edit.unit_rate ?? line.unit_rate;
                          const total = Math.round(q * r * 100) / 100;

                          const rateChanged =
                            edit.unit_rate !== undefined &&
                            edit.unit_rate !== line.unit_rate;
                          const qtyChanged =
                            edit.quantity !== undefined &&
                            edit.quantity !== line.quantity;
                          const isChanged = rateChanged || qtyChanged;
                          const isTempSaved = tempSavedLines.has(idx);

                          return (
                            <tr
                              key={`orig-${idx}`}
                              style={{
                                background: isTempSaved
                                  ? "#e8f8f0"
                                  : isChanged
                                  ? "#fff3cd"
                                  : undefined,
                              }}
                            >
                              <td>{line.component_type}</td>
                              <td>
                                {line.name}
                                {isTempSaved && (
                                  <span
                                    style={{
                                      marginRight: 6,
                                      background: "#27ae60",
                                      color: "white",
                                      padding: "1px 6px",
                                      borderRadius: 4,
                                      fontSize: 10,
                                      fontWeight: 700,
                                    }}
                                  >
                                    محفوظ
                                  </span>
                                )}
                              </td>
                              <td>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={q}
                                  onChange={(e) => {
                                    handleEditOriginalLine(
                                      idx,
                                      "quantity",
                                      parseFloat(e.target.value) || 0
                                    );
                                    setTempSavedLines((prev) => {
                                      const next = new Set(prev);
                                      next.delete(idx);
                                      return next;
                                    });
                                  }}
                                  style={{
                                    width: 70,
                                    padding: "4px 6px",
                                    border: "1px solid #d5dbdb",
                                    borderRadius: 4,
                                    fontSize: 12,
                                    textAlign: "center",
                                  }}
                                />
                              </td>
                              <td>{line.unit}</td>
                              <td>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={r}
                                  onChange={(e) => {
                                    handleEditOriginalLine(
                                      idx,
                                      "unit_rate",
                                      parseFloat(e.target.value) || 0
                                    );
                                    setTempSavedLines((prev) => {
                                      const next = new Set(prev);
                                      next.delete(idx);
                                      return next;
                                    });
                                  }}
                                  style={{
                                    width: 90,
                                    padding: "4px 6px",
                                    border: rateChanged
                                      ? "2px solid #f39c12"
                                      : "1px solid #d5dbdb",
                                    borderRadius: 4,
                                    fontSize: 12,
                                    textAlign: "center",
                                    background: "white",
                                  }}
                                />
                              </td>
                              <td className="total-cell">
                                {total.toLocaleString("ar-EG")} ج.م
                              </td>

                              <td>
                                {isChanged && !isTempSaved && (
                                  <button
                                    onClick={() => handleTempSaveLine(idx)}
                                    type="button"
                                    title="حفظ مؤقت في الذاكرة"
                                    style={{
                                      background: "#fff",
                                      color: "#27ae60",
                                      border: "1px solid #27ae60",
                                      borderRadius: 6,
                                      padding: "4px 10px",
                                      cursor: "pointer",
                                      fontSize: 12,
                                      fontWeight: "bold",
                                    }}
                                  >
                                    حفظ مؤقت
                                  </button>
                                )}
                                {isTempSaved && (
                                  <span
                                    style={{
                                      color: "#27ae60",
                                      fontSize: 12,
                                      fontWeight: 600,
                                    }}
                                  >
                                    محفوظ
                                  </span>
                                )}
                              </td>

                              <td>
                                <button
                                  onClick={() =>
                                    handleDeleteOriginalLine(idx)
                                  }
                                  type="button"
                                  title="حذف السطر"
                                  style={{
                                    background: "#fee",
                                    color: "#c0392b",
                                    border: "1px solid #f5b7b1",
                                    borderRadius: 6,
                                    padding: "4px 10px",
                                    cursor: "pointer",
                                    fontSize: 12,
                                  }}
                                >
                                  حذف
                                </button>
                              </td>
                            </tr>
                          );
                        })}
{customLines.map((line) => (
  <tr key={line.id} style={{ background: "#fff9e6" }}>
    <td>
      {line.component_type}{" "}
      <span
        style={{
          background: "#f39c12",
          color: "white",
          padding: "1px 6px",
          borderRadius: 4,
          fontSize: 10,
        }}
      >
        جديد
      </span>
    </td>

    {/* 🆕 اسم المكوّن قابل للتعديل */}
    <td>
      <input
        type="text"
        value={line.name}
        onChange={(e) => {
          const v = e.target.value;
          setCustomLines((prev) =>
            prev.map((x) => (x.id === line.id ? { ...x, name: v } : x))
          );
        }}
        style={{
          width: "100%",
          minWidth: 100,
          padding: "4px 6px",
          border: "1px solid #d5dbdb",
          borderRadius: 4,
          fontSize: 12,
        }}
      />
    </td>

    {/* 🆕 الكمية قابلة للتعديل */}
    <td>
      <input
        type="number"
        step="0.01"
        value={line.quantity}
        onChange={(e) => {
          const v = parseFloat(e.target.value) || 0;
          setCustomLines((prev) =>
            prev.map((x) =>
              x.id === line.id
                ? {
                    ...x,
                    quantity: v,
                    total_cost: Math.round(v * x.unit_rate * 100) / 100,
                  }
                : x
            )
          );
        }}
        style={{
          width: 70,
          padding: "4px 6px",
          border: "1px solid #d5dbdb",
          borderRadius: 4,
          fontSize: 12,
          textAlign: "center",
        }}
      />
    </td>

    {/* 🆕 الوحدة قابلة للتعديل */}
    <td>
      <input
        type="text"
        value={line.unit}
        onChange={(e) => {
          const v = e.target.value;
          setCustomLines((prev) =>
            prev.map((x) => (x.id === line.id ? { ...x, unit: v } : x))
          );
        }}
        style={{
          width: 60,
          padding: "4px 6px",
          border: "1px solid #d5dbdb",
          borderRadius: 4,
          fontSize: 12,
          textAlign: "center",
        }}
      />
    </td>

    {/* 🆕 سعر الوحدة قابل للتعديل */}
    <td>
      <input
        type="number"
        step="0.01"
        value={line.unit_rate}
        onChange={(e) => {
          const v = parseFloat(e.target.value) || 0;
          setCustomLines((prev) =>
            prev.map((x) =>
              x.id === line.id
                ? {
                    ...x,
                    unit_rate: v,
                    total_cost: Math.round(x.quantity * v * 100) / 100,
                  }
                : x
            )
          );
        }}
        style={{
          width: 90,
          padding: "4px 6px",
          border: "1px solid #d5dbdb",
          borderRadius: 4,
          fontSize: 12,
          textAlign: "center",
        }}
      />
    </td>

    <td className="total-cell">
      {line.total_cost.toLocaleString("ar-EG")} ج.م
    </td>

    <td>
      <span style={{ color: "#888", fontSize: 11 }}>جديد</span>
    </td>

    <td>
      <button
        onClick={() => handleDeleteCustomLine(line.id)}
        type="button"
        title="حذف السطر"
        style={{
          background: "#fee",
          color: "#c0392b",
          border: "1px solid #f5b7b1",
          borderRadius: 6,
          padding: "4px 10px",
          cursor: "pointer",
          fontSize: 12,
        }}
      >
        حذف
      </button>
    </td>
  </tr>
))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="empty-note">
                      لا توجد مكونات - استخدم "إضافة بند" لإضافة مكونات
                    </p>
                  )}

                  <div
                    style={{
                      background: "#f8f9fa",
                      border: "1px solid #e0e0e0",
                      borderRadius: 8,
                      padding: 12,
                      marginTop: 12,
                      marginBottom: 12,
                    }}
                  >
                    <h4 style={{ margin: "0 0 10px 0", fontSize: 14 }}>
                      النسب (قابلة للتعديل)
                    </h4>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(4, 1fr)",
                        gap: 12,
                      }}
                    >
                      <div>
                        <label style={{ fontSize: 12, color: "#666" }}>
                          الهالك %
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={wastagePct}
                          onChange={(e) =>
                            setWastagePct(parseFloat(e.target.value) || 0)
                          }
                          className="answer-input"
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, color: "#666" }}>
                          المصاريف العامة %
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={overheadPct}
                          onChange={(e) =>
                            setOverheadPct(parseFloat(e.target.value) || 0)
                          }
                          className="answer-input"
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, color: "#666" }}>
                          المخاطر %
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={riskPct}
                          onChange={(e) =>
                            setRiskPct(parseFloat(e.target.value) || 0)
                          }
                          className="answer-input"
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, color: "#666" }}>
                          الربح %
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={profitPct}
                          onChange={(e) =>
                            setProfitPct(parseFloat(e.target.value) || 0)
                          }
                          className="answer-input"
                        />
                      </div>
                    </div>
                  </div>

                  {totals && (
                    <div className="cost-summary">
                      <h4>ملخص التكاليف</h4>
                      <div className="summary-row">
                        <span>التكلفة المباشرة</span>
                        <span>
                          {Math.round(totals.direct_cost).toLocaleString(
                            "ar-EG"
                          )}{" "}
                          ج.م
                        </span>
                      </div>
                      <div className="summary-row">
                        <span>الهالك ({wastagePct}%)</span>
                        <span>
                          {Math.round(totals.wastage_cost).toLocaleString(
                            "ar-EG"
                          )}{" "}
                          ج.م
                        </span>
                      </div>
                      <div className="summary-row subtotal">
                        <span>الإجمالي الفرعي</span>
                        <span>
                          {Math.round(totals.subtotal).toLocaleString("ar-EG")}{" "}
                          ج.م
                        </span>
                      </div>
                      <div className="summary-row">
                        <span>المصاريف العامة ({overheadPct}%)</span>
                        <span>
                          {Math.round(totals.overhead_cost).toLocaleString(
                            "ar-EG"
                          )}{" "}
                          ج.م
                        </span>
                      </div>
                      <div className="summary-row">
                        <span>المخاطر ({riskPct}%)</span>
                        <span>
                          {Math.round(totals.risk_cost).toLocaleString(
                            "ar-EG"
                          )}{" "}
                          ج.م
                        </span>
                      </div>
                      <div className="summary-row">
                        <span>الربح ({profitPct}%)</span>
                        <span>
                          {Math.round(totals.profit_cost).toLocaleString(
                            "ar-EG"
                          )}{" "}
                          ج.م
                        </span>
                      </div>
                      <div className="summary-row total">
                        <span>سعر الوحدة (مقرب)</span>
                        <span>
                          {totals.unit_price_rounded.toLocaleString("ar-EG")}{" "}
                          ج.م
                        </span>
                      </div>
                      <div className="summary-row grand-total">
                        <span>
                          الإجمالي للكمية ({selectedItem.quantity}{" "}
                          {selectedItem.unit})
                        </span>
                        <span>
                          {totals.total_price_rounded.toLocaleString("ar-EG")}{" "}
                          ج.م
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!loadingBreakdown &&
                breakdownDetails &&
                !breakdownDetails.ok && (
                  <div className="error-box">
                    خطأ في الحساب:{" "}
                    {breakdownDetails.error === "no_recipe"
                      ? `القالب ${selectedTemplate} مفيش له وصفة (recipe) بعد`
                      : breakdownDetails.error}
                    {selectedItem && (
                      <div style={{ marginTop: 8 }}>
                        <button
                          className="btn-primary"
                          type="button"
                          style={{ fontSize: 12, padding: "6px 12px" }}
                          onClick={() => {
                            const r = pricingResults.find((x) =>
                              sameItem(x, selectedItem)
                            );
                            setIsModalOpen(false);
                            setCustomItem(
                              r ? toBoqItem(r, true) : selectedItem
                            );
                          }}
                        >
                          سعّر ببريك داون مخصص
                        </button>
                      </div>
                    )}
                  </div>
                )}

              <div className="questions-section">
                <h3>الأسئلة ({questions.length})</h3>
                {loadingQuestions ? (
                  <p>جاري تحميل الأسئلة...</p>
                ) : questions.length === 0 ? (
                  <p className="empty-note">لا توجد أسئلة لهذا القالب</p>
                ) : (
                  <div className="questions-list">
                    {questions.map((q) => (
                      <div key={q.id} className="question-item">
                        <label className="question-label">
                          <span className="question-num">{q.sort_order}.</span>
                          <span className="question-text">
                            {q.question_text}
                          </span>
                          {q.unit_hint && (
                            <span className="question-hint">
                              ({q.unit_hint})
                            </span>
                          )}
                        </label>

                        {q.question_type === "boolean" ? (
                          <div className="radio-group">
                            <label>
                              <input
                                type="radio"
                                name={`q-${q.id}`}
                                checked={answers[q.id] === true}
                                onChange={() => updateAnswer(q.id, true)}
                              />
                              نعم
                            </label>
                            <label>
                              <input
                                type="radio"
                                name={`q-${q.id}`}
                                checked={answers[q.id] === false}
                                onChange={() => updateAnswer(q.id, false)}
                              />
                              لا
                            </label>
                          </div>
                        ) : q.question_type === "choice" && q.options ? (
                          <select
                            value={answers[q.id] ?? ""}
                            onChange={(e) =>
                              updateAnswer(q.id, e.target.value)
                            }
                            className="answer-input"
                          >
                            <option value="">— اختر —</option>
                            {(Array.isArray(q.options) ? q.options : []).map(
                              (opt: any, i: number) => (
                                <option key={i} value={opt.value ?? opt}>
                                  {opt.label ?? opt}
                                </option>
                              )
                            )}
                          </select>
                        ) : q.question_type === "number" ? (
                          <input
                            type="number"
                            value={answers[q.id] ?? ""}
                            onChange={(e) =>
                              updateAnswer(
                                q.id,
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="answer-input"
                            placeholder="أدخل رقم"
                          />
                        ) : (
                          <input
                            type="text"
                            value={answers[q.id] ?? ""}
                            onChange={(e) =>
                              updateAnswer(q.id, e.target.value)
                            }
                            className="answer-input"
                            placeholder="أدخل إجابة"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={handleReanalyze}
                disabled={loadingBreakdown}
                type="button"
              >
                إعادة التحليل
              </button>

              <button
                className="btn-secondary"
                onClick={() =>
                  selectedItem &&
                  handleRepriceItem(selectedItem, { template: selectedTemplate })
                }
                disabled={loading || !selectedItem}
                type="button"
                title="أعد تسعير هذا البند فقط"
              >
                إعادة تسعير هذا البند
              </button>

              <button
                className="btn-secondary"
                onClick={async () => {
                  if (!selectedTemplate) return;
                  const same = pricingResults.filter(
                    (x) => x.template_code === selectedTemplate
                  );
                  if (same.length === 0) {
                    alert("مفيش بنود تانية بنفس القالب");
                    return;
                  }
                  if (
                    !confirm(
                      `هتعيد تسعير ${same.length} بند بنفس القالب ${selectedTemplate}؟`
                    )
                  )
                    return;

                  setLoading(true);
                  let ok = 0;
                  for (const x of same) {
                    const done = await handleRepriceItem(toBoqItem(x), {
                      silent: true,
                      template: selectedTemplate,
                    });
                    if (done) ok++;
                  }
                  setLoading(false);
                  alert(`تم إعادة تسعير ${ok} من ${same.length} بند`);
                }}
                disabled={loading}
                type="button"
              >
                إعادة تسعير كل بنود نفس القالب
              </button>

              <button
                className="btn-primary"
                onClick={handleSaveAsCustom}
                disabled={approving || !breakdownDetails?.ok}
                type="button"
                title="يحفظ الإضافات والحذف والتعديلات لهذا البند"
              >
                حفظ كبريك داون مخصص
              </button>

              <button
                className="btn-success"
                onClick={handleApprove}
                disabled={approving || !breakdownDetails?.ok}
                type="button"
              >
                {approving
                  ? "جاري الاعتماد..."
                  : "اعتماد الإجابات + حفظ دائم"}
              </button>

              <button
                className="btn-ghost"
                onClick={() => setIsModalOpen(false)}
                type="button"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          🆕 مودال التعميم (مع كارت الوصف الاحترافي)
          ═══════════════════════════════════════════════════════ */}
      {genSource && (
        <div className="modal-overlay" onClick={() => !genBusy && setGenSource(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
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
                <h2 style={{ margin: "0 0 4px 0" }}>
                  تعميم البريك داون بالمساحة
                </h2>

                {/* 🆕 كارت الوصف الكامل */}
                {renderItemHeaderCard({
                  code: genSource.item_code,
                  description: genSource.description,
                  unit: genSource.unit,
                  quantity: genSource.raw_qty ?? genSource.quantity,
                })}

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    fontSize: 12,
                    color: "#475569",
                  }}
                >
                  <span style={chipStyle("#dbeafe", "#1e40af")}>
                    المصدر: مساحة {areaOf(genSource)} م²
                  </span>
                  <span style={chipStyle("#dcfce7", "#166534")}>
                    سعر الوحدة: {Math.round(genSource.unit_price).toLocaleString("ar-EG")} ج.م
                  </span>
                </div>
              </div>
              <button
                className="modal-close"
                onClick={() => !genBusy && setGenSource(null)}
                style={{ alignSelf: "flex-start", marginTop: 4 }}
              >
                x
              </button>
            </div>

            <div className="modal-body">
              <label style={{ fontSize: 12, color: "#666" }}>
                كلمات البحث في الوصف (افصل بينها بـ |)
              </label>
              <input
                className="answer-input"
                value={genKeyword}
                onChange={(e) => {
                  setGenKeyword(e.target.value);
                  setGenOverride({});
                }}
                placeholder="مثال: alumin  أو  wood|timber|pine"
              />
              <p style={{ fontSize: 12, color: "#666" }}>
                {genCandidates.length} بند فيه مساحة (المحدد: {genSelected.length}).
                المكوّنات بالمتر المربع بتتناسب مع مساحة كل فتحة، والباقي بيفضل زي ما هو.
                السعر التقريبي للمعاينة بس، والسعر الفعلي بيتحسب عند الحفظ.
              </p>

              <div style={{ display: "flex", gap: 6, margin: "6px 0" }}>
                <button className="btn-secondary" type="button" style={{ fontSize: 12, padding: "4px 10px" }}
                  onClick={() => setGenOverride(Object.fromEntries(genCandidates.map((x) => [String(x.id), x.status !== "priced"])))}>
                  غير المسعّر فقط
                </button>
                <button className="btn-secondary" type="button" style={{ fontSize: 12, padding: "4px 10px" }}
                  onClick={() => setGenOverride(Object.fromEntries(genCandidates.map((x) => [String(x.id), true])))}>
                  تحديد الكل
                </button>
                <button className="btn-secondary" type="button" style={{ fontSize: 12, padding: "4px 10px" }}
                  onClick={() => setGenOverride(Object.fromEntries(genCandidates.map((x) => [String(x.id), false])))}>
                  إلغاء التحديد
                </button>
              </div>

              {genCandidates.length === 0 ? (
                <p className="empty-note">
                  مفيش بنود مطابقة. عدّل كلمات البحث، أو تأكد إن البنود فيها مقاس (Size 2400x2700 mm) أو عمود area_per_unit.
                </p>
              ) : (
                <div className="table-wrapper" style={{ maxHeight: 360, overflowY: "auto" }}>
                  <table className="components-table">
                    <thead>
                      <tr>
                        <th></th>
                        <th>الكود</th>
                        <th>الشيت</th>
                        <th>الوصف</th>
                        <th>المساحة م²</th>
                        <th>الكمية</th>
                        <th>الحالة</th>
                        <th>سعر تقريبي</th>
                      </tr>
                    </thead>
                    <tbody>
                      {genCandidates.map((x) => {
                        const a = areaOf(x) as number;
                        const srcA = areaOf(genSource) || 1;
                        return (
                          <tr key={String(x.id)} style={{ background: genChecked(x) ? "#eafaf1" : undefined }}>
                            <td>
                              <input
                                type="checkbox"
                                checked={genChecked(x)}
                                onChange={(e) =>
                                  setGenOverride((prev) => ({ ...prev, [String(x.id)]: e.target.checked }))
                                }
                              />
                            </td>
                            <td>{x.item_code}</td>
                            <td style={{ fontSize: 11, color: "#888" }}>{x.sheet_name}</td>
                            <td dir="auto" title={x.description} style={{ fontSize: 12 }}>
                              {x.description.length > 110 ? "…" + x.description.slice(-110) : x.description}
                            </td>
                            <td>{a}</td>
                            <td>{x.raw_qty ?? x.quantity}</td>
                            <td>{statusText(x)}</td>
                            <td>{Math.round(genSource.unit_price * (a / srcA)).toLocaleString("ar-EG")}</td>
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
                onClick={handleGeneralize}
                disabled={genBusy || genSelected.length === 0}
              >
                {genBusy ? "جاري التطبيق..." : `طبّق على ${genSelected.length} بند`}
              </button>
              <button className="btn-ghost" type="button" onClick={() => !genBusy && setGenSource(null)}>
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {smartTargets.length > 0 && (
        <SmartPricingModal
          targets={smartTargets}
          projectId={currentProjectId}
          onClose={() => setSmartTargets([])}
          onDone={() => {
            setSmartTargets([]);
            handleLoadFromSupabase(true);
          }}
        />
      )}

      {customItem && (
        <CustomBreakdownModal
          item={customItem}
          projectId={currentProjectId}
          onClose={() => setCustomItem(null)}
          onSaved={({ unit_price, total_price }) => {
            const target = customItem;
            setPricingResults((prev) =>
              prev.map((x) =>
                sameItem(x, target)
                  ? {
                      ...x,
                      unit_price,
                      total_price,
                      template_code: "CUSTOM",
                      template_name: "بريك داون مخصص",
                      status: "priced",
                      db_status: "priced",
                      error: undefined,
                      estimated: false,
                    }
                  : x
              )
            );
            handleLoadFromSupabase(true);
          }}
        />
      )}
    </div>
  );
}