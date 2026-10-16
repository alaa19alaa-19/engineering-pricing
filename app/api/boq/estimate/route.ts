// app/api/boq/estimate/route.ts
// تسعير تقديري لأي بند مالوش قالب/سعر — مع علامة "تقديري" وحالة "يحتاج مراجعة".
//
// الفكرة:
//  1) نجيب بنود المشروع اللي سعرها صفر (no_match / unmatched / review / new / matched)
//  2) لكل بند نجيب "مراجع": بنود مشابهة اتسعّرت فعلا (من مشروعك أو مشاريعك السابقة) بنفس الوحدة
//  3) Claude يقدّر سعر الوحدة بالجنيه المصري، معتمدا على المراجع أولا ثم خبرة السوق
//  4) نحفظ: status='review' + price_result.estimated=true (من غير أي تعديل في الداتابيز)
//
// الاستدعاء: POST { project_id, force?: boolean, skip_ids?: string[] }
// بيعالج دفعة (حتى 36 بند) ويرجع remaining — الواجهة تكرر لحد ما remaining = 0.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateBookPrice } from './rate-book';

export const runtime = 'nodejs';
export const maxDuration = 60;

const BATCH = 12;
const PARALLEL = 3;
const PER_CALL = 48;
const TODO_STATUSES = ['no_match', 'unmatched', 'review', 'new', 'matched', 'unpriced', 'error'];

// ---------- أدوات ----------
const norm = (v: any) =>
  String(v ?? '').toLowerCase()
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();

const STOP = new Set(['من', 'في', 'على', 'الى', 'مع', 'او', 'التي', 'الذي', 'ما', 'لا', 'قد', 'هو', 'هي',
  'the', 'and', 'for', 'with', 'of', 'to', 'in', 'per', 'all', 'any']);
const tokens = (t: string) =>
  new Set(norm(t).split(' ').filter((w) => w.length >= 3 && !STOP.has(w)));
const normUnit = (u: any) => norm(u).replace(/\s/g, '');

function jaccard(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let i = 0;
  a.forEach((x) => { if (b.has(x)) i++; });
  return i / (a.size + b.size - i);
}

function sb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env');
  return createClient(url, key, { auth: { persistSession: false } });
}

type Item = {
  id: string; item_code: string; description: string; unit: string | null;
  qty: number | null; pricing_qty: number | null; status: string; price_result: any;
  template_key: string | null;
};
type Anchor = { desc: string; unit: string; price: number; tk: Set<string>; u: string };

// ---------- المراجع: بنود اتسعّرت فعلا ----------
async function loadAnchors(supabase: any): Promise<Anchor[]> {
  const out: Anchor[] = [];
  for (let from = 0; from < 6000; from += 1000) {
    const { data, error } = await supabase
      .from('boq_items')
      .select('description,unit,price_result')
      .eq('status', 'priced')
      .range(from, from + 999);
    if (error || !data?.length) break;
    for (const r of data) {
      const p = Number(r.price_result?.unit_price || 0);
      if (!(p > 0) || r.price_result?.estimated) continue; // التقديري مش مرجع
      out.push({ desc: r.description || '', unit: r.unit || '', price: p,
        tk: tokens(r.description || ''), u: normUnit(r.unit) });
    }
    if (data.length < 1000) break;
  }
  return out;
}

function anchorsFor(item: Item, all: Anchor[]) {
  const tk = tokens(item.description);
  const u = normUnit(item.unit);
  return all
    .filter((a) => a.u === u)
    .map((a) => ({ a, sc: jaccard(tk, a.tk) }))
    .filter((x) => x.sc >= 0.25)
    .sort((x, y) => y.sc - x.sc)
    .slice(0, 4)
    .map((x) => ({ description: x.a.desc.slice(0, 200), unit: x.a.unit, unit_price: Math.round(x.a.price) }));
}

// ---------- Claude ----------
async function askClaude(batch: { id: string; description: string; unit: string; qty: number; anchors: any[] }[]) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY مطلوب للتسعير التقديري');

  const prompt =
