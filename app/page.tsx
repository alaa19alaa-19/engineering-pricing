"use client";

import { useState, useEffect, useMemo } from "react";
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
  const [newProjectStage, setNewProjectStage] = useState("تسعير");
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
      if (divRes.data) { setDivisions(divRes.data); if (divRes.data.length > 0) setSelectedDivision(divRes.data[0].id); }
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
    const total = analysisComponents.reduce((sum, c) => sum + (c.quantity * c.unit_rate), 0);
    const final = total * markupFactor;
    setDirectCost(Math.ceil(total));
    setFinalPrice(Math.ceil(final));
  }, [analysisComponents, markupFactor]);

  // ============================================
  // Breakdown Functions
  // ============================================
  const openBreakdownQuestions = async (parsedItem: any) => {
    setBreakdownItem(parsedItem);
    setLoadingBreakdown(true);
    setBreakdownAnswers({});
    try {
      const { data: template } = await supabase
        .from("breakdown_templates")
        .select("*")
        .eq("item_code", parsedItem.item_code || "CO-003")
        .single();
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
      
      const { data: template } = await supabase
        .from("breakdown_templates")
        .select("id, item_code")
        .eq("item_code", itemCode)
        .single();

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

      // اختيار دالة الحساب حسب كود البند بدقة
      let rpcName = "calculate_breakdown_rc"; // الافتراضي
      if (itemCode.startsWith("1.")) rpcName = "calculate_breakdown_earthworks";
      else if (itemCode === "2.8") rpcName = "calculate_breakdown_steel";
      else if (itemCode.startsWith("3.")) rpcName = "calculate_breakdown_insulation";
      else if (itemCode === "CO-003") rpcName = "calculate_breakdown_co003";
      else if (itemCode.match(/^2\.[1-7]$/)) rpcName = "calculate_breakdown_rc";

      await supabase.rpc(rpcName, { p_answer_id: answerRow.id });

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

      setBreakdownResult({ ...pricing, answer_id: answerRow.id });
      setBreakdownComponents(components || []);
      setShowBreakdownQuestions(false);
      setShowBreakdownView(true);
    } catch (err: any) {
      alert("خطأ: " + err.message);
    }
    setLoadingBreakdown(false);
  };

  const recalculateBreakdownTotals = async () => {
    if (!breakdownResult?.answer_id) return;
    const { data: components } = await supabase
      .from("breakdown_components")
      .select("*")
      .eq("answer_id", breakdownResult.answer_id);
    if (!components) return;
    const direct = components.reduce((sum, c) => sum + Number(c.total_cost || 0), 0);
    const wastage = direct * 0.05;
    const subtotal = direct + wastage;
    const overhead = subtotal * 0.10;
    const risk = subtotal * 0.03;
    const profit = (subtotal + overhead + risk) * 0.15;
    const final = subtotal + overhead + risk + profit;
    await supabase
      .from("breakdown_pricing")
      .update({
        direct_cost: Math.round(direct), wastage_cost: Math.round(wastage),
        subtotal: Math.round(subtotal), overhead_cost: Math.round(overhead),
        risk_cost: Math.round(risk), profit_cost: Math.round(profit),
        final_price: Math.round(final),
      })
      .eq("answer_id", breakdownResult.answer_id);
    setBreakdownResult((prev: any) => ({
      ...prev, direct_cost: Math.round(direct), wastage_cost: Math.round(wastage),
      subtotal: Math.round(subtotal), overhead_cost: Math.round(overhead),
      risk_cost: Math.round(risk), profit_cost: Math.round(profit),
      final_price: Math.round(final),
    }));
  };

  const updateBreakdownComponent = async (componentId: number, newQty: number, newRate: number) => {
    const newTotal = newQty * newRate;
    await supabase.from("breakdown_components").update({ quantity: newQty, unit_rate: newRate, total_cost: newTotal, is_manual: true }).eq("id", componentId);
    setBreakdownComponents((prev) => prev.map((c) => c.id === componentId ? { ...c, quantity: newQty, unit_rate: newRate, total_cost: newTotal } : c));
    await recalculateBreakdownTotals();
  };

  const addBreakdownComponent = async () => {
    if (!breakdownResult?.answer_id) return;
    if (!newBreakdownComponent.component_name || !newBreakdownComponent.unit_rate) {
      alert("املأ اسم المكون والسعر"); return;
    }
    const newTotal = newBreakdownComponent.quantity * newBreakdownComponent.unit_rate;
    const { data, error } = await supabase
      .from("breakdown_components")
      .insert({
        answer_id: breakdownResult.answer_id,
        component_type: newBreakdownComponent.component_type,
        component_name: newBreakdownComponent.component_name,
        quantity: newBreakdownComponent.quantity,
        unit: newBreakdownComponent.unit,
        unit_rate: newBreakdownComponent.unit_rate,
        total_cost: newTotal, source: "manual", is_manual: true,
      })
      .select().single();
    if (error) { alert("خطأ: " + error.message); return; }
    if (data) {
      setBreakdownComponents([...breakdownComponents, data]);
      setNewBreakdownComponent({ component_type: "خامات", component_name: "", quantity: 1, unit: "كجم", unit_rate: 0 });
      setShowAddBreakdownComponentModal(false);
      await recalculateBreakdownTotals();
    }
  };

  const removeBreakdownComponent = async (componentId: number) => {
    if (!confirm("هل تريد حذف هذا المكون؟")) return;
    const { error } = await supabase.from("breakdown_components").delete().eq("id", componentId);
    if (error) { alert("خطأ: " + error.message); return; }
    setBreakdownComponents((prev) => prev.filter((c) => c.id !== componentId));
    await recalculateBreakdownTotals();
  };

  const approveBreakdown = async () => {
    if (!breakdownResult || !breakdownItem) return;

    try {
      const itemCode = breakdownItem.item_code || "CO-003";

      const payload = {
        user_name: userName,
        item_code: itemCode,
        item_description: breakdownItem.item_description?.substring(0, 500) || "",
        unit: breakdownItem.unit,
        quantity: breakdownItem.quantity || 0,
        source_file: breakdownItem.source_file || "",
        source_sheet: breakdownItem.source_sheet || "",
        direct_cost: breakdownResult.direct_cost || 0,
        wastage_cost: breakdownResult.wastage_cost || 0,
        overhead_cost: breakdownResult.overhead_cost || 0,
        risk_cost: breakdownResult.risk_cost || 0,
        profit_cost: breakdownResult.profit_cost || 0,
        final_price: breakdownResult.final_price || 0,
        components: breakdownComponents || [],
        pricing: breakdownResult || {},
      };

      const { data: existing } = await supabase
        .from("breakdown_results")
        .select("id")
        .eq("user_name", userName)
        .eq("item_code", itemCode)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("breakdown_results")
          .update(payload)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("breakdown_results")
          .insert(payload);
        if (error) throw error;
      }

      await supabase.from("parsed_boq_items").update({ status: "matched" }).eq("id", breakdownItem.id);
      alert(`✅ ${existing ? "تم تحديث" : "تم حفظ"} Breakdown بسعر ${breakdownResult.final_price.toLocaleString("ar-EG")} ج.م/${breakdownItem.unit}`);
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
    if (parsedItems.length === 0) { alert("لا توجد بنود لاعتمادها"); return; }
    try {
      const rows = parsedItems.map((item) => ({
        project_id: null, user_name: userName,
        source_file: item.source_file, source_sheet: item.source_sheet,
        item_code: item.item_code, item_description: item.item_description,
        unit: item.unit, quantity: item.quantity, status: "pending",
      }));
      await supabase.from("parsed_boq_items").insert(rows);
      alert(`✅ تم حفظ ${parsedItems.length} بند.`);
      setShowBOQUploader(false);
      setParsedItems([]);
      setUploadProgress("");
    } catch (err: any) {
      alert("خطأ في الحفظ: " + err.message);
    }
  };

  const loadParsedItems = async () => {
    setLoadingParsedItems(true);

    const { data, error } = await supabase
      .from("parsed_boq_items")
      .select("*")
      .eq("user_name", userName)
      .order("source_file", { ascending: true })
      .order("id", { ascending: true });
    if (data) setSavedParsedItems(data);
    if (error) console.error("Error loading parsed items:", error);

    const { data: bdData } = await supabase
      .from("breakdown_results")
      .select("*")
      .eq("user_name", userName);

    if (bdData) {
      const map: Record<string, any> = {};
      bdData.forEach((bd: any) => {
        const key = `${bd.item_code}__${bd.source_sheet}`;
        map[key] = bd;
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

  const exportToExcel = () => {
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
    csv += "\n\nملخص المقايسة\n";
    csv += "الكود,التقسيم,الإجمالي\n";
    divisions.forEach((div) => {
      const total = getDivisionTotal(div.id);
      if (total > 0) csv += `"${div.code}","${div.name_ar}",${Math.ceil(total)}\n`;
    });
    csv += `,"الإجمالي الكلي",${Math.ceil(grandTotal)}\n`;
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
      setNewProjectType("سكني"); setNewProjectStage("تسعير"); setNewProjectDescription("");
      setNewProjectFile(null); setShowProjectsModal(false); loadProjects();
    }
  };

  const openProject = (project: SavedProject) => {
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

  const openViewBreakdown = (bd: any) => {
    setViewingBreakdown(bd);
    setShowViewBreakdownModal(true);
  };

  const deleteViewingBreakdown = async () => {
    if (!viewingBreakdown) return;
    if (!confirm("هل تريد حذف هذا التحليل؟")) return;
    const { error } = await supabase.from("breakdown_results").delete().eq("id", viewingBreakdown.id);
    if (error) { alert("خطأ: " + error.message); return; }
    setParsedBreakdowns((prev) => {
      const updated = { ...prev };
      const key = `${viewingBreakdown.item_code}__${viewingBreakdown.source_sheet}`;
      delete updated[key];
      return updated;
    });
    setShowViewBreakdownModal(false);
    setViewingBreakdown(null);
    alert("✅ تم حذف التحليل");
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

  // ============================================
  // MAIN APP
  // ============================================
  return (
    <div className="min-h-screen bg-slate-50 font-sans" dir="rtl">
      <header className="bg-slate-900 text-white p-4 flex justify-between items-center sticky top-0 z-30 shadow-lg no-print">
        <div>
          <h1 className="text-xl font-bold text-blue-400">منصة التسعير والتحليل الهندسي</h1>
          <p className="text-xs text-gray-400">
            مرحباً {userName}
            {isSubscribed ? <span className="mr-2 bg-green-500 text-white px-2 py-0.5 rounded-full text-xs">✓ مشترك</span> : <span className="mr-2 bg-yellow-500 text-white px-2 py-0.5 rounded-full text-xs">مجاني</span>}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setShowBOQUploader(true)} className="bg-cyan-600 hover:bg-cyan-700 px-3 py-2 rounded-lg text-xs font-semibold">📤 رفع مقايسة</button>
          <button onClick={loadParsedItems} className="bg-teal-600 hover:bg-teal-700 px-3 py-2 rounded-lg text-xs font-semibold">📋 البنود المستخرجة</button>
          <button onClick={() => setShowSearchModal(true)} className="bg-pink-600 hover:bg-pink-700 px-3 py-2 rounded-lg text-xs font-semibold">🔍 بحث المكونات</button>
          <button onClick={loadProjects} className="bg-purple-600 hover:bg-purple-700 px-3 py-2 rounded-lg text-xs font-semibold">📁 مشاريعي</button>
          <button onClick={loadBreakdownResults} className="bg-orange-600 hover:bg-orange-700 px-3 py-2 rounded-lg text-xs font-semibold">📊 Breakdowns</button>
          <button onClick={() => { if (!isSubscribed) { setShowSubscriptionModal(true); return; } setShowCustomItemModal(true); }} className="bg-indigo-600 hover:bg-indigo-700 px-3 py-2 rounded-lg text-xs font-semibold">➕ بند خاص</button>
          <button onClick={() => { if (!isSubscribed) { setShowSubscriptionModal(true); return; } exportToExcel(); }} className="bg-green-600 hover:bg-green-700 px-3 py-2 rounded-lg text-xs font-semibold">📤 Excel</button>
          <button onClick={printBOQ} className="bg-yellow-600 hover:bg-yellow-700 px-3 py-2 rounded-lg text-xs font-semibold">🖨️ طباعة</button>
          <button onClick={clearProject} className="bg-red-600 hover:bg-red-700 px-3 py-2 rounded-lg text-xs font-semibold">🗑️ حذف</button>
          <button onClick={logout} className="bg-gray-600 hover:bg-gray-700 px-3 py-2 rounded-lg text-xs font-semibold">🚪 خروج</button>
        </div>
      </header>

      <div className="flex">
        <aside className="w-64 bg-white border-l border-gray-200 min-h-[calc(100vh-72px)] sticky top-[72px] max-h-[calc(100vh-72px)] overflow-y-auto no-print">
          <div className="p-4 border-b bg-slate-100">
            <h3 className="font-bold text-slate-700 text-sm">📁 التقسيمات ({divisions.length})</h3>
          </div>
          <nav>
            {divisions.map((div) => (
              <button key={div.id} onClick={() => { setSelectedDivision(div.id); setSelectedSection(null); }} className={`w-full text-right p-2.5 border-b hover:bg-blue-50 transition flex items-center gap-2 text-xs ${selectedDivision === div.id ? "bg-blue-50 border-r-4 border-r-blue-500 font-bold text-blue-700" : ""}`}>
                <span className="font-mono bg-slate-200 px-1.5 py-0.5 rounded text-xs">{div.code}</span>
                <span className="flex-1">{div.name_ar}</span>
                {getDivisionItemCount(div.id) > 0 && (<span className="bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full">{getDivisionItemCount(div.id)}</span>)}
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1 p-6">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-4 no-print">
            <div className="flex gap-2">
              <input type="text" placeholder="🔍 ابحث عن بند..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="flex-1 p-3 border-2 border-gray-200 rounded-lg text-right focus:ring-2 focus:ring-blue-500 outline-none" />
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

          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">📋 جدول البنود ({filteredItems.length} بند)</h2>
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

          {customItems.length > 0 && (
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-xl shadow-sm border-2 border-indigo-200 mb-4">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-bold text-indigo-700">⭐ البنود الخاصة ({customItems.length})</h2>
                  <p className="text-xs text-gray-600 mt-1">
                    {customItemsWithQuantity.length > 0 ? `${customItemsWithQuantity.length} بند مُدخل بكميات | الإجمالي: ${Math.ceil(customItemsTotal).toLocaleString("ar-EG")} ج.م` : "لم يتم إدخال كميات بعد"}
                  </p>
                </div>
                <button onClick={() => setShowCustomItemsModal(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg font-bold text-sm">📂 عرض البنود الخاصة</button>
              </div>
            </div>
          )}

          {hasAnyItems && (
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <h2 className="text-lg font-bold mb-4">📊 ملخص المقايسة:</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-800 text-white">
                    <tr>
                      <th className="p-2 text-right">الكود</th>
                      <th className="p-2 text-right">التقسيم</th>
                      <th className="p-2 text-center">البنود</th>
                      <th className="p-2 text-center">الإجمالي (ج.م)</th>
                      <th className="p-2 text-center">النسبة %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {divisions.filter((div) => getDivisionTotal(div.id) > 0).map((div, idx) => {
                      const total = getDivisionTotal(div.id);
                      const pct = grandTotal > 0 ? (total / grandTotal) * 100 : 0;
                      return (
                        <tr key={div.id} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                          <td className="p-2 text-right font-mono text-xs">{div.code}</td>
                          <td className="p-2 text-right font-semibold">{div.name_ar}</td>
                          <td className="p-2 text-center">{getDivisionItemCount(div.id)}</td>
                          <td className="p-2 text-center font-bold text-blue-800">{Math.ceil(total).toLocaleString("ar-EG")}</td>
                          <td className="p-2 text-center font-bold text-gray-600">{pct.toFixed(1)}%</td>
                        </tr>
                      );
                    })}
                    {customItemsTotal > 0 && (
                      <tr className="bg-indigo-50">
                        <td className="p-2 text-right font-mono text-xs">00</td>
                        <td className="p-2 text-right font-semibold">بنود خاصة</td>
                        <td className="p-2 text-center">{customItemsWithQuantity.length}</td>
                        <td className="p-2 text-center font-bold text-indigo-800">{Math.ceil(customItemsTotal).toLocaleString("ar-EG")}</td>
                        <td className="p-2 text-center font-bold text-indigo-600">{grandTotal > 0 ? ((customItemsTotal / grandTotal) * 100).toFixed(1) : 0}%</td>
                      </tr>
                    )}
                    <tr className="bg-blue-600 text-white font-bold text-lg">
                      <td colSpan={3} className="p-3 text-right">الإجمالي الكلي:</td>
                      <td className="p-3 text-center">{Math.ceil(grandTotal).toLocaleString("ar-EG")} ج.م</td>
                      <td className="p-3 text-center">100%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!hasAnyItems && (
            <div className="bg-white p-12 rounded-xl shadow-sm border border-gray-100 text-center">
              <div className="text-6xl mb-4">📋</div>
              <h2 className="text-xl font-bold text-slate-700 mb-2">لا توجد بنود في المقايسة</h2>
              <p className="text-gray-500 mb-6">ابدأ بإحدى الطرق التالية:</p>
              <div className="flex flex-wrap gap-3 justify-center">
                <button onClick={() => setShowBOQUploader(true)} className="bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-3 rounded-lg font-bold">📤 رفع مقايسة (Excel)</button>
                <button onClick={() => setShowParsedItemsModal(true)} className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-lg font-bold">📋 البنود المستخرجة</button>
                <button onClick={() => { if (divisions.length > 0) { setSelectedDivision(divisions[0].id); const firstSection = sections.find(s => s.division_id === divisions[0].id); if (firstSection) setSelectedSection(firstSection.id); } }} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold">📂 تصفح البنود الجاهزة</button>
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
                  <div><label className="block text-xs font-semibold mb-1">مرحلة المشروع</label><select value={newProjectStage} onChange={(e) => setNewProjectStage(e.target.value)} className="w-full p-2 border rounded text-right"><option value="تسعير">تسعير</option><option value="تنفيذ">تنفيذ</option><option value="إنجاز">إنجاز</option><option value="متوقف">متوقف</option></select></div>
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
              <div><h3 className="text-xl font-bold">📋 البنود المستخرجة</h3><p className="text-sm text-teal-200 mt-1">إجمالي {savedParsedItems.length} بند من {uniqueFiles.length} ملف</p></div>
              <div className="flex gap-2 flex-wrap items-center">
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
                              const bdKey = `${item.item_code}__${item.source_sheet}`;
                              const bd = parsedBreakdowns[bdKey];
                              const price = bd?.final_price;
                              const total = bd?.final_price && bd?.quantity ? bd.final_price * bd.quantity : null;
                              return (
                                <tr key={item.id} className={item.status === "matched" ? "bg-green-50" : item.status === "no_match" ? "bg-red-50" : (idx % 2 === 0 ? "bg-white" : "bg-slate-50")}>
                                  <td className="p-2 text-right text-gray-500">{item.source_sheet}</td>
                                  <td className="p-2 text-right font-mono">{item.item_code}</td>
                                  <td className="p-2 text-right">{item.item_description.substring(0, 80)}</td>
                                  <td className="p-2 text-center">{item.unit}</td>
                                  <td className="p-2 text-center font-bold">{item.quantity}</td>
                                  <td className="p-2 text-center font-bold text-green-700">{price ? Math.round(price).toLocaleString("ar-EG") : "—"}</td>
                                  <td className="p-2 text-center font-bold text-blue-800">{total ? Math.round(total).toLocaleString("ar-EG") : "—"}</td>
                                  <td className="p-2 text-center">
                                    <div className="flex gap-1 justify-center">
                                      {bd ? (
                                        <button onClick={() => openViewBreakdown(bd)} className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs" title="عرض التحليل المحفوظ">👁️</button>
                                      ) : (
                                        <button onClick={() => openBreakdownQuestions(item)} className="bg-purple-600 hover:bg-purple-700 text-white px-2 py-1 rounded text-xs" title="Breakdown تفصيلي">🧮</button>
                                      )}
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
              <div><h3 className="text-xl font-bold">👁️ مراجعة التحليل — {viewingBreakdown.item_code}</h3><p className="text-sm text-blue-200 mt-1">{viewingBreakdown.item_description?.substring(0, 100)}</p></div>
              <button onClick={() => { setShowViewBreakdownModal(false); setViewingBreakdown(null); }} className="text-3xl text-blue-200 hover:text-white">×</button>
            </div>
            <div className="p-6">
              <div className="bg-yellow-50 p-4 rounded-lg mb-6 border-2 border-yellow-200">
                <h4 className="font-bold mb-2 text-yellow-900">📦 بيانات البند:</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                  <div><span className="text-gray-600">الوحدة: </span><span className="font-bold">{viewingBreakdown.unit}</span></div>
                  <div><span className="text-gray-600">الكمية: </span><span className="font-bold">{viewingBreakdown.quantity}</span></div>
                  <div><span className="text-gray-600">سعر الوحدة: </span><span className="font-bold text-green-700">{Math.round(viewingBreakdown.final_price).toLocaleString("ar-EG")} ج.م</span></div>
                  <div><span className="text-gray-600">الإجمالي: </span><span className="font-bold text-blue-800">{Math.round(viewingBreakdown.final_price * viewingBreakdown.quantity).toLocaleString("ar-EG")} ج.م</span></div>
                </div>
              </div>

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

              <h4 className="font-bold text-lg mb-3">💰 التسعير:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                <div className="bg-blue-50 p-3 rounded-lg flex justify-between items-center border border-blue-200"><span className="text-sm font-bold">التكلفة المباشرة:</span><span className="text-lg font-bold text-blue-800">{Math.round(viewingBreakdown.direct_cost || 0).toLocaleString("ar-EG")} ج.م</span></div>
                <div className="bg-yellow-50 p-3 rounded-lg flex justify-between items-center border border-yellow-200"><span className="text-sm font-bold">الهالك:</span><span className="text-lg font-bold text-yellow-800">{Math.round(viewingBreakdown.wastage_cost || 0).toLocaleString("ar-EG")} ج.م</span></div>
                <div className="bg-purple-50 p-3 rounded-lg flex justify-between items-center border border-purple-200"><span className="text-sm font-bold">غير مباشرة:</span><span className="text-lg font-bold text-purple-800">{Math.round(viewingBreakdown.overhead_cost || 0).toLocaleString("ar-EG")} ج.م</span></div>
                <div className="bg-red-50 p-3 rounded-lg flex justify-between items-center border border-red-200"><span className="text-sm font-bold">مخاطر:</span><span className="text-lg font-bold text-red-800">{Math.round(viewingBreakdown.risk_cost || 0).toLocaleString("ar-EG")} ج.م</span></div>
                <div className="bg-green-50 p-3 rounded-lg flex justify-between items-center border border-green-200"><span className="text-sm font-bold">ربح:</span><span className="text-lg font-bold text-green-800">{Math.round(viewingBreakdown.profit_cost || 0).toLocaleString("ar-EG")} ج.م</span></div>
                <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-3 rounded-lg flex justify-between items-center"><span className="text-sm font-bold">السعر النهائي:</span><span className="text-lg font-bold">{Math.round(viewingBreakdown.final_price || 0).toLocaleString("ar-EG")} ج.م/{viewingBreakdown.unit}</span></div>
              </div>

              <div className="flex gap-3 pt-4 border-t-2">
                <button onClick={deleteViewingBreakdown} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-bold">🗑️ حذف التحليل</button>
                <button onClick={() => { setShowViewBreakdownModal(false); setViewingBreakdown(null); }} className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-3 rounded-lg font-bold">إغلاق</button>
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
                  {["بيانات البند", "ظروف التنفيذ", "المخاطر والمحاذير", "الهالك والفاقد", "المصنعيات والمعدات", "المصاريف والربح"].map((section) => {
                    const sectionQs = breakdownQuestions.filter(q => q.section === section);
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
                <button onClick={() => { setShowBreakdownView(false); setBreakdownItem(null); setBreakdownResult(null); setBreakdownComponents([]); }} className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-3 rounded-lg font-bold">❌ إلغاء</button>
                <button onClick={approveBreakdown} className="flex-[2] bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white py-3 rounded-lg font-bold text-lg">✅ اعتماد وحفظ Breakdown</button>
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