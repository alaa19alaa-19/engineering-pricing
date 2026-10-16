import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import { s, parseQty, matchRole, detectColumns, aiDetectColumns, type ColumnMap } from './boq-columns';

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

const pick = (rules: [RegExp, Disc][], text: string): Disc | null =>
  rules.find(([re]) => re.test(text))?.[1] ?? null;

const shortTitle = (d: string) => (d.includes(':') ? d.split(':')[0] : d).trim();
const CONCRETE_RE = /\b(rc|pc)\b|concrete|خرسانة/i;
const inferUnit = (title: string) => (CONCRETE_RE.test(title) ? 'm3' : '');

// عمق الكود: "6" = 1، "6.1" = 2، "6.1.1" = 3
const depthOf = (code: string) => Math.max(1, code.split('.').filter(Boolean).length);
const at = (row: any[], i: number) => (i >= 0 ? row[i] : null);

// ---------- قراءة شيت واحد ----------
export type ParsedItem = {
  row_no: number; item_code: string; description: string; unit: string | null;
  qty: number | null; discipline: Disc | null; status: string;
  error_reason: string | null; import_note: string | null;
};

function parseSheetRows(rows: any[][], sheetName: string, forcedDisc: string | null, h: ColumnMap) {
  const items: ParsedItem[] = [];
  const warnings: string[] = [];
  let sectionDisc: Disc | null = null;
  const parents: string[] = [];
  let headingNoCode = ''; // للشيتات اللي مفيهاش عمود كود
  let skipped = 0;

  for (let r = h.headerRow + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const code = s(at(row, h.code));
    const desc = s(at(row, h.desc));
    const unitRaw = s(at(row, h.unit));
    const qtyRaw = s(at(row, h.qty));

    if (/^(summary|ملخص)/i.test(code) || /^(summary|ملخص)/i.test(desc)) break;
    if (/^(total\b|sub-?total|إجمالي|اجمالي|المجموع)/i.test(code) ||
        /^(total\b|sub-?total|إجمالي|اجمالي|المجموع)/i.test(desc)) continue;
    if (!desc) continue;
    // تكرار صف العنوان (مثلا في بداية كل صفحة)
    if (matchRole(desc, 'desc') > 0 && desc.length < 25 && qtyRaw === '' && unitRaw === '') continue;

    const hasData = unitRaw !== '' || qtyRaw !== '';
    if (!hasData) {
      if (code) {
        const d = depthOf(code);
        if (d === 1 && desc.length < 80) {
          sectionDisc = pick(SECTION_RULES, desc);
          parents.length = 0;
        } else {
          parents[d - 1] = desc;
          parents.length = d;
        }
      } else if (h.code < 0 && desc.length < 120) {
        // شيت بدون كود: السطر بدون بيانات = عنوان قسم
        headingNoCode = desc;
        sectionDisc = pick(SECTION_RULES, desc) ?? sectionDisc;
      } else {
        skipped++;
      }
      continue;
    }

    const itemCode = code || `R${r + 1}`;
    const d = depthOf(code || '1');
    const chain = parents.slice(0, d - 1).filter(Boolean);
    if (!chain.length && headingNoCode) chain.push(headingNoCode);
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

    const qty = parseQty(at(row, h.qty));
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

// أول صفوف الشيت — تظهر في رسالة الخطأ عشان نعرف المشكلة بدون ما نفتح الملف
function previewRows(rows: any[][], n = 8) {
  return rows
    .map((r, i) => ({ i, cells: (r ?? []).map((c) => s(c).slice(0, 30)).filter(Boolean) }))
    .filter((x) => x.cells.length)
    .slice(0, n)
    .map((x) => `r${x.i + 1}: ${x.cells.slice(0, 8).join(' | ')}`)
    .join(' // ');
}

function safeJson(v: FormDataEntryValue | null): any {
  if (typeof v !== 'string' || !v) return null;
  try { return JSON.parse(v); } catch { return null; }
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
  const form = await req.formData();
  const file = form.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'file مطلوب' }, { status: 400 });

  const projectId = (form.get('project_id') as string) || null;
  const forcedDisc = (form.get('discipline') as string) || null;
  if (!projectId) return NextResponse.json({ error: 'project_id مطلوب' }, { status: 400 });

  // dry_run=1  → يرجع الأعمدة المكتشفة + عينة بنود بدون أي كتابة في قاعدة البيانات
  const dryRun = form.get('dry_run') === '1';
  // column_map = {"اسم الشيت" أو "*": {"headerRow":3,"code":0,"desc":1,"unit":2,"qty":3}}  (فهارس تبدأ من 0)
  const overrides = safeJson(form.get('column_map'));

  const supabase = dryRun ? null : sb();
  const wb = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: 'buffer' });
  const fileDisc = pick(FILE_RULES, file.name);

  const report: any[] = [];
  const warnings: string[] = [];
  const sheetIds: string[] = [];
  let aiBudget = 3; // أقصى عدد استدعاءات Claude لكل ملف

  for (const sheetName of wb.SheetNames) {
    const cleanName = sheetName.trim();
    const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
      header: 1, raw: true, defval: null,
    });

    // ---- تحديد الأعمدة: يدوي ← عناوين/محتوى ← Claude ----
    const ov = overrides?.[cleanName] ?? overrides?.['*'];
    let map: ColumnMap | null = null;
    if (ov && Number.isInteger(ov.desc) && Number.isInteger(ov.qty)) {
      map = {
        headerRow: Number.isInteger(ov.headerRow) ? ov.headerRow : 0,
        code: ov.code ?? -1, desc: ov.desc, unit: ov.unit ?? -1, qty: ov.qty,
        method: 'manual', confidence: 1, notes: [],
      };
    } else {
      map = detectColumns(rows);
      if (!map && aiBudget > 0 && rows.length > 3) {
        aiBudget--;
        map = await aiDetectColumns(rows);
      }
    }
    if (!map) {
      warnings.push(`[${cleanName}] لم أستطع تحديد أعمدة (الوصف/الكمية) - تم التخطي. أول الصفوف: ${previewRows(rows) || '(فارغ)'}`);
      continue;
    }

    const parsed = parseSheetRows(rows, cleanName, forcedDisc, map);
    if (parsed.items.length === 0) {
      warnings.push(`[${cleanName}] لا توجد بنود (وحدة/كمية) - تم التخطي. الأعمدة المكتشفة: ${JSON.stringify({ hdr: map.headerRow, code: map.code, desc: map.desc, unit: map.unit, qty: map.qty })}`);
      continue;
    }
    warnings.push(...parsed.warnings);
    if (map.confidence < 0.8) warnings.push(`[${cleanName}] ⚠ ${map.notes.join(' | ')} (ثقة ${Math.round(map.confidence * 100)}%)`);

    const sheetDisc = (forcedDisc as Disc) || pick(FILE_RULES, cleanName) || fileDisc || 'other';
    const columns = { method: map.method, confidence: map.confidence, header_row: map.headerRow + 1,
      code: map.code, desc: map.desc, unit: map.unit, qty: map.qty };

    if (dryRun || !supabase) {
      report.push({ sheet: cleanName, discipline: sheetDisc, items: parsed.items.length, columns,
        sample: parsed.items.slice(0, 5) });
      continue;
    }

    const { error: deleteError } = await supabase
      .from('boq_sheets').delete()
      .eq('file_name', file.name).eq('sheet_name', cleanName).eq('project_id', projectId);
    if (deleteError) {
      console.error('DELETE ERROR', JSON.stringify(deleteError));
      warnings.push(`[${cleanName}] فشل حذف الشيت القديم: ${deleteError.message}`);
      continue;
    }

    const { data: sheet, error: sErr } = await supabase
      .from('boq_sheets')
      .insert({ project_id: projectId, file_name: file.name, sheet_name: cleanName, discipline: sheetDisc })
      .select('id').single();
    if (sErr || !sheet) {
      console.error('SUPABASE ERROR', JSON.stringify(sErr));
      warnings.push(`[${cleanName}] ${sErr?.message}`);
      continue;
    }

    const payload = parsed.items.map((it) => ({ ...it, project_id: projectId, sheet_id: sheet.id }));

    let batchFailed = false;
    for (let i = 0; i < payload.length; i += 500) {
      const { error } = await supabase.from('boq_items').insert(payload.slice(i, i + 500));
      if (error) {
        console.error('SUPABASE ERROR', JSON.stringify(error));
        warnings.push(`[${cleanName}] خطأ إدخال: ${error.message}`);
        batchFailed = true;
        break;
      }
    }
    if (batchFailed) {
      await supabase.from('boq_sheets').delete().eq('id', sheet.id);
      continue;
    }

    sheetIds.push(sheet.id);
    report.push({ sheet: cleanName, discipline: sheetDisc, items: parsed.items.length,
      spec_rows_skipped: parsed.skipped, columns });
  }

  if (dryRun) return NextResponse.json({ dry_run: true, sheets: report, warnings });
  if (!sheetIds.length)
    return NextResponse.json({ error: 'لا شيتات صالحة', warnings }, { status: 422 });

  const prep = await supabase!.rpc('prepare_boq_items', { p_sheet_ids: sheetIds });
  if (prep.error)
    return NextResponse.json({ error: 'prepare: ' + prep.error.message, report }, { status: 500 });

  const match = await supabase!.rpc('match_boq_items', { p_sheet_ids: sheetIds });
  if (match.error)
    return NextResponse.json({ error: 'match: ' + match.error.message, report }, { status: 500 });

  const price = await supabase!.rpc('price_matched_items', { p_sheet_ids: sheetIds, p_answers: {} });
  if (price.error) warnings.push('price: ' + price.error.message);

  const { data: statusRows } = await supabase!
    .from('boq_items').select('status').in('sheet_id', sheetIds).limit(10000);
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
