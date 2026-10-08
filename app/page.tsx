"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "./supabase";

type Division = { id: number; code: string; name_ar: string; display_order: number };
type Section = { id: number; division_id: number; code: string; name_ar: string };
type Item = {
  id: number; section_id: number; code: string; name_ar: string; name_en: string;
  unit: string; rate: number; masterformat_code?: string; final_rate?: number; has_custom_analysis?: boolean;
};
type SavedProject = {
  id: number; project_name: string; project_data: any; total_amount: number; created_at: string;
  user_name?: string; client_name?: string; location?: string; project_type?: string; project_stage?: string;
  description?: string; file_url?: string; file_name?: string; file_type?: string;
};
type CustomItem = { id?: number; code: string; name_ar: string; unit: string; rate: number; division_code: string; section_code?: string };
type SearchResult = { item: Item; matched_component: string; component_rate: number };
type RateComponent = {
  id: number | string; component_type: string; component_name: string;
  quantity: number; unit: string; unit_rate: number; is_custom: boolean;
};
type ParsedItem = {
  source_file: string; source_sheet: string; item_code: string;
  item_description: string; unit: string; quantity: number;
};
type UserItem = { item_id: number; quantity: number; custom_rate: number };
type UnifiedItem = {
  id: number | string; code: string; name_ar: string; unit: string; rate: number;
  source: "main" | "custom"; masterformat_code?: string; final_rate?: number; has_custom_analysis?: boolean;
};