`You are a senior quantity surveyor / cost estimator working on Egyptian construction projects. Today is October 2026.
For EACH BOQ item below, estimate a realistic ALL-IN unit price in Egyptian pounds (EGP) per ONE unit of the stated unit
(materials + labor + equipment + overheads + profit, supply & install as the description implies).

Rules:
- If "anchors" are given (similar items the contractor already priced, same unit), base your estimate on them and adjust for differences in the description. Set basis="anchor".
- Otherwise use your knowledge of the CURRENT Egyptian market. Set basis="market".
- NEVER return 0 or null. If the description is vague, give your best estimate and confidence="low".
- "unit_price" is per 1 unit (not the total). low/high = plausible range.
- lines: 2-5 cost components (component_type one of: خامات, مصنعيات, معدات, محملات) that roughly explain the price.
- rationale and assumptions: Arabic, one short sentence each.

Return ONLY a JSON array, no markdown:
[{"id":"...","unit_price":0,"low":0,"high":0,"confidence":"high|medium|low","basis":"anchor|market","rationale":"","assumptions":"","lines":[{"component_type":"خامات","name":"","quantity":1,"unit":"","unit_rate":0}]}]

Items:
${JSON.stringify(batch)}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
      max_tokens: 6000,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: AbortSignal.timeout(50000),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Claude API ${res.status}`);
  const txt = (data.content ?? []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
  const a = txt.indexOf('['), b = txt.lastIndexOf(']');
  if (a < 0 || b < 0) throw new Error('رد غير صالح من Claude');
  return JSON.parse(txt.slice(a, b + 1)) as any[];
}


// ---------- المرحلة 1: التسعير من القوالب (بياناتك أنت) ----------
function unitPriceFromDirect(direct: number, a: Record<string, any>) {
  const wPct = Number(a._wastage_pct ?? 5);
  const oPct = Number(a._overhead_pct ?? 18);
  const rPct = Number(a._risk_pct ?? 3);
  const pPct = Number(a._profit_pct ?? 10);
  const sub = direct + (direct * wPct) / 100;
  const o = (sub * oPct) / 100;
  const r = (sub * rPct) / 100;
  const p = ((sub + o + r) * pPct) / 100;
  return Math.round(sub + o + r + p);
}

async function priceByTemplate(supabase: any, it: Item) {
  let code = it.template_key && it.template_key !== 'CUSTOM' ? it.template_key : '';
  if (!code) {
    const { data } = await supabase.rpc('resolve_breakdown_template', {
      p_item_code: it.item_code || '', p_desc: it.description || '', p_unit: it.unit || '',
    });
    code = data?.template || '';
  }
  if (!code) return { fail: 'لا يوجد قالب' };

  const { data: def } = await supabase
    .from('template_default_answers').select('answers').eq('template_item_code', code).maybeSingle();
  const answers = def?.answers || {};
  const qty = Number(it.pricing_qty || it.qty || 1);

  const { data, error } = await supabase.rpc('price_recipe_for_boq', {
    p_template: code, p_desc: it.description || '', p_unit: it.unit || '', p_qty: qty, p_answers: answers,
  });
  if (error || !data?.ok) return { fail: `قالب ${code}: ${data?.error || error?.message || 'فشل'}` };
  const up = unitPriceFromDirect(data.direct_cost || 0, answers);
  if (!(up > 0)) return { fail: `قالب ${code}: السعر صفر` };
  return { code, up, qty, name: data.name || code, lines: data.lines || [] };
}

async function saveEstimate(supabase: any, it: Item, pr: any, extra: Record<string, any> = {}) {
  const { error } = await supabase
    .from('boq_items')
    .update({ status: 'review', price_result: { ...(it.price_result || {}), ...pr, ok: true, estimated: true,
      estimated_at: new Date().toISOString() }, ...extra })
    .eq('id', it.id);
  return !error;
}

async function pool<T, R>(arr: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(arr.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, arr.length) }, async () => {
    while (i < arr.length) { const k = i++; out[k] = await fn(arr[k]); }
  }));
  return out;
}

// ---------- مرحلة احتياطية: وسيط أسعار بنود مشابهة (بدون AI) ----------
function localAnchorPrice(it: Item, all: Anchor[]) {
  const tk = tokens(it.description);
  const u = normUnit(it.unit);
  const top = all.filter((a) => a.u === u)
    .map((a) => ({ a, sc: jaccard(tk, a.tk) }))
    .filter((x) => x.sc >= 0.35).sort((x, y) => y.sc - x.sc).slice(0, 3);
  if (!top.length) return null;
  const prices = top.map((x) => x.a.price).sort((x, y) => x - y);
  return { up: prices[Math.floor(prices.length / 2)], best: top[0].sc, n: top.length };
}

