import * as XLSX from "xlsx";

export type BoqItem = {
  id?: string | number;              // 🆕
  item_code: string;
  description: string;
  unit: string;
  quantity: number;
  area_per_unit?: number | null;     // 🆕
  rate?: number;
  total?: number;
  section?: string;
  sheet?: string;
};

export async function parseBoqFile(file: File): Promise<BoqItem[]> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: "array" });

  const allItems: BoqItem[] = [];

  for (const sheetName of workbook.SheetNames) {
    console.log(`\n📄 ===== معالجة الشيت: ${sheetName} =====`);

    const sheet = workbook.Sheets[sheetName];
    const raw: any[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      raw: false,
      blankrows: false,
    });

    if (raw.length < 3) {
      console.log(`⏭️ تخطي الشيت (فارغ)`);
      continue;
    }

    const items = parseSheet(raw, sheetName);
    allItems.push(...items);
  }

  if (allItems.length === 0) {
    throw new Error("❌ لم يتم العثور على بنود BOQ صالحة في أي شيت");
  }

  console.log(`\n✅ إجمالي البنود المستخرجة: ${allItems.length}`);
  console.log("📋 أول 5 بنود:", allItems.slice(0, 5));

  return allItems;
}

// ============================================
// 🎯 parser لشيت واحد
// ============================================
function parseSheet(raw: any[][], sheetName: string): BoqItem[] {
  const items: BoqItem[] = [];

  const headerRowIndex = findHeaderRow(raw);
  if (headerRowIndex === -1) {
    console.log(`⚠️ لم يتم العثور على header في ${sheetName}`);
    return [];
  }

  const headerRow = raw[headerRowIndex];
  console.log(`🎯 header (${headerRowIndex}):`, headerRow);

  const cols = detectColumns(headerRow, raw, headerRowIndex);
  console.log(`🎯 الأعمدة:`, cols);

  if (cols.code === -1 || cols.desc === -1) {
    console.log(`⚠️ أعمدة أساسية مفقودة (code=${cols.code}, desc=${cols.desc})`);
    return [];
  }

  let currentSection = "";
  let parentDesc = "";   // 🆕 وصف البند الأب (للمحلي)

  for (let i = headerRowIndex + 1; i < raw.length; i++) {
    const row = raw[i];
    if (!row || row.length === 0) continue;

    const codeRaw = String(row[cols.code] ?? "").trim();
    const descRaw = String(row[cols.desc] ?? "").trim();

    // 🔍 كشف عنوان القسم
    if (
      codeRaw &&
      /^\d+$/.test(codeRaw) &&
      descRaw &&
      descRaw.length > 3 &&
      descRaw.length < 80 &&
      !String(row[cols.qty] ?? "").trim()
    ) {
      currentSection = descRaw;
      parentDesc = "";   // 🆕
      console.log(`  📁 قسم: "${currentSection}"`);
      continue;
    }

    // 🆕 بند أب: كود رقمي بدون نقطة + وصف طويل + مفيش كمية
    if (
      codeRaw &&
      /^\d+$/.test(codeRaw) &&
      descRaw.length >= 80 &&
      !String(row[cols.qty] ?? "").trim()
    ) {
      parentDesc = descRaw;
      continue;
    }

    // 🔍 كشف البند الحقيقي (كود فيه نقطة عشرية: 1.1, 2.1...)
    const isRealItem = /^\d+\.\d+/.test(codeRaw);
    if (!isRealItem) continue;

    const lowerDesc = descRaw.toLowerCase();
    if (
      lowerDesc.includes("total") ||
      lowerDesc.includes("إجمالي") ||
      lowerDesc.includes("اجمالي")
    ) {
      continue;
    }

    const unit = String(row[cols.unit] ?? "").trim();
    const qtyRaw = String(row[cols.qty] ?? "").trim();
    const rateRaw = String(row[cols.rate] ?? "").trim();
    const totalRaw = String(row[cols.total] ?? "").trim();

    const quantity = parseNumber(qtyRaw);
    const rate = rateRaw ? parseNumber(rateRaw) : undefined;
    const total = totalRaw ? parseNumber(totalRaw) : undefined;

    // 🆕 دمج وصف الأب
    const description = parentDesc
      ? `${parentDesc} — ${descRaw}`
      : descRaw;

    items.push({
      item_code: codeRaw,
      description,
      unit,
      quantity,
      rate,
      total,
      section: currentSection,
      sheet: sheetName,
    });
  }

  console.log(`  ✅ ${items.length} بند في ${sheetName}`);
  return items;
}