export default function Home() {
  const [userName, setUserName] = useState<string>("");
  const [userInput, setUserInput] = useState<string>("");
  const [showLogin, setShowLogin] = useState(true);
  const [isSubscribed, setIsSubscribed] = useState(false);

  const [divisions, setDivisions] = useState<Division[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [customItems, setCustomItems] = useState<CustomItem[]>([]);
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);

  const [selectedDivision, setSelectedDivision] = useState<number | null>(null);
  const [selectedSection, setSelectedSection] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [componentSearch, setComponentSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Breakdown System
  const [showBreakdownQuestions, setShowBreakdownQuestions] = useState(false);
  const [showBreakdownView, setShowBreakdownView] = useState(false);
  const [breakdownItem, setBreakdownItem] = useState<any>(null);
  const [breakdownQuestions, setBreakdownQuestions] = useState<any[]>([]);
  const [breakdownAnswers, setBreakdownAnswers] = useState<Record<string, any>>({});
  const [breakdownResult, setBreakdownResult] = useState<any>(null);
  const [breakdownComponents, setBreakdownComponents] = useState<any[]>([]);
  const [loadingBreakdown, setLoadingBreakdown] = useState(false);
  const [showAddBreakdownComponentModal, setShowAddBreakdownComponentModal] = useState(false);
  const [newBreakdownComponent, setNewBreakdownComponent] = useState({
    component_type: "خامات", component_name: "", quantity: 1, unit: "كجم", unit_rate: 0,
  });
  const [showBreakdownsModal, setShowBreakdownsModal] = useState(false);
  const [savedBreakdowns, setSavedBreakdowns] = useState<any[]>([]);
  const [loadingBreakdowns, setLoadingBreakdowns] = useState(false);

  const [userItems, setUserItems] = useState<Record<number, UserItem>>({});
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [analysisItem, setAnalysisItem] = useState<UnifiedItem | null>(null);
  const [analysisComponents, setAnalysisComponents] = useState<RateComponent[]>([]);
  const [markupFactor, setMarkupFactor] = useState<number>(1.28);
  const [directCost, setDirectCost] = useState<number>(0);
  const [finalPrice, setFinalPrice] = useState<number>(0);
  const [savingAnalysis, setSavingAnalysis] = useState(false);
  const [analysisDirty, setAnalysisDirty] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);

  const [showCustomItemModal, setShowCustomItemModal] = useState(false);
  const [showProjectsModal, setShowProjectsModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [showAddComponentModal, setShowAddComponentModal] = useState(false);
  const [showProjectDetailsModal, setShowProjectDetailsModal] = useState(false);
  const [showBOQUploader, setShowBOQUploader] = useState(false);
  const [showParsedItemsModal, setShowParsedItemsModal] = useState(false);
  const [showCustomItemsModal, setShowCustomItemsModal] = useState(false);

  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedProject, setSelectedProject] = useState<SavedProject | null>(null);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectClient, setNewProjectClient] = useState("");
  const [newProjectLocation, setNewProjectLocation] = useState("");
  const [newProjectType, setNewProjectType] = useState("سكني");
  const [newProjectStage, setNewProjectStage] = useState("تحت الدراسة");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [newProjectFile, setNewProjectFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [customItem, setCustomItem] = useState<CustomItem>({
    code: "", name_ar: "", unit: "m³", rate: 0, division_code: "", section_code: "",
  });
  const [newComponent, setNewComponent] = useState<RateComponent>({
    id: "", component_type: "خامات", component_name: "", quantity: 1, unit: "كجم", unit_rate: 0, is_custom: true,
  });

  const [uploadingBOQ, setUploadingBOQ] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [fileCount, setFileCount] = useState(0);
  const [savedParsedItems, setSavedParsedItems] = useState<any[]>([]);
  const [parsedBreakdowns, setParsedBreakdowns] = useState<Record<string, any>>({});

  // Auto-pricing engine v2
  const engineCache = useRef<{ templates: any[] | null; questions: Record<number, any[]> }>({ templates: null, questions: {} });
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoProgress, setAutoProgress] = useState("");
  const [autoReport, setAutoReport] = useState<any[]>([]);
  const [showAutoReport, setShowAutoReport] = useState(false);

  // Workflow v4: مشاريع + مستويات + ملخص عند الطلب + أسئلة الخبرة
  const [userLevel, setUserLevel] = useState<"مبتدئ" | "متقدم" | "محترف">("مبتدئ");
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [approvedForSummary, setApprovedForSummary] = useState<any[]>([]);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [pickerTab, setPickerTab] = useState<string>("الكل");
  const [pickerProjects, setPickerProjects] = useState<any[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<number | null>(null);
  const [projectStarted, setProjectStarted] = useState(false);
  const [expertAnswers, setExpertAnswers] = useState<Record<string, number>>({});
  const [viewingBreakdown, setViewingBreakdown] = useState<any>(null);
  const [showViewBreakdownModal, setShowViewBreakdownModal] = useState(false);
  const [parsedSearchQuery, setParsedSearchQuery] = useState("");
  const [parsedFileFilter, setParsedFileFilter] = useState("");
  const [loadingParsedItems, setLoadingParsedItems] = useState(false);

  const [matchingItem, setMatchingItem] = useState<any>(null);
  const [similarItems, setSimilarItems] = useState<any[]>([]);
  const [showMatchingModal, setShowMatchingModal] = useState(false);
  const [loadingMatch, setLoadingMatch] = useState(false);
  const [bulkMatching, setBulkMatching] = useState(false);
  const [bulkMatchProgress, setBulkMatchProgress] = useState("");

  // ============================================
  // Login/Logout
  // ============================================
  const handleLogin = async () => {
    if (!userInput.trim()) { alert("اكتب اسمك أولاً"); return; }
    setUserName(userInput);
    localStorage.setItem("userName", userInput);
    try {
      await supabase.from("user_sessions").upsert({ user_name: userInput, last_login: new Date().toISOString() }, { onConflict: "user_name" });
      const { data } = await supabase.from("user_sessions").select("is_subscribed").eq("user_name", userInput).single();
      if (data?.is_subscribed) setIsSubscribed(true);
    } catch (e) {}
    setShowLogin(false);
  };

  const logout = () => {
    localStorage.removeItem("userName");
    setUserName("");
    setUserInput("");
    setIsSubscribed(false);
    setShowLogin(true);
  };

  useEffect(() => {
    const saved = localStorage.getItem("userName");
    if (saved) {
      setUserName(saved);
      setShowLogin(false);
      const checkSubscription = async () => {
        const { data } = await supabase.from("user_sessions").select("is_subscribed").eq("user_name", saved).single();
        if (data?.is_subscribed) setIsSubscribed(true);
      };
      checkSubscription();
    }
  }, []);

  useEffect(() => {
    if (!userName) return;
    const fetchAll = async () => {
      const [divRes, secRes, itmRes, custRes] = await Promise.all([
        supabase.from("divisions").select("*").order("code"),
        supabase.from("sections").select("*").order("code"),
        supabase.from("items").select("*").order("code"),
        supabase.from("custom_items").select("*").order("created_at", { ascending: false }),
      ]);
      if (divRes.data) { setDivisions(divRes.data); }
      if (secRes.data) setSections(secRes.data);
      if (itmRes.data) setAllItems(itmRes.data);
      if (custRes.data) setCustomItems(custRes.data);
      setLoading(false);
    };
    fetchAll();
  }, [userName]);

  useEffect(() => {
    const saved = localStorage.getItem("userItems");
    if (saved) { try { setUserItems(JSON.parse(saved)); } catch (e) {} }
  }, []);

  useEffect(() => {
    if (Object.keys(userItems).length > 0) localStorage.setItem("userItems", JSON.stringify(userItems));
  }, [userItems]);

  useEffect(() => {
    const lv = localStorage.getItem("userLevel");
    if (lv === "مبتدئ" || lv === "متقدم" || lv === "محترف") setUserLevel(lv);
  }, []);

  useEffect(() => {
    const total = analysisComponents.reduce((sum, c) => sum + (c.quantity * c.unit_rate), 0);
    const final = total * markupFactor;
    setDirectCost(Math.ceil(total));
    setFinalPrice(Math.ceil(final));
  }, [analysisComponents, markupFactor]);

  // ============================================
  // Breakdown Functions
  // ============================================

  // ============================================
  // AUTO BREAKDOWN / AUTO PRICING ENGINE
  // ============================================

  const normalizeText = (value: any) =>
    String(value || "")
      .toLowerCase()
      .replace(/[إأآا]/g, "ا")
      .replace(/[ى]/g, "ي")
      .replace(/[ة]/g, "ه")
      .replace(/[^\u0600-\u06FFa-z0-9.]+/gi, " ")
      .trim();

  // ------------------------------------------------------------
  // ENGINE v2:  قالب مطابق → قالب من نفس العائلة → استنتاج من بند مشابه → يدوي
  // كل مرحلة بتفشل = بنسجّل السبب وبنكمّل للي بعدها (مفيش خطأ بيوقف التسعير)
  // ------------------------------------------------------------

  const isNoCode = (code?: any) => {
    const c = String(code ?? "").trim();
    return c === "" || c === "—" || c === "-";
  };

  // البنود بدون كود بنفرّقها بالوصف عشان ما تتخلطش ببعض
  const descSuffix = (item: any) =>
    isNoCode(item?.item_code) ? `__${String(item?.item_description || "").substring(0, 80)}` : "";

  const getBreakdownKey = (item: any) =>
    `${item?.item_code || ""}__${item?.source_file || ""}__${item?.source_sheet || ""}${descSuffix(item)}`;

  // مفتاح قديم (كود + شيت) — بيُستخدم فقط للسجلات القديمة اللي مالهاش source_file
  const getLegacyBreakdownKey = (item: any) =>
    `${item?.item_code || ""}__${item?.source_sheet || ""}${descSuffix(item)}`;

  const normalizeUnit = (u: any) => {
    const s = String(u || "").toLowerCase().replace(/[\s.]/g, "");
    if (/^(m3|m³|cum|cbm|م3|م³|مترمكعب)$/.test(s)) return "m3";
    if (/^(m2|m²|sqm|م2|م²|مترمربع)$/.test(s)) return "m2";
    if (/^(m|lm|rm|مط|متر|مترطولي)$/.test(s)) return "m";
    if (/^(kg|كجم|كيلو|كغم)$/.test(s)) return "kg";
    if (/^(ton|t|طن)$/.test(s)) return "ton";
    if (/^(no|nr|number|عدد|each|ea)$/.test(s)) return "no";
    return s;
  };

  const getBreakdownRpcName = (itemCode: string) => {
    const code = String(itemCode || "").trim();
    if (code.startsWith("1.")) return "calculate_breakdown_earthworks";
    if (code === "2.8") return "calculate_breakdown_steel";
    if (code.startsWith("3.")) return "calculate_breakdown_insulation";
    if (code === "CO-003") return "calculate_breakdown_co003";
    if (code === "RD-001") return "calculate_breakdown_crushed_stone";
    if (code === "RD-002") return "calculate_breakdown_road_marking";
    if (code === "RD-003") return "calculate_breakdown_warning_signs";
    return "calculate_breakdown_rc";
  };
      const code = String(itemCode || "").trim();
    if (code.startsWith("1.")) return "calculate_breakdown_earthworks";
    if (code === "2.8") return "calculate_breakdown_steel";
    if (code.startsWith("3.")) return "calculate_breakdown_insulation";
    if (code === "CO-003") return "calculate_breakdown_co003";
    return "calculate_breakdown_rc";
  };

  const getElementHint = (text: string) =>
    /\bcolumns?\b|عمود|اعمده/.test(text) ? "column" :
    /beam|girder|كمر|سمل|ميده/.test(text) ? "beam" :
    /footing|foundation|قاعده|قواعد|اساس/.test(text) ? "footing" :
    /slab|بلاطه|سقف/.test(text) ? "slab" :
    /\bwalls?\b|حائط|جدار/.test(text) ? "wall" : "general";

  // ملاحظة: النسخة القديمة كانت بتعتبر أي وصف فيه "reinforced" حديد تسليح (steel)،
  // فكل بنود الخرسانة المسلحة RC كانت بتتصنّف غلط. هنا الحديد = steel بس لو مفيش كلمة خرسانة.
  const getEngineeringFamily = (item: any) => {
    const code = String(item?.item_code || "").trim();
    const text = normalizeText(item?.item_description);
    const unit = normalizeUnit(item?.unit);

    if (code.startsWith("1.")) return "earthworks";
    if (code.startsWith("3.")) return "insulation";
    if (code === "CO-003") return "co003";

    // ✅ بنود الطرق
    if (/interlock|crushed lime|lime stone|curbstone|sidewalk|road marking|warning sign/i.test(text)) {
      if (/crushed lime|lime stone|aggregate/i.test(text)) return "crushed_stone";
      if (/road marking|road paint/i.test(text)) return "road_marking";
      if (/warning sign|guidance sign|galvanized.*sign/i.test(text)) return "warning_signs";
      if (/interlock|sidewalk/i.test(text)) return "roads_interlock";
      if (/curbstone|curb stone/i.test(text)) return "roads_curbstone";
      return "roads_general";
    }

    const hasConcrete = /concrete|خرسانه/.test(text);
    if (code === "2.8" || (/\bsteel\b|\brebar\b|\breinforcement\b|حديد|تسليح/.test(text) && !hasConcrete)) return "steel";

    if (code.startsWith("2.") || hasConcrete) {
      const plain = /\bpc\b|plain concrete|blinding|خرسانه عاديه|نظافه/.test(text) && !/\brc\b|reinforced|مسلحه/.test(text);
      return `${plain ? "pc" : "rc"}_${getElementHint(text)}`;
    }
    if (/masonry|block|brick|مباني|طوب/.test(text)) return "masonry";
    if (/plaster|render|محاره|لياسه/.test(text)) return "plaster";
    if (/tile|ceramic|porcelain|بلاط|سيراميك/.test(text)) return "finishes_tiles";
    if (/paint|دهان/.test(text)) return "painting";
    return `generic_${unit || "unknown"}`;
  };    const code = String(item?.item_code || "").trim();
    const text = normalizeText(item?.item_description);
    const unit = normalizeUnit(item?.unit);

    if (code.startsWith("1.")) return "earthworks";
    if (code.startsWith("3.")) return "insulation";
    if (code === "CO-003") return "co003";

    const hasConcrete = /concrete|خرسانه/.test(text);
    if (code === "2.8" || (/\bsteel\b|\brebar\b|\breinforcement\b|حديد|تسليح/.test(text) && !hasConcrete)) return "steel";

    if (code.startsWith("2.") || hasConcrete) {
      const plain = /\bpc\b|plain concrete|blinding|خرسانه عاديه|نظافه/.test(text) && !/\brc\b|reinforced|مسلحه/.test(text);
      return `${plain ? "pc" : "rc"}_${getElementHint(text)}`;
    }
    if (/masonry|block|brick|مباني|طوب/.test(text)) return "masonry";
    if (/plaster|render|محاره|لياسه/.test(text)) return "plaster";
    if (/tile|ceramic|porcelain|بلاط|سيراميك/.test(text)) return "finishes_tiles";
    if (/paint|دهان/.test(text)) return "painting";
    return `generic_${unit || "unknown"}`;
  };

  const FAMILY_TEMPLATE_CODES: Record<string, string[]> = {
    pc_footing: ["2.1"], pc_beam: ["2.3"], pc_general: ["2.1", "2.3"],
    pc_column: ["2.1"], pc_slab: ["2.1"], pc_wall: ["2.1"],
    rc_footing: ["2.2"], rc_beam: ["2.4"], rc_column: ["2.5"],
    rc_slab: ["2.6", "2.7", "2.4"], rc_wall: ["2.7", "2.5"], rc_general: ["2.2", "2.4", "2.5"],
    steel: ["2.8"],
  };

  const pickFamilyTemplate = (item: any, templates: any[]) => {
    const family = getEngineeringFamily(item);
    const wanted = FAMILY_TEMPLATE_CODES[family];
    if (wanted) {
      for (const c of wanted) {
        const hit = templates.find((tp: any) => tp.item_code === c);
        if (hit) return hit;
      }
      return null;
    }
    const prefix = family === "earthworks" ? "1." : family === "insulation" ? "3." : null;
    if (!prefix) return null;
    const list = templates.filter((tp: any) => String(tp.item_code || "").startsWith(prefix));
    if (!list.length) return null;
    const code = String(item?.item_code || "");
    const common = (a: string, b: string) => { let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return i; };
    return [...list].sort((a: any, b: any) => common(String(b.item_code), code) - common(String(a.item_code), code))[0];
  };

  const extractThicknessMeters = (item: any) => {
    const text = normalizeText(item?.item_description);
    const cm = text.match(/(?:^|\s)(\d+(?:\.\d+)?)\s*cm\b/i);
    if (cm) return Number(cm[1]) / 100;
    const mm = text.match(/(?:^|\s)(\d+(?:\.\d+)?)\s*mm\b/i);
    if (mm) return Number(mm[1]) / 1000;
    const meter = text.match(/(?:^|\s)(0?\.\d+|\d+(?:\.\d+)?)\s*m\b/i);
    if (meter) {
      const v = Number(meter[1]);
      if (v > 0 && v <= 1) return v;
    }
    return null;
  };

  // معامل تحويل السعر بين وحدتين (سعر/م2 = سعر/م3 × السمك). null = غير متوافقين
  const unitFactor = (source: any, target: any): number | null => {
    const su = normalizeUnit(source?.unit), tu = normalizeUnit(target?.unit);
    if (su === tu) return 1;
    if (su === "m3" && tu === "m2") { const th = extractThicknessMeters(target); return th ? th : null; }
    if (su === "m2" && tu === "m3") { const th = extractThicknessMeters(source); return th ? 1 / th : null; }
    return null;
  };

  // نفس مدخلات التسعير اليدوي بالظبط (6 مفاتيح بس) عشان الـ RPC يتصرف زي الشاشة اليدوية
  const buildDefaultAnswers = (item: any, questions: any[], hint?: any) => {
    const answersJson: Record<string, any> = { qty: Number(item?.quantity || 0) };
    const hintAnswers = hint?.pricing?.answers_used;
    if (hintAnswers && typeof hintAnswers === "object") {
      ["wastage_concrete", "steel_ratio", "overhead", "risk", "profit"].forEach((k) => {
        if (hintAnswers[k] !== undefined && hintAnswers[k] !== null && hintAnswers[k] !== "") answersJson[k] = hintAnswers[k];
      });
    }
    (questions || []).forEach((q: any) => {
      const raw = q.default_value;
      if (raw === null || raw === undefined || raw === "") return;
      const numeric = !isNaN(Number(raw)) ? Number(raw) : raw;
      if (q.helps_with === "wastage" && answersJson.wastage_concrete === undefined) answersJson.wastage_concrete = numeric;
      if (q.helps_with === "steel_ratio" && answersJson.steel_ratio === undefined) answersJson.steel_ratio = numeric;
      if (q.helps_with === "overhead" && answersJson.overhead === undefined) answersJson.overhead = numeric;
      if (q.helps_with === "risk" && answersJson.risk === undefined) answersJson.risk = numeric;
      if (q.helps_with === "profit" && answersJson.profit === undefined) answersJson.profit = numeric;
      if (q.helps_with === "quantity") answersJson.qty = numeric;
    });
    return answersJson;
  };

  const saveBreakdownResult = async (
    item: any,
    pricing: any,
    components: any[],
    extra: Record<string, any> = {}
  ) => {
    const payload: any = {
      user_name: userName,
      item_code: item.item_code || "",
      item_description: item.item_description?.substring(0, 500) || "",
      unit: item.unit || "",
      quantity: Number(item.quantity || 0),
      source_file: item.source_file || "",
      source_sheet: item.source_sheet || "",
      direct_cost: Number(pricing?.direct_cost || 0),
      wastage_cost: Number(pricing?.wastage_cost || 0),
      overhead_cost: Number(pricing?.overhead_cost || 0),
      risk_cost: Number(pricing?.risk_cost || 0),
      profit_cost: Number(pricing?.profit_cost || 0),
      final_price: Number(pricing?.final_price || 0),
      components: components || [],
      pricing: pricing || {},
    };

    let lookup = supabase
      .from("breakdown_results")
      .select("id")
      .eq("user_name", userName)
      .eq("item_code", item.item_code || "")
      .eq("source_file", item.source_file || "")
      .eq("source_sheet", item.source_sheet || "");
    if (isNoCode(item.item_code)) lookup = lookup.eq("item_description", String(item.item_description || "").substring(0, 500));
    const { data: existing, error: existingError } = await lookup.limit(1).maybeSingle();
    if (existingError) throw existingError;

    const run = (body: any) =>
      existing?.id
        ? supabase.from("breakdown_results").update(body).eq("id", existing.id).select().single()
        : supabase.from("breakdown_results").insert(body).select().single();

    let { data, error } = await run({ ...payload, ...extra });
    if (error) {
      // fallback: لو عمود إضافي مش موجود في الجدول نحفظ بدونه (نبقي على pricing)
      const safeExtra: Record<string, any> = {};
      if (extra.pricing) safeExtra.pricing = extra.pricing;
      ({ data, error } = await run({ ...payload, ...safeExtra }));
    }
    if (error) throw error;
    return data;
  };

  // ---------------- قوالب + أسئلة (مع كاش) ----------------
  const loadTemplates = async () => {
    if (!engineCache.current.templates) {
      const { data, error } = await supabase.from("breakdown_templates").select("id, item_code");
      if (error) throw error;
      engineCache.current.templates = data || [];
    }
    return engineCache.current.templates as any[];
  };

  const loadQuestions = async (templateId: number) => {
    if (!engineCache.current.questions[templateId]) {
      const { data, error } = await supabase
        .from("breakdown_questions").select("*").eq("template_id", templateId).order("question_order");
      if (error) throw error;
      engineCache.current.questions[templateId] = data || [];
    }
    return engineCache.current.questions[templateId];
  };

  // حساب من قالب. أي فشل = throw برسالة واضحة (والمنسّق بيسجّلها ويكمّل)
  const calcFromTemplate = async (item: any, template: any, templateSource: string) => {
    const questions = await loadQuestions(template.id);
    const answersJson = buildDefaultAnswers(item, questions);

    const { data: answerRow, error: answerError } = await supabase
      .from("breakdown_answers")
      .insert({
        user_name: userName,
        parsed_item_id: item.id || null,
        template_id: template.id,
        answers: answersJson,
        status: "draft",
      })
      .select()
      .single();
    if (answerError) throw new Error("حفظ الإجابات: " + answerError.message);
    if (!answerRow) throw new Error("فشل إنشاء إجابة Breakdown");

    const cleanup = async () => { await supabase.from("breakdown_answers").delete().eq("id", answerRow.id); };

    const rpcName = getBreakdownRpcName(template.item_code);
    const { error: rpcError } = await supabase.rpc(rpcName, { p_answer_id: answerRow.id });
    if (rpcError) { await cleanup(); throw new Error(`${rpcName}: ${rpcError.message}`); }

    const [pr, cr] = await Promise.all([
      supabase.from("breakdown_pricing").select("*").eq("answer_id", answerRow.id).single(),
      supabase.from("breakdown_components").select("*").eq("answer_id", answerRow.id).order("component_type"),
    ]);
    const pricing = pr.data;
    if (pr.error || !pricing || !(Number(pricing.final_price) > 0)) {
      await cleanup();
      throw new Error(`${rpcName}: الحساب ما أنتجش سعر (${pr.error?.message || "final_price = 0"})`);
    }

    const family = getEngineeringFamily(item);
    const meta = {
      ...pricing,
      auto_source: templateSource,
      auto_confidence: templateSource === "exact" ? 1 : 0.75,
      engineering_family: family,
      template_item_code: template.item_code,
      answers_used: answersJson,
    };
    await saveBreakdownResult(item, pricing, cr.data || [], { pricing: meta });
    return Number(pricing.final_price);
  };

  // ---------------- الاستنتاج من بند مسعّر مشابه ----------------
  const scoreSimilarBreakdown = (item: any, candidate: any) => {
    const toks = (s: any) => new Set(normalizeText(s).split(/\s+/).filter((x: string) => x.length >= 3));
    const A = toks(item?.item_description), B = toks(candidate?.item_description);
    let common = 0;
    A.forEach((x) => { if (B.has(x)) common++; });
    const union = new Set([...A, ...B]).size;
    const textScore = union ? common / union : 0;

    const fa = getEngineeringFamily(item), fb = getEngineeringFamily(candidate);
    const sameFamily = fa === fb;
    const cls = (f: string) => f.split("_")[0];
    const unitScore = normalizeUnit(item?.unit) === normalizeUnit(candidate?.unit) ? 0.25 : 0.12;
    const familyScore = sameFamily ? 0.25 : (/^(rc|pc)_/.test(fa) && cls(fa) === cls(fb) ? 0.10 : 0);
    const codeA = String(item?.item_code || "").trim(), codeB = String(candidate?.item_code || "").trim();
    const prefixScore = codeA && codeB && codeA.split(".")[0] === codeB.split(".")[0] ? 0.10 : 0;
    return { score: Math.min(1, textScore * 0.40 + unitScore + familyScore + prefixScore), textScore, sameFamily };
  };

  const findSimilarBreakdown = async (item: any) => {
    const { data, error } = await supabase
      .from("breakdown_results").select("*").eq("user_name", userName).limit(1000);
    if (error) throw error;

    const fa = getEngineeringFamily(item);
    const concrete = /^(rc|pc)_/.test(fa);
    const general = /_general$|^generic_/.test(fa);
    let best: any = null;

    for (const cand of data || []) {
      if (cand.item_code === item.item_code && cand.source_file === item.source_file && cand.source_sheet === item.source_sheet) continue;
      if (!(Number(cand.final_price) > 0)) continue;
      const src = cand.pricing?.auto_source;
      if (src === "similar_item" || src === "inferred") continue; // مفيش استنتاج على استنتاج
      const factor = unitFactor(cand, item);
      if (factor === null) continue;                              // وحدات غير متوافقة
      const fb = getEngineeringFamily(cand);
      if (concrete && fa.split("_")[0] !== fb.split("_")[0]) continue; // PC ≠ RC
      const { score, textScore, sameFamily } = scoreSimilarBreakdown(item, cand);
      const ok = sameFamily
        ? (score >= 0.55 && textScore >= (general ? 0.30 : 0.15))
        : (concrete && score >= 0.52 && textScore >= 0.25);
      if (!ok) continue;
      if (!best || score > best.score) best = { candidate: cand, score, factor, sameFamily };
    }
    return best;
  };

  const buildInferred = (item: any, match: any) => {
    const source = match.candidate;
    const f: number = match.factor;
    const scale = (v: any) => Math.round(Number(v || 0) * f * 100) / 100;
    const sourceQty = Number(source.quantity || 0);
    const targetQty = Number(item.quantity || 0);

    const components = (Array.isArray(source.components) && sourceQty > 0 ? source.components : []).map((c: any, idx: number) => {
      const q = (Number(c.quantity || 0) / sourceQty) * targetQty * f;
      const rate = Number(c.unit_rate || 0);
      return { ...c, id: `inf-${idx}`, answer_id: undefined, quantity: q, total_cost: rate * q, source: "inferred", is_manual: false };
    });

    const pricing = {
      ...(source.pricing || {}),
      id: undefined,
      answer_id: undefined, // مهم: بدون ده التعديل كان بيكتب على مكونات البند المصدر
      direct_cost: scale(source.direct_cost),
      wastage_cost: scale(source.wastage_cost),
      overhead_cost: scale(source.overhead_cost),
      risk_cost: scale(source.risk_cost),
      profit_cost: scale(source.profit_cost),
      subtotal: scale(source.pricing?.subtotal),
      final_price: scale(source.final_price),
      auto_source: "similar_item",
      auto_confidence: Number(match.score.toFixed(3)),
      inferred_from_item_code: source.item_code,
      unit_factor: f,
      needs_review: true,
      engineering_family: getEngineeringFamily(item),
    };
    return { pricing, components };
  };

  // ---------------- المنسّق: تسعير بند واحد ----------------
  // phase: "template" = قوالب فقط | "infer" = استنتاج فقط | "all" = الاتنين بالترتيب
  const autoPriceItem = async (item: any, phase: "all" | "template" | "infer" = "all") => {
    const reasons: string[] = [];
    if (!userName || !item) return { price: null as number | null, source: "none", reasons: ["لا يوجد مستخدم/بند"] };

    const markMatched = async () => {
      if (item?.id) await supabase.from("parsed_boq_items").update({ status: "matched" }).eq("id", item.id).neq("status", "approved");
    };

    // 0) موجود بالفعل؟ ما نكرّرش ولا نمسح تعديلات المستخدم
    try {
      let q = supabase
        .from("breakdown_results").select("id, final_price")
        .eq("user_name", userName)
        .eq("item_code", item.item_code || "")
        .eq("source_file", item.source_file || "")
        .eq("source_sheet", item.source_sheet || "");
      if (isNoCode(item.item_code)) q = q.eq("item_description", String(item.item_description || "").substring(0, 500));
      const { data: existing, error } = await q.limit(1).maybeSingle();
      if (error) throw error;
      if (existing && Number(existing.final_price) > 0) {
        await markMatched();
        return { price: Number(existing.final_price), source: "existing", reasons };
      }
    } catch (e: any) { reasons.push("فحص التكرار: " + (e?.message || e)); }

    // 1) قالب مطابق ثم قالب من نفس العائلة
    if (phase !== "infer") {
      let templates: any[] = [];
      try { templates = await loadTemplates(); } catch (e: any) { reasons.push("تحميل القوالب: " + (e?.message || e)); }

      const candidates: { template: any; source: string }[] = [];
      const code = String(item.item_code || "").trim();
      const exact = templates.find((tp: any) => tp.item_code === code);
      if (exact) candidates.push({ template: exact, source: "exact" });
      const fam = pickFamilyTemplate(item, templates);
      if (fam && (!exact || fam.id !== exact.id)) candidates.push({ template: fam, source: "family_template" });

      if (!candidates.length) reasons.push(`لا يوجد قالب مطابق أو لعائلة (${getEngineeringFamily(item)})`);
      for (const c of candidates) {
        try {
          const price = await calcFromTemplate(item, c.template, c.source);
          await markMatched();
          return { price, source: c.source, reasons };
        } catch (e: any) {
          reasons.push(`قالب ${c.template.item_code} (${c.source === "exact" ? "مطابق" : "عائلة"}): ${e?.message || e}`);
        }
      }
    }

    // 2) استنتاج من بند مسعّر مشابه (نفس الوحدة/قابلة للتحويل + نفس نوع الخرسانة)
    if (phase !== "template") {
      try {
        const match = await findSimilarBreakdown(item);
        if (match) {
          const { pricing, components } = buildInferred(item, match);
          if (Number(pricing.final_price) > 0) {
            await saveBreakdownResult(item, pricing, components);
            await markMatched();
            return { price: Number(pricing.final_price), source: "similar_item", reasons };
          }
        } else {
          reasons.push("لا يوجد بند مسعّر مشابه (نفس العائلة/الوحدة) لاستنتاج السعر منه");
        }
      } catch (e: any) { reasons.push("الاستنتاج: " + (e?.message || e)); }
    }

    return { price: null as number | null, source: "none", reasons };
  };

  // للتوافق مع أي استدعاء قديم
  const autoBreakdownForItem = async (item: any) => (await autoPriceItem(item, "all")).price;

  // ---------------- دفعة كاملة: مرحلتين (القوالب أولاً ثم الاستنتاج) ----------------
  const runAutoPricingBatch = async (items: any[], onProgress?: (msg: string) => void) => {
    let priced = 0;
    const retry: { item: any; reasons: string[] }[] = [];
    const failed: any[] = [];

    for (let i = 0; i < items.length; i++) {
      onProgress?.(`⚡ مرحلة 1/2 — القوالب (${i + 1}/${items.length})`);
      let r: any;
      try { r = await autoPriceItem(items[i], "template"); }
      catch (e: any) { r = { price: null, reasons: [String(e?.message || e)] }; }
      if (r.price) priced++; else retry.push({ item: items[i], reasons: r.reasons });
    }

    for (let i = 0; i < retry.length; i++) {
      onProgress?.(`🧠 مرحلة 2/2 — استنتاج من البنود المسعّرة (${i + 1}/${retry.length})`);
      let r: any;
      try { r = await autoPriceItem(retry[i].item, "infer"); }
      catch (e: any) { r = { price: null, reasons: [String(e?.message || e)] }; }
      if (r.price) priced++;
      else failed.push({ item: retry[i].item, reasons: [...retry[i].reasons, ...r.reasons] });
    }

    setAutoReport(failed.map((f) => ({
      code: f.item.item_code,
      description: String(f.item.item_description || "").substring(0, 90),
      unit: f.item.unit,
      quantity: f.item.quantity,
      reasons: f.reasons,
    })));
    return { priced, total: items.length, failed };
  };

  const autoPriceAllPending = async () => {
    if (autoRunning) return;
    const pending = savedParsedItems.filter(
      (x: any) => !parsedBreakdowns[getBreakdownKey(x)] && !parsedBreakdowns[getLegacyBreakdownKey(x)]
    );
    if (pending.length === 0) { alert("لا توجد بنود تحتاج تسعير تلقائي حاليًا."); return; }
    setAutoRunning(true);
    try {
      engineCache.current = { templates: null, questions: {} };
      const res = await runAutoPricingBatch(pending, setAutoProgress);
      await loadParsedItems();
      alert(`⚡ تم تسعير ${res.priced} من ${res.total} بند تلقائيًا.\n` + (res.failed.length ? `📝 ${res.failed.length} بند محتاج تدخل — هيظهر لك تقرير بالأسباب.` : "✅ كل البنود اتسعّرت."));
      if (res.failed.length) setShowAutoReport(true);
    } catch (e: any) {
      alert("خطأ: " + (e?.message || e));
    } finally {
      setAutoProgress("");
      setAutoRunning(false);
    }
  };

  const autoPriceOneItem = async (item: any, force = false, existingBd?: any) => {
    if (autoRunning) return;
    if (force && !confirm("سيتم مسح التسعير الحالي لهذا البند وإعادة التسعير التلقائي. متأكد؟")) return;
    setAutoRunning(true);
    try {
      if (force && existingBd?.id) {
        await supabase.from("breakdown_results").delete().eq("id", existingBd.id);
        if (item.id) await supabase.from("breakdown_answers").delete().eq("user_name", userName).eq("parsed_item_id", item.id);
      }
      const r = await autoPriceItem(item, "all");
      await loadParsedItems();
      if (!r.price) alert("تعذّر التسعير التلقائي:\n" + r.reasons.join("\n"));
    } catch (e: any) {
      alert("خطأ: " + (e?.message || e));
    }
    setAutoRunning(false);
  };

  // إعادة تسعير كل البنود اللي اتسعّرت تلقائيًا (ومتراجعتش يدويًا) بالمحرك الجديد
  const repriceAutoItems = async () => {
    if (autoRunning) return;
    const targets = savedParsedItems.filter((it: any) => {
      const bd = parsedBreakdowns[getBreakdownKey(it)] || parsedBreakdowns[getLegacyBreakdownKey(it)];
      return it.status !== "approved" && bd?.pricing?.auto_source && !bd?.pricing?.manually_reviewed && !bd?.manually_reviewed;
    });
    if (!targets.length) { alert("لا توجد بنود مسعّرة تلقائيًا وغير معدّلة يدويًا."); return; }
    if (!confirm(`سيتم مسح وإعادة تسعير ${targets.length} بند مسعّر تلقائيًا (التعديلات اليدوية لن تتأثر). متأكد؟`)) return;
    setAutoRunning(true);
    try {
      engineCache.current = { templates: null, questions: {} };
      for (const it of targets) {
        const bd = parsedBreakdowns[getBreakdownKey(it)] || parsedBreakdowns[getLegacyBreakdownKey(it)];
        if (bd?.id) await supabase.from("breakdown_results").delete().eq("id", bd.id);
        if (it.id) await supabase.from("breakdown_answers").delete().eq("user_name", userName).eq("parsed_item_id", it.id);
      }
      const res = await runAutoPricingBatch(targets, setAutoProgress);
      await loadParsedItems();
      alert(`🔄 تمت إعادة تسعير ${res.priced} من ${res.total} بند.`);
      if (res.failed.length) setShowAutoReport(true);
    } catch (e: any) {
      alert("خطأ: " + (e?.message || e));
    } finally {
      setAutoProgress("");
      setAutoRunning(false);
    }
  };

  const autoSourceLabel = (bd: any) => {
    const p = bd?.pricing || {};
    if (p.manually_reviewed || bd?.manually_reviewed) return { label: "✍️ مراجَع يدويًا", cls: "text-purple-600" };
    switch (p.auto_source) {
      case "exact":
      case "template": return { label: "⚡ قالب مطابق", cls: "text-green-600" };
      case "family_template": return { label: "🔍 قالب نفس العائلة", cls: "text-amber-600" };
      case "similar_item":
      case "inferred": return { label: "🧠 استنتاج — راجعه", cls: "text-orange-600" };
      default: return null;
    }
  };

  const openSavedBreakdownForEdit = async (bd: any) => {
    if (!bd) return;

    setBreakdownItem({
      id: bd.parsed_item_id || null,
      item_code: bd.item_code,
      item_description: bd.item_description,
      unit: bd.unit,
      quantity: bd.quantity,
      source_file: bd.source_file,
      source_sheet: bd.source_sheet,
    });

    setBreakdownResult({
      ...bd,
      answer_id: bd.answer_id || bd.pricing?.answer_id || null,
      saved_result_id: bd.id,
    });

    setBreakdownComponents(
      Array.isArray(bd.components)
        ? bd.components.map((c: any) => ({ ...c }))
        : []
    );

    setShowViewBreakdownModal(false);
    setShowBreakdownView(true);
  };

  const openBreakdownQuestions = async (parsedItem: any) => {
    setBreakdownItem(parsedItem);
    setLoadingBreakdown(true);
    setBreakdownAnswers({});
    setExpertAnswers({});
    try {
      const allTemplates = await loadTemplates();
      const wantedCode = parsedItem.item_code || "CO-003";
      const template = allTemplates.find((tp: any) => tp.item_code === wantedCode) || pickFamilyTemplate(parsedItem, allTemplates);
      if (!template) {
        alert("لا يوجد قالب Breakdown لهذا البند");
        setLoadingBreakdown(false);
        return;
      }
      const { data: questions } = await supabase
        .from("breakdown_questions")
        .select("*")
        .eq("template_id", template.id)
        .order("question_order");
      setBreakdownQuestions(questions || []);
      const defaults: Record<string, any> = { qty: parsedItem.quantity || 0 };
      (questions || []).forEach((q: any) => {
        defaults[`q_${q.id}`] = q.default_value || "";
      });
      setBreakdownAnswers(defaults);
      setShowBreakdownQuestions(true);
    } catch (err: any) {
      alert("خطأ: " + err.message);
    }
    setLoadingBreakdown(false);
  };

  const calculateBreakdown = async () => {
    if (!breakdownItem) return;
    setLoadingBreakdown(true);
    try {
      const itemCode = breakdownItem.item_code || "";
      
      const allTemplates = await loadTemplates();
      const template = allTemplates.find((tp: any) => tp.item_code === itemCode) || pickFamilyTemplate(breakdownItem, allTemplates);

      if (!template) throw new Error("لا يوجد قالب Breakdown لهذا البند");

      const answersJson: Record<string, any> = {
        qty: breakdownItem.quantity || 0,
      };

      breakdownQuestions.forEach((q: any) => {
        const val = breakdownAnswers[`q_${q.id}`];
        if (val === undefined || val === null || val === "") return;
        const numVal = typeof val === "string" && !isNaN(Number(val)) ? Number(val) : val;
        if (q.helps_with === "wastage") answersJson.wastage_concrete = numVal;
        if (q.helps_with === "steel_ratio") answersJson.steel_ratio = numVal;
        if (q.helps_with === "overhead") answersJson.overhead = numVal;
        if (q.helps_with === "risk") answersJson.risk = numVal;
        if (q.helps_with === "profit") answersJson.profit = numVal;
        if (q.helps_with === "quantity") answersJson.qty = numVal;
      });

      const { data: answerRow } = await supabase
        .from("breakdown_answers")
        .insert({
          user_name: userName,
          parsed_item_id: breakdownItem.id,
          template_id: template.id,
          answers: answersJson,
          status: "draft",
        })
        .select()
        .single();

      if (!answerRow) throw new Error("فشل حفظ الإجابات");

      // اختيار دالة الحساب حسب كود القالب
      const rpcName = getBreakdownRpcName(template.item_code || itemCode);

      const { error: rpcErr } = await supabase.rpc(rpcName, { p_answer_id: answerRow.id });
      if (rpcErr) throw new Error(`${rpcName}: ${rpcErr.message}`);

      const { data: components } = await supabase
        .from("breakdown_components")
        .select("*")
        .eq("answer_id", answerRow.id)
        .order("component_type");

      const { data: pricing } = await supabase
        .from("breakdown_pricing")
        .select("*")
        .eq("answer_id", answerRow.id)
        .single();

      // تعديلات الخبرة الميدانية (حسب المستوى) تتضاف كمكونات قابلة للتعديل
      const adj = await applyExpertAdjustments(breakdownItem, answerRow.id, components || [], pricing);
      setBreakdownResult({ ...adj.pricing, answer_id: answerRow.id, user_level: userLevel, expert_adjustments: adj.adjustments });
      setBreakdownComponents(adj.components);
      setExpertAnswers({});
      setShowBreakdownQuestions(false);
      setShowBreakdownView(true);
    } catch (err: any) {
      alert("خطأ: " + err.message);
    }
    setLoadingBreakdown(false);
  };

  const recalculateBreakdownTotals = async () => {
    let components: any[] = [];

    if (breakdownResult?.answer_id) {
      const { data, error } = await supabase
        .from("breakdown_components")
        .select("*")
        .eq("answer_id", breakdownResult.answer_id);
      if (error) throw error;
      components = data || [];
    } else {
      components = breakdownComponents || [];
    }

    if (!components) return;
    const direct = components.reduce((sum, c) => sum + Number(c.total_cost || 0), 0);
    // نسب القالب نفسه (لو موجودة) بدل نسب ثابتة
    const pctOf = (v: any, d: number) => {
      const n = Number(v);
      if (v === undefined || v === null || v === "" || !isFinite(n)) return d;
      return n > 1 ? n / 100 : n;
    };
    const wastage = direct * pctOf(breakdownResult?.wastage_pct, 0.05);
    const subtotal = direct + wastage;
    const overhead = subtotal * pctOf(breakdownResult?.overhead_pct, 0.10);
    const risk = subtotal * pctOf(breakdownResult?.risk_pct, 0.03);
    const profit = (subtotal + overhead + risk) * pctOf(breakdownResult?.profit_pct, 0.15);
    const final = subtotal + overhead + risk + profit;
    if (breakdownResult?.answer_id) {
      await supabase
        .from("breakdown_pricing")
        .update({
          direct_cost: Math.round(direct), wastage_cost: Math.round(wastage),
          subtotal: Math.round(subtotal), overhead_cost: Math.round(overhead),
          risk_cost: Math.round(risk), profit_cost: Math.round(profit),
          final_price: Math.round(final),
        })
        .eq("answer_id", breakdownResult.answer_id);
    }
    setBreakdownResult((prev: any) => ({
      ...prev, direct_cost: Math.round(direct), wastage_cost: Math.round(wastage),
      subtotal: Math.round(subtotal), overhead_cost: Math.round(overhead),
      risk_cost: Math.round(risk), profit_cost: Math.round(profit),
      final_price: Math.round(final),
    }));
  };

  const updateBreakdownComponent = async (componentId: number, newQty: number, newRate: number) => {
    const newTotal = newQty * newRate;

    if (breakdownResult?.answer_id) {
      const { error } = await supabase
        .from("breakdown_components")
        .update({
          quantity: newQty,
          unit_rate: newRate,
          total_cost: newTotal,
          is_manual: true,
        })
        .eq("id", componentId);

      if (error) {
        alert("خطأ: " + error.message);
        return;
      }
    }

    setBreakdownComponents((prev) =>
      prev.map((c) =>
        c.id === componentId
          ? { ...c, quantity: newQty, unit_rate: newRate, total_cost: newTotal, is_manual: true }
          : c
      )
    );

    await recalculateBreakdownTotals();
  };

  const addBreakdownComponent = async () => {
    if (!newBreakdownComponent.component_name || !newBreakdownComponent.unit_rate) {
      alert("املأ اسم المكون والسعر");
      return;
    }

    const newTotal = newBreakdownComponent.quantity * newBreakdownComponent.unit_rate;

    if (breakdownResult?.answer_id) {
      const { data, error } = await supabase
        .from("breakdown_components")
        .insert({
          answer_id: breakdownResult.answer_id,
          component_type: newBreakdownComponent.component_type,
          component_name: newBreakdownComponent.component_name,
          quantity: newBreakdownComponent.quantity,
          unit: newBreakdownComponent.unit,
          unit_rate: newBreakdownComponent.unit_rate,
          total_cost: newTotal,
          source: "manual",
          is_manual: true,
        })
        .select()
        .single();

      if (error) {
        alert("خطأ: " + error.message);
        return;
      }

      if (data) setBreakdownComponents((prev) => [...prev, data]);
    } else {
      setBreakdownComponents((prev) => [
        ...prev,
        {
          id: `manual-${Date.now()}`,
          component_type: newBreakdownComponent.component_type,
          component_name: newBreakdownComponent.component_name,
          quantity: newBreakdownComponent.quantity,
          unit: newBreakdownComponent.unit,
          unit_rate: newBreakdownComponent.unit_rate,
          total_cost: newTotal,
          source: "manual",
          is_manual: true,
        },
      ]);
    }

    setNewBreakdownComponent({
      component_type: "خامات",
      component_name: "",
      quantity: 1,
      unit: "كجم",
      unit_rate: 0,
    });
    setShowAddBreakdownComponentModal(false);
    await recalculateBreakdownTotals();
  };

  const removeBreakdownComponent = async (componentId: number | string) => {
    if (!confirm("هل تريد حذف هذا المكون؟")) return;

    if (breakdownResult?.answer_id) {
      const { error } = await supabase
        .from("breakdown_components")
        .delete()
        .eq("id", componentId);

      if (error) {
        alert("خطأ: " + error.message);
        return;
      }
    }

    setBreakdownComponents((prev) => prev.filter((c) => c.id !== componentId));
    await recalculateBreakdownTotals();
  };

  const approveBreakdown = async () => {
    if (!breakdownResult || !breakdownItem) return;

    try {
      const itemCode = breakdownItem.item_code || "";
      const payload = {
        user_name: userName,
        item_code: itemCode,
        item_description: breakdownItem.item_description?.substring(0, 500) || "",
        unit: breakdownItem.unit || "",
        quantity: Number(breakdownItem.quantity || 0),
        source_file: breakdownItem.source_file || "",
        source_sheet: breakdownItem.source_sheet || "",
        direct_cost: Number(breakdownResult.direct_cost || 0),
        wastage_cost: Number(breakdownResult.wastage_cost || 0),
        overhead_cost: Number(breakdownResult.overhead_cost || 0),
        risk_cost: Number(breakdownResult.risk_cost || 0),
        profit_cost: Number(breakdownResult.profit_cost || 0),
        final_price: Number(breakdownResult.final_price || 0),
        components: breakdownComponents || [],
        pricing: {
          ...(breakdownResult.pricing || {}),
          ...breakdownResult,
          manually_reviewed: true,
          auto_source: breakdownResult.auto_source || null,
        },
      };

      let savedId = breakdownResult.saved_result_id || breakdownResult.id || null;

      if (savedId) {
        const { error } = await supabase
          .from("breakdown_results")
          .update(payload)
          .eq("id", savedId)
          .eq("user_name", userName);
        if (error) throw error;
      } else {
        const saved = await saveBreakdownResult(
          breakdownItem,
          breakdownResult,
          breakdownComponents || [],
          {
            pricing: payload.pricing,
            manually_reviewed: true,
          }
        );
        savedId = saved?.id || null;
      }

      if (breakdownItem.id) {
        await supabase
          .from("parsed_boq_items")
          .update({ status: "approved" })
          .eq("id", breakdownItem.id);
        setSavedParsedItems((prev) => prev.map((p) => (p.id === breakdownItem.id ? { ...p, status: "approved" } : p)));
      }

      setParsedBreakdowns((prev) => ({
        ...prev,
        [getBreakdownKey(breakdownItem)]: { ...payload, id: savedId },
      }));

      alert(
        `✅ تم ${breakdownResult.saved_result_id ? "تحديث" : "حفظ"} Breakdown بسعر ${Number(
          breakdownResult.final_price || 0
        ).toLocaleString("ar-EG")} ج.م/${breakdownItem.unit}`
      );

      setShowBreakdownView(false);
      setBreakdownItem(null);
      setBreakdownResult(null);
      setBreakdownComponents([]);
    } catch (err: any) {
      alert("خطأ: " + err.message);
    }
  };

  // ============================================
  // Breakdown Results (Saved)
  // ============================================
  const loadBreakdownResults = async () => {
    setLoadingBreakdowns(true);
    const { data, error } = await supabase
      .from("breakdown_results").select("*").eq("user_name", userName).order("created_at", { ascending: false });
    if (data) setSavedBreakdowns(data);
    if (error) console.error("Error loading breakdowns:", error);
    setLoadingBreakdowns(false);
    setShowBreakdownsModal(true);
  };

  const deleteBreakdownResult = async (id: number) => {
    if (!confirm("هل تريد حذف هذا Breakdown؟")) return;
    const { error } = await supabase.from("breakdown_results").delete().eq("id", id);
    if (error) { alert("خطأ: " + error.message); return; }
    setSavedBreakdowns(savedBreakdowns.filter((b) => b.id !== id));
    alert("✅ تم الحذف");
  };

  const exportBreakdownsToExcel = () => {
    if (savedBreakdowns.length === 0) { alert("لا توجد Breakdowns"); return; }
    let csv = "\uFEFF";
    csv += `Breakdowns — ${userName}\n`;
    csv += `التاريخ: ${new Date().toLocaleDateString("ar-EG")}\n\n`;
    csv += "الكود,الوصف,الوحدة,الكمية,سعر الوحدة,الإجمالي,التاريخ\n";
    savedBreakdowns.forEach((bd) => {
      csv += `"${bd.item_code}","${bd.item_description || ""}","${bd.unit}",${bd.quantity},${Math.round(bd.final_price)},${Math.round(bd.final_price * bd.quantity)},"${new Date(bd.created_at).toLocaleDateString("ar-EG")}"\n`;
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Breakdowns_${userName}_${new Date().toLocaleDateString("ar-EG").replace(/\//g, "-")}.csv`;
    link.click();
  };

  const loadProjects = async () => {
    const { data } = await supabase.from("user_projects").select("*").eq("user_name", userName).order("created_at", { ascending: false });
    if (data) setSavedProjects(data);
    setShowProjectsModal(true);
  };

  // ============================================
  // BOQ Upload
  // ============================================
  const handleBOQFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    setUploadingBOQ(true);
    setUploadProgress(`جاري معالجة ${files.length} ملف...`);
    setParsedItems([]);
    setFileCount(0);
    try {
      let allParsedItems: ParsedItem[] = [];
      let totalFilesProcessed = 0;
      for (const file of files) {
        const fileExt = file.name.split(".").pop()?.toLowerCase() || "";
        let filesToProcess: { name: string; data: ArrayBuffer }[] = [];
        if (fileExt === "zip") {
          continue;
        } else if (fileExt === "xlsx" || fileExt === "xls" || fileExt === "csv") {
          const buffer = await file.arrayBuffer();
          filesToProcess = [{ name: file.name, data: buffer }];
        } else {
          continue;
        }
        totalFilesProcessed++;
        for (const fileToProcess of filesToProcess) {
          const ext = fileToProcess.name.split(".").pop()?.toLowerCase();
          if (ext === "xlsx" || ext === "xls" || ext === "csv") {
            try {
              const XLSX = await import("xlsx");
              const workbook = XLSX.read(fileToProcess.data, { type: "array" });
              workbook.SheetNames.forEach((sheetName) => {
                const worksheet = workbook.Sheets[sheetName];
                const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
                rows.forEach((row) => {
                  if (!row || row.length === 0) return;
                  const code = String(row[0] || "").trim();
                  const description = String(row[1] || "").trim();
                  const unit = String(row[2] || "").trim();
                  const quantityStr = String(row[3] || "").trim();
                  const quantity = parseFloat(quantityStr.replace(/,/g, "")) || 0;
                  if (description.length < 5) return;
                  if (unit.length === 0 || unit.length > 20) return;
                  if (quantity <= 0) return;
                  allParsedItems.push({
                    source_file: fileToProcess.name,
                    source_sheet: sheetName,
                    item_code: code || "—",
                    item_description: description.substring(0, 500),
                    unit: unit.toLowerCase() === "kg" ? "كجم" : unit,
                    quantity,
                  });
                });
              });
            } catch (err) {}
          }
        }
      }
      setUploadProgress(`✅ تم استخراج ${allParsedItems.length} بند من ${totalFilesProcessed} ملف`);
      setParsedItems(allParsedItems);
      setFileCount(totalFilesProcessed);
    } catch (err: any) {
      alert("خطأ: " + err.message);
    } finally {
      setUploadingBOQ(false);
    }
  };

  const approveParsedItems = async () => {
    if (parsedItems.length === 0) {
      alert("لا توجد بنود لاعتمادها");
      return;
    }

    setUploadingBOQ(true);
    setUploadProgress("⏳ جاري حفظ البنود...");

    try {
      const rows = parsedItems.map((item) => ({
        project_id: null,
        user_name: userName,
        source_file: item.source_file,
        source_sheet: item.source_sheet,
        item_code: item.item_code,
        item_description: item.item_description,
        unit: item.unit,
        quantity: item.quantity,
        status: "pending",
      }));

      const { data: insertedRows, error: insertError } = await supabase
        .from("parsed_boq_items")
        .insert(rows)
        .select();

      if (insertError) throw insertError;

      let autoPriced = 0;
      let manualItems = 0;

      if (insertedRows && insertedRows.length > 0) {
        engineCache.current = { templates: null, questions: {} };
        const res = await runAutoPricingBatch(insertedRows, (msg) => setUploadProgress(msg));
        autoPriced = res.priced;
        manualItems = res.total - res.priced;
      }

      // تحديث الشاشة فورًا من قاعدة البيانات.
      await loadParsedItems();

      alert(
        `✅ تم حفظ ${parsedItems.length} بند.\n` +
        `⚡ تم إنشاء Breakdown وتسعير تلقائي لـ ${autoPriced} بند.\n` +
        `📝 ${manualItems} بند يحتاج مراجعة/تدخل يدوي.`
      );
      if (manualItems > 0) setShowAutoReport(true);

      setShowBOQUploader(false);
      setParsedItems([]);
      setUploadProgress("");
    } catch (err: any) {
      alert("خطأ في الحفظ: " + err.message);
    } finally {
      setUploadingBOQ(false);
    }
  };

  const loadParsedItems = async () => {
    setLoadingParsedItems(true);

    // 1. جلب البنود المستخرجة
    const { data, error } = await supabase
      .from("parsed_boq_items")
      .select("*")
      .eq("user_name", userName)
      .order("source_file", { ascending: true })
      .order("id", { ascending: true });
    if (data) setSavedParsedItems(data);
    if (error) console.error("Error loading parsed items:", error);

    // 2. جلب الـ Breakdowns المرتبطة
    const { data: bdData } = await supabase
      .from("breakdown_results")
      .select("*")
      .eq("user_name", userName);

    if (bdData) {
      const map: Record<string, any> = {};
      bdData.forEach((bd: any) => {
        map[getBreakdownKey(bd)] = bd;
        // المفتاح القديم للسجلات القديمة فقط (بدون ملف) — عشان بند ملف تاني ما يظهرش مسعّر بالغلط
        if (!bd.source_file) map[getLegacyBreakdownKey(bd)] = bd;
      });
      setParsedBreakdowns(map);
    }

    setLoadingParsedItems(false);
    setShowParsedItemsModal(true);
  };

  const deleteParsedItem = async (id: number) => {
    if (!confirm("هل تريد حذف هذا البند المستخرج؟")) return;
    await supabase.from("parsed_boq_items").delete().eq("id", id);
    setSavedParsedItems(savedParsedItems.filter((p) => p.id !== id));
  };

  const clearAllParsedItems = async () => {
    if (!confirm("هل أنت متأكد من حذف كل البنود المستخرجة؟")) return;
    await supabase.from("parsed_boq_items").delete().eq("user_name", userName);
    setSavedParsedItems([]);
    alert("✅ تم حذف كل البنود المستخرجة");
  };

  const addParsedItemToMainTable = async (parsedItem: any) => {
    const { data, error } = await supabase.from("custom_items").insert({
      code: parsedItem.item_code || "PARSED",
      name_ar: parsedItem.item_description.substring(0, 200),
      unit: parsedItem.unit, rate: 0,
      division_code: "00", section_code: parsedItem.source_sheet,
    }).select();
    if (error) { alert("خطأ: " + error.message); return; }
    if (data) {
      setCustomItems([data[0], ...customItems]);
      setUserItems((prev) => ({
        ...prev,
        [data[0].id]: { item_id: data[0].id, quantity: parsedItem.quantity, custom_rate: 0 },
      }));
      alert(`✅ تم إضافة البند إلى الجدول الرئيسي`);
    }
  };

  const filteredParsedItems = useMemo(() => {
    let result = savedParsedItems;
    if (parsedFileFilter) result = result.filter((item) => item.source_file === parsedFileFilter);
    if (parsedSearchQuery) {
      const q = parsedSearchQuery.toLowerCase();
      result = result.filter((item) =>
        item.item_description?.toLowerCase().includes(q) ||
        item.item_code?.toLowerCase().includes(q) ||
        item.source_file?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [savedParsedItems, parsedFileFilter, parsedSearchQuery]);

  const groupedParsedItems = useMemo(() => {
    const groups: Record<string, any[]> = {};
    filteredParsedItems.forEach((item) => {
      if (!groups[item.source_file]) groups[item.source_file] = [];
      groups[item.source_file].push(item);
    });
    return groups;
  }, [filteredParsedItems]);

  const uniqueFiles = useMemo(() => {
    const files = new Set(savedParsedItems.map((item) => item.source_file));
    return Array.from(files).sort();
  }, [savedParsedItems]);

  // حساب الإجمالي الكلي للـ Breakdowns في البنود المستخرجة
  const parsedBreakdownsGrandTotal = useMemo(() => {
    return Object.values(parsedBreakdowns).reduce((sum: number, bd: any) => {
      return sum + (Number(bd?.final_price || 0) * Number(bd?.quantity || 0));
    }, 0);
  }, [parsedBreakdowns]);

  // ============================================
  // Analysis Functions
  // ============================================
  const loadUnifiedRateAnalysis = async (unifiedItem: UnifiedItem) => {
    setAnalysisItem(unifiedItem);
    setShowAnalysis(true);
    setAnalysisComponents([]);
    const divisionCode = unifiedItem.masterformat_code?.substring(0, 2) || "03";
    const { data: mf } = await supabase.from("markup_factors").select("markup_factor").eq("division_code", divisionCode).single();
    if (mf?.markup_factor) setMarkupFactor(mf.markup_factor);
    if (unifiedItem.source === "main") {
      const { data } = await supabase.rpc("get_item_components_for_user", { p_item_id: unifiedItem.id, p_user_name: userName });
      if (data && data.length > 0) {
        setAnalysisComponents(data.map((c: any, idx: number) => ({
          id: c.component_id === 0 ? `base-${idx}` : c.component_id,
          component_type: c.component_type, component_name: c.component_name,
          quantity: c.quantity, unit: c.unit, unit_rate: c.unit_rate, is_custom: c.is_custom,
        })));
      }
    } else { setAnalysisComponents([]); }
    setAnalysisDirty(false);
  };

  const updateComponentQuantity = (id: number | string, qty: number) => {
    setAnalysisComponents((prev) => prev.map((c) => c.id === id ? { ...c, quantity: qty } : c));
    setAnalysisDirty(true);
  };
  const updateComponentRate = (id: number | string, rate: number) => {
    setAnalysisComponents((prev) => prev.map((c) => c.id === id ? { ...c, unit_rate: rate } : c));
    setAnalysisDirty(true);
  };
  const removeComponent = (id: number | string) => {
    if (confirm("هل تريد حذف هذا المكوّن؟")) {
      setAnalysisComponents((prev) => prev.filter((c) => c.id !== id));
      setAnalysisDirty(true);
    }
  };
  const addComponent = () => {
    if (!newComponent.component_name || !newComponent.unit_rate) { alert("املأ اسم المكوّن والسعر"); return; }
    const newId = `custom-${Date.now()}`;
    setAnalysisComponents((prev) => [...prev, { ...newComponent, id: newId, is_custom: true }]);
    setNewComponent({ id: "", component_type: "خامات", component_name: "", quantity: 1, unit: "كجم", unit_rate: 0, is_custom: true });
    setShowAddComponentModal(false);
    setAnalysisDirty(true);
  };

  const saveAnalysis = async (silent: boolean = false) => {
    if (!analysisItem || !userName) return;
    setSavingAnalysis(true);
    await supabase.from("custom_item_components").delete().eq("user_name", userName).eq("item_id", analysisItem.id);
    const rows = analysisComponents.map((c) => ({
      user_name: userName, item_id: analysisItem.id,
      component_type: c.component_type, component_name: c.component_name,
      quantity: c.quantity, unit: c.unit, unit_rate: c.unit_rate,
      total_cost: Math.ceil(c.quantity * c.unit_rate),
    }));
    const { error } = await supabase.from("custom_item_components").insert(rows);
    if (!error && isSubscribed) {
      if (analysisItem.source === "main") {
        await supabase.from("items").update({ final_rate: finalPrice, has_custom_analysis: true }).eq("id", analysisItem.id);
        setAllItems((prev) => prev.map((i) => i.id === analysisItem.id ? { ...i, final_rate: finalPrice, has_custom_analysis: true } : i));
      } else {
        await supabase.from("custom_items").update({ rate: finalPrice }).eq("id", analysisItem.id);
        setCustomItems((prev) => prev.map((i) => i.id === analysisItem.id ? { ...i, rate: finalPrice } : i));
      }
      setUserItems((prev) => {
        const updated = {
          ...prev,
          [analysisItem.id]: { item_id: analysisItem.id as number, quantity: prev[analysisItem.id as number]?.quantity || 0, custom_rate: finalPrice },
        };
        localStorage.setItem("userItems", JSON.stringify(updated));
        return updated;
      });
    }
    setSavingAnalysis(false);
    setAnalysisDirty(false);
    if (error) { if (!silent) alert("خطأ في الحفظ: " + error.message); }
    else { if (!silent) alert("✅ تم حفظ التحليل وتحديث السعر!"); }
  };

  const closeAnalysis = async () => {
    if (analysisDirty && analysisItem && userName) {
      setAutoSaving(true);
      await saveAnalysis(true);
      setAutoSaving(false);
    }
    setShowAnalysis(false);
    setAnalysisDirty(false);
  };

  const resetAnalysis = () => {
    if (!analysisItem) return;
    if (confirm("هل تريد إعادة تعيين التحليل للقيم الأساسية؟")) loadUnifiedRateAnalysis(analysisItem);
  };

  const searchComponents = async () => {
    if (!componentSearch.trim()) return;
    const q = componentSearch.toLowerCase();
    const { data } = await supabase.from("item_components").select("*");
    if (!data) return;
    const matchedComponents = data.filter((c: any) =>
      c.name_ar?.toLowerCase().includes(q) || c.name_en?.toLowerCase().includes(q)
    );
    const results: SearchResult[] = [];
    const seenItems = new Set<number>();
    matchedComponents.forEach((c: any) => {
      if (seenItems.has(c.item_id)) return;
      const item = allItems.find((i) => i.id === c.item_id);
      if (item) {
        seenItems.add(c.item_id);
        results.push({ item, matched_component: c.name_ar || c.name_en, component_rate: c.rate });
      }
    });
    setSearchResults(results);
    setShowSearchModal(true);
  };

  const updateQuantity = (itemId: number, quantity: number) => {
    const item = allItems.find((i) => i.id === itemId);
    const customItem = customItems.find((i) => i.id === itemId);
    const effectiveRate = item?.has_custom_analysis ? (item.final_rate || item.rate) : (item?.rate || customItem?.rate || 0);
    setUserItems((prev) => {
      const updated = { ...prev, [itemId]: { item_id: itemId, quantity: quantity || 0, custom_rate: prev[itemId]?.custom_rate ?? effectiveRate } };
      localStorage.setItem("userItems", JSON.stringify(updated));
      return updated;
    });
  };

  const updateRate = (itemId: number, rate: number) => {
    setUserItems((prev) => {
      const updated = { ...prev, [itemId]: { item_id: itemId, quantity: prev[itemId]?.quantity || 0, custom_rate: rate || 0 } };
      localStorage.setItem("userItems", JSON.stringify(updated));
      return updated;
    });
  };

  const getItemRate = (item: Item) => item.final_rate || item.rate;

  const filteredItems = useMemo(() => {
    let result = allItems;
    if (selectedSection) result = result.filter((i) => i.section_id === selectedSection);
    else if (selectedDivision) {
      const divSections = sections.filter((s) => s.division_id === selectedDivision).map((s) => s.id);
      result = result.filter((i) => divSections.includes(i.section_id));
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((i) => i.name_ar?.toLowerCase().includes(q) || i.name_en?.toLowerCase().includes(q) || i.code?.toLowerCase().includes(q));
    }
    return result;
  }, [allItems, selectedSection, selectedDivision, sections, searchQuery]);

  const filteredSections = useMemo(() => {
    if (!selectedDivision) return [];
    return sections.filter((s) => s.division_id === selectedDivision);
  }, [sections, selectedDivision]);

  const getItemTotal = (itemId: number) => {
    const item = allItems.find((i) => i.id === itemId);
    const ui = userItems[itemId];
    if (!ui) return 0;
    const rate = item?.has_custom_analysis ? (item.final_rate || item.rate) : ui.custom_rate;
    return ui.quantity * rate;
  };

  const getCustomItemTotal = (itemId: number) => {
    const ui = userItems[itemId];
    if (!ui) return 0;
    return ui.quantity * ui.custom_rate;
  };

  const sectionTotal = filteredItems.reduce((sum, item) => sum + getItemTotal(item.id), 0);

  const getDivisionTotal = (divisionId: number) => {
    const divisionSections = sections.filter((s) => s.division_id === divisionId).map((s) => s.id);
    const divisionItems = allItems.filter((i) => divisionSections.includes(i.section_id));
    return divisionItems.reduce((sum, item) => sum + getItemTotal(item.id), 0);
  };

  const projectTotal = divisions.reduce((sum, div) => sum + getDivisionTotal(div.id), 0);
  const customItemsTotal = customItems.reduce((sum, item) => sum + getCustomItemTotal(item.id as number), 0);
  const grandTotal = projectTotal + customItemsTotal;

  const getDivisionItemCount = (divisionId: number) => {
    const divisionSections = sections.filter((s) => s.division_id === divisionId).map((s) => s.id);
    const divisionItems = allItems.filter((i) => divisionSections.includes(i.section_id));
    return divisionItems.filter((i) => userItems[i.id] && userItems[i.id].quantity > 0).length;
  };

  const clearProject = () => {
    if (confirm("هل أنت متأكد من حذف كل الكميات؟")) {
      setUserItems({});
      localStorage.removeItem("userItems");
    }
  };

  const exportToExcel = async () => {
    let approved: any[] = [];
    try { approved = await loadApprovedForSummary(); } catch (e) { console.warn("approved load failed", e); }
    const approvedTotalX = approved.reduce((s, r) => s + r.total, 0);

    let csv = "\uFEFF";
    csv += `المشروع: ${newProjectName || "بدون اسم"}\n`;
    csv += `التاريخ: ${new Date().toLocaleDateString("ar-EG")}\n`;
    csv += `المهندس: ${userName}\n\n`;
    csv += "الكود,البند,الوحدة,الكمية,السعر الفردي,الإجمالي\n";
    allItems.forEach((item) => {
      const ui = userItems[item.id];
      if (ui && ui.quantity > 0) {
        const rate = item.has_custom_analysis ? (item.final_rate || item.rate) : ui.custom_rate;
        csv += `"${item.code || ""}","${item.name_ar || item.name_en || ""}","${item.unit}",${ui.quantity},${rate},${Math.ceil(ui.quantity * rate)}\n`;
      }
    });
    if (approved.length > 0) {
      csv += "\n\nبنود المقايسة المرفوعة (المعتمدة)\n";
      csv += "الشيت,الكود,البند,الوحدة,الكمية,السعر الفردي,الإجمالي\n";
      approved.forEach((r) => {
        csv += `"${r.item.source_sheet || ""}","${r.item.item_code || ""}","${String(r.item.item_description || "").replace(/"/g, '""')}","${r.item.unit || ""}",${r.item.quantity || 0},${Math.round(r.price)},${Math.round(r.total)}\n`;
      });
      csv += `,,,,,"إجمالي المرفوعة",${Math.round(approvedTotalX)}\n`;
    }
    csv += "\n\nملخص المقايسة\n";
    csv += "الكود,التقسيم,الإجمالي\n";
    divisions.forEach((div) => {
      const total = getDivisionTotal(div.id);
      if (total > 0) csv += `"${div.code}","${div.name_ar}",${Math.ceil(total)}\n`;
    });
    if (approvedTotalX > 0) csv += `,"المقايسة المرفوعة (المعتمدة)",${Math.round(approvedTotalX)}\n`;
    csv += `,"الإجمالي الكلي",${Math.ceil(grandTotal + approvedTotalX)}\n`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `BOQ_${newProjectName || "project"}_${new Date().toLocaleDateString("ar-EG").replace(/\//g, "-")}.csv`;
    link.click();
  };

  const printBOQ = () => window.print();

  const saveProject = async () => {
    if (!newProjectName.trim()) { alert("اكتب اسم المشروع أولاً"); return; }
    setUploadingFile(true);
    let fileUrl = null, fileName = null, fileType = null;
    if (newProjectFile) {
      const fileExt = newProjectFile.name.split(".").pop();
      const randomId = Math.random().toString(36).substring(2, 10);
      const fileName_ = `${Date.now()}_${randomId}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from("project-files").upload(fileName_, newProjectFile);
      if (uploadError) { alert("خطأ في رفع الملف: " + uploadError.message); setUploadingFile(false); return; }
      const { data: urlData } = supabase.storage.from("project-files").getPublicUrl(fileName_);
      fileUrl = urlData.publicUrl;
      fileName = newProjectFile.name;
      fileType = newProjectFile.type;
    }
    const { data, error } = await supabase.from("user_projects").insert({
      project_name: newProjectName, project_data: userItems, total_amount: Math.ceil(grandTotal),
      user_name: userName, client_name: newProjectClient || null, location: newProjectLocation || null,
      project_type: newProjectType, project_stage: newProjectStage, description: newProjectDescription || null,
      file_url: fileUrl, file_name: fileName, file_type: fileType,
    }).select();
    setUploadingFile(false);
    if (error) { alert("حدث خطأ: " + error.message); return; }
    if (data) {
      alert("✅ تم حفظ المشروع بنجاح!");
      setNewProjectName(""); setNewProjectClient(""); setNewProjectLocation("");
      setNewProjectType("سكني"); setNewProjectStage("تحت الدراسة"); setNewProjectDescription("");
      setNewProjectFile(null); setShowProjectsModal(false); loadProjects();
    }
  };

  const openProject = (project: SavedProject) => {
    setActiveProjectId((project as any).id ?? null);
    setProjectStarted(true);
    setNewProjectStage(project.project_stage || "تحت الدراسة");
    setUserItems(project.project_data || {});
    localStorage.setItem("userItems", JSON.stringify(project.project_data || {}));
    setNewProjectName(project.project_name);
    setSelectedProject(project);
    setShowProjectsModal(false);
    setShowProjectDetailsModal(true);
  };

  const loadProjectIntoWorkspace = () => {
    if (!selectedProject) return;
    setUserItems(selectedProject.project_data || {});
    localStorage.setItem("userItems", JSON.stringify(selectedProject.project_data || {}));
    setShowProjectDetailsModal(false);
    alert("✅ تم تحميل المشروع في مساحة العمل");
  };

  const downloadProjectFile = () => {
    if (!selectedProject?.file_url) { alert("لا يوجد ملف مرفق"); return; }
    window.open(selectedProject.file_url, "_blank");
  };

  const deleteProject = async (id: number) => {
    if (!confirm("هل أنت متأكد؟")) return;
    await supabase.from("user_projects").delete().eq("id", id);
    setSavedProjects(savedProjects.filter((p) => p.id !== id));
  };

  const getStageColor = (stage?: string) => {
    switch (stage) {
      case "جديد": return "bg-sky-100 text-sky-800";
      case "تحت الدراسة": return "bg-amber-100 text-amber-800";
      case "تم": return "bg-green-100 text-green-800";
      case "تسعير": return "bg-blue-100 text-blue-800";
      case "تنفيذ": return "bg-yellow-100 text-yellow-800";
      case "إنجاز": return "bg-green-100 text-green-800";
      case "متوقف": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const addCustomItem = async () => {
    if (!customItem.name_ar || !customItem.rate) { alert("املأ اسم البند والسعر"); return; }
    const { data, error } = await supabase.from("custom_items").insert({
      code: customItem.code || "CUSTOM", name_ar: customItem.name_ar,
      unit: customItem.unit, rate: customItem.rate,
      division_code: customItem.division_code, section_code: customItem.section_code,
    }).select();
    if (error) { alert("حدث خطأ: " + error.message); return; }
    if (data) {
      alert("تم إضافة البند بنجاح!");
      setCustomItems([data[0], ...customItems]);
      setShowCustomItemModal(false);
      setCustomItem({ code: "", name_ar: "", unit: "m³", rate: 0, division_code: "", section_code: "" });
    }
  };

  // ============================================
  // View Saved Breakdown (from parsed items)
  // ============================================
  const openViewBreakdown = (bd: any) => {
    setViewingBreakdown(bd);
    setShowViewBreakdownModal(true);
  };

  const deleteViewingBreakdown = async () => {
    if (!viewingBreakdown) return;
    if (!confirm("هل تريد حذف هذا التحليل؟")) return;
    const { error } = await supabase.from("breakdown_results").delete().eq("id", viewingBreakdown.id);
    if (error) { alert("خطأ: " + error.message); return; }
    // حدّث parsedBreakdowns
    setParsedBreakdowns((prev) => {
      const updated = { ...prev };
      const key = getBreakdownKey(viewingBreakdown);
      const legacyKey = getLegacyBreakdownKey(viewingBreakdown);
      delete updated[key];
      delete updated[legacyKey];
      return updated;
    });
    setShowViewBreakdownModal(false);
    setViewingBreakdown(null);
    alert("✅ تم حذف التحليل");
  };

  // ============================================
  // Workflow v4: مستويات + أسئلة خبرة + مشاريع + اعتماد وتثبيت + ملخص
  // ============================================
  const LEVELS = [
    { key: "مبتدئ", icon: "🌱", desc: "الأسئلة الأساسية فقط — والباقي بقيم افتراضية آمنة" },
    { key: "متقدم", icon: "🛠️", desc: "+ ظروف التنفيذ والهالك + أسئلة خبرة ميدانية" },
    { key: "محترف", icon: "🎯", desc: "كل الأسئلة (المخاطر والمصنعيات والمعدات) + كل عوامل الخبرة" },
  ] as const;

  const levelRank = (l: string) => (l === "محترف" ? 3 : l === "متقدم" ? 2 : 1);
  const changeLevel = (l: "مبتدئ" | "متقدم" | "محترف") => { setUserLevel(l); localStorage.setItem("userLevel", l); };

  // أقسام الأسئلة المتاحة لكل مستوى (لو جدول الأسئلة فيه عمود level هيتم استخدامه بدل ده)
  const SECTION_MIN_LEVEL: Record<string, number> = {
    "بيانات البند": 1, "المصاريف والربح": 1,
    "ظروف التنفيذ": 2, "الهالك والفاقد": 2,
    "المخاطر والمحاذير": 3, "المصنعيات والمعدات": 3,
  };
  const questionMinLevel = (q: any) => {
    const lv = String(q?.level || q?.min_level || "").trim();
    if (lv) {
      if (/محترف|pro|3/i.test(lv)) return 3;
      if (/متقدم|adv|2/i.test(lv)) return 2;
      if (/مبتدئ|basic|beg|1/i.test(lv)) return 1;
    }
    return SECTION_MIN_LEVEL[q?.section] ?? 1;
  };

  // ------------------------------------------------------------------
  // أسئلة الخبرة الميدانية. النسب = % زيادة على التكلفة المباشرة.
  // ⚠️ دي قيم افتراضية للتقدير الأولي (مش أسعار سوق مؤكدة) — عدّلها حسب خبرتك.
  // ------------------------------------------------------------------
  type ExpertQ = { key: string; tag: string; text: string; short: string; minLevel: number; options: { label: string; pct: number }[] };
  const EXPERT_QUESTIONS: ExpertQ[] = [
    // —— عامة ——
    { key: "access", tag: "all", minLevel: 2, short: "الوصول", text: "سهولة الوصول للموقع وتخزين المواد", options: [{ label: "سهل ومفتوح", pct: 0 }, { label: "متوسط (مساحة محدودة)", pct: 3 }, { label: "صعب (موقع ضيق/وسط مزدحم)", pct: 7 }] },
    { key: "schedule", tag: "all", minLevel: 3, short: "ضغط الجدول", text: "ضغط الجدول الزمني", options: [{ label: "عادي", pct: 0 }, { label: "مضغوط (ساعات إضافية)", pct: 4 }, { label: "شديد (ورديتين)", pct: 8 }] },
    { key: "weather", tag: "all", minLevel: 3, short: "المناخ", text: "الظروف المناخية وقت التنفيذ", options: [{ label: "معتدلة", pct: 0 }, { label: "حر شديد / رياح", pct: 2 }, { label: "أمطار / برد", pct: 3 }] },
    { key: "supervision", tag: "all", minLevel: 3, short: "اشتراطات الجودة", text: "صرامة الإشراف واشتراطات الجودة", options: [{ label: "قياسية", pct: 0 }, { label: "صارمة (اختبارات وتوثيق إضافي)", pct: 2.5 }] },
    // —— إنشائية (خرسانة + حديد) ——
    { key: "height", tag: "structural", minLevel: 2, short: "الارتفاع", text: "ارتفاع العمل عن منسوب الأرض", options: [{ label: "أرضي / بدروم", pct: 0 }, { label: "حتى 4 أدوار", pct: 2 }, { label: "أكثر من 4 أدوار", pct: 5 }] },
    // —— خرسانة ——
    { key: "pour", tag: "concrete", minLevel: 2, short: "طريقة الصب", text: "طريقة الصب", options: [{ label: "قواديس / يدوي", pct: 0 }, { label: "مضخة ثابتة", pct: 3 }, { label: "مضخة بوم", pct: 4.5 }] },
    { key: "cement", tag: "concrete", minLevel: 2, short: "نوع الخلطة", text: "نوع الأسمنت / الخلطة", options: [{ label: "عادي", pct: 0 }, { label: "مقاوم للكبريتات", pct: 4 }, { label: "خلطة خاصة (عالية المقاومة)", pct: 8 }] },
    { key: "additives", tag: "concrete", minLevel: 2, short: "إضافات", text: "إضافات الخرسانة", options: [{ label: "بدون", pct: 0 }, { label: "ملدنات", pct: 2 }, { label: "مانع نفاذية + ملدنات", pct: 4 }] },
    { key: "face", tag: "concrete", minLevel: 3, short: "سطح الخرسانة", text: "نوع سطح الخرسانة", options: [{ label: "مخفي (تشطيب لاحق)", pct: 0 }, { label: "خرسانة مكشوفة", pct: 8 }] },
    { key: "mass", tag: "concrete", minLevel: 3, short: "صب كتلي", text: "صب كتلي (سمك كبير) يحتاج ضبط حرارة؟", options: [{ label: "لا", pct: 0 }, { label: "نعم", pct: 5 }] },
    { key: "night", tag: "concrete", minLevel: 3, short: "صب ليلي", text: "الصب ليلاً / خارج ساعات العمل؟", options: [{ label: "لا", pct: 0 }, { label: "نعم", pct: 6 }] },
    { key: "testing", tag: "concrete", minLevel: 3, short: "اختبارات", text: "اختبارات الجودة (مكعبات/تحميل)", options: [{ label: "قياسية", pct: 0 }, { label: "مكثفة", pct: 1.5 }] },
    { key: "congestion", tag: "rc", minLevel: 3, short: "ازدحام الحديد", text: "ازدحام حديد التسليح في القطاع", options: [{ label: "عادي", pct: 0 }, { label: "عالي (صعوبة صب وهز)", pct: 4 }] },
    // —— حديد ——
    { key: "couplers", tag: "steel", minLevel: 2, short: "وصلات", text: "وصلات ميكانيكية / أقطار كبيرة؟", options: [{ label: "لا", pct: 0 }, { label: "نعم", pct: 6 }] },
    { key: "fabrication", tag: "steel", minLevel: 2, short: "التقطيع", text: "مكان التقطيع والتشكيل", options: [{ label: "ورشة خارجية", pct: 0 }, { label: "بالموقع", pct: 3 }] },
    // —— عزل ——
    { key: "substrate", tag: "insulation", minLevel: 2, short: "حالة السطح", text: "حالة السطح قبل العزل", options: [{ label: "جاهز", pct: 0 }, { label: "يحتاج معالجة", pct: 6 }] },
    { key: "protection", tag: "insulation", minLevel: 2, short: "طبقة حماية", text: "طبقة حماية فوق العزل", options: [{ label: "لا", pct: 0 }, { label: "نعم", pct: 5 }] },
    { key: "watertest", tag: "insulation", minLevel: 3, short: "اختبار غمر", text: "اختبار غمر بالمياه", options: [{ label: "لا", pct: 0 }, { label: "نعم", pct: 1.5 }] },
    // —— أعمال ترابية ——
    { key: "soil", tag: "earthworks", minLevel: 2, short: "نوع التربة", text: "نوع التربة", options: [{ label: "رملية / ردم نظيف", pct: 0 }, { label: "طينية أو مختلطة", pct: 6 }, { label: "صخرية / متماسكة", pct: 20 }] },
    { key: "water", tag: "earthworks", minLevel: 2, short: "مياه جوفية", text: "المياه الجوفية", options: [{ label: "لا توجد", pct: 0 }, { label: "توجد (نزح مياه)", pct: 12 }] },
    { key: "haul", tag: "earthworks", minLevel: 2, short: "مسافة النقل", text: "مسافة نقل ناتج الحفر / جلب الردم", options: [{ label: "حتى 5 كم", pct: 0 }, { label: "5–15 كم", pct: 8 }, { label: "أكثر من 15 كم", pct: 15 }] },
    { key: "shoring", tag: "earthworks", minLevel: 3, short: "سند جوانب", text: "سند جوانب الحفر", options: [{ label: "لا يلزم", pct: 0 }, { label: "يلزم", pct: 10 }] },
    { key: "utilities", tag: "earthworks", minLevel: 3, short: "مرافق", text: "وجود خدمات/مرافق تحت الأرض", options: [{ label: "لا", pct: 0 }, { label: "نعم (حفر يدوي حذر)", pct: 6 }] },
  ];

  const expertTagsFor = (item: any) => {
    const f = getEngineeringFamily(item);
    if (f === "earthworks") return ["earthworks", "all"];
    if (f === "insulation") return ["insulation", "all"];
    if (f === "steel") return ["steel", "structural", "all"];
    if (f.startsWith("rc_")) return ["concrete", "rc", "structural", "all"];
    if (f.startsWith("pc_")) return ["concrete", "structural", "all"];
    return ["all"];
  };

  const getExpertQuestions = (item: any) => {
    const tags = expertTagsFor(item);
    return EXPERT_QUESTIONS.filter((q) => levelRank(userLevel) >= q.minLevel && tags.includes(q.tag));
  };

  // نفس معادلة recalculateBreakdownTotals (نسب القالب لو موجودة)
  const computeTotals = (components: any[], pr: any) => {
    const pctOf = (v: any, d: number) => {
      const n = Number(v);
      if (v === undefined || v === null || v === "" || !isFinite(n)) return d;
      return n > 1 ? n / 100 : n;
    };
    const direct = components.reduce((s, c) => s + Number(c.total_cost || 0), 0);
    const wastage = direct * pctOf(pr?.wastage_pct, 0.05);
    const subtotal = direct + wastage;
    const overhead = subtotal * pctOf(pr?.overhead_pct, 0.10);
    const risk = subtotal * pctOf(pr?.risk_pct, 0.03);
    const profit = (subtotal + overhead + risk) * pctOf(pr?.profit_pct, 0.15);
    const final = subtotal + overhead + risk + profit;
    return {
      direct_cost: Math.round(direct), wastage_cost: Math.round(wastage), subtotal: Math.round(subtotal),
      overhead_cost: Math.round(overhead), risk_cost: Math.round(risk), profit_cost: Math.round(profit),
      final_price: Math.round(final),
    };
  };

  // تضيف إجابات الخبرة كمكونات "تعديل خبرة" (قابلة للتعديل/الحذف) وتعيد حساب الإجماليات
  const applyExpertAdjustments = async (item: any, answerId: number, components: any[], pricing: any) => {
    const chosen = getExpertQuestions(item)
      .map((q) => ({ q, opt: q.options[expertAnswers[q.key] ?? 0] }))
      .filter((x) => x.opt && x.opt.pct > 0);
    const base = components.reduce((s, c) => s + Number(c.total_cost || 0), 0);
    if (!chosen.length || !(base > 0)) return { components, pricing, adjustments: [] as any[] };

    const added: any[] = [];
    const adjustments: any[] = [];
    for (const { q, opt } of chosen) {
      const amount = Math.round((base * opt.pct) / 100);
      if (amount <= 0) continue;
      const row = {
        answer_id: answerId, component_type: "أخرى",
        component_name: `🧠 ${q.short}: ${opt.label} (+${opt.pct}%)`,
        quantity: 1, unit: "مقطوعية", unit_rate: amount, total_cost: amount, is_manual: false,
      };
      let res = await supabase.from("breakdown_components").insert({ ...row, source: "expert" }).select().single();
      if (res.error) res = await supabase.from("breakdown_components").insert({ ...row, source: "manual" }).select().single();
      if (res.error) { console.warn("expert adjustment skipped:", q.key, res.error.message); continue; }
      added.push(res.data);
      adjustments.push({ key: q.key, label: q.short, option: opt.label, pct: opt.pct, amount });
    }
    if (!added.length) return { components, pricing, adjustments };
    const all = [...components, ...added];
    const totals = computeTotals(all, pricing);
    await supabase.from("breakdown_pricing").update(totals).eq("answer_id", answerId);
    return { components: all, pricing: { ...pricing, ...totals }, adjustments };
  };

  // ------------------------------------------------------------------
  // اعتماد البنود وتثبيتها في الملخص
  // ------------------------------------------------------------------
  const setParsedItemApproval = async (item: any, approve: boolean) => {
    const bd = parsedBreakdowns[getBreakdownKey(item)] || parsedBreakdowns[getLegacyBreakdownKey(item)];
    if (approve && !(Number(bd?.final_price) > 0)) { alert("سعّر البند أولاً (السعر صفر أو غير موجود)."); return; }
    const status = approve ? "approved" : "matched";
    const { error } = await supabase.from("parsed_boq_items").update({ status }).eq("id", item.id);
    if (error) { alert("خطأ: " + error.message); return; }
    setSavedParsedItems((prev) => prev.map((p) => (p.id === item.id ? { ...p, status } : p)));
  };

  const approveAllPriced = async () => {
    const getBd = (it: any) => parsedBreakdowns[getBreakdownKey(it)] || parsedBreakdowns[getLegacyBreakdownKey(it)];
    const targets = savedParsedItems.filter((it: any) => it.status !== "approved" && Number(getBd(it)?.final_price) > 0);
    if (!targets.length) { alert("لا توجد بنود مسعّرة جاهزة للاعتماد."); return; }
    const needReview = targets.filter((it: any) => getBd(it)?.pricing?.needs_review && !getBd(it)?.pricing?.manually_reviewed).length;
    if (!confirm(`اعتماد ${targets.length} بند وتثبيتها في ملخص المقايسة؟` + (needReview ? `\n⚠️ منها ${needReview} بند تسعيره استنتاج ولم تراجعه.` : ""))) return;
    const ids = targets.map((it: any) => it.id);
    const { error } = await supabase.from("parsed_boq_items").update({ status: "approved" }).in("id", ids);
    if (error) { alert("خطأ: " + error.message); return; }
    setSavedParsedItems((prev) => prev.map((p) => (ids.includes(p.id) ? { ...p, status: "approved" } : p)));
    alert(`✅ تم اعتماد ${ids.length} بند وتثبيتها في الملخص.`);
  };

  const loadApprovedForSummary = async () => {
    const [itemsRes, bdsRes] = await Promise.all([
      supabase.from("parsed_boq_items").select("*").eq("user_name", userName).eq("status", "approved")
        .order("source_file", { ascending: true }).order("id", { ascending: true }),
      supabase.from("breakdown_results").select("*").eq("user_name", userName),
    ]);
    const map: Record<string, any> = {};
    (bdsRes.data || []).forEach((bd: any) => {
      map[getBreakdownKey(bd)] = bd;
      if (!bd.source_file) map[getLegacyBreakdownKey(bd)] = bd;
    });
    return (itemsRes.data || []).map((it: any) => {
      const bd = map[getBreakdownKey(it)] || map[getLegacyBreakdownKey(it)];
      const price = Number(bd?.final_price || 0);
      return { item: it, bd, price, total: price * Number(it.quantity || 0) };
    });
  };

  const openSummary = async () => {
    try { setApprovedForSummary(await loadApprovedForSummary()); } catch (e) { console.warn(e); }
    setShowSummaryModal(true);
  };

  // ------------------------------------------------------------------
  // المشاريع: جديد / تحت الدراسة / تم
  // ------------------------------------------------------------------
  const PROJECT_TABS = ["الكل", "جديد", "تحت الدراسة", "تم"];
  const stageInTab = (stage: string | undefined, tab: string) => {
    if (tab === "الكل") return true;
    if (tab === "جديد") return stage === "جديد";
    if (tab === "تحت الدراسة") return ["تحت الدراسة", "تسعير", "تنفيذ"].includes(stage || "");
    if (tab === "تم") return ["تم", "إنجاز"].includes(stage || "");
    return false;
  };

  const openNewProject = () => {
    setNewProjectName(""); setNewProjectClient(""); setNewProjectLocation("");
    setNewProjectType("سكني"); setNewProjectStage("جديد"); setNewProjectDescription("");
    setShowNewProjectModal(true);
  };

  const startNewProject = async () => {
    if (!newProjectName.trim()) { alert("اكتب اسم المشروع أولاً"); return; }
    setUserItems({});
    localStorage.removeItem("userItems");
    let id: number | null = null;
    if (isSubscribed) {
      const { data, error } = await supabase.from("user_projects").insert({
        project_name: newProjectName, project_data: {}, total_amount: 0, user_name: userName,
        client_name: newProjectClient || null, location: newProjectLocation || null,
        project_type: newProjectType, project_stage: newProjectStage, description: newProjectDescription || null,
      }).select();
      if (error) alert("تعذّر حفظ المشروع في قاعدة البيانات: " + error.message + "\nهنكمّل بدون حفظ، تقدر تحفظه بعدين.");
      else if (data?.[0]) id = data[0].id;
    }
    setActiveProjectId(id);
    setProjectStarted(true);
    setShowNewProjectModal(false);
    setSelectedDivision(null); setSelectedSection(null); setSearchQuery("");
  };

  const openProjectPicker = async (tab: string) => {
    const { data } = await supabase.from("user_projects").select("*").eq("user_name", userName).order("created_at", { ascending: false });
    setPickerProjects(data || []);
    setPickerTab(tab);
    setShowProjectPicker(true);
  };

  const changeProjectStage = async (stage: string) => {
    setNewProjectStage(stage);
    if (activeProjectId) await supabase.from("user_projects").update({ project_stage: stage }).eq("id", activeProjectId);
  };

  const saveActiveProject = async () => {
    if (!isSubscribed) { setShowSubscriptionModal(true); return; }
    const payload: any = {
      project_name: newProjectName || "بدون اسم", project_data: userItems, total_amount: Math.ceil(grandTotal),
      project_stage: newProjectStage, client_name: newProjectClient || null, location: newProjectLocation || null,
    };
    if (activeProjectId) {
      const { error } = await supabase.from("user_projects").update(payload).eq("id", activeProjectId);
      if (error) { alert("خطأ: " + error.message); return; }
    } else {
      const { data, error } = await supabase.from("user_projects")
        .insert({ ...payload, user_name: userName, project_type: newProjectType, description: newProjectDescription || null }).select();
      if (error) { alert("خطأ: " + error.message); return; }
      if (data?.[0]) setActiveProjectId(data[0].id);
    }
    alert("✅ تم حفظ المشروع");
  };

  const closeActiveProject = () => {
    if (!confirm("إغلاق المشروع الحالي والرجوع للشاشة الرئيسية؟")) return;
    setActiveProjectId(null); setProjectStarted(false); setNewProjectName("");
    goHome();
  };

  // ============================================
  // LOGIN SCREEN
  // ============================================
  if (showLogin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-blue-900 flex items-center justify-center p-4" dir="rtl">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-slate-800 mb-2">منصة التسعير والتحليل الهندسي</h1>
            <p className="text-sm text-gray-500">بنك معلومات هندسي - MasterFormat</p>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">اسمك (لحفظ مشاريعك):</label>
            <input type="text" value={userInput} onChange={(e) => setUserInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleLogin()} placeholder="مثال: م. أحمد محمد" className="w-full p-3 border-2 border-gray-200 rounded-lg text-right focus:ring-2 focus:ring-blue-500 outline-none" autoFocus />
          </div>
          <button onClick={handleLogin} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold text-lg">دخول</button>
          <p className="text-xs text-gray-400 text-center mt-4">جرب: "عادي" أو "مشترك"</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-xl font-bold text-blue-600">جاري التحميل...</div>
      </div>
    );
  }

  const customItemsWithQuantity = customItems.filter((item) => {
    const ui = userItems[item.id as number];
    return ui && ui.quantity > 0;
  });
  const pricedMainItems = allItems.filter((item) => {
    const ui = userItems[item.id];
    return ui && ui.quantity > 0;
  });
  const hasAnyItems = customItemsWithQuantity.length > 0 || pricedMainItems.length > 0;

  // الشاشة الرئيسية فاضية عند الفتح: المحتوى بيظهر فقط لما تختار قسم / تبحث / يبقى فيه بنود مسعّرة
  const showItemsTable = selectedDivision !== null || searchQuery.trim() !== "";
  const showWorkspace = showItemsTable;
  const approvedTotal = approvedForSummary.reduce((s: number, r: any) => s + r.total, 0);
  const goHome = () => { setSelectedDivision(null); setSelectedSection(null); setSearchQuery(""); };

  // ============================================
  // MAIN APP
  // ============================================
  return (
    <div className="min-h-screen bg-slate-50 font-sans" dir="rtl">
      <header className="sticky top-0 z-30 no-print text-white shadow-xl border-b border-white/10 bg-gradient-to-l from-slate-900 via-slate-900 to-indigo-950">
        <div className="flex justify-between items-center gap-4 px-5 py-3">
          <button onClick={goHome} className="text-right" title="الشاشة الرئيسية">
            <h1 className="text-xl font-extrabold bg-gradient-to-l from-sky-300 to-blue-500 bg-clip-text text-transparent">منصة التسعير والتحليل الهندسي</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              مرحباً {userName}
              {isSubscribed ? <span className="mr-2 bg-green-500 text-white px-2 py-0.5 rounded-full text-xs">✓ مشترك</span> : <span className="mr-2 bg-yellow-500 text-white px-2 py-0.5 rounded-full text-xs">مجاني</span>}
            </p>
          </button>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <div className="flex gap-1.5 bg-white/5 p-1 rounded-xl border border-white/10">
              <button onClick={() => setShowBOQUploader(true)} className="bg-cyan-600 hover:bg-cyan-500 px-3 py-2 rounded-lg text-xs font-semibold transition hover:-translate-y-0.5 hover:shadow-lg">📤 رفع مقايسة</button>
              <button onClick={loadParsedItems} className="bg-teal-600 hover:bg-teal-500 px-3 py-2 rounded-lg text-xs font-semibold transition hover:-translate-y-0.5 hover:shadow-lg">📋 البنود المستخرجة</button>
              <button onClick={() => setShowSearchModal(true)} className="bg-pink-600 hover:bg-pink-500 px-3 py-2 rounded-lg text-xs font-semibold transition hover:-translate-y-0.5 hover:shadow-lg">🔍 بحث المكونات</button>
              <button onClick={loadProjects} className="bg-purple-600 hover:bg-purple-500 px-3 py-2 rounded-lg text-xs font-semibold transition hover:-translate-y-0.5 hover:shadow-lg">📁 مشاريعي</button>
              <button onClick={loadBreakdownResults} className="bg-orange-600 hover:bg-orange-500 px-3 py-2 rounded-lg text-xs font-semibold transition hover:-translate-y-0.5 hover:shadow-lg">📊 Breakdowns</button>
            </div>
            <div className="flex gap-1.5 bg-white/5 p-1 rounded-xl border border-white/10">
              <button onClick={openSummary} className="bg-sky-600 hover:bg-sky-500 px-3 py-2 rounded-lg text-xs font-semibold transition hover:-translate-y-0.5 hover:shadow-lg">📊 ملخص المقايسة</button>
              <button onClick={() => { if (!isSubscribed) { setShowSubscriptionModal(true); return; } setShowCustomItemModal(true); }} className="bg-indigo-600 hover:bg-indigo-500 px-3 py-2 rounded-lg text-xs font-semibold transition hover:-translate-y-0.5 hover:shadow-lg">➕ بند خاص</button>
              <button onClick={() => { if (!isSubscribed) { setShowSubscriptionModal(true); return; } exportToExcel(); }} className="bg-green-600 hover:bg-green-500 px-3 py-2 rounded-lg text-xs font-semibold transition hover:-translate-y-0.5 hover:shadow-lg">📤 Excel</button>
              <button onClick={printBOQ} className="bg-yellow-600 hover:bg-yellow-500 px-3 py-2 rounded-lg text-xs font-semibold transition hover:-translate-y-0.5 hover:shadow-lg">🖨️ طباعة</button>
            </div>
            <div className="flex gap-1.5 bg-white/5 p-1 rounded-xl border border-white/10">
              <button onClick={clearProject} className="bg-red-600 hover:bg-red-500 px-3 py-2 rounded-lg text-xs font-semibold transition hover:-translate-y-0.5 hover:shadow-lg">🗑️ حذف</button>
              <button onClick={logout} className="bg-gray-600 hover:bg-gray-500 px-3 py-2 rounded-lg text-xs font-semibold transition hover:-translate-y-0.5 hover:shadow-lg">🚪 خروج</button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className="w-72 bg-white border-l border-slate-200 min-h-[calc(100vh-72px)] sticky top-[72px] max-h-[calc(100vh-72px)] overflow-y-auto no-print">
          <div className="p-4 border-b bg-gradient-to-b from-slate-50 to-white sticky top-0 z-10">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-extrabold text-slate-700 text-sm">📁 التقسيمات <span className="text-xs font-semibold text-slate-400">({divisions.length})</span></h3>
              {showWorkspace && (<button onClick={goHome} className="text-[11px] text-blue-600 hover:underline font-semibold">🏠 الرئيسية</button>)}
            </div>
            <input type="text" placeholder="🔍 ابحث عن بند..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-400 outline-none text-right" />
            <div className="mt-3">
              <div className="text-[11px] font-bold text-slate-500 mb-1">🎚️ مستوى الدخول للأنشطة</div>
              <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg">
                {LEVELS.map((lv) => (
                  <button key={lv.key} onClick={() => changeLevel(lv.key)} title={lv.desc} className={`text-[11px] font-bold py-1.5 rounded-md transition ${userLevel === lv.key ? "bg-white text-indigo-700 shadow" : "text-slate-500 hover:text-slate-700"}`}>{lv.icon} {lv.key}</button>
                ))}
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={openSummary} className="flex-1 text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 rounded-lg py-1.5">📊 الملخص</button>
              <button onClick={() => setShowCustomItemsModal(true)} className="flex-1 text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 rounded-lg py-1.5">⭐ الخاصة ({customItems.length})</button>
            </div>
            <div className="mt-2 text-[10px] text-slate-400 leading-snug">🟢 الرقم الأخضر بجوار القسم = عدد البنود اللي دخّلت لها كمية في القسم ده</div>
          </div>
          <nav className="p-2 space-y-1">
            {divisions.map((div) => {
              const active = selectedDivision === div.id;
              return (
                <button key={div.id} onClick={() => { setSelectedDivision(div.id); setSelectedSection(null); }} className={`w-full text-right px-3 py-2.5 rounded-xl transition flex items-center gap-2 text-xs ${active ? "bg-gradient-to-l from-blue-600 to-indigo-600 text-white shadow-md font-bold" : "text-slate-700 hover:bg-blue-50"}`}>
                  <span className={`font-mono px-1.5 py-0.5 rounded-md text-xs ${active ? "bg-white/20" : "bg-slate-200"}`}>{div.code}</span>
                  <span className="flex-1">{div.name_ar}</span>
                  {getDivisionItemCount(div.id) > 0 && (<span title="عدد البنود المُدخلة بكميات في هذا القسم" className="bg-green-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">{getDivisionItemCount(div.id)} بند</span>)}
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 p-6">
          {(activeProjectId !== null || projectStarted) && (
            <div className="mb-4 bg-white border border-indigo-100 rounded-2xl shadow-sm px-4 py-3 flex flex-wrap items-center gap-3 no-print">
              <div>
                <div className="text-[11px] text-slate-400">المشروع الحالي</div>
                <div className="font-extrabold text-slate-800">🗂️ {newProjectName || "بدون اسم"}</div>
              </div>
              <select value={newProjectStage} onChange={(e) => changeProjectStage(e.target.value)} className="p-1.5 border rounded-lg text-xs font-semibold bg-slate-50">
                <option value="جديد">جديد</option><option value="تحت الدراسة">تحت الدراسة</option><option value="تم">تم</option><option value="تنفيذ">تنفيذ</option><option value="متوقف">متوقف</option>
              </select>
              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStageColor(newProjectStage)}`}>{newProjectStage}</span>
              <div className="flex-1" />
              <button onClick={saveActiveProject} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-bold">💾 حفظ المشروع</button>
              <button onClick={closeActiveProject} className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-2 rounded-lg text-xs font-bold">✕ إغلاق</button>
            </div>
          )}
          {showWorkspace ? (
          <>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-4 no-print">
            <div className="flex gap-2">
              <input type="text" placeholder="🔬 ابحث في المكونات..." value={componentSearch} onChange={(e) => setComponentSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && searchComponents()} className="flex-1 p-3 border-2 border-pink-200 rounded-lg text-right focus:ring-2 focus:ring-pink-500 outline-none" />
              <button onClick={searchComponents} className="bg-pink-600 hover:bg-pink-700 text-white px-6 rounded-lg font-bold">بحث</button>
            </div>
          </div>

          {filteredSections.length > 0 && (
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-4 no-print">
              <h3 className="font-bold mb-3 text-sm">📂 الأقسام الفرعية:</h3>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setSelectedSection(null)} className={`px-3 py-1.5 rounded-lg border-2 text-xs font-semibold ${selectedSection === null ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 hover:border-blue-300"}`}>الكل</button>
                {filteredSections.map((sec) => (
                  <button key={sec.id} onClick={() => setSelectedSection(sec.id)} className={`px-3 py-1.5 rounded-lg border-2 text-xs font-semibold ${selectedSection === sec.id ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 hover:border-blue-300"}`}>
                    {sec.code} - {sec.name_ar}
                  </button>
                ))}
              </div>
            </div>
          )}

          {showItemsTable && (
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-4">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold">📋 جدول البنود ({filteredItems.length} بند)</h2>
                <button onClick={goHome} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1 rounded-full">✕ إغلاق</button>
              </div>
              <div className="text-sm text-gray-500">إجمالي القسم: <span className="font-bold text-blue-700 text-lg">{Math.ceil(sectionTotal).toLocaleString("ar-EG")} ج.م</span></div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-800 text-white">
                  <tr>
                    <th className="p-2 text-right">الكود</th>
                    <th className="p-2 text-right">البند</th>
                    <th className="p-2 text-center">الوحدة</th>
                    <th className="p-2 text-center">الكمية</th>
                    <th className="p-2 text-center">السعر</th>
                    <th className="p-2 text-center">الإجمالي</th>
                    <th className="p-2 text-center">📊</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item, idx) => {
                    const effectiveRate = getItemRate(item);
                    const ui = {
                      quantity: userItems[item.id]?.quantity || 0,
                      custom_rate: item.has_custom_analysis ? (item.final_rate || item.rate) : (userItems[item.id]?.custom_rate ?? effectiveRate),
                    };
                    return (
                      <tr key={item.id} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                        <td className="p-2 text-right font-mono text-xs">{item.code}</td>
                        <td className="p-2 text-right font-semibold text-xs">{item.name_ar || item.name_en}</td>
                        <td className="p-2 text-center text-xs">{item.unit}</td>
                        <td className="p-2 text-center"><input type="number" value={ui.quantity} onChange={(e) => updateQuantity(item.id, Number(e.target.value))} className="w-20 p-1.5 border rounded text-center font-bold text-xs" min="0" /></td>
                        <td className="p-2 text-center"><input type="number" value={ui.custom_rate} onChange={(e) => updateRate(item.id, Number(e.target.value))} className={`w-24 p-1.5 border rounded text-center font-bold text-xs ${item.has_custom_analysis ? "bg-green-50 border-green-400" : ""}`} min="0" /></td>
                        <td className="p-2 text-center font-bold text-blue-800 text-sm">{Math.ceil(getItemTotal(item.id)).toLocaleString("ar-EG")}</td>
                        <td className="p-2 text-center">
                          <button onClick={() => { if (!isSubscribed) { setShowSubscriptionModal(true); return; } loadUnifiedRateAnalysis({ id: item.id, code: item.code, name_ar: item.name_ar || item.name_en, unit: item.unit, rate: item.rate, source: "main", masterformat_code: item.masterformat_code, final_rate: item.final_rate, has_custom_analysis: item.has_custom_analysis }); }} className="text-blue-600 hover:text-blue-800 text-lg">📊</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          )}

          </>
          ) : (
            <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-blue-50 to-indigo-100 min-h-[calc(100vh-170px)] p-8 md:p-12">
              <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-blue-200/40 blur-3xl" />
              <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-indigo-200/50 blur-3xl" />
              <div className="relative max-w-4xl mx-auto">
                <div className="text-center mb-8">
                  <div className="mx-auto mb-4 w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-700 shadow-2xl flex items-center justify-center text-4xl">🏗️</div>
                  <h2 className="text-3xl font-extrabold text-slate-800 mb-2">أهلاً {userName} — من أين نبدأ؟</h2>
                  <p className="text-slate-500">اختر نقطة البداية، أو اختر قسماً من القائمة على اليمين.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <button onClick={openNewProject} className="text-right p-5 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg hover:-translate-y-1 hover:shadow-2xl transition">
                    <div className="text-3xl mb-2">➕</div>
                    <div className="font-extrabold text-lg">مشروع جديد</div>
                    <div className="text-xs text-emerald-50 mt-1">ابدأ مقايسة من الصفر (اسم، عميل، موقع، مرحلة)</div>
                  </button>
                  <button onClick={() => openProjectPicker("تحت الدراسة")} className="text-right p-5 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg hover:-translate-y-1 hover:shadow-2xl transition">
                    <div className="text-3xl mb-2">📂</div>
                    <div className="font-extrabold text-lg">مشروع تحت الدراسة</div>
                    <div className="text-xs text-amber-50 mt-1">استدعِ مشروع بدأته وكمّل تسعيره</div>
                  </button>
                  <button onClick={() => openProjectPicker("تم")} className="text-right p-5 rounded-2xl bg-gradient-to-br from-slate-600 to-slate-800 text-white shadow-lg hover:-translate-y-1 hover:shadow-2xl transition">
                    <div className="text-3xl mb-2">✅</div>
                    <div className="font-extrabold text-lg">مشاريع تمّت</div>
                    <div className="text-xs text-slate-200 mt-1">راجع المشاريع المنتهية والمعتمدة</div>
                  </button>
                </div>

                <div className="bg-white/80 rounded-2xl border border-white shadow p-5 mb-6">
                  <h3 className="font-extrabold text-slate-700 mb-3">🎚️ مستوى الدخول للأنشطة</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {LEVELS.map((lv) => (
                      <button key={lv.key} onClick={() => changeLevel(lv.key)} className={`text-right p-4 rounded-xl border-2 transition ${userLevel === lv.key ? "border-indigo-500 bg-indigo-50 shadow" : "border-slate-200 bg-white hover:border-indigo-300"}`}>
                        <div className="font-bold text-slate-800">{lv.icon} {lv.key} {userLevel === lv.key && <span className="text-xs text-indigo-600">✓ الحالي</span>}</div>
                        <div className="text-xs text-slate-500 mt-1 leading-relaxed">{lv.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-white/70 rounded-2xl border border-white p-5">
                  <h3 className="font-extrabold text-slate-700 mb-3">🧭 خطوات العمل على مقايسة مرفوعة</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                                 <button onClick={() => setShowBOQUploader(true)} className="text-right bg-cyan-50 border border-cyan-200 rounded-xl p-3 hover:bg-cyan-100 hover:border-cyan-400 transition cursor-pointer">
                <div className="font-bold text-cyan-800">① ارفع المقايسة</div>
                <div className="text-xs text-slate-500 mt-1">زرار «📤 رفع مقايسة» ثم اعتماد + تسعير تلقائي</div>
              </button>

              <button onClick={loadParsedItems} className="text-right bg-teal-50 border border-teal-200 rounded-xl p-3 hover:bg-teal-100 hover:border-teal-400 transition cursor-pointer">
                <div className="font-bold text-teal-800">② شوف المقايسة مسعّرة</div>
                <div className="text-xs text-slate-500 mt-1">«📋 البنود المستخرجة» بتفتح تلقائياً بعد التسعير</div>
              </button>

              <button onClick={loadParsedItems} className="text-right bg-indigo-50 border border-indigo-200 rounded-xl p-3 hover:bg-indigo-100 hover:border-indigo-400 transition cursor-pointer">
                <div className="font-bold text-indigo-800">③ راجع كل بند</div>
                <div className="text-xs text-slate-500 mt-1">👁️ عرض التحليل · ✏️ تعديل · 🔄 إعادة تسعير</div>
              </button>

              <button onClick={openSummary} className="text-right bg-emerald-50 border border-emerald-200 rounded-xl p-3 hover:bg-emerald-100 hover:border-emerald-400 transition cursor-pointer">
                <div className="font-bold text-emerald-800">④ اعتمد وثبّت</div>
                <div className="text-xs text-slate-500 mt-1">✅ بيثبّت البند في «📊 ملخص المقايسة»</div>
              </button>

                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Modal: البنود الخاصة */}
      {showCustomItemsModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[75] p-4 overflow-y-auto" onClick={() => setShowCustomItemsModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full my-8 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} dir="rtl">
            <div className="bg-indigo-700 text-white p-5 rounded-t-2xl flex justify-between items-center sticky top-0 z-10">
              <div><h3 className="text-xl font-bold">⭐ البنود الخاصة</h3><p className="text-sm text-indigo-200 mt-1">إجمالي {customItems.length} بند</p></div>
              <button onClick={() => setShowCustomItemsModal(false)} className="text-3xl text-indigo-200 hover:text-white">×</button>
            </div>
            <div className="p-6">
              {customItems.length === 0 ? (
                <div className="text-center py-10 bg-gray-50 rounded-lg"><div className="text-4xl mb-2">📭</div><p className="text-gray-500">لا توجد بنود خاصة</p></div>
              ) : (
                <div className="overflow-x-auto border rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-indigo-800 text-white"><tr><th className="p-3 text-right">الكود</th><th className="p-3 text-right">البند</th><th className="p-3 text-center">الوحدة</th><th className="p-3 text-center">الكمية</th><th className="p-3 text-center">السعر</th><th className="p-3 text-center">الإجمالي</th><th className="p-3 text-center">📊</th></tr></thead>
                    <tbody>
                      {customItems.map((item: any, idx: number) => {
                        const ui = userItems[item.id] || { quantity: 0, custom_rate: item.rate };
                        return (
                          <tr key={item.id} className={idx % 2 === 0 ? "bg-white" : "bg-indigo-50"}>
                            <td className="p-2 text-right font-mono text-xs">{item.code}</td>
                            <td className="p-2 text-right font-semibold text-xs">{item.name_ar}</td>
                            <td className="p-2 text-center text-xs">{item.unit}</td>
                            <td className="p-2 text-center"><input type="number" value={ui.quantity} onChange={(e) => updateQuantity(item.id, Number(e.target.value))} className="w-20 p-1.5 border rounded text-center font-bold text-xs" min="0" /></td>
                            <td className="p-2 text-center"><input type="number" value={ui.custom_rate} onChange={(e) => updateRate(item.id, Number(e.target.value))} className="w-24 p-1.5 border rounded text-center font-bold text-xs" min="0" /></td>
                            <td className="p-2 text-center font-bold text-indigo-800 text-sm">{Math.ceil(ui.quantity * ui.custom_rate).toLocaleString("ar-EG")}</td>
                            <td className="p-2 text-center">
                              <button onClick={() => { if (!isSubscribed) { setShowSubscriptionModal(true); return; } loadUnifiedRateAnalysis({ id: item.id, code: item.code, name_ar: item.name_ar, unit: item.unit, rate: item.rate, source: "custom" }); }} className="text-indigo-600 hover:text-indigo-800 text-lg" title="تحليل التكلفة">📊</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: رفع مقايسة */}
      {showBOQUploader && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[80] p-4 overflow-y-auto" onClick={() => setShowBOQUploader(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full my-8 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} dir="rtl">
            <div className="bg-indigo-700 text-white p-5 rounded-t-2xl flex justify-between items-center">
              <div><h3 className="text-xl font-bold">📤 رفع ملفات المقايسة</h3><p className="text-sm text-indigo-200 mt-1">يمكنك اختيار عدة ملفات دفعة واحدة</p></div>
              <button onClick={() => setShowBOQUploader(false)} className="text-3xl text-indigo-200 hover:text-white">×</button>
            </div>
            <div className="p-6">
              <div className="bg-indigo-50 p-8 rounded-lg border-2 border-dashed border-indigo-300 text-center mb-4">
                <input type="file" accept=".zip,.xlsx,.xls,.csv" onChange={handleBOQFileUpload} disabled={uploadingBOQ} className="hidden" id="boq-file-upload" multiple />
                <label htmlFor="boq-file-upload" className={`cursor-pointer inline-block bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-lg font-bold text-lg ${uploadingBOQ ? "opacity-50" : ""}`}>
                  {uploadingBOQ ? "⏳ جاري المعالجة..." : "📁 اختر ملفاتك (Excel أو ZIP)"}
                </label>
                <p className="text-sm text-gray-600 mt-4">اضغط <strong>Ctrl</strong> أثناء الاختيار لاختيار عدة ملفات دفعة واحدة</p>
              </div>
              {uploadProgress && (<div className="bg-blue-50 p-4 rounded-lg mb-4 text-center"><p className="text-blue-800 font-semibold">{uploadProgress}</p></div>)}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-xs text-amber-900">
                ⚡ بعد الاعتماد سيحاول النظام تلقائيًا إنشاء Breakdown من <strong>القالب المطابق</strong> أولًا،
                ثم <strong>البنود المشابهة المحفوظة</strong> عند توافر درجة تشابه كافية. وما لا يملك أساسًا موثوقًا سيبقى للمراجعة اليدوية.
              </div>
              {parsedItems.length > 0 && (
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200"><div className="text-sm text-green-600">عدد الملفات المعالَجة</div><div className="text-2xl font-bold text-green-800">{fileCount}</div></div>
                  <div className="bg-purple-50 p-4 rounded-lg border border-purple-200"><div className="text-sm text-purple-600">عدد البنود المستخرجة</div><div className="text-2xl font-bold text-purple-800">{parsedItems.length}</div></div>
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={approveParsedItems} disabled={parsedItems.length === 0 || uploadingBOQ} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold disabled:opacity-50">✅ اعتماد كل البنود ({parsedItems.length})</button>
                <button onClick={() => { setShowBOQUploader(false); setParsedItems([]); setUploadProgress(""); }} className="bg-gray-300 hover:bg-gray-400 px-6 py-3 rounded-lg font-bold">إلغاء</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Breakdowns المحفوظة */}
      {showBreakdownsModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[75] p-4 overflow-y-auto" onClick={() => setShowBreakdownsModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full my-8 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} dir="rtl">
            <div className="bg-orange-700 text-white p-5 rounded-t-2xl flex justify-between items-center sticky top-0 z-10">
              <div><h3 className="text-xl font-bold">📊 Breakdowns المحفوظة</h3><p className="text-sm text-orange-200 mt-1">إجمالي {savedBreakdowns.length} بند</p></div>
              <div className="flex gap-2 items-center">
                <button onClick={exportBreakdownsToExcel} className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded text-xs font-semibold">📤 Excel</button>
                <button onClick={() => setShowBreakdownsModal(false)} className="text-3xl text-orange-200 hover:text-white">×</button>
              </div>
            </div>
            <div className="p-6">
              {loadingBreakdowns ? (
                <div className="text-center py-10 text-gray-500">جاري التحميل...</div>
              ) : savedBreakdowns.length === 0 ? (
                <div className="text-center py-10 bg-gray-50 rounded-lg"><div className="text-4xl mb-2">📭</div><p className="text-gray-500">لا توجد Breakdowns محفوظة</p><p className="text-xs text-gray-400 mt-2">ارفع مقايسة، واعمل Breakdown، واعتمد.</p></div>
              ) : (
                <div className="overflow-x-auto border rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-orange-800 text-white"><tr><th className="p-3 text-right">الكود</th><th className="p-3 text-right">الوصف</th><th className="p-3 text-center">الوحدة</th><th className="p-3 text-center">الكمية</th><th className="p-3 text-center">سعر الوحدة</th><th className="p-3 text-center">الإجمالي</th><th className="p-3 text-center">التاريخ</th><th className="p-3 text-center">🗑️</th></tr></thead>
                    <tbody>
                      {savedBreakdowns.map((bd: any, idx: number) => (
                        <tr key={bd.id} className={idx % 2 === 0 ? "bg-white" : "bg-orange-50"}>
                          <td className="p-2 text-right font-mono text-xs">{bd.item_code}</td>
                          <td className="p-2 text-right text-xs">{bd.item_description?.substring(0, 80)}</td>
                          <td className="p-2 text-center text-xs">{bd.unit}</td>
                          <td className="p-2 text-center font-bold">{bd.quantity}</td>
                          <td className="p-2 text-center font-bold text-green-700">{Math.round(bd.final_price).toLocaleString("ar-EG")}</td>
                          <td className="p-2 text-center font-bold text-orange-800">{Math.round(bd.final_price * bd.quantity).toLocaleString("ar-EG")}</td>
                          <td className="p-2 text-center text-xs text-gray-500">{new Date(bd.created_at).toLocaleDateString("ar-EG")}</td>
                          <td className="p-2 text-center"><button onClick={() => deleteBreakdownResult(bd.id)} className="text-red-500 hover:text-red-700 text-lg" title="حذف">🗑️</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: مشاريعي */}
      {showProjectsModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto" onClick={() => setShowProjectsModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full my-8 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} dir="rtl">
            <div className="bg-purple-700 text-white p-5 rounded-t-2xl flex justify-between items-center">
              <div><h3 className="text-xl font-bold">📁 مشاريعي</h3><p className="text-sm text-purple-200 mt-1">إدارة وحفظ وعرض المشاريع</p></div>
              <button onClick={() => setShowProjectsModal(false)} className="text-3xl text-purple-200 hover:text-white">×</button>
            </div>
            <div className="p-6">
              <div className="bg-purple-50 p-5 rounded-lg mb-6 border-2 border-purple-200">
                <h4 className="font-bold mb-4 text-purple-900">➕ حفظ مشروع جديد</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div><label className="block text-xs font-semibold mb-1">اسم المشروع *</label><input type="text" placeholder="مثال: مشروع أكتوبر" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} className="w-full p-2 border rounded text-right" /></div>
                  <div><label className="block text-xs font-semibold mb-1">اسم العميل</label><input type="text" placeholder="مثال: شركة التطوير" value={newProjectClient} onChange={(e) => setNewProjectClient(e.target.value)} className="w-full p-2 border rounded text-right" /></div>
                  <div><label className="block text-xs font-semibold mb-1">الموقع</label><input type="text" placeholder="مثال: 6 أكتوبر - الجيزة" value={newProjectLocation} onChange={(e) => setNewProjectLocation(e.target.value)} className="w-full p-2 border rounded text-right" /></div>
                  <div><label className="block text-xs font-semibold mb-1">نوع المشروع</label><select value={newProjectType} onChange={(e) => setNewProjectType(e.target.value)} className="w-full p-2 border rounded text-right"><option value="سكني">سكني</option><option value="تجاري">تجاري</option><option value="إداري">إداري</option><option value="صناعي">صناعي</option><option value="تعليمي">تعليمي</option><option value="صحي">صحي</option></select></div>
                  <div><label className="block text-xs font-semibold mb-1">مرحلة المشروع</label><select value={newProjectStage} onChange={(e) => setNewProjectStage(e.target.value)} className="w-full p-2 border rounded text-right"><option value="جديد">جديد</option><option value="تحت الدراسة">تحت الدراسة</option><option value="تم">تم</option><option value="تنفيذ">تنفيذ</option><option value="متوقف">متوقف</option></select></div>
                  <div><label className="block text-xs font-semibold mb-1">ملف المقايسة (اختياري)</label><input type="file" accept=".xlsx,.xls,.pdf,.csv,.png,.jpg,.jpeg" onChange={(e) => setNewProjectFile(e.target.files?.[0] || null)} className="w-full p-2 border rounded text-right text-xs" /></div>
                </div>
                <div className="mb-3"><label className="block text-xs font-semibold mb-1">وصف المشروع</label><textarea placeholder="وصف مختصر..." value={newProjectDescription} onChange={(e) => setNewProjectDescription(e.target.value)} className="w-full p-2 border rounded text-right" rows={2} /></div>
                <button onClick={() => { if (!isSubscribed) { setShowSubscriptionModal(true); return; } saveProject(); }} disabled={uploadingFile} className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-bold disabled:opacity-50">
                  {uploadingFile ? "⏳ جاري الحفظ..." : "💾 حفظ المشروع"}
                </button>
              </div>
              <h4 className="font-bold mb-3 text-purple-900">📋 المشاريع المحفوظة ({savedProjects.length})</h4>
              {savedProjects.length === 0 ? (
                <div className="text-center text-gray-500 py-10 bg-gray-50 rounded-lg">لا يوجد مشاريع محفوظة بعد</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {savedProjects.map((proj) => (
                    <div key={proj.id} className="bg-white border-2 border-purple-100 rounded-lg p-4 hover:border-purple-300 transition">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1"><div className="font-bold text-purple-900">{proj.project_name}</div>{proj.client_name && <div className="text-xs text-gray-500">👤 {proj.client_name}</div>}{proj.location && <div className="text-xs text-gray-500">📍 {proj.location}</div>}</div>
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStageColor(proj.project_stage)}`}>{proj.project_stage || "تسعير"}</span>
                      </div>
                      <div className="text-xs text-gray-600 mb-2">💰 <span className="font-bold text-blue-700">{Math.ceil(proj.total_amount).toLocaleString("ar-EG")}</span> ج.م</div>
                      <div className="text-xs text-gray-400 mb-3">📅 {new Date(proj.created_at).toLocaleDateString("ar-EG")}{proj.file_name && <span className="mr-2">📎 {proj.file_name.substring(0, 20)}...</span>}</div>
                      <div className="flex gap-2">
                        <button onClick={() => openProject(proj)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-semibold">📂 فتح</button>
                        <button onClick={() => deleteProject(proj.id)} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded text-xs">🗑️</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: البنود المستخرجة */}
      {showParsedItemsModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[80] p-4 overflow-y-auto" onClick={() => setShowParsedItemsModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full my-8 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} dir="rtl">
            <div className="bg-teal-700 text-white p-5 rounded-t-2xl flex justify-between items-center sticky top-0 z-10">
              <div><h3 className="text-xl font-bold">📋 البنود المستخرجة</h3><p className="text-sm text-teal-200 mt-1">إجمالي {savedParsedItems.length} بند من {uniqueFiles.length} ملف</p>{autoProgress && <p className="text-xs text-yellow-200 mt-1 font-bold">{autoProgress}</p>}</div>
              <div className="flex gap-2 flex-wrap items-center">
                <button onClick={autoPriceAllPending} disabled={autoRunning} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded text-xs font-semibold disabled:opacity-50">{autoRunning ? "⏳ جاري التسعير..." : "⚡ تسعير تلقائي"}</button>
                <button onClick={repriceAutoItems} disabled={autoRunning} className="bg-teal-500 hover:bg-teal-600 text-white px-3 py-2 rounded text-xs font-semibold disabled:opacity-50" title="مسح وإعادة تسعير البنود المسعّرة تلقائيًا بالمحرك الجديد">🔄 إعادة تسعير التلقائي</button>
                {autoReport.length > 0 && (<button onClick={() => setShowAutoReport(true)} className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-2 rounded text-xs font-semibold">📋 تقرير ({autoReport.length})</button>)}
                <button onClick={approveAllPriced} className="bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-2 rounded text-xs font-semibold" title="اعتماد كل البنود المسعّرة وتثبيتها في الملخص">✅ اعتماد كل المسعّر</button>
                <button onClick={clearAllParsedItems} className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded text-xs font-semibold">🗑️ حذف الكل</button>
                <button onClick={() => setShowParsedItemsModal(false)} className="text-3xl text-teal-200 hover:text-white">×</button>
              </div>
            </div>
            <div className="p-6">
              <div className="bg-teal-50 p-4 rounded-lg mb-4 border border-teal-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div><label className="block text-xs font-semibold mb-1">🔍 بحث في الوصف والكود:</label><input type="text" placeholder="ابحث..." value={parsedSearchQuery} onChange={(e) => setParsedSearchQuery(e.target.value)} className="w-full p-2 border rounded text-right" /></div>
                  <div><label className="block text-xs font-semibold mb-1">📁 فلترة حسب الملف:</label>
                    <select value={parsedFileFilter} onChange={(e) => setParsedFileFilter(e.target.value)} className="w-full p-2 border rounded text-right">
                      <option value="">كل الملفات ({savedParsedItems.length})</option>
                      {uniqueFiles.map((file) => (<option key={file} value={file}>{file} ({savedParsedItems.filter(i => i.source_file === file).length})</option>))}
                    </select>
                  </div>
                </div>
              </div>
              {loadingParsedItems ? (
                <div className="text-center py-10 text-gray-500">جاري التحميل...</div>
              ) : Object.keys(groupedParsedItems).length === 0 ? (
                <div className="text-center py-10 bg-gray-50 rounded-lg">
                  <div className="text-4xl mb-2">📭</div>
                  <p className="text-gray-500">لا توجد بنود مستخرجة</p>
                  <button onClick={() => { setShowParsedItemsModal(false); setShowBOQUploader(true); }} className="mt-4 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded font-bold">📤 رفع ملفات جديدة</button>
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(groupedParsedItems).map(([fileName, items]) => (
                    <div key={fileName} className="border rounded-lg overflow-hidden">
                      <div className="bg-slate-700 text-white p-3 flex justify-between items-center">
                        <div className="font-bold text-sm">📄 {fileName}</div>
                        <span className="bg-teal-500 text-white text-xs px-2 py-0.5 rounded-full">{items.length} بند</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-slate-800 text-white">
                            <tr>
                              <th className="p-2 text-right">الشيت</th>
                              <th className="p-2 text-right">الكود</th>
                              <th className="p-2 text-right">الوصف</th>
                              <th className="p-2 text-center">الوحدة</th>
                              <th className="p-2 text-center">الكمية</th>
                              <th className="p-2 text-center">السعر</th>
                              <th className="p-2 text-center">الإجمالي</th>
                              <th className="p-2 text-center">إجراء</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((item: any, idx: number) => {
                              const bdKey = getBreakdownKey(item);
                              const legacyBdKey = getLegacyBreakdownKey(item);
                              const bd = parsedBreakdowns[bdKey] || parsedBreakdowns[legacyBdKey];
                              const price = bd?.final_price;
                              const total = bd?.final_price && bd?.quantity ? bd.final_price * bd.quantity : null;
                              return (
                                <tr key={item.id} className={item.status === "approved" ? "bg-emerald-100" : item.status === "matched" ? "bg-green-50" : item.status === "no_match" ? "bg-red-50" : (idx % 2 === 0 ? "bg-white" : "bg-slate-50")}>
                                  <td className="p-2 text-right text-gray-500">{item.source_sheet}</td>
                                  <td className="p-2 text-right font-mono">{item.item_code}</td>
                                  <td className="p-2 text-right">{item.item_description.substring(0, 80)}</td>
                                  <td className="p-2 text-center">{item.unit}</td>
                                  <td className="p-2 text-center font-bold">{item.quantity}</td>
                                  <td className="p-2 text-center font-bold text-green-700">
                                    {price ? Math.round(price).toLocaleString("ar-EG") : "—"}
                                    {bd && autoSourceLabel(bd) && (<div className={`text-[10px] font-semibold ${autoSourceLabel(bd)!.cls}`}>{autoSourceLabel(bd)!.label}{bd?.pricing?.inferred_from_item_code ? ` (من ${bd.pricing.inferred_from_item_code})` : ""}</div>)}
                                  </td>
                                  <td className="p-2 text-center font-bold text-blue-800">{total ? Math.round(total).toLocaleString("ar-EG") : "—"}</td>
                                  <td className="p-2 text-center">
                                    <div className="flex gap-1 justify-center">
                                      {bd ? (
                                        <>
                                          <button onClick={() => openViewBreakdown(bd)} className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs" title="عرض التحليل المحفوظ">👁️</button>
                                          <button onClick={() => openSavedBreakdownForEdit(bd)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-1 rounded text-xs" title="تعديل وإعادة التسعير">✏️</button>
                                          {bd?.pricing?.auto_source && !bd?.pricing?.manually_reviewed && item.status !== "approved" && (
                                            <button onClick={() => autoPriceOneItem(item, true, bd)} disabled={autoRunning} className="bg-teal-600 hover:bg-teal-700 text-white px-2 py-1 rounded text-xs disabled:opacity-50" title="إعادة التسعير التلقائي لهذا البند">🔄</button>
                                          )}
                                        </>
                                      ) : (
                                        <>
                                          <button onClick={() => autoPriceOneItem(item)} disabled={autoRunning} className="bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 rounded text-xs disabled:opacity-50" title="تسعير تلقائي لهذا البند">⚡</button>
                                          <button onClick={() => openBreakdownQuestions(item)} className="bg-purple-600 hover:bg-purple-700 text-white px-2 py-1 rounded text-xs" title="Breakdown تفصيلي">🧮</button>
                                        </>
                                      )}
                                      {bd && (item.status === "approved"
                                        ? (<button onClick={() => setParsedItemApproval(item, false)} className="bg-emerald-700 hover:bg-emerald-800 text-white px-2 py-1 rounded text-xs" title="معتمد ومثبّت في الملخص — اضغط لإلغاء الاعتماد">✔</button>)
                                        : (<button onClick={() => setParsedItemApproval(item, true)} className="bg-emerald-500 hover:bg-emerald-600 text-white px-2 py-1 rounded text-xs" title="اعتماد وتثبيت في ملخص المقايسة">✅</button>))}
                                      <button onClick={() => addParsedItemToMainTable(item)} className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs" title="إضافة بدون سعر">➕</button>
                                      <button onClick={() => deleteParsedItem(item.id)} className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-xs" title="حذف">🗑️</button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                  {/* صف الإجمالي الكلي */}
                  {parsedBreakdownsGrandTotal > 0 && (
                    <div className="bg-gradient-to-r from-orange-600 to-amber-600 text-white p-4 rounded-lg flex justify-between items-center shadow-lg">
                      <span className="text-lg font-bold">💰 الإجمالي الكلي للـ Breakdowns:</span>
                      <span className="text-2xl font-bold">{Math.round(parsedBreakdownsGrandTotal).toLocaleString("ar-EG")} ج.م</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: عرض Breakdown محفوظ */}
      {showViewBreakdownModal && viewingBreakdown && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[90] p-4 overflow-y-auto" onClick={() => { setShowViewBreakdownModal(false); setViewingBreakdown(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full my-8 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} dir="rtl">
            <div className="bg-gradient-to-r from-blue-700 to-indigo-700 text-white p-5 rounded-t-2xl flex justify-between items-center sticky top-0 z-10">
              <div>
                <h3 className="text-xl font-bold">👁️ مراجعة التحليل — {viewingBreakdown.item_code}</h3>
                <p className="text-sm text-blue-200 mt-1">{viewingBreakdown.item_description?.substring(0, 100)}</p>
                {viewingBreakdown.pricing?.auto_source && (
                  <span className="inline-block mt-2 bg-white/20 px-2 py-1 rounded text-xs">
                    {autoSourceLabel(viewingBreakdown)?.label || "تلقائي"}{viewingBreakdown.pricing.auto_confidence ? ` — ثقة ${Math.round(Number(viewingBreakdown.pricing.auto_confidence) * 100)}%` : ""}{viewingBreakdown.pricing.inferred_from_item_code ? ` — من بند ${viewingBreakdown.pricing.inferred_from_item_code}` : ""}
                  </span>
                )}
              </div>
              <button onClick={() => { setShowViewBreakdownModal(false); setViewingBreakdown(null); }} className="text-3xl text-blue-200 hover:text-white">×</button>
            </div>
            <div className="p-6">
              {/* بيانات البند */}
              <div className="bg-yellow-50 p-4 rounded-lg mb-6 border-2 border-yellow-200">
                <h4 className="font-bold mb-2 text-yellow-900">📦 بيانات البند:</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                  <div><span className="text-gray-600">الوحدة: </span><span className="font-bold">{viewingBreakdown.unit}</span></div>
                  <div><span className="text-gray-600">الكمية: </span><span className="font-bold">{viewingBreakdown.quantity}</span></div>
                  <div><span className="text-gray-600">سعر الوحدة: </span><span className="font-bold text-green-700">{Math.round(viewingBreakdown.final_price).toLocaleString("ar-EG")} ج.م</span></div>
                  <div><span className="text-gray-600">الإجمالي: </span><span className="font-bold text-blue-800">{Math.round(viewingBreakdown.final_price * viewingBreakdown.quantity).toLocaleString("ar-EG")} ج.م</span></div>
                </div>
              </div>

              {/* جدول المكونات */}
              <h4 className="font-bold text-lg mb-3">🧱 المكونات ({Array.isArray(viewingBreakdown.components) ? viewingBreakdown.components.length : 0}):</h4>
              {Array.isArray(viewingBreakdown.components) && viewingBreakdown.components.length > 0 ? (
                <div className="overflow-x-auto border-2 border-slate-200 rounded-lg mb-6">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-800 text-white">
                      <tr>
                        <th className="p-2 text-right">النوع</th>
                        <th className="p-2 text-right">المكون</th>
                        <th className="p-2 text-center">الكمية</th>
                        <th className="p-2 text-center">الوحدة</th>
                        <th className="p-2 text-center">سعر الوحدة</th>
                        <th className="p-2 text-center">الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewingBreakdown.components.map((c: any, idx: number) => (
                        <tr key={c.id || idx} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                          <td className="p-2 text-right"><span className={`px-2 py-0.5 rounded-full text-xs ${c.component_type === "خامات" ? "bg-blue-100 text-blue-800" : c.component_type === "مصنعيات" ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800"}`}>{c.component_type}</span></td>
                          <td className="p-2 text-right font-semibold">{c.component_name}</td>
                          <td className="p-2 text-center font-bold">{c.quantity}</td>
                          <td className="p-2 text-center text-xs">{c.unit}</td>
                          <td className="p-2 text-center">{Math.round(c.unit_rate).toLocaleString("ar-EG")}</td>
                          <td className="p-2 text-center font-bold text-blue-800">{Math.round(c.total_cost).toLocaleString("ar-EG")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-6 bg-gray-50 rounded-lg mb-6 text-gray-500">لا توجد مكونات محفوظة</div>
              )}

              {/* التسعير */}
              <h4 className="font-bold text-lg mb-3">💰 التسعير:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                <div className="bg-blue-50 p-3 rounded-lg flex justify-between items-center border border-blue-200"><span className="text-sm font-bold">التكلفة المباشرة:</span><span className="text-lg font-bold text-blue-800">{Math.round(viewingBreakdown.direct_cost || 0).toLocaleString("ar-EG")} ج.م</span></div>
                <div className="bg-yellow-50 p-3 rounded-lg flex justify-between items-center border border-yellow-200"><span className="text-sm font-bold">الهالك:</span><span className="text-lg font-bold text-yellow-800">{Math.round(viewingBreakdown.wastage_cost || 0).toLocaleString("ar-EG")} ج.م</span></div>
                <div className="bg-purple-50 p-3 rounded-lg flex justify-between items-center border border-purple-200"><span className="text-sm font-bold">غير مباشرة:</span><span className="text-lg font-bold text-purple-800">{Math.round(viewingBreakdown.overhead_cost || 0).toLocaleString("ar-EG")} ج.م</span></div>
                <div className="bg-red-50 p-3 rounded-lg flex justify-between items-center border border-red-200"><span className="text-sm font-bold">مخاطر:</span><span className="text-lg font-bold text-red-800">{Math.round(viewingBreakdown.risk_cost || 0).toLocaleString("ar-EG")} ج.م</span></div>
                <div className="bg-green-50 p-3 rounded-lg flex justify-between items-center border border-green-200"><span className="text-sm font-bold">ربح:</span><span className="text-lg font-bold text-green-800">{Math.round(viewingBreakdown.profit_cost || 0).toLocaleString("ar-EG")} ج.م</span></div>
                <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-3 rounded-lg flex justify-between items-center"><span className="text-sm font-bold">السعر النهائي:</span><span className="text-lg font-bold">{Math.round(viewingBreakdown.final_price || 0).toLocaleString("ar-EG")} ج.م/{viewingBreakdown.unit}</span></div>
              </div>

              {/* أزرار */}
              <div className="flex gap-3 pt-4 border-t-2">
                <button onClick={() => openSavedBreakdownForEdit(viewingBreakdown)} className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold">✏️ تعديل الـBreakdown وإعادة التسعير</button>
                <button onClick={deleteViewingBreakdown} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-bold">🗑️ حذف</button>
                <button onClick={() => { setShowViewBreakdownModal(false); setViewingBreakdown(null); }} className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-3 rounded-lg font-bold">إغلاق</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: تقرير التسعير التلقائي */}
      {showAutoReport && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4" onClick={() => setShowAutoReport(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full p-6 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} dir="rtl">
            <h3 className="text-xl font-bold mb-1 text-amber-700">📋 بنود لم يُسعَّر منها تلقائيًا ({autoReport.length})</h3>
            <p className="text-xs text-gray-500 mb-4">دي بنود محتاجة تدخلك (🧮 أو ✏️). الأسباب تحت كل بند بتوضح ليه المحرك ما قدرش يسعّرها.</p>
            {autoReport.length === 0 ? (
              <div className="text-center py-6 bg-green-50 rounded-lg text-green-700 font-bold">✅ كل البنود اتسعّرت</div>
            ) : (
              <div className="space-y-3">
                {autoReport.map((r: any, i: number) => (
                  <div key={i} className="border rounded-lg p-3 bg-amber-50">
                    <div className="font-bold text-sm"><span className="font-mono text-indigo-700">{r.code}</span> — {r.description}</div>
                    <div className="text-xs text-gray-600 mb-1">{r.quantity} {r.unit}</div>
                    <ul className="list-disc pr-5 text-xs text-red-700 space-y-0.5">
                      {(r.reasons || []).map((m: string, j: number) => (<li key={j}>{m}</li>))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 mt-4">
              <button onClick={() => { navigator.clipboard?.writeText(autoReport.map((r: any) => `${r.code} | ${r.description} | ${r.quantity} ${r.unit}\n  - ${(r.reasons || []).join("\n  - ")}`).join("\n\n")); alert("✅ تم نسخ التقرير"); }} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg font-bold">📋 نسخ التقرير</button>
              <button onClick={() => setShowAutoReport(false)} className="flex-1 bg-gray-300 hover:bg-gray-400 py-2 rounded-lg font-bold">إغلاق</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: مشروع جديد */}
      {showNewProjectModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[85] p-4" onClick={() => setShowNewProjectModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()} dir="rtl">
            <h3 className="text-xl font-extrabold text-emerald-700 mb-4">➕ مشروع جديد</h3>
            <div className="space-y-3">
              <div><label className="block text-xs font-semibold mb-1">اسم المشروع *</label><input type="text" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} placeholder="مثال: مشروع أكتوبر" className="w-full p-2 border rounded text-right" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-semibold mb-1">العميل</label><input type="text" value={newProjectClient} onChange={(e) => setNewProjectClient(e.target.value)} className="w-full p-2 border rounded text-right" /></div>
                <div><label className="block text-xs font-semibold mb-1">الموقع</label><input type="text" value={newProjectLocation} onChange={(e) => setNewProjectLocation(e.target.value)} className="w-full p-2 border rounded text-right" /></div>
                <div><label className="block text-xs font-semibold mb-1">نوع المشروع</label>
                  <select value={newProjectType} onChange={(e) => setNewProjectType(e.target.value)} className="w-full p-2 border rounded text-right">
                    {["سكني", "تجاري", "إداري", "صناعي", "فندقي", "تعليمي", "صحي", "أخرى"].map((x) => (<option key={x} value={x}>{x}</option>))}
                  </select>
                </div>
                <div><label className="block text-xs font-semibold mb-1">المرحلة</label>
                  <select value={newProjectStage} onChange={(e) => setNewProjectStage(e.target.value)} className="w-full p-2 border rounded text-right">
                    <option value="جديد">جديد</option><option value="تحت الدراسة">تحت الدراسة</option><option value="تم">تم</option>
                  </select>
                </div>
              </div>
              <div><label className="block text-xs font-semibold mb-1">وصف مختصر</label><textarea value={newProjectDescription} onChange={(e) => setNewProjectDescription(e.target.value)} rows={2} className="w-full p-2 border rounded text-right" /></div>
              {!isSubscribed && (<div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">ℹ️ حفظ المشروع في قاعدة البيانات للمشتركين فقط — هتشتغل عليه محلياً.</div>)}
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={startNewProject} className="flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg font-bold">🚀 ابدأ المشروع</button>
              <button onClick={() => setShowNewProjectModal(false)} className="flex-1 bg-gray-300 hover:bg-gray-400 py-3 rounded-lg font-bold">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: اختيار مشروع (جديد / تحت الدراسة / تم) */}
      {showProjectPicker && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[85] p-4 overflow-y-auto" onClick={() => setShowProjectPicker(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full my-8 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} dir="rtl">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white p-5 rounded-t-2xl flex justify-between items-center sticky top-0 z-10">
              <h3 className="text-xl font-extrabold">📂 مشاريعي</h3>
              <button onClick={() => setShowProjectPicker(false)} className="text-3xl text-amber-100 hover:text-white">×</button>
            </div>
            <div className="p-5">
              <div className="flex gap-2 mb-4 flex-wrap">
                {PROJECT_TABS.map((tab) => (
                  <button key={tab} onClick={() => setPickerTab(tab)} className={`px-4 py-1.5 rounded-full text-sm font-bold border-2 transition ${pickerTab === tab ? "bg-orange-500 text-white border-orange-500" : "bg-white text-slate-600 border-slate-200 hover:border-orange-300"}`}>
                    {tab} ({pickerProjects.filter((p) => stageInTab(p.project_stage, tab)).length})
                  </button>
                ))}
              </div>
              {pickerProjects.filter((p) => stageInTab(p.project_stage, pickerTab)).length === 0 ? (
                <div className="text-center py-10 text-slate-400">لا توجد مشاريع في هذا التصنيف</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {pickerProjects.filter((p) => stageInTab(p.project_stage, pickerTab)).map((p) => (
                    <div key={p.id} className="border-2 border-slate-100 rounded-xl p-4 hover:border-orange-300 transition">
                      <div className="flex justify-between items-start mb-1">
                        <div className="font-bold text-slate-800">{p.project_name}</div>
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${getStageColor(p.project_stage)}`}>{p.project_stage || "—"}</span>
                      </div>
                      {p.client_name && <div className="text-xs text-slate-500">👤 {p.client_name}</div>}
                      {p.location && <div className="text-xs text-slate-500">📍 {p.location}</div>}
                      <div className="text-xs text-slate-500 mt-1">💰 {Math.ceil(p.total_amount || 0).toLocaleString("ar-EG")} ج.م • 📅 {new Date(p.created_at).toLocaleDateString("ar-EG")}</div>
                      <button onClick={() => { setShowProjectPicker(false); openProject(p); }} className="mt-3 w-full bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg text-sm font-bold">📂 فتح المشروع</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: ملخص المقايسة (عند الطلب) */}
      {showSummaryModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[85] p-4 overflow-y-auto" onClick={() => setShowSummaryModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full my-8 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} dir="rtl">
            <div className="bg-gradient-to-r from-sky-700 to-blue-800 text-white p-5 rounded-t-2xl flex justify-between items-center sticky top-0 z-10">
              <div>
                <h3 className="text-xl font-extrabold">📊 ملخص المقايسة</h3>
                <p className="text-sm text-sky-200 mt-1">{newProjectName || "بدون مشروع محدد"}</p>
              </div>
              <button onClick={() => setShowSummaryModal(false)} className="text-3xl text-sky-200 hover:text-white">×</button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center"><div className="text-[11px] text-slate-500">بنود التقسيمات</div><div className="font-extrabold text-blue-800">{Math.ceil(projectTotal).toLocaleString("ar-EG")}</div></div>
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-center"><div className="text-[11px] text-slate-500">البنود الخاصة</div><div className="font-extrabold text-indigo-800">{Math.ceil(customItemsTotal).toLocaleString("ar-EG")}</div></div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center"><div className="text-[11px] text-slate-500">المقايسة المرفوعة (معتمدة)</div><div className="font-extrabold text-emerald-800">{Math.round(approvedTotal).toLocaleString("ar-EG")}</div></div>
                <div className="bg-slate-800 rounded-xl p-3 text-center text-white"><div className="text-[11px] text-slate-300">الإجمالي الكلي</div><div className="font-extrabold">{Math.ceil(grandTotal + approvedTotal).toLocaleString("ar-EG")} ج.م</div></div>
              </div>

              {divisions.some((div) => getDivisionTotal(div.id) > 0) && (
                <div>
                  <h4 className="font-bold text-slate-700 mb-2">🏷️ حسب التقسيمات</h4>
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-800 text-white"><tr><th className="p-2 text-right">الكود</th><th className="p-2 text-right">التقسيم</th><th className="p-2 text-center">البنود</th><th className="p-2 text-center">الإجمالي (ج.م)</th></tr></thead>
                      <tbody>
                        {divisions.filter((div) => getDivisionTotal(div.id) > 0).map((div, idx) => (
                          <tr key={div.id} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                            <td className="p-2 text-right font-mono text-xs">{div.code}</td>
                            <td className="p-2 text-right font-semibold">{div.name_ar}</td>
                            <td className="p-2 text-center">{getDivisionItemCount(div.id)}</td>
                            <td className="p-2 text-center font-bold text-blue-800">{Math.ceil(getDivisionTotal(div.id)).toLocaleString("ar-EG")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div>
                <h4 className="font-bold text-slate-700 mb-2">📋 المقايسة المرفوعة — البنود المعتمدة ({approvedForSummary.length})</h4>
                {approvedForSummary.length === 0 ? (
                  <div className="text-center py-6 bg-slate-50 rounded-lg text-slate-400 text-sm">لا توجد بنود معتمدة بعد — افتح «📋 البنود المستخرجة» واضغط ✅ على كل بند بعد مراجعته.</div>
                ) : (
                  <div className="overflow-x-auto border rounded-lg max-h-96 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-emerald-700 text-white sticky top-0"><tr><th className="p-2 text-right">الشيت</th><th className="p-2 text-right">الكود</th><th className="p-2 text-right">البند</th><th className="p-2 text-center">الوحدة</th><th className="p-2 text-center">الكمية</th><th className="p-2 text-center">السعر</th><th className="p-2 text-center">الإجمالي</th></tr></thead>
                      <tbody>
                        {approvedForSummary.map((r: any, idx: number) => (
                          <tr key={r.item.id} className={idx % 2 === 0 ? "bg-white" : "bg-emerald-50"}>
                            <td className="p-2 text-right text-gray-500">{r.item.source_sheet}</td>
                            <td className="p-2 text-right font-mono">{r.item.item_code}</td>
                            <td className="p-2 text-right">{String(r.item.item_description || "").substring(0, 70)}</td>
                            <td className="p-2 text-center">{r.item.unit}</td>
                            <td className="p-2 text-center font-bold">{r.item.quantity}</td>
                            <td className="p-2 text-center">{Math.round(r.price).toLocaleString("ar-EG")}</td>
                            <td className="p-2 text-center font-bold text-emerald-800">{Math.round(r.total).toLocaleString("ar-EG")}</td>
                          </tr>
                        ))}
                        <tr className="bg-emerald-700 text-white font-bold"><td colSpan={6} className="p-2 text-right">إجمالي المقايسة المرفوعة:</td><td className="p-2 text-center">{Math.round(approvedTotal).toLocaleString("ar-EG")}</td></tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button onClick={() => { if (!isSubscribed) { setShowSubscriptionModal(true); return; } exportToExcel(); }} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg font-bold">📤 تصدير Excel</button>
                <button onClick={printBOQ} className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white py-2.5 rounded-lg font-bold">🖨️ طباعة</button>
                <button onClick={() => setShowSummaryModal(false)} className="flex-1 bg-gray-300 hover:bg-gray-400 py-2.5 rounded-lg font-bold">إغلاق</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Breakdown - الأسئلة */}
      {showBreakdownQuestions && breakdownItem && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[90] p-4 overflow-y-auto" onClick={() => { setShowBreakdownQuestions(false); setBreakdownItem(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full my-8 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} dir="rtl">
            <div className="bg-gradient-to-r from-indigo-700 to-purple-700 text-white p-5 rounded-t-2xl flex justify-between items-center sticky top-0 z-10">
              <div><h3 className="text-xl font-bold">📋 Breakdown — {breakdownItem.item_code}</h3><p className="text-sm text-indigo-200 mt-1">{breakdownItem.item_description?.substring(0, 100)}</p></div>
              <button onClick={() => { setShowBreakdownQuestions(false); setBreakdownItem(null); }} className="text-3xl text-indigo-200 hover:text-white">×</button>
            </div>
            <div className="p-6">
              {loadingBreakdown ? (
                <div className="text-center py-10"><div className="text-4xl mb-3">⏳</div><p className="text-indigo-700 font-bold">جاري التحميل...</p></div>
              ) : (
                <>
                  <div className="bg-yellow-50 p-4 rounded-lg mb-6 border-2 border-yellow-200">
                    <h4 className="font-bold mb-2 text-yellow-900">📦 البند المستخرج:</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-gray-600">الكود: </span><span className="font-bold">{breakdownItem.item_code}</span></div>
                      <div><span className="text-gray-600">الوحدة: </span><span className="font-bold">{breakdownItem.unit}</span></div>
                      <div><span className="text-gray-600">الكمية: </span><span className="font-bold">{breakdownItem.quantity}</span></div>
                      <div><span className="text-gray-600">الشيت: </span><span className="font-bold">{breakdownItem.source_sheet}</span></div>
                    </div>
                  </div>
                  <div className="mb-6 bg-indigo-50 border-2 border-indigo-200 rounded-xl p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-bold text-indigo-800">🎚️ مستوى الأسئلة: {userLevel}</div>
                        <div className="text-xs text-indigo-600 mt-0.5">{LEVELS.find((l) => l.key === userLevel)?.desc}</div>
                      </div>
                      <div className="flex gap-1 bg-white p-1 rounded-lg border">
                        {LEVELS.map((lv) => (
                          <button key={lv.key} onClick={() => changeLevel(lv.key)} className={`text-xs font-bold px-3 py-1.5 rounded-md transition ${userLevel === lv.key ? "bg-indigo-600 text-white shadow" : "text-slate-500 hover:bg-slate-100"}`}>{lv.icon} {lv.key}</button>
                        ))}
                      </div>
                    </div>
                    {breakdownQuestions.filter((q: any) => levelRank(userLevel) < questionMinLevel(q)).length > 0 && (
                      <div className="text-xs text-amber-700 mt-2">⚠️ {breakdownQuestions.filter((q: any) => levelRank(userLevel) < questionMinLevel(q)).length} سؤال مخفي في هذا المستوى (بتُستخدم قيمها الافتراضية). غيّر المستوى لعرضها.</div>
                    )}
                  </div>
                  {["بيانات البند", "ظروف التنفيذ", "المخاطر والمحاذير", "الهالك والفاقد", "المصنعيات والمعدات", "المصاريف والربح"].map((section) => {
                    const sectionQs = breakdownQuestions.filter(q => q.section === section && levelRank(userLevel) >= questionMinLevel(q));
                    if (sectionQs.length === 0) return null;
                    return (
                      <div key={section} className="mb-6">
                        <h4 className="font-bold text-indigo-800 text-lg mb-3 border-b-2 border-indigo-200 pb-2">🔹 {section}</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {sectionQs.map((q: any) => (
                            <div key={q.id} className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                              <label className="block text-sm font-semibold text-gray-700 mb-2">{q.question_order}. {q.question_text}</label>
                              {q.question_type === "select" ? (
                                <select value={breakdownAnswers[`q_${q.id}`] || ""} onChange={(e) => setBreakdownAnswers({ ...breakdownAnswers, [`q_${q.id}`]: e.target.value })} className="w-full p-2 border-2 border-gray-200 rounded text-right focus:ring-2 focus:ring-indigo-500 outline-none">
                                  <option value="">— اختار —</option>
                                  {(q.options || []).map((opt: string, i: number) => (<option key={i} value={opt}>{opt}</option>))}
                                </select>
                              ) : q.question_type === "boolean" ? (
                                <select value={breakdownAnswers[`q_${q.id}`] || "false"} onChange={(e) => setBreakdownAnswers({ ...breakdownAnswers, [`q_${q.id}`]: e.target.value })} className="w-full p-2 border-2 border-gray-200 rounded text-right focus:ring-2 focus:ring-indigo-500 outline-none">
                                  <option value="false">لا</option>
                                  <option value="true">نعم</option>
                                </select>
                              ) : q.question_type === "number" ? (
                                <input type="number" value={breakdownAnswers[`q_${q.id}`] || ""} onChange={(e) => setBreakdownAnswers({ ...breakdownAnswers, [`q_${q.id}`]: e.target.value })} className="w-full p-2 border-2 border-gray-200 rounded text-right focus:ring-2 focus:ring-indigo-500 outline-none" step="0.01" />
                              ) : (
                                <input type="text" value={breakdownAnswers[`q_${q.id}`] || ""} onChange={(e) => setBreakdownAnswers({ ...breakdownAnswers, [`q_${q.id}`]: e.target.value })} className="w-full p-2 border-2 border-gray-200 rounded text-right focus:ring-2 focus:ring-indigo-500 outline-none" />
                              )}
                              {q.default_value && (<p className="text-xs text-gray-500 mt-1">💡 القيمة الافتراضية: {q.default_value}</p>)}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {getExpertQuestions(breakdownItem).length > 0 && (
                    <div className="mb-6">
                      <h4 className="font-bold text-purple-800 text-lg mb-1 border-b-2 border-purple-200 pb-2">🧠 أسئلة الخبرة الميدانية</h4>
                      <p className="text-xs text-gray-500 mb-3">كل إجابة غير "الأساسية" بتضيف بند «تعديل خبرة» على التكلفة المباشرة. النسب افتراضية للتقدير الأولي، وتقدر تعدّلها أو تحذفها بعد الحساب. مستواك الحالي: {userLevel}.</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {getExpertQuestions(breakdownItem).map((q) => (
                          <div key={q.key} className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">{q.text}</label>
                            <select value={expertAnswers[q.key] ?? 0} onChange={(e) => setExpertAnswers({ ...expertAnswers, [q.key]: Number(e.target.value) })} className="w-full p-2 border-2 border-purple-200 rounded text-right">
                              {q.options.map((o, i) => (<option key={i} value={i}>{o.label}{o.pct > 0 ? ` (+${o.pct}%)` : ""}</option>))}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex gap-3 mt-6 pt-4 border-t-2">
                    <button onClick={() => { setShowBreakdownQuestions(false); setBreakdownItem(null); }} className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-3 rounded-lg font-bold">🔙 إلغاء</button>
                    <button onClick={calculateBreakdown} disabled={loadingBreakdown} className="flex-[2] bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white py-3 rounded-lg font-bold text-lg disabled:opacity-50">
                      {loadingBreakdown ? "⏳ جاري الحساب..." : "🧮 احسب Breakdown"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Breakdown - عرض النتيجة */}
      {showBreakdownView && breakdownResult && breakdownItem && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[90] p-4 overflow-y-auto" onClick={() => { setShowBreakdownView(false); setBreakdownItem(null); setBreakdownResult(null); setBreakdownComponents([]); }}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full my-8 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} dir="rtl">
            <div className="bg-gradient-to-r from-emerald-700 to-teal-700 text-white p-5 rounded-t-2xl flex justify-between items-center sticky top-0 z-10">
              <div><h3 className="text-xl font-bold">📊 Breakdown — {breakdownItem.item_code}</h3><p className="text-sm text-emerald-200 mt-1">{breakdownItem.item_description?.substring(0, 100)}</p></div>
              <button onClick={() => { setShowBreakdownView(false); setBreakdownItem(null); setBreakdownResult(null); setBreakdownComponents([]); }} className="text-3xl text-emerald-200 hover:text-white">×</button>
            </div>
            <div className="p-6">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-bold text-lg">🧱 المكونات ({breakdownComponents.length}):</h4>
                <button onClick={() => setShowAddBreakdownComponentModal(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold">➕ إضافة مكون</button>
              </div>
              <div className="overflow-x-auto border-2 border-slate-200 rounded-lg mb-6">
                <table className="w-full text-sm">
                  <thead className="bg-slate-800 text-white"><tr><th className="p-2 text-right">النوع</th><th className="p-2 text-right">المكون</th><th className="p-2 text-center">الكمية</th><th className="p-2 text-center">الوحدة</th><th className="p-2 text-center">سعر الوحدة</th><th className="p-2 text-center">الإجمالي</th><th className="p-2 text-center">🗑️</th></tr></thead>
                  <tbody>
                    {breakdownComponents.map((c: any, idx: number) => (
                      <tr key={c.id} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                        <td className="p-2 text-right"><span className={`px-2 py-0.5 rounded-full text-xs ${c.component_type === "خامات" ? "bg-blue-100 text-blue-800" : c.component_type === "مصنعيات" ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800"}`}>{c.component_type}</span></td>
                        <td className="p-2 text-right font-semibold">{c.component_name}</td>
                        <td className="p-2 text-center"><input type="number" value={c.quantity} onChange={(e) => updateBreakdownComponent(c.id, Number(e.target.value), Number(c.unit_rate))} className="w-20 p-1 border rounded text-center text-xs font-bold" step="0.01" /></td>
                        <td className="p-2 text-center text-xs">{c.unit}</td>
                        <td className="p-2 text-center"><input type="number" value={c.unit_rate} onChange={(e) => updateBreakdownComponent(c.id, Number(c.quantity), Number(e.target.value))} className="w-24 p-1 border rounded text-center text-xs font-bold" step="0.1" /></td>
                        <td className="p-2 text-center font-bold text-blue-800">{Math.round(c.total_cost).toLocaleString("ar-EG")}</td>
                        <td className="p-2 text-center"><button onClick={() => removeBreakdownComponent(c.id)} className="text-red-500 hover:text-red-700 text-lg" title="حذف">🗑️</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <h4 className="font-bold text-lg mb-3">💰 التسعير:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                <div className="bg-blue-50 p-3 rounded-lg flex justify-between items-center border border-blue-200"><span className="text-sm font-bold">التكلفة المباشرة:</span><span className="text-lg font-bold text-blue-800">{Math.round(breakdownResult.direct_cost).toLocaleString("ar-EG")} ج.م</span></div>
                <div className="bg-yellow-50 p-3 rounded-lg flex justify-between items-center border border-yellow-200"><span className="text-sm font-bold">الهالك:</span><span className="text-lg font-bold text-yellow-800">{Math.round(breakdownResult.wastage_cost).toLocaleString("ar-EG")} ج.م</span></div>
                <div className="bg-purple-50 p-3 rounded-lg flex justify-between items-center border border-purple-200"><span className="text-sm font-bold">غير مباشرة ({breakdownResult.overhead_pct}%):</span><span className="text-lg font-bold text-purple-800">{Math.round(breakdownResult.overhead_cost).toLocaleString("ar-EG")} ج.م</span></div>
                <div className="bg-red-50 p-3 rounded-lg flex justify-between items-center border border-red-200"><span className="text-sm font-bold">مخاطر ({breakdownResult.risk_pct}%):</span><span className="text-lg font-bold text-red-800">{Math.round(breakdownResult.risk_cost).toLocaleString("ar-EG")} ج.م</span></div>
                <div className="bg-green-50 p-3 rounded-lg flex justify-between items-center border border-green-200"><span className="text-sm font-bold">ربح ({breakdownResult.profit_pct}%):</span><span className="text-lg font-bold text-green-800">{Math.round(breakdownResult.profit_cost).toLocaleString("ar-EG")} ج.م</span></div>
              </div>
              <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-5 rounded-lg mb-6">
                <div className="flex justify-between items-center mb-2"><span className="text-lg font-bold">💰 السعر النهائي للوحدة:</span><span className="text-3xl font-bold">{Math.round(breakdownResult.final_price).toLocaleString("ar-EG")} ج.م/{breakdownItem.unit}</span></div>
                <div className="flex justify-between items-center pt-2 border-t border-white/30"><span className="text-sm">📦 الإجمالي ({breakdownItem.quantity} {breakdownItem.unit}):</span><span className="text-xl font-bold">{Math.round(breakdownResult.final_price * breakdownItem.quantity).toLocaleString("ar-EG")} ج.م</span></div>
              </div>
              <div className="flex gap-3">
                <button onClick={recalculateBreakdownTotals} className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-3 rounded-lg font-bold">🔄 إعادة الحساب</button>
                <button onClick={() => { setShowBreakdownView(false); setBreakdownItem(null); setBreakdownResult(null); setBreakdownComponents([]); }} className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-3 rounded-lg font-bold">❌ إلغاء</button>
                <button onClick={approveBreakdown} className="flex-[2] bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white py-3 rounded-lg font-bold text-lg">💾 حفظ التعديل / اعتماد Breakdown</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: إضافة مكون Breakdown */}
      {showAddBreakdownComponentModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[95] p-4" onClick={() => setShowAddBreakdownComponentModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()} dir="rtl">
            <h3 className="text-xl font-bold mb-4 text-indigo-700">➕ إضافة مكون جديد</h3>
            <div className="space-y-3">
              <div><label className="block text-sm font-semibold mb-1">النوع:</label>
                <select value={newBreakdownComponent.component_type} onChange={(e) => setNewBreakdownComponent({...newBreakdownComponent, component_type: e.target.value})} className="w-full p-3 border rounded-lg text-right">
                  <option value="خامات">خامات</option><option value="مصنعيات">مصنعيات</option><option value="معدات">معدات</option><option value="أخرى">أخرى</option>
                </select>
              </div>
              <div><label className="block text-sm font-semibold mb-1">اسم المكون:</label><input type="text" placeholder="مثال: إضافات كيميائية" value={newBreakdownComponent.component_name} onChange={(e) => setNewBreakdownComponent({...newBreakdownComponent, component_name: e.target.value})} className="w-full p-3 border rounded-lg text-right" /></div>
              <div className="grid grid-cols-3 gap-2">
                <div><label className="block text-sm font-semibold mb-1">الكمية:</label><input type="number" value={newBreakdownComponent.quantity} onChange={(e) => setNewBreakdownComponent({...newBreakdownComponent, quantity: Number(e.target.value)})} className="w-full p-3 border rounded-lg text-center font-bold" step="0.01" /></div>
                <div><label className="block text-sm font-semibold mb-1">الوحدة:</label>
                  <select value={newBreakdownComponent.unit} onChange={(e) => setNewBreakdownComponent({...newBreakdownComponent, unit: e.target.value})} className="w-full p-3 border rounded-lg text-center">
                    <option value="كجم">كجم</option><option value="م³">م³</option><option value="م²">م²</option><option value="م.ط">م.ط</option><option value="لتر">لتر</option><option value="عدد">عدد</option><option value="يوم">يوم</option><option value="طن">طن</option>
                  </select>
                </div>
                <div><label className="block text-sm font-semibold mb-1">السعر:</label><input type="number" value={newBreakdownComponent.unit_rate} onChange={(e) => setNewBreakdownComponent({...newBreakdownComponent, unit_rate: Number(e.target.value)})} className="w-full p-3 border rounded-lg text-center font-bold" step="0.1" /></div>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={addBreakdownComponent} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg font-bold">إضافة</button>
              <button onClick={() => setShowAddBreakdownComponentModal(false)} className="flex-1 bg-gray-300 hover:bg-gray-400 py-3 rounded-lg font-bold">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: إضافة بند خاص */}
      {showCustomItemModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowCustomItemModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()} dir="rtl">
            <h3 className="text-xl font-bold mb-4 text-indigo-700">➕ إضافة بند خاص</h3>
            <div className="space-y-3">
              <input type="text" placeholder="كود البند" value={customItem.code} onChange={(e) => setCustomItem({...customItem, code: e.target.value})} className="w-full p-3 border rounded text-right" />
              <input type="text" placeholder="اسم البند *" value={customItem.name_ar} onChange={(e) => setCustomItem({...customItem, name_ar: e.target.value})} className="w-full p-3 border rounded text-right" />
              <select value={customItem.unit} onChange={(e) => setCustomItem({...customItem, unit: e.target.value})} className="w-full p-3 border rounded text-right">
                <option value="m³">m³</option><option value="m²">m²</option><option value="m">m</option>
                <option value="No.">No.</option><option value="kg">kg</option><option value="Ton">Ton</option><option value="LS">LS</option>
              </select>
              <input type="number" placeholder="السعر الفردي *" value={customItem.rate} onChange={(e) => setCustomItem({...customItem, rate: Number(e.target.value)})} className="w-full p-3 border rounded text-right" />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={addCustomItem} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg font-bold">إضافة</button>
              <button onClick={() => setShowCustomItemModal(false)} className="flex-1 bg-gray-300 hover:bg-gray-400 py-3 rounded-lg font-bold">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: تفاصيل المشروع */}
      {showProjectDetailsModal && selectedProject && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[70] p-4 overflow-y-auto" onClick={() => setShowProjectDetailsModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full my-8" onClick={(e) => e.stopPropagation()} dir="rtl">
            <div className="bg-slate-900 text-white p-6 rounded-t-2xl flex justify-between items-center">
              <div><h3 className="text-xl font-bold text-blue-400">📋 {selectedProject.project_name}</h3><p className="text-sm text-gray-300 mt-1">تفاصيل المشروع والمقايسة</p></div>
              <button onClick={() => setShowProjectDetailsModal(false)} className="text-3xl text-gray-400 hover:text-white">×</button>
            </div>
            <div className="bg-slate-50 p-5 border-b">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><div className="text-gray-500 text-xs">العميل</div><div className="font-bold">{selectedProject.client_name || "غير محدد"}</div></div>
                <div><div className="text-gray-500 text-xs">الموقع</div><div className="font-bold">{selectedProject.location || "غير محدد"}</div></div>
                <div><div className="text-gray-500 text-xs">نوع المشروع</div><div className="font-bold">{selectedProject.project_type || "غير محدد"}</div></div>
                <div><div className="text-gray-500 text-xs">المرحلة</div><span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStageColor(selectedProject.project_stage)}`}>{selectedProject.project_stage || "تسعير"}</span></div>
                <div><div className="text-gray-500 text-xs">التاريخ</div><div className="font-bold">{new Date(selectedProject.created_at).toLocaleDateString("ar-EG")}</div></div>
                <div><div className="text-gray-500 text-xs">الإجمالي</div><div className="font-bold text-blue-700">{Math.ceil(selectedProject.total_amount).toLocaleString("ar-EG")} ج.م</div></div>
                {selectedProject.file_name && (<div className="col-span-2"><div className="text-gray-500 text-xs">ملف المقايسة</div><button onClick={downloadProjectFile} className="text-blue-600 hover:text-blue-800 font-bold underline">📎 {selectedProject.file_name}</button></div>)}
              </div>
              {selectedProject.description && (<div className="mt-3 text-sm"><div className="text-gray-500 text-xs mb-1">الوصف</div><div className="bg-white p-2 rounded border">{selectedProject.description}</div></div>)}
            </div>
            <div className="p-6">
              <h4 className="font-bold text-lg mb-4">📊 تفاصيل المقايسة:</h4>
              <div className="overflow-x-auto border rounded-lg mb-4">
                <table className="w-full text-sm">
                  <thead className="bg-slate-800 text-white"><tr><th className="p-3 text-right">الكود</th><th className="p-3 text-right">البند</th><th className="p-3 text-center">الوحدة</th><th className="p-3 text-center">الكمية</th><th className="p-3 text-center">السعر</th><th className="p-3 text-center">الإجمالي</th></tr></thead>
                  <tbody>
                    {allItems.filter((item) => selectedProject.project_data?.[item.id]?.quantity > 0).map((item, idx) => {
                      const ui = selectedProject.project_data[item.id];
                      return (
                        <tr key={item.id} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                          <td className="p-2 text-right font-mono text-xs">{item.code}</td>
                          <td className="p-2 text-right font-semibold text-xs">{item.name_ar || item.name_en}</td>
                          <td className="p-2 text-center text-xs">{item.unit}</td>
                          <td className="p-2 text-center font-bold">{ui.quantity}</td>
                          <td className="p-2 text-center">{Math.ceil(ui.custom_rate).toLocaleString("ar-EG")}</td>
                          <td className="p-2 text-center font-bold text-blue-800">{Math.ceil(ui.quantity * ui.custom_rate).toLocaleString("ar-EG")}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="bg-blue-600 text-white p-5 rounded-lg flex justify-between items-center">
                <span className="text-xl font-bold">💰 الإجمالي الكلي:</span>
                <span className="text-3xl font-bold">{Math.ceil(selectedProject.total_amount).toLocaleString("ar-EG")} ج.م</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={loadProjectIntoWorkspace} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold">✏️ فتح في مساحة العمل (للتعديل)</button>
                {selectedProject.file_url && (<button onClick={downloadProjectFile} className="bg-purple-600 hover:bg-purple-700 text-white py-3 px-6 rounded-lg font-bold">📥 تحميل الملف</button>)}
                <button onClick={() => window.print()} className="bg-yellow-600 hover:bg-yellow-700 text-white py-3 px-6 rounded-lg font-bold">🖨️ طباعة</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: البحث في المكونات */}
      {showSearchModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowSearchModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} dir="rtl">
            <h3 className="text-xl font-bold mb-4 text-pink-700">🔍 نتائج البحث في المكونات</h3>
            {searchResults.length === 0 ? (<div className="text-center text-gray-500 py-10">لا توجد نتائج.</div>) : (
              <div className="space-y-2">
                {searchResults.map((r, idx) => (
                  <div key={idx} className="bg-pink-50 border-r-4 border-pink-500 p-3 rounded">
                    <div className="font-bold text-sm">{r.item.name_ar || r.item.name_en}</div>
                    <div className="text-xs text-gray-600 mt-1">المكوّن: <span className="font-semibold text-pink-700">{r.matched_component}</span> - السعر: <span className="font-bold">{r.component_rate}</span></div>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setShowSearchModal(false)} className="w-full mt-4 bg-gray-300 hover:bg-gray-400 py-2 rounded font-bold">إغلاق</button>
          </div>
        </div>
      )}

      {/* Modal: Rate Analysis */}
      {showAnalysis && analysisItem && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[85] p-4 overflow-y-auto" onClick={closeAnalysis}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full my-8" onClick={(e) => e.stopPropagation()} dir="rtl">
            <div className="bg-slate-900 text-white p-6 rounded-t-2xl flex justify-between items-center">
              <div><h3 className="text-xl font-bold text-blue-400">📊 تحليل تكلفة البند</h3><p className="text-sm text-gray-300 mt-1">{analysisItem.name_ar}</p></div>
              <button onClick={closeAnalysis} className="text-3xl text-gray-400 hover:text-white">×</button>
            </div>
            <div className="bg-blue-50 p-4 border-b flex flex-wrap gap-4 justify-between items-center text-sm">
              <div><span className="text-gray-600">الكود: </span><span className="font-bold">{analysisItem.code}</span></div>
              <div><span className="text-gray-600">الوحدة: </span><span className="font-bold">{analysisItem.unit}</span></div>
              <div><span className="text-gray-600">السعر الأساسي: </span><span className="font-bold text-blue-800">{Math.ceil(analysisItem.rate).toLocaleString("ar-EG")} ج.م</span></div>
              <div className="flex gap-2 items-center flex-wrap">
                {analysisDirty && (<span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">● تغييرات غير محفوظة</span>)}
                {autoSaving && (<span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">⏳ جاري الحفظ...</span>)}
                <button onClick={resetAnalysis} className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded text-xs font-semibold">🔄 إعادة تعيين</button>
                <button onClick={() => saveAnalysis(false)} disabled={savingAnalysis} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs font-semibold disabled:opacity-50">
                  {savingAnalysis ? "⏳ جاري الحفظ..." : "💾 حفظ الآن"}
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-bold text-lg">تفاصيل التكلفة ({analysisComponents.length} مكوّن):</h4>
                <button onClick={() => setShowAddComponentModal(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold">➕ إضافة مكوّن</button>
              </div>
              {analysisComponents.length > 0 ? (
                <div className="overflow-x-auto border rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-800 text-white"><tr><th className="p-3 text-right">#</th><th className="p-3 text-right">النوع</th><th className="p-3 text-right">المكوّن</th><th className="p-3 text-center">الكمية</th><th className="p-3 text-center">الوحدة</th><th className="p-3 text-center">السعر الفردي</th><th className="p-3 text-center">الإجمالي</th><th className="p-3 text-center">🗑️</th></tr></thead>
                    <tbody>
                      {analysisComponents.map((comp, idx) => (
                        <tr key={comp.id} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                          <td className="p-2 text-right font-mono text-xs">{idx + 1}</td>
                          <td className="p-2 text-center"><span className={`px-2 py-1 rounded-full text-xs ${comp.component_type === "خامات" ? "bg-blue-100 text-blue-800" : comp.component_type === "مصنعيات" ? "bg-green-100 text-green-800" : comp.component_type === "معدات" ? "bg-orange-100 text-orange-800" : "bg-gray-100 text-gray-800"}`}>{comp.component_type}</span></td>
                          <td className="p-2 text-right font-semibold text-xs">{comp.component_name}</td>
                          <td className="p-2 text-center"><input type="number" value={comp.quantity} onChange={(e) => updateComponentQuantity(comp.id, Number(e.target.value))} className="w-20 p-1 border rounded text-center text-xs font-bold" step="0.01" min="0" /></td>
                          <td className="p-2 text-center text-xs">{comp.unit}</td>
                          <td className="p-2 text-center"><input type="number" value={comp.unit_rate} onChange={(e) => updateComponentRate(comp.id, Number(e.target.value))} className="w-24 p-1 border rounded text-center text-xs font-bold" step="0.1" min="0" /></td>
                          <td className="p-2 text-center font-bold text-blue-800 text-sm">{Math.ceil(comp.quantity * comp.unit_rate).toLocaleString("ar-EG")}</td>
                          <td className="p-2 text-center"><button onClick={() => removeComponent(comp.id)} className="text-red-500 hover:text-red-700 text-lg">×</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (<div className="text-center text-gray-500 py-10 bg-gray-50 rounded-lg">لا توجد مكونات لهذا البند. اضغط "إضافة مكوّن" للبدء.</div>)}
              <div className="mt-6 space-y-3">
                <div className="bg-blue-50 p-4 rounded-lg flex justify-between items-center border border-blue-200"><span className="text-lg font-bold text-blue-900">التكلفة المباشرة:</span><span className="text-2xl font-bold text-blue-800">{directCost.toLocaleString("ar-EG")} ج.م</span></div>
                <div className="bg-yellow-50 p-4 rounded-lg flex justify-between items-center border border-yellow-200">
                  <div className="flex items-center gap-3"><span className="text-lg font-bold text-yellow-900">معامل الضرب:</span><input type="number" value={markupFactor} onChange={(e) => setMarkupFactor(Number(e.target.value))} className="w-24 p-2 border-2 border-yellow-400 rounded-lg text-center font-bold" step="0.01" min="1" /></div>
                  <span className="text-sm text-gray-600">× {markupFactor}</span>
                </div>
                <div className="bg-green-600 text-white p-5 rounded-lg flex justify-between items-center"><span className="text-xl font-bold">💰 السعر النهائي:</span><span className="text-3xl font-bold">{finalPrice.toLocaleString("ar-EG")} ج.م</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: إضافة مكوّن للتحليل */}
      {showAddComponentModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[90] p-4" onClick={() => setShowAddComponentModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()} dir="rtl">
            <h3 className="text-xl font-bold mb-4 text-indigo-700">➕ إضافة مكوّن جديد</h3>
            <div className="space-y-3">
              <div><label className="block text-sm font-semibold mb-1">النوع:</label><select value={newComponent.component_type} onChange={(e) => setNewComponent({...newComponent, component_type: e.target.value})} className="w-full p-3 border rounded-lg text-right"><option value="خامات">خامات</option><option value="مصنعيات">مصنعيات</option><option value="معدات">معدات</option><option value="أخرى">أخرى</option></select></div>
              <div><label className="block text-sm font-semibold mb-1">اسم المكوّن:</label><input type="text" placeholder="مثال: أسمنت مقاوم" value={newComponent.component_name} onChange={(e) => setNewComponent({...newComponent, component_name: e.target.value})} className="w-full p-3 border rounded-lg text-right" /></div>
              <div className="grid grid-cols-3 gap-2">
                <div><label className="block text-sm font-semibold mb-1">الكمية:</label><input type="number" value={newComponent.quantity} onChange={(e) => setNewComponent({...newComponent, quantity: Number(e.target.value)})} className="w-full p-3 border rounded-lg text-center font-bold" step="0.01" /></div>
                <div><label className="block text-sm font-semibold mb-1">الوحدة:</label><select value={newComponent.unit} onChange={(e) => setNewComponent({...newComponent, unit: e.target.value})} className="w-full p-3 border rounded-lg text-center"><option value="كجم">كجم</option><option value="م³">م³</option><option value="م²">م²</option><option value="م.ط">م.ط</option><option value="عدد">عدد</option><option value="يوم">يوم</option><option value="لتر">لتر</option><option value="طن">طن</option></select></div>
                <div><label className="block text-sm font-semibold mb-1">السعر:</label><input type="number" value={newComponent.unit_rate} onChange={(e) => setNewComponent({...newComponent, unit_rate: Number(e.target.value)})} className="w-full p-3 border rounded-lg text-center font-bold" step="0.1" /></div>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={addComponent} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg font-bold">إضافة</button>
              <button onClick={() => setShowAddComponentModal(false)} className="flex-1 bg-gray-300 hover:bg-gray-400 py-3 rounded-lg font-bold">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: الاشتراك */}
      {showSubscriptionModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowSubscriptionModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8" onClick={(e) => e.stopPropagation()} dir="rtl">
            <div className="text-center">
              <div className="text-6xl mb-4">🔒</div>
              <h3 className="text-2xl font-bold mb-4 text-slate-800">هذه الميزة للمشتركين فقط</h3>
              <p className="text-gray-600 mb-6">اشترك الآن للاستفادة من:</p>
              <ul className="text-right space-y-2 mb-6 pr-4">
                <li className="flex items-center gap-2"><span className="text-green-500">✓</span> عرض تحليل التكلفة التفصيلي</li>
                <li className="flex items-center gap-2"><span className="text-green-500">✓</span> تعديل المكونات والأسعار</li>
                <li className="flex items-center gap-2"><span className="text-green-500">✓</span> إضافة مكونات مخصصة</li>
                <li className="flex items-center gap-2"><span className="text-green-500">✓</span> رفع مقايسة (عدة ملفات)</li>
                <li className="flex items-center gap-2"><span className="text-green-500">✓</span> تصدير Excel</li>
              </ul>
              <div className="bg-blue-50 rounded-lg p-4 mb-4"><div className="text-sm text-gray-600">السعر الشهري</div><div className="text-3xl font-bold text-blue-700">299 ج.م</div></div>
              <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold text-lg mb-2">💳 اشترك الآن (Paymob)</button>
              <button onClick={() => setShowSubscriptionModal(false)} className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 rounded-lg font-semibold">لاحقاً</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}