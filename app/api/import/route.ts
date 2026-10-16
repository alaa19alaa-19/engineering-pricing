import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Disc =
  | 'architectural' | 'structural' | 'finishing' | 'electrical'
  | 'mechanical' | 'roads_sitework' | 'other';

// ---------- قواعد التصنيف ----------
const FILE_RULES: [RegExp, Disc][] = [
  [/struc|انشائي|إنشائي/i, 'structural'],
  [/arch|معمار/i, 'architectural'],
  [/finish|تشطيب/i, 'finishing'],
  [/elec|كهرب/i, 'electrical'],
  [/mech|hvac|plumb|صحي|تكييف/i, 'mechanical'],
  [/road|site|grad|طرق|موقع|تسوية|تسويه/i, 'roads_sitework'],
];

const SECTION_RULES: [RegExp, Disc][] = [
  [/earth|excavat|أعمال ترابية|اعمال ترابية|حفر|ردم/i, 'roads_sitework'],
  [/insulation|عزل/i, 'architectural'],
  [/concrete|steel|rebar|خرسانة|حديد/i, 'structural'],
  [/tile|tiling|tileing|porcel|ceramic|paint|gypsum|ceiling|flooring|بلاط|سيراميك|دهان/i, 'finishing'],
  [/block|plaster|alumin|glass|door|window|pergola|handrail|طوب|بياض|ألوميتال|الوميتال/i, 'architectural'],
];

// ---------- أدوات ----------
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const s = (v: any) =>
  v == null ? '' : String(v).replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d))).replace(/\s+/g, ' ').trim();
const pick = (rules: [RegExp, Disc][], text: string): Disc | null =>
  rules.find(([re]) => re.test(text))?.[1] ?? null;

function parseQty(v: any): number | null {
  if (typeof v === 'number') return isFinite(v) ? v : null;
  const t = s(v).replace(/,/g, '');
  return /^\d+(\.\d+)?$/.test(t) ? parseFloat(t) : null;
}