// ============================================
// 🔍 اكتشاف صف الـ header
// ============================================
function findHeaderRow(raw: any[][]): number {
  const keywords = ["description", "unit", "qty", "quantity", "price", "total"];

  for (let i = 0; i < Math.min(10, raw.length); i++) {
    const row = raw[i];
    if (!row) continue;

    const matches = row.filter((c) => {
      const text = String(c ?? "").toLowerCase().trim();
      return keywords.some((k) => text === k || text.includes(k));
    }).length;

    if (matches >= 3) return i;
  }

  return -1;
}

// ============================================
// 🎯 اكتشاف فهارس الأعمدة
// ============================================
function detectColumns(
  headerRow: any[],
  raw: any[][],
  headerRowIndex: number
): {
  code: number;
  desc: number;
  unit: number;
  qty: number;
  rate: number;
  total: number;
} {
  const headers = headerRow.map((h) => String(h ?? "").toLowerCase().trim());

  const find = (candidates: string[]): number => {
    for (const c of candidates) {
      const idx = headers.findIndex((h) => h === c);
      if (idx !== -1) return idx;
    }
    for (const c of candidates) {
      const idx = headers.findIndex((h) => h.includes(c));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const result = {
    code: find(["s", "item no", "code", "no", "serial", "رقم", "كود", "بند"]),
    desc: find(["description", "desc", "item description", "بيان", "وصف"]),
    unit: find(["unit", "uom", "الوحدة", "وحدة"]),
    qty: find(["qty", "quantity", "الكمية", "كمية"]),
    rate: find(["unit price", "rate", "price", "السعر", "سعر", "فئة"]),
    total: find(["total price", "total", "amount", "الإجمالي", "إجمالي"]),
  };

  if (result.desc === -1) {
    console.log("  🆘 عمود الوصف مفقود — جاري البحث التلقائي...");

    if (result.code !== -1) {
      for (let i = result.code + 1; i < headers.length; i++) {
        if (
          i !== result.unit &&
          i !== result.qty &&
          i !== result.rate &&
          i !== result.total
        ) {
          const sampleValues = raw
            .slice(headerRowIndex + 1, headerRowIndex + 20)
            .map((r) => String(r[i] ?? "").trim())
            .filter((v) => v.length > 0);

          const textCount = sampleValues.filter(
            (v) => isNaN(Number(v)) && v.length > 3
          ).length;

          if (textCount >= 2) {
            result.desc = i;
            console.log(`  ✅ عمود الوصف اتحدد تلقائيًا: فهرس ${i}`);
            break;
          }
        }
      }
    }

    if (result.desc === -1) {
      let bestCol = -1;
      let bestAvgLen = 0;

      const maxCol = Math.max(...raw.slice(0, 20).map((r) => r?.length || 0));

      for (let i = 0; i < maxCol; i++) {
        if (
          i === result.code ||
          i === result.unit ||
          i === result.qty ||
          i === result.rate ||
          i === result.total
        ) {
          continue;
        }

        const values = raw
          .slice(headerRowIndex + 1, headerRowIndex + 30)
          .map((r) => String(r[i] ?? "").trim())
          .filter((v) => v.length > 0 && isNaN(Number(v)));

        if (values.length < 3) continue;

        const avgLen =
          values.reduce((s, v) => s + v.length, 0) / values.length;

        if (avgLen > bestAvgLen && avgLen > 10) {
          bestAvgLen = avgLen;
          bestCol = i;
        }
      }

      if (bestCol !== -1) {
        result.desc = bestCol;
        console.log(`  ✅ عمود الوصف (بحث متقدم): فهرس ${bestCol}`);
      }
    }
  }

  return result;
}

// ============================================
// 🔢 تحويل نص لرقم
// ============================================
function parseNumber(val: string): number {
  if (!val) return 0;
  const cleaned = val.replace(/,/g, "").replace(/\s/g, "").trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}