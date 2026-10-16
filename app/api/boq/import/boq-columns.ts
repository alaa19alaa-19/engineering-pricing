// boq-columns.ts  — اكتشاف أعمدة الـ BOQ بشكل مرن (ضعه بجانب route.ts)
//
// الطبقات بالترتيب:
//  1) عناوين الأعمدة: تطبيع عربي/إنجليزي + مرادفات + مطابقة جزئية + عنوان على صفين
//  2) استنتاج الأعمدة الناقصة من محتوى البيانات (أرقام / وحدات / نص طويل)
//  3) شيت بدون عناوين نهائيا: استنتاج كامل من المحتوى
//  4) (اختياري) Claude API لو ANTHROPIC_API_KEY موجود
//  5) يدوي: المستخدم يمرر column_map من الواجهة

export type Role = 'code' | 'desc' | 'unit' | 'qty';
export type ColumnMap = {
  headerRow: number; // فهرس صف العنوان (-1 = لا يوجد، يبدأ القراءة من أول صف)
  code: number; desc: number; unit: number; qty: number; // -1 = غير موجود
  method: 'header' | 'header+content' | 'content' | 'ai' | 'manual';
  confidence: number; // 0..1
  notes: string[];
};

// ---------- أدوات ----------
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
export const s = (v: any) =>
  v == null ? '' : String(v).replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d))).replace(/\s+/g, ' ').trim();

export function parseQty(v: any): number | null {
  if (typeof v === 'number') return isFinite(v) ? v : null;
  const t = s(v).replace(/,/g, '');
  return /^\d+(\.\d+)?$/.test(t) ? parseFloat(t) : null;
}

// تطبيع: حروف صغيرة، حذف التشكيل، توحيد الهمزات والياء والتاء المربوطة، حذف الرموز
export function norm(v: any): string {
  return s(v).toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ').trim();
}

// ---------- المرادفات (أضف هنا أي كلمة جديدة تقابلها) ----------
const set = (a: string[]) => new Set(a.map(norm));
const SYN: Record<Role | 'ambig', Set<string>> = {
  qty: set([
    'qty', 'qu', 'qtty', 'qnty', 'qnt', "q'ty", 'quantity', 'quantities', 'quant', 'qty.',
    'الكمية', 'كمية', 'الكميات', 'كميات', 'العدد', 'عدد',
  ]),
  unit: set([
    'unit', 'units', 'uom', 'u/m', 'um', 'unit of measure', 'unit of measurement', 'measure',
    'الوحدة', 'وحدة', 'الوحدات', 'وحدات', 'وحدة القياس',
  ]),
  desc: set([
    'description', 'desc', 'item description', 'work description', 'description of work',
    'description of works', 'particulars', 'scope', 'scope of work', 'details', 'work item',
    'الوصف', 'وصف', 'البيان', 'بيان', 'وصف البند', 'وصف العمل', 'بيان الاعمال', 'بنود الاعمال',
    'بند الاعمال', 'الاعمال', 'اعمال', 'تفاصيل', 'تفاصيل البند', 'اسم البند', 'نوع العمل', 'المواصفات',
  ]),
  code: set([
    'no', 'item no', 'item number', 'ref', 'ref no', 'code', 'item code', 'sl', 'sl no', 's no', 's',
    'sr', 'sr no', 'serial', 'serial no', 'bill no', 'boq no', 'n', '#',
    'م', 'مسلسل', 'رقم', 'رقم البند', 'كود', 'كود البند', 'تسلسل', 'التسلسل', 'ر م',
  ]),
  // كلمات ممكن تكون كود أو وصف حسب باقي الأعمدة
  ambig: set(['item', 'items', 'work', 'البند', 'بند']),
};

// أعمدة الأسعار نتجاهلها (Unit Price ≠ Unit)
const PRICE_RE = /(^| )(price|prices|rate|rates|amount|cost|سعر|السعر|اسعار|الاسعار|فئه|الفئه|قيمه|القيمه|مبلغ|المبلغ|ثمن|الثمن)( |$)/;

export function matchRole(cell: any, role: Role | 'ambig'): number {
  if (role === 'code' && s(cell) === '#') return 3;
  const n = norm(cell);
  if (!n || n.length > 60) return 0;
  if (role !== 'code' && PRICE_RE.test(n)) return 0;
  const list = SYN[role];
  if (list.has(n)) return 3;
  for (const syn of list) {
    if (syn.length >= 3 && (' ' + n + ' ').includes(' ' + syn + ' ')) return 2;
  }
  return 0;
}

// ---------- 1) من صف العنوان ----------
const ORDER = ['qty', 'unit', 'desc', 'code', 'ambig'];