// يقبل QU / QTY / Quantity / Q'ty / الكمية ...
const QTY_RE = /^(qu|qty|qtty|qnty|q'ty|quantity|quant\.?|الكمية|كمية|الكميه|كميه)$/i;
const UNIT_RE = /^(unit|uom|units|الوحدة|وحدة|الوحده|وحده)$/i;
const DESC_RE = /description|desc\.?|الوصف|البيان|بيان/i;
const CODE_RE = /^(s|no\.?|item|item no\.?|code|م|البند|بند|كود|رقم)$/i;

function findHeader(rows: any[][]) {
  for (let r = 0; r < Math.min(rows.length, 40); r++) {
    const row = (rows[r] ?? []).map(s);
    const qty = row.findIndex((c) => QTY_RE.test(c));
    const unit = row.findIndex((c) => UNIT_RE.test(c));
    if (qty < 0 || unit < 0) continue;
    let desc = row.findIndex((c) => DESC_RE.test(c));
    if (desc < 0) desc = Math.min(qty, unit) - 1;
    let code = row.findIndex((c) => CODE_RE.test(c));
    if (code < 0 || code === desc) code = desc > 0 ? desc - 1 : 0;
    return { r, qty, unit, desc, code };
  }
  return null;
}

const shortTitle = (d: string) => (d.includes(':') ? d.split(':')[0] : d).trim();
const CONCRETE_RE = /\b(rc|pc)\b|concrete|خرسانة/i;

function inferUnit(title: string): string {
  return CONCRETE_RE.test(title) ? 'm3' : '';
}

// عمق الكود: "6" = 1، "6.1" = 2، "6.1.1" = 3
const depthOf = (code: string) => Math.max(1, code.split('.').filter(Boolean).length);

// ---------- قراءة شيت واحد ----------
export type ParsedItem = {
  row_no: number; item_code: string; description: string; unit: string | null;
  qty: number | null; discipline: Disc | null; status: string;
  error_reason: string | null; import_note: string | null;
};

function parseSheetRows(rows: any[][], sheetName: string, forcedDisc: string | null) {
  const h = findHeader(rows);
  if (!h) return null;

  const items: ParsedItem[] = [];
  const warnings: string[] = [];
  let sectionDisc: Disc | null = null;
  const parents: string[] = []; // وصف البنود الأب حسب العمق (1 = أعلى مستوى)
  let skipped = 0;

  for (let r = h.r + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const code = s(row[h.code]);
    const desc = s(row[h.desc]);
    const unitRaw = s(row[h.unit]);
    const qtyRaw = s(row[h.qty]);

    // نهاية البنود
    if (/^(summary|ملخص)/i.test(code) || /^(summary|ملخص)/i.test(desc)) break;
    // صفوف الإجماليات
    if (/^(total\b|sub-?total|إجمالي|اجمالي|المجموع)/i.test(code) ||
        /^(total\b|sub-?total|إجمالي|اجمالي|المجموع)/i.test(desc)) continue;
    if (!desc) continue;
    // تكرار صف العنوان
    if (DESC_RE.test(desc) && desc.length < 20 && qtyRaw === '' && unitRaw === '') continue;

    const hasData = unitRaw !== '' || qtyRaw !== '';
    if (!hasData) {
      if (code) {
        const d = depthOf(code);
        if (d === 1 && desc.length < 80) {
          // عنوان قسم قصير
          sectionDisc = pick(SECTION_RULES, desc);
          parents.length = 0;
        } else {
          // بند أب (1 أو 6.1 أو 8.1 ...) نحفظ وصفه ونمسح المستويات الأعمق
          parents[d - 1] = desc;
          parents.length = d;
        }
      } else {
        skipped++;
      }
      continue;
    }

    const itemCode = code || `R${r + 1}`;

    // دمج وصف كل الآباء (كل المستويات) مع وصف البند الفرعي
    const d = depthOf(code || '1');
    const chain = parents.slice(0, d - 1).filter(Boolean);
    const fullDesc = chain.length ? `${chain.join(' — ')} — ${desc}` : desc;

    const title = shortTitle(fullDesc);
    let unit = unitRaw;
    const notes: string[] = [];
    if (!unit) {
      const u = inferUnit(title);
      if (u) { unit = u; notes.push(`الوحدة فاضية - استُنتجت ${u}`); }
      else notes.push('الوحدة فاضية');
    }
    if (/^m2$|^م2$|^م²$/i.test(unit) && CONCRETE_RE.test(title))
      notes.push('تنبيه: بند خرسانة بوحدة م2 - غالبا م3');

    const qty = parseQty(row[h.qty]);
    if (qty == null) notes.push(`الكمية "${qtyRaw}" - بند اختياري/سعر فقط`);
    if (notes.length) warnings.push(`[${sheetName}] ${itemCode}: ${notes.join(' | ')}`);

    items.push({
      row_no: r + 1,
      item_code: itemCode,
      description: fullDesc,
      unit: unit || null,
      qty,
      discipline: forcedDisc ? null : sectionDisc,
      status: qty == null ? 'optional' : 'new',
      error_reason: qty == null ? 'OPTIONAL_NO_QTY' : null,
      import_note: notes.join(' | ') || null,
    });
  }
  return { items, warnings, skipped };
}

// ---- HTTP ----
function sb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Missing env: ' + (!url ? 'NEXT_PUBLIC_SUPABASE_URL ' : '') + (!key ? 'SUPABASE_SERVICE_ROLE_KEY' : '')
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
  try {
    return await handle(req);
  } catch (e: any) {
    console.error('IMPORT ERROR:', e);
    return NextResponse.json(
      { error: e?.message ?? String(e), stack: e?.stack?.split('\n').slice(0, 6) },
      { status: 500 }
    );
  }
}

