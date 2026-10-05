"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabase";

type Division = { id: number; code: string; name_ar: string; display_order: number; };
type Section = { id: number; division_id: number; code: string; name_ar: string; };
type Item = { id: number; section_id: number; code: string; name_ar: string; name_en: string; unit: string; rate: number; };
type ItemComponent = { id: number; item_id: number; component_type: string; name_ar: string; name_en: string; unit: string; rate: number; display_order: number; };
type UserItem = { item_id: number; quantity: number; custom_rate: number; };
type SavedProject = { id: number; project_name: string; project_data: any; total_amount: number; created_at: string; user_name?: string; };
type CustomItem = { id?: number; code: string; name_ar: string; unit: string; rate: number; division_code: string; section_code?: string; };
type SearchResult = { item: Item; matched_component: string; component_rate: number; };

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
  const [allComponents, setAllComponents] = useState<ItemComponent[]>([]);
  
  const [selectedDivision, setSelectedDivision] = useState<number | null>(null);
  const [selectedSection, setSelectedSection] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [componentSearch, setComponentSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [userItems, setUserItems] = useState<Record<number, UserItem>>({});

  const [showAnalysis, setShowAnalysis] = useState(false);
  const [analysisItem, setAnalysisItem] = useState<Item | null>(null);
  const [components, setComponents] = useState<ItemComponent[]>([]);

  const [showCustomItemModal, setShowCustomItemModal] = useState(false);
  const [showProjectsModal, setShowProjectsModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [newProjectName, setNewProjectName] = useState("");
  const [customItem, setCustomItem] = useState<CustomItem>({
    code: "", name_ar: "", unit: "m³", rate: 0, division_code: "", section_code: "",
  });

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
      const [divRes, secRes, itmRes, custRes, compRes] = await Promise.all([
        supabase.from("divisions").select("*").order("code"),
        supabase.from("sections").select("*").order("code"),
        supabase.from("items").select("*").order("code"),
        supabase.from("custom_items").select("*").order("created_at", { ascending: false }),
        supabase.from("item_components").select("*"),
      ]);
      if (divRes.data) { setDivisions(divRes.data); if (divRes.data.length > 0) setSelectedDivision(divRes.data[0].id); }
      if (secRes.data) setSections(secRes.data);
      if (itmRes.data) setAllItems(itmRes.data);
      if (custRes.data) setCustomItems(custRes.data);
      if (compRes.data) setAllComponents(compRes.data);
      setLoading(false);
    };
    fetchAll();
  }, [userName]);

  useEffect(() => {
    const fetchComponents = async () => {
      if (!analysisItem) return;
      const { data } = await supabase.from("item_components").select("*").eq("item_id", analysisItem.id).order("display_order");
      if (data) setComponents(data);
    };
    fetchComponents();
  }, [analysisItem]);

  useEffect(() => {
    const saved = localStorage.getItem("userItems");
    if (saved) { try { setUserItems(JSON.parse(saved)); } catch (e) {} }
  }, []);

  useEffect(() => {
    if (Object.keys(userItems).length > 0) localStorage.setItem("userItems", JSON.stringify(userItems));
  }, [userItems]);

  const searchComponents = () => {
    if (!componentSearch.trim()) return;
    const q = componentSearch.toLowerCase();
    const matchedComponents = allComponents.filter((c) =>
      c.name_ar?.toLowerCase().includes(q) || c.name_en?.toLowerCase().includes(q)
    );
    const results: SearchResult[] = [];
    const seenItems = new Set<number>();
    matchedComponents.forEach((c) => {
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
    const originalRate = item?.rate || 0;
    setUserItems((prev) => ({
      ...prev,
      [itemId]: { item_id: itemId, quantity: quantity || 0, custom_rate: prev[itemId]?.custom_rate ?? originalRate },
    }));
  };

  const updateRate = (itemId: number, rate: number) => {
    setUserItems((prev) => ({
      ...prev,
      [itemId]: { item_id: itemId, quantity: prev[itemId]?.quantity || 0, custom_rate: rate || 0 },
    }));
  };

  const filteredItems = useMemo(() => {
    let result = allItems;
    if (selectedSection) {
      result = result.filter((i) => i.section_id === selectedSection);
    } else if (selectedDivision) {
      const divSections = sections.filter((s) => s.division_id === selectedDivision).map((s) => s.id);
      result = result.filter((i) => divSections.includes(i.section_id));
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (i) => i.name_ar?.toLowerCase().includes(q) || i.name_en?.toLowerCase().includes(q) || i.code?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [allItems, selectedSection, selectedDivision, sections, searchQuery]);

  const filteredSections = useMemo(() => {
    if (!selectedDivision) return [];
    return sections.filter((s) => s.division_id === selectedDivision);
  }, [sections, selectedDivision]);

  const getItemTotal = (itemId: number) => {
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

  const getDivisionItemCount = (divisionId: number) => {
    const divisionSections = sections.filter((s) => s.division_id === divisionId).map((s) => s.id);
    const divisionItems = allItems.filter((i) => divisionSections.includes(i.section_id));
    return divisionItems.filter((i) => userItems[i.id] && userItems[i.id].quantity > 0).length;
  };

  const clearProject = () => {
    if (confirm("هل أنت متأكد من حذف كل الكميات؟")) {
      setUserItems({}); localStorage.removeItem("userItems");
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
        csv += `"${item.code || ""}","${item.name_ar || item.name_en || ""}","${item.unit}",${ui.quantity},${ui.custom_rate},${ui.quantity * ui.custom_rate}\n`;
      }
    });
    csv += "\n\nملخص المقايسة\n";
    csv += "الكود,التقسيم,الإجمالي\n";
    divisions.forEach((div) => {
      const total = getDivisionTotal(div.id);
      if (total > 0) csv += `"${div.code}","${div.name_ar}",${total}\n`;
    });
    csv += `,"الإجمالي الكلي",${projectTotal}\n`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `BOQ_${newProjectName || "project"}_${new Date().toLocaleDateString("ar-EG").replace(/\//g, "-")}.csv`;
    link.click();
  };

  const printBOQ = () => window.print();

  const saveProject = async () => {
    if (!newProjectName.trim()) { alert("اكتب اسم المشروع أولاً"); return; }
    const { data, error } = await supabase.from("user_projects").insert({
      project_name: newProjectName,
      project_data: userItems,
      total_amount: projectTotal,
      user_name: userName,
    }).select();
    if (error) { alert("حدث خطأ: " + error.message); return; }
    if (data) { alert("تم حفظ المشروع بنجاح!"); setNewProjectName(""); setShowProjectsModal(false); }
  };

  const loadProjects = async () => {
    const { data } = await supabase.from("user_projects").select("*").eq("user_name", userName).order("created_at", { ascending: false });
    if (data) setSavedProjects(data);
    setShowProjectsModal(true);
  };

  const openProject = (project: SavedProject) => {
    setUserItems(project.project_data || {});
    localStorage.setItem("userItems", JSON.stringify(project.project_data || {}));
    setNewProjectName(project.project_name);
    setShowProjectsModal(false);
    alert(`تم تحميل المشروع: ${project.project_name}`);
  };

  const deleteProject = async (id: number) => {
    if (!confirm("هل أنت متأكد؟")) return;
    await supabase.from("user_projects").delete().eq("id", id);
    setSavedProjects(savedProjects.filter((p) => p.id !== id));
  };

  const addCustomItem = async () => {
    if (!customItem.name_ar || !customItem.rate) { alert("املأ اسم البند والسعر"); return; }
    const { data, error } = await supabase.from("custom_items").insert({
      code: customItem.code || "CUSTOM",
      name_ar: customItem.name_ar,
      unit: customItem.unit,
      rate: customItem.rate,
      division_code: customItem.division_code,
      section_code: customItem.section_code,
    }).select();
    if (error) { alert("حدث خطأ: " + error.message); return; }
    if (data) {
      alert("تم إضافة البند بنجاح!");
      setCustomItems([data[0], ...customItems]);
      setShowCustomItemModal(false);
      setCustomItem({ code: "", name_ar: "", unit: "m³", rate: 0, division_code: "", section_code: "" });
    }
  };

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
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="مثال: م. أحمد محمد"
              className="w-full p-3 border-2 border-gray-200 rounded-lg text-right focus:ring-2 focus:ring-blue-500 outline-none"
              autoFocus
            />
          </div>
          <button onClick={handleLogin} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold text-lg">
            دخول
          </button>
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
          <button onClick={() => setShowSearchModal(true)} className="bg-pink-600 hover:bg-pink-700 px-3 py-2 rounded-lg text-xs font-semibold">🔍 بحث المكونات</button>
          <button onClick={loadProjects} className="bg-purple-600 hover:bg-purple-700 px-3 py-2 rounded-lg text-xs font-semibold">📁 مشاريعي</button>
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
              <button
                key={div.id}
                onClick={() => { setSelectedDivision(div.id); setSelectedSection(null); }}
                className={`w-full text-right p-2.5 border-b hover:bg-blue-50 transition flex items-center gap-2 text-xs ${
                  selectedDivision === div.id ? "bg-blue-50 border-r-4 border-r-blue-500 font-bold text-blue-700" : ""
                }`}
              >
                <span className="font-mono bg-slate-200 px-1.5 py-0.5 rounded text-xs">{div.code}</span>
                <span className="flex-1">{div.name_ar}</span>
                {getDivisionItemCount(div.id) > 0 && (
                  <span className="bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full">{getDivisionItemCount(div.id)}</span>
                )}
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
              <div className="text-sm text-gray-500">إجمالي القسم: <span className="font-bold text-blue-700 text-lg">{sectionTotal.toLocaleString("ar-EG")} ج.م</span></div>
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
                    const ui = userItems[item.id] || { quantity: 0, custom_rate: item.rate };
                    return (
                      <tr key={item.id} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                        <td className="p-2 text-right font-mono text-xs">{item.code}</td>
                        <td className="p-2 text-right font-semibold text-xs">{item.name_ar || item.name_en}</td>
                        <td className="p-2 text-center text-xs">{item.unit}</td>
                        <td className="p-2 text-center">
                          <input type="number" value={ui.quantity} onChange={(e) => updateQuantity(item.id, Number(e.target.value))} className="w-20 p-1.5 border rounded text-center font-bold text-xs" min="0" />
                        </td>
                        <td className="p-2 text-center">
                          <input type="number" value={ui.custom_rate} onChange={(e) => updateRate(item.id, Number(e.target.value))} className="w-24 p-1.5 border rounded text-center font-bold text-xs" min="0" />
                        </td>
                        <td className="p-2 text-center font-bold text-blue-800 text-sm">{getItemTotal(item.id).toLocaleString("ar-EG")}</td>
                        <td className="p-2 text-center">
                          <button onClick={() => { if (!isSubscribed) { setShowSubscriptionModal(true); return; } setAnalysisItem(item); setShowAnalysis(true); }} className="text-blue-600 hover:text-blue-800 text-lg">📊</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {customItems.length > 0 && (
            <div className="bg-white p-4 rounded-xl shadow-sm border-2 border-indigo-200 mb-4">
              <h2 className="text-lg font-bold mb-3 text-indigo-700">⭐ البنود الخاصة ({customItems.length})</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-indigo-800 text-white">
                    <tr>
                      <th className="p-2 text-right">الكود</th>
                      <th className="p-2 text-right">البند</th>
                      <th className="p-2 text-center">الوحدة</th>
                      <th className="p-2 text-center">الكمية</th>
                      <th className="p-2 text-center">السعر</th>
                      <th className="p-2 text-center">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customItems.map((item: any, idx: number) => {
                      const ui = userItems[item.id] || { quantity: 0, custom_rate: item.rate };
                      return (
                        <tr key={item.id} className={idx % 2 === 0 ? "bg-white" : "bg-indigo-50"}>
                          <td className="p-2 text-right font-mono text-xs">{item.code}</td>
                          <td className="p-2 text-right font-semibold text-xs">{item.name_ar}</td>
                          <td className="p-2 text-center text-xs">{item.unit}</td>
                          <td className="p-2 text-center">
                            <input type="number" value={ui.quantity} onChange={(e) => updateQuantity(item.id, Number(e.target.value))} className="w-20 p-1.5 border rounded text-center font-bold text-xs" />
                          </td>
                          <td className="p-2 text-center">
                            <input type="number" value={ui.custom_rate} onChange={(e) => updateRate(item.id, Number(e.target.value))} className="w-24 p-1.5 border rounded text-center font-bold text-xs" />
                          </td>
                          <td className="p-2 text-center font-bold text-indigo-800 text-sm">{(ui.quantity * ui.custom_rate).toLocaleString("ar-EG")}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

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
                    const pct = projectTotal > 0 ? (total / projectTotal) * 100 : 0;
                    return (
                      <tr key={div.id} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                        <td className="p-2 text-right font-mono text-xs">{div.code}</td>
                        <td className="p-2 text-right font-semibold">{div.name_ar}</td>
                        <td className="p-2 text-center">{getDivisionItemCount(div.id)}</td>
                        <td className="p-2 text-center font-bold text-blue-800">{total.toLocaleString("ar-EG")}</td>
                        <td className="p-2 text-center font-bold text-gray-600">{pct.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                  {projectTotal === 0 && <tr><td colSpan={5} className="p-4 text-center text-gray-500">لم يتم إدخال أي كميات بعد</td></tr>}
                  <tr className="bg-blue-600 text-white font-bold text-lg">
                    <td colSpan={3} className="p-3 text-right">الإجمالي الكلي:</td>
                    <td className="p-3 text-center">{projectTotal.toLocaleString("ar-EG")} ج.م</td>
                    <td className="p-3 text-center">100%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
            {/* Modal التحليل */}
      {showAnalysis && analysisItem && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowAnalysis(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} dir="rtl">
            <div className="bg-slate-900 text-white p-6 rounded-t-2xl flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-blue-400">تحليل تكلفة البند</h3>
                <p className="text-sm text-gray-300 mt-1">{analysisItem.name_ar || analysisItem.name_en}</p>
              </div>
              <button onClick={() => setShowAnalysis(false)} className="text-3xl text-gray-400 hover:text-white">×</button>
            </div>
            <div className="bg-blue-50 p-4 border-b flex justify-between">
              <div className="text-sm"><span className="text-gray-600">الكود: </span><span className="font-bold">{analysisItem.code}</span></div>
              <div className="text-sm"><span className="text-gray-600">الوحدة: </span><span className="font-bold">{analysisItem.unit}</span></div>
              <div className="text-sm"><span className="text-gray-600">السعر: </span><span className="font-bold text-blue-800">{analysisItem.rate.toLocaleString("ar-EG")} ج.م</span></div>
            </div>
            <div className="p-6">
              {components.length > 0 ? (
                <table className="w-full text-sm border rounded-lg overflow-hidden">
                  <thead className="bg-slate-800 text-white">
                    <tr><th className="p-3 text-right">#</th><th className="p-3 text-right">المكوّن</th><th className="p-3 text-center">النوع</th><th className="p-3 text-center">الوحدة</th><th className="p-3 text-center">السعر</th><th className="p-3 text-center">النسبة</th></tr>
                  </thead>
                  <tbody>
                    {components.map((comp, idx) => {
                      const total = components.reduce((s, c) => s + c.rate, 0);
                      const pct = total > 0 ? (comp.rate / total) * 100 : 0;
                      return (
                        <tr key={comp.id} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                          <td className="p-3 text-right font-mono text-xs">{idx + 1}</td>
                          <td className="p-3 text-right font-semibold">{comp.name_ar || comp.name_en}</td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-1 rounded-full text-xs ${comp.component_type === "material" ? "bg-blue-100 text-blue-800" : comp.component_type === "labor" ? "bg-green-100 text-green-800" : comp.component_type === "waste" ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-800"}`}>
                              {comp.component_type === "material" ? "خامات" : comp.component_type === "labor" ? "مصنعيات" : comp.component_type === "waste" ? "هالك" : "أخرى"}
                            </span>
                          </td>
                          <td className="p-3 text-center">{comp.unit}</td>
                          <td className="p-3 text-center font-bold">{comp.rate.toLocaleString("ar-EG")}</td>
                          <td className="p-3 text-center font-bold text-blue-700">{pct.toFixed(1)}%</td>
                        </tr>
                      );
                    })}
                    <tr className="bg-blue-600 text-white font-bold">
                      <td colSpan={4} className="p-3 text-right text-lg">الإجمالي:</td>
                      <td className="p-3 text-center text-lg">{components.reduce((s, c) => s + c.rate, 0).toLocaleString("ar-EG")}</td>
                      <td className="p-3 text-center">100%</td>
                    </tr>
                  </tbody>
                </table>
              ) : <div className="text-center text-gray-500 py-10">لا يوجد تحليل مسجل</div>}
            </div>
          </div>
        </div>
      )}

      {/* Modal البحث في المكونات */}
      {showSearchModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowSearchModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} dir="rtl">
            <h3 className="text-xl font-bold mb-4 text-pink-700">🔍 نتائج البحث في المكونات</h3>
            {searchResults.length === 0 ? (
              <div className="text-center text-gray-500 py-10">لا توجد نتائج. جرب البحث في المكونات (حديد، خرسانة، عمالة...)</div>
            ) : (
              <div className="space-y-2">
                {searchResults.map((r, idx) => (
                  <div key={idx} className="bg-pink-50 border-r-4 border-pink-500 p-3 rounded">
                    <div className="font-bold text-sm">{r.item.name_ar || r.item.name_en}</div>
                    <div className="text-xs text-gray-600 mt-1">المكوّن: <span className="font-semibold text-pink-700">{r.matched_component}</span> - السعر: <span className="font-bold">{r.component_rate}</span></div>
                    <div className="text-xs text-gray-500 mt-1">الكود: {r.item.code} | الوحدة: {r.item.unit} | السعر: {r.item.rate.toLocaleString("ar-EG")} ج.م</div>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setShowSearchModal(false)} className="w-full mt-4 bg-gray-300 hover:bg-gray-400 py-2 rounded font-bold">إغلاق</button>
          </div>
        </div>
      )}

      {/* Modal إضافة بند خاص */}
      {showCustomItemModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowCustomItemModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()} dir="rtl">
            <h3 className="text-xl font-bold mb-4 text-indigo-700">➕ إضافة بند خاص</h3>
            <div className="space-y-3">
              <input type="text" placeholder="كود البند" value={customItem.code} onChange={(e) => setCustomItem({...customItem, code: e.target.value})} className="w-full p-3 border rounded text-right" />
              <input type="text" placeholder="اسم البند *" value={customItem.name_ar} onChange={(e) => setCustomItem({...customItem, name_ar: e.target.value})} className="w-full p-3 border rounded text-right" />
              <select value={customItem.unit} onChange={(e) => setCustomItem({...customItem, unit: e.target.value})} className="w-full p-3 border rounded text-right">
                <option value="m³">m³</option><option value="m²">m²</option><option value="m">m</option>
                <option value="No.">No.</option><option value="kg">kg</option><option value="Ton">Ton</option>
                <option value="LS">LS</option>
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

      {/* Modal مشاريعي */}
      {showProjectsModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowProjectsModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} dir="rtl">
            <h3 className="text-xl font-bold mb-4 text-purple-700">📁 مشاريعي المحفوظة</h3>
            <div className="bg-purple-50 p-4 rounded-lg mb-4">
              <h4 className="font-bold mb-2 text-sm">حفظ المشروع الحالي باسم:</h4>
              <div className="flex gap-2">
                <input type="text" placeholder="اسم المشروع" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} className="flex-1 p-2 border rounded text-right" />
                <button onClick={() => { if (!isSubscribed) { setShowSubscriptionModal(true); return; } saveProject(); }} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded font-bold">💾 حفظ</button>
              </div>
            </div>
            {savedProjects.length === 0 ? (
              <div className="text-center text-gray-500 py-10">لا يوجد مشاريع محفوظة</div>
            ) : (
              <div className="space-y-2">
                {savedProjects.map((proj) => (
                  <div key={proj.id} className="bg-white border rounded-lg p-3 flex justify-between items-center">
                    <div>
                      <div className="font-bold">{proj.project_name}</div>
                      <div className="text-xs text-gray-500">{proj.total_amount.toLocaleString("ar-EG")} ج.م - {new Date(proj.created_at).toLocaleDateString("ar-EG")}</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => openProject(proj)} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm">فتح</button>
                      <button onClick={() => deleteProject(proj.id)} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm">حذف</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setShowProjectsModal(false)} className="w-full mt-4 bg-gray-300 hover:bg-gray-400 py-2 rounded font-bold">إغلاق</button>
          </div>
        </div>
      )}

      {/* Modal الاشتراك */}
      {showSubscriptionModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowSubscriptionModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8" onClick={(e) => e.stopPropagation()} dir="rtl">
            <div className="text-center">
              <div className="text-6xl mb-4">🔒</div>
              <h3 className="text-2xl font-bold mb-4 text-slate-800">هذه الميزة للمشتركين فقط</h3>
              <p className="text-gray-600 mb-6">اشترك الآن للاستفادة من:</p>
              <ul className="text-right space-y-2 mb-6 pr-4">
                <li className="flex items-center gap-2"><span className="text-green-500">✓</span> عرض تحليل التكلفة التفصيلي</li>
                <li className="flex items-center gap-2"><span className="text-green-500">✓</span> تصدير Excel</li>
                <li className="flex items-center gap-2"><span className="text-green-500">✓</span> حفظ مشاريع غير محدودة</li>
                <li className="flex items-center gap-2"><span className="text-green-500">✓</span> إضافة بنود خاصة</li>
                <li className="flex items-center gap-2"><span className="text-green-500">✓</span> دعم فني</li>
              </ul>
              <div className="bg-blue-50 rounded-lg p-4 mb-4">
                <div className="text-sm text-gray-600">السعر الشهري</div>
                <div className="text-3xl font-bold text-blue-700">299 ج.م</div>
              </div>
              <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold text-lg mb-2">
                💳 اشترك الآن (Paymob)
              </button>
              <button onClick={() => setShowSubscriptionModal(false)} className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 rounded-lg font-semibold">
                لاحقاً
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}