function assignRoles(cells: any[]) {
  const cand: { c: number; role: Role | 'ambig'; sc: number }[] = [];
  cells.forEach((cell, c) => {
    for (const role of ['qty', 'unit', 'desc', 'code', 'ambig'] as const) {
      const sc = matchRole(cell, role);
      if (sc) cand.push({ c, role, sc });
    }
  });
  cand.sort((a, b) => b.sc - a.sc || ORDER.indexOf(a.role) - ORDER.indexOf(b.role) || a.c - b.c);

  const a: Partial<Record<Role, number>> = {};
  const used = new Set<number>();
  for (const x of cand) {
    if (x.role === 'ambig' || a[x.role] != null || used.has(x.c)) continue;
    a[x.role] = x.c; used.add(x.c);
  }
  for (const x of cand.filter((x) => x.role === 'ambig')) {
    if (used.has(x.c)) continue;
    if (a.desc == null) { a.desc = x.c; used.add(x.c); }
    else if (a.code == null) { a.code = x.c; used.add(x.c); }
  }
  const core = (['qty', 'unit', 'desc'] as Role[]).filter((k) => a[k] != null).length;
  if (core < 2) return null;
  return { a, core, score: core * 3 + (a.code != null ? 1 : 0) };
}

// ---------- 2) من محتوى البيانات ----------
const UNIT_WORDS = set([
  'm', 'm1', 'm2', 'm3', 'm²', 'm³', 'lm', 'rm', 'sqm', 'cum', 'cbm', 'sq m', 'cu m', 'l m', 'r m',
  'kg', 'ton', 'tons', 't', 'no', 'nr', 'nos', 'number', 'each', 'ea', 'pcs', 'pc', 'set', 'sets',
  'ls', 'l s', 'lump sum', 'lumpsum', 'item', 'ltr', 'l', 'point', 'pt', 'job', 'trip', 'day', 'month',
  'م', 'م2', 'م3', 'م²', 'م³', 'م ط', 'م.ط', 'متر', 'متر مربع', 'متر مكعب', 'متر طولي', 'طن', 'كجم', 'كيلو',
  'عدد', 'قطعة', 'قطعه', 'مقطوعية', 'مقطوعيه', 'لتر', 'نقطة', 'نقطه', 'طقم', 'رحلة', 'يوم', 'شهر', 'بند',
]);
const isUnitLike = (t: string) => {
  const n = norm(t);
  return n.length > 0 && n.length <= 14 && (UNIT_WORDS.has(n) || /^(m|م)\s?[123²³]?$/.test(n));
};

type Prof = { n: number; num: number; text: number; unit: number; len: number; vals: number[] };

function profileCols(rows: any[][], start: number, ncols: number): Prof[] {
  const out: Prof[] = Array.from({ length: ncols }, () => ({ n: 0, num: 0, text: 0, unit: 0, len: 0, vals: [] }));
  for (let r = Math.max(0, start); r < Math.min(rows.length, start + 120); r++) {
    const row = rows[r] ?? [];
    for (let c = 0; c < ncols; c++) {
      const t = s(row[c]);
      if (!t) continue;
      const o = out[c];
      o.n++;
      const num = parseQty(row[c]);
      if (num != null) { o.num++; o.vals.push(num); }
      else { o.text++; o.len += t.length; if (isUnitLike(t)) o.unit++; }
    }
  }
  return out;
}

// عمود أرقام متسلسلة 1,2,3.. = كود وليس كمية
function isSequential(p: Prof) {
  if (p.vals.length < 4) return false;
  let ok = 0;
  for (let i = 1; i < p.vals.length; i++) if (p.vals[i] - p.vals[i - 1] === 1) ok++;
  return ok / (p.vals.length - 1) >= 0.7;
}

function inferMissing(rows: any[][], a: Partial<Record<Role, number>>, start: number, ncols: number) {
  const P = profileCols(rows, start, ncols);
  const used = () => new Set(Object.values(a).filter((v): v is number => v != null));

  if (a.unit == null) {
    let best = -1, bestR = 0;
    P.forEach((p, c) => {
      if (used().has(c) || p.unit < 2 || !p.text) return;
      const ratio = p.unit / p.text;
      if (ratio >= 0.4 && ratio > bestR) { best = c; bestR = ratio; }
    });
    if (best >= 0) a.unit = best;
  }
  if (a.qty == null) {
    const cands = P.map((p, c) => ({ p, c }))
      .filter(({ p, c }) => !used().has(c) && p.n >= 3 && p.num / p.n >= 0.5 && !isSequential(p));
    if (cands.length) {
      const ref = a.unit ?? a.desc;
      cands.sort((x, y) => ref != null
        ? Math.abs(x.c - ref) - Math.abs(y.c - ref)
        : x.c - y.c);
      a.qty = cands[0].c;
    }
  }
  if (a.desc == null) {
    let best = -1, bestLen = 8;
    P.forEach((p, c) => {
      if (used().has(c) || !p.text || p.text / p.n < 0.5) return;
      const avg = p.len / p.text;
      if (avg > bestLen) { best = c; bestLen = avg; }
    });
    if (best >= 0) a.desc = best;
  }
  if (a.code == null && a.desc != null && a.desc > 0 && !used().has(a.desc - 1) && P[a.desc - 1]?.n >= 3) {
    a.code = a.desc - 1;
  }
}