async function handle(req: NextRequest) {
  const supabase = sb();
  const form = await req.formData();
  const file = form.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'file مطلوب' }, { status: 400 });

  const projectId = (form.get('project_id') as string) || null;
  const forcedDisc = (form.get('discipline') as string) || null;

  if (!projectId) {
    return NextResponse.json({ error: 'project_id مطلوب' }, { status: 400 });
  }

  const wb = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: 'buffer' });
  const fileDisc = pick(FILE_RULES, file.name);

  const report: any[] = [];
  const warnings: string[] = [];
  const sheetIds: string[] = [];

  for (const sheetName of wb.SheetNames) {
    const cleanName = sheetName.trim(); // المسافات الزيادة في آخر اسم الشيت
    const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
      header: 1,
      raw: true,
      defval: null,
    });

    const parsed = parseSheetRows(rows, cleanName, forcedDisc);
    if (!parsed) {
      warnings.push(`[${cleanName}] لم أجد صف العنوان (Description/Unit/Qty) - تم التخطي`);
      continue;
    }
    if (parsed.items.length === 0) {
      warnings.push(`[${cleanName}] لا توجد بنود (وحدة + كمية) - تم التخطي`);
      continue;
    }
    warnings.push(...parsed.warnings);

    const sheetDisc = (forcedDisc as Disc) || pick(FILE_RULES, cleanName) || fileDisc || 'other';

    // حذف الشيت القديم — مقيد بـ project_id
    const { error: deleteError } = await supabase
      .from('boq_sheets')
      .delete()
      .eq('file_name', file.name)
      .eq('sheet_name', cleanName)
      .eq('project_id', projectId);
    if (deleteError) {
      console.error('DELETE ERROR', JSON.stringify(deleteError));
      warnings.push(`[${cleanName}] فشل حذف الشيت القديم: ${deleteError.message}`);
      continue;
    }

    // إدخال الشيت الجديد مع project_id
    const { data: sheet, error: sErr } = await supabase
      .from('boq_sheets')
      .insert({
        project_id: projectId,
        file_name: file.name,
        sheet_name: cleanName,
        discipline: sheetDisc,
      })
      .select('id')
      .single();

    if (sErr || !sheet) {
      console.error('SUPABASE ERROR', JSON.stringify(sErr));
      warnings.push(`[${cleanName}] ${sErr?.message}`);
      continue;
    }

    // project_id + sheet_id في كل صف
    const payload = parsed.items.map((it) => ({
      ...it,
      project_id: projectId,
      sheet_id: sheet.id,
    }));

    // إدخال الدفعات — لو فشلت أي دفعة نمسح الشيت كله
    let batchFailed = false;
    for (let i = 0; i < payload.length; i += 500) {
      const { error } = await supabase
        .from('boq_items')
        .insert(payload.slice(i, i + 500));
      if (error) {
        console.error('SUPABASE ERROR', JSON.stringify(error));
        warnings.push(`[${cleanName}] خطأ إدخال: ${error.message}`);
        batchFailed = true;
        break;
      }
    }

    if (batchFailed) {
      // امسح الشيت اللي دخل جزئيًا (CASCADE هيمسح بنوده)
      await supabase.from('boq_sheets').delete().eq('id', sheet.id);
      continue;
    }

    sheetIds.push(sheet.id);

    report.push({
      sheet: cleanName,
      discipline: sheetDisc,
      items: parsed.items.length,
      spec_rows_skipped: parsed.skipped,
    });
  }

  if (!sheetIds.length)
    return NextResponse.json({ error: 'لا شيتات صالحة', warnings }, { status: 422 });

  const prep = await supabase.rpc('prepare_boq_items', { p_sheet_ids: sheetIds });
  if (prep.error)
    return NextResponse.json({ error: 'prepare: ' + prep.error.message, report }, { status: 500 });

  const match = await supabase.rpc('match_boq_items', { p_sheet_ids: sheetIds });
  if (match.error)
    return NextResponse.json({ error: 'match: ' + match.error.message, report }, { status: 500 });

  // تسعير البنود المطابقة تلقائيا
  const price = await supabase.rpc('price_matched_items', {
    p_sheet_ids: sheetIds,
    p_answers: {},
  });
  if (price.error) warnings.push('price: ' + price.error.message);

  // توزيع الحالات بعد التسعير
  const { data: statusRows } = await supabase
    .from('boq_items')
    .select('status')
    .in('sheet_id', sheetIds)
    .limit(10000);
  const counts: Record<string, number> = {};
  for (const r of statusRows ?? []) counts[r.status] = (counts[r.status] || 0) + 1;
  const dist = Object.entries(counts).map(([status, n]) => ({ status, n }));

  return NextResponse.json({
    sheets: report,
    total_items: report.reduce((a, x) => a + x.items, 0),
    status_distribution: dist,
    sheet_ids: sheetIds,
    warnings,
  });
}