// ---------- معالجة دفعة (AI) ----------
async function processBatch(supabase: any, items: Item[], anchors: Anchor[]) {
  const payload = items.map((it) => ({
    id: it.id,
    description: (it.description || '').slice(0, 400),
    unit: it.unit || '',
    qty: Number(it.qty || 0),
    anchors: anchorsFor(it, anchors),
  }));

  const answers = await askClaude(payload);
  const byId = new Map(answers.map((a) => [String(a.id), a]));
  let ok = 0;
  const failed: string[] = [];

  for (const it of items) {
    const a = byId.get(String(it.id));
    const up = Number(a?.unit_price);
    if (!a || !isFinite(up) || up <= 0) { failed.push(it.id); continue; }

    // فحص منطقي مقابل المراجع
    const anc = anchorsFor(it, anchors).map((x) => x.unit_price).sort((x, y) => x - y);
    let confidence: string = ['high', 'medium', 'low'].includes(a.confidence) ? a.confidence : 'low';
    let assumptions: string = String(a.assumptions || '');
    if (anc.length) {
      const med = anc[Math.floor(anc.length / 2)];
      if (up / med > 4 || up / med < 0.25) {
        confidence = 'low';
        assumptions = `⚠ السعر بعيد جدا عن بنود مشابهة اتسعّرت (حوالي ${med}). ` + assumptions;
      }
    }

    // نظبط مجموع المكونات ليساوي سعر الوحدة
    let lines: any[] = Array.isArray(a.lines) ? a.lines : [];
    lines = lines
      .map((l, i) => ({
        id: `est-${it.id}-${i}`,
        component_type: ['خامات', 'مصنعيات', 'معدات', 'محملات'].includes(l.component_type) ? l.component_type : 'خامات',
        price_key: `est-${i}`,
        name: String(l.name || '').slice(0, 120),
        quantity: Number(l.quantity) > 0 ? Number(l.quantity) : 1,
        unit: String(l.unit || '—'),
        unit_rate: Number(l.unit_rate) || 0,
        total_cost: 0,
      }))
      .filter((l) => l.name);
    const sum = lines.reduce((s, l) => s + l.quantity * l.unit_rate, 0);
    if (sum > 0) {
      const k = up / sum;
      lines = lines.map((l) => {
        const rate = Math.round(l.unit_rate * k * 100) / 100;
        return { ...l, unit_rate: rate, total_cost: Math.round(l.quantity * rate * 100) / 100 };
      });
    } else lines = [];

    const qty = Number(it.qty || 0);
    const price_result = {
      ...(it.price_result || {}),
      ok: true,
      estimated: true,
      name: 'تقدير تلقائي',
      unit_price: Math.round(up * 100) / 100,
      total_price: Math.round(up * qty * 100) / 100,
      price_low: Number(a.low) > 0 ? Math.round(Number(a.low)) : undefined,
      price_high: Number(a.high) > 0 ? Math.round(Number(a.high)) : undefined,
      confidence,
      basis: a.basis === 'anchor' ? 'anchor' : 'market',
      rationale: String(a.rationale || ''),
      assumptions,
      lines,
      estimated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('boq_items')
      .update({ status: 'review', price_result })
      .eq('id', it.id);
    if (error) failed.push(it.id); else ok++;
  }
  return { ok, failed };
}

// ---------- HTTP ----------
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const projectId: string = body.project_id;
    const force = !!body.force;
    const skip = new Set<string>((body.skip_ids ?? []).map(String));
    if (!projectId) return NextResponse.json({ error: 'project_id مطلوب' }, { status: 400 });

    const supabase = sb();
    const { data: sheets } = await supabase.from('boq_sheets').select('id').eq('project_id', projectId);
    const sheetIds = (sheets ?? []).map((x: any) => x.id);
    if (!sheetIds.length) return NextResponse.json({ processed: 0, failed: 0, remaining: 0, failed_ids: [] });

    const items: Item[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from('boq_items')
        .select('id,item_code,description,unit,qty,pricing_qty,status,price_result,template_key')
        .in('sheet_id', sheetIds)
        .in('status', TODO_STATUSES)
        .range(from, from + 999);
      if (error) throw new Error(error.message);
      items.push(...((data as Item[]) ?? []));
      if (!data || data.length < 1000) break;
    }

    const todo = items.filter((it) => {
      if (skip.has(String(it.id))) return false;
      if (!(Number(it.qty) > 0) || !it.description) return false;
      const pr = it.price_result || {};
      if (Number(pr.unit_price) > 0 && !pr.estimated) return false; // عنده سعر حقيقي
      if (pr.estimated && !force) return false;                     // اتقدّر قبل كده
      return true;
    });

    const chunk = todo.slice(0, PER_CALL);
    const stats = { by_template: 0, by_ai: 0, by_anchor: 0, by_ratebook: 0 };
    const failedIds: string[] = [];
    const failedMeta: string[] = [];
    const reasons: string[] = [];
    if (!chunk.length) {
      return NextResponse.json({ processed: 0, failed: 0, failed_ids: [], remaining: 0, ...stats,
        total_candidates: items.length });
    }

    // --- مرحلة 1: القوالب ---
    const t1 = await pool(chunk, 6, (it) => priceByTemplate(supabase, it));
    const needAI: Item[] = [];
    const tplFails = new Set<string>();
    for (let i = 0; i < chunk.length; i++) {
      const it = chunk[i]; const r: any = t1[i];
      if (r && r.up) {
        const total = Math.round(r.up * r.qty * 100) / 100;
        const ok = await saveEstimate(supabase, it, {
          name: r.name, unit_price: r.up, total_price: total, confidence: 'medium', basis: 'template',
          rationale: `سُعّر من القالب ${r.code} (مطابقة متوسطة - تأكد إنه القالب الصحيح)`,
          assumptions: 'نسب الهالك والتشغيل والمخاطر والربح الافتراضية للقالب', lines: r.lines,
        }, { template_key: r.code });
        if (ok) stats.by_template++; else failedIds.push(it.id);
      } else {
        needAI.push(it);
        // نسجل سبب فشل القالب (لو البند كان ليه قالب) عشان نعرف نصلحه
        if (r?.fail && it.template_key && tplFails.size < 6) tplFails.add(`${it.item_code}: ${r.fail}`);
      }
    }

    // --- مرحلة 2: AI (مع مراجع من بنودك) ---
    let aiError = '';
    if (needAI.length) {
      const anchors = await loadAnchors(supabase);
      const hasKey = !!process.env.ANTHROPIC_API_KEY;
      const batches: Item[][] = [];
      for (let i = 0; i < needAI.length; i += BATCH) batches.push(needAI.slice(i, i + BATCH));

      const results = hasKey
        ? await Promise.allSettled(batches.map((b) => processBatch(supabase, b, anchors)))
        : [];
      const done = new Set<string>();
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          stats.by_ai += r.value.ok;
          batches[i].forEach((x) => { if (!r.value.failed.includes(x.id)) done.add(x.id); });
        } else {
          aiError = String(r.reason?.message ?? r.reason);
          console.error('ESTIMATE BATCH ERROR', r.reason);
        }
      });
      

      // --- مرحلة 3: وسيط أسعار بنود مشابهة لو AI مش متاح/فشل ---
      for (const it of needAI) {
        if (done.has(it.id)) continue;
        const qty = Number(it.qty || 0);
        const a = localAnchorPrice(it, anchors);
        if (a) {
          const ok = await saveEstimate(supabase, it, {
            name: 'تقدير من بنود مشابهة', unit_price: a.up, total_price: Math.round(a.up * qty * 100) / 100,
            confidence: a.best >= 0.55 ? 'medium' : 'low', basis: 'anchor',
            rationale: `وسيط أسعار ${a.n} بنود مشابهة اتسعّرت عندك بنفس الوحدة (تشابه ${Math.round(a.best * 100)}%)`,
            assumptions: 'بدون تعديل على الفروق في الوصف', lines: [],
          });
          if (ok) { stats.by_anchor++; continue; }
        }
        // آخر حل مجاني: جدول الأسعار المرجعية (rate-book.ts)
        const rb = rateBookPrice(it.description, it.unit || '');
        if (rb) {
          const ok = await saveEstimate(supabase, it, {
            name: `سعر مرجعي: ${rb.label}`, unit_price: rb.up, total_price: Math.round(rb.up * qty * 100) / 100,
            price_low: rb.low, price_high: rb.high, confidence: 'low', basis: 'ratebook',
            rationale: `سعر مرجعي عام لفئة "${rb.label}" من جدول الأسعار الداخلي - مش مبني على بيانات مشروعك`,
            assumptions: 'تقدير تقريبي: راجع/عدّل البريك داون قبل الاعتماد', lines: [],
          });
          if (ok) { stats.by_ratebook++; continue; }
        }
        failedIds.push(it.id);
        failedMeta.push(`${it.item_code} [${it.unit || '?'}] ${(it.description || '').replace(/\s+/g, ' ').slice(0, 90)}`);
      }
    }

    const processed = stats.by_template + stats.by_ai + stats.by_anchor + stats.by_ratebook;
    if (failedIds.length) reasons.push(`${failedIds.length} بند لم يتسعّر: لا قالب ولا بنود مشابهة ولا قاعدة في rate-book.ts تناسب وصفه/وحدته`);
    if (aiError) reasons.push('AI: ' + aiError);
    if (tplFails.size) reasons.push('فشل تسعير القالب: ' + Array.from(tplFails).join(' ; '));

    return NextResponse.json({
      processed, ...stats,
      failed: failedIds.length, failed_ids: failedIds,
      remaining: Math.max(0, todo.length - chunk.length),
      total_candidates: items.length,
      reasons,
      failed_items: failedMeta.slice(0, 40),
      error: processed === 0 && reasons.length ? reasons.join(' | ') : undefined,
    });
  } catch (e: any) {
    console.error('ESTIMATE ERROR', e);
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