// ---------- 3) شيت بدون عناوين ----------
function headerless(rows: any[][], ncols: number): ColumnMap | null {
  let start = -1;
  for (let r = 0; r < Math.min(rows.length, 100); r++) {
    const row = rows[r] ?? [];
    const hasUnit = row.some((c) => isUnitLike(s(c)) && parseQty(c) == null);
    const hasLong = row.some((c) => parseQty(c) == null && s(c).length >= 10);
    const hasNum = row.some((c) => parseQty(c) != null);
    if (hasUnit && hasLong && hasNum) { start = r; break; }
  }
  if (start < 0) return null;
  const a: Partial<Record<Role, number>> = {};
  inferMissing(rows, a, start, ncols);
  if (a.desc == null || a.qty == null) return null;
  return {
    headerRow: -1, code: a.code ?? -1, desc: a.desc, unit: a.unit ?? -1, qty: a.qty,
    method: 'content', confidence: 0.55,
    notes: ['لا يوجد صف عناوين — تم استنتاج الأعمدة من محتوى البيانات، راجع النتيجة'],
  };
}

// ---------- الدالة الرئيسية ----------
export function detectColumns(rows: any[][]): ColumnMap | null {
  const ncols = Math.max(0, ...rows.slice(0, 120).map((r) => r?.length ?? 0));
  let best: { a: Partial<Record<Role, number>>; core: number; score: number; idx: number } | null = null;

  for (let r = 0; r < Math.min(rows.length, 100); r++) {
    const row = rows[r] ?? [];
    const variants: { cells: any[]; idx: number }[] = [{ cells: row, idx: r }];
    if (r + 1 < rows.length) {
      // عنوان على صفين (مثلا: Description | Unit  فوق  Qty  تحتها)
      const nx = rows[r + 1] ?? [];
      const merged = Array.from({ length: Math.max(row.length, nx.length) }, (_, c) =>
        [s(row[c]), s(nx[c])].filter(Boolean).join(' '));
      variants.push({ cells: merged, idx: r + 1 });
    }
    for (const v of variants) {
      const res = assignRoles(v.cells);
      if (res && (!best || res.score > best.score)) best = { ...res, idx: v.idx };
    }
  }

  if (!best) return headerless(rows, ncols);

  const a = { ...best.a };
  const notes: string[] = [];
  let method: ColumnMap['method'] = 'header';
  const missing = (['qty', 'unit', 'desc'] as Role[]).filter((k) => a[k] == null);
  if (missing.length) {
    inferMissing(rows, a, best.idx + 1, ncols);
    method = 'header+content';
    const still = missing.filter((k) => a[k] == null);
    notes.push(`أعمدة استُنتجت من المحتوى: ${missing.filter((k) => a[k] != null).join(', ') || 'لا شيء'}`);
    if (still.includes('unit') && !still.includes('qty') && !still.includes('desc'))
      notes.push('لا يوجد عمود وحدة');
  }
  if (a.desc == null || a.qty == null) return headerless(rows, ncols);

  // فحص منطقي: عمود الكمية لازم فيه أرقام
  const P = profileCols(rows, best.idx + 1, ncols);
  const q = P[a.qty];
  let confidence = best.core === 3 ? 0.95 : 0.75;
  if (q && q.n >= 3 && q.num / q.n < 0.2) {
    confidence = 0.5;
    notes.push('عمود الكمية المكتشف لا يحتوي أرقام غالبا — راجع الأعمدة');
  }

  return {
    headerRow: best.idx, code: a.code ?? -1, desc: a.desc, unit: a.unit ?? -1, qty: a.qty,
    method, confidence, notes,
  };
}

// ---------- 4) Claude API كخطة بديلة (اختياري) ----------
export async function aiDetectColumns(rows: any[][]): Promise<ColumnMap | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const sample = rows.slice(0, 40)
    .map((r, i) => i + '\t' + (r ?? []).map((c) => s(c).slice(0, 50)).join('\t'))
    .join('\n');
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content:
            'Below are the first rows of a construction Bill of Quantities sheet (Arabic and/or English). ' +
            'Each line = row index, then tab-separated cells (column index starts at 0 after the row index).\n' +
            'Return ONLY JSON: {"header_row":n,"code":n,"desc":n,"unit":n,"qty":n} using -1 when a column does not exist ' +
            '(header_row=-1 if no header row). "qty" is the quantity column, NOT price/total. ' +
            'If this is not a BOQ items sheet return {"not_boq":true}.\n\n' + sample,
        }],
      }),
      signal: AbortSignal.timeout(20000),
    });
    const data = await res.json();
    const txt = (data.content ?? []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
    const j = JSON.parse(txt.replace(/```json|```/g, '').trim());
    if (j.not_boq) return null;
    const ok = (v: any) => Number.isInteger(v) && v >= -1 && v < 60;
    if (![j.header_row, j.code, j.desc, j.unit, j.qty].every(ok) || j.desc < 0 || j.qty < 0) return null;
    return {
      headerRow: j.header_row, code: j.code, desc: j.desc, unit: j.unit, qty: j.qty,
      method: 'ai', confidence: 0.7, notes: ['الأعمدة اكتشفها Claude — راجع النتيجة'],
    };
  } catch {
    return null;
  }
}
