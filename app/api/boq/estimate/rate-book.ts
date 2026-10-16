// rate-book.ts — جدول أسعار مرجعية تقريبية (مجاني، بدون AI، بدون اشتراك)
// ضعه بجانب route.ts في: app/api/boq/estimate/

export type Rule = { label: string; k: (string | string[])[]; not?: string[]; unit: string; price: number };

const RULES: Rule[] = [
  // ============ أعمال ترابية ============
  { label: 'نقل مخلفات للمقالب', k: ['نقل', 'مخلفات'], unit: 'm3', price: 130 },
  { label: 'حفر في تربة صخرية', k: ['حفر', 'صخر'], not: ['ما عدا', 'عدا'], unit: 'm3', price: 300 },
  { label: 'حفر عام', k: ['حفر'], unit: 'm3', price: 90 },

  // ردم (m3)
  { label: 'ردم تربة نظيفة موردة', k: ['ردم', ['نظيفة', 'موردة', 'مورد']], unit: 'm3', price: 100 },
  { label: 'ردم رمل نظيف مورد', k: ['ردم', ['رمل', 'رمال']], unit: 'm3', price: 100 },
  { label: 'ردم عام', k: ['ردم'], unit: 'm3', price: 100 },

  // ردم (m2)
  { label: 'ردم تربة نظيفة موردة (م2)', k: ['ردم', ['نظيفة', 'موردة', 'مورد']], unit: 'm2', price: 100 },
  { label: 'ردم عام (م2)', k: ['ردم'], unit: 'm2', price: 100 },

  // ترابه إحلال
  { label: 'ترابه إحلال (م2)', k: [['ترابه', 'تربة'], 'احلال'], unit: 'm2', price: 280 },
  { label: 'ترابه إحلال (م3)', k: [['ترابه', 'تربة'], 'احلال'], unit: 'm3', price: 280 },

  { label: 'تسوية وتجهيز مسطح', k: ['تسويه'], unit: 'm2', price: 20 },
  { label: 'دمك وتجهيز', k: ['دمك'], unit: 'm2', price: 35 },

  // ============ خرسانات ============
  { label: 'خرسانة مسلحة', k: ['خرسانه', 'مسلحه'], unit: 'm3', price: 5900 },
  { label: 'خرسانة عادية', k: ['خرسانه', 'عاديه'], unit: 'm3', price: 2900 },
  { label: 'خرسانة (عام)', k: ['خرسانه'], unit: 'm3', price: 4500 },
  { label: 'دكة/أرضية خرسانة', k: [['دكه', 'ارضيه', 'ارضيات'], 'خرسانه'], unit: 'm2', price: 420 },
  { label: 'خرسانة خفيفة لعمل ميول', k: ['خرسانه', 'خفيفه'], unit: 'm2', price: 320 },
  { label: 'حديد تسليح (طن)', k: ['حديد'], unit: 'ton', price: 42000 },
  { label: 'حديد تسليح (كجم)', k: ['حديد'], unit: 'kg', price: 42 },

  // ============ مباني وبياض ============
  { label: 'مباني طوب (م3)', k: ['مباني', 'طوب'], unit: 'm3', price: 2300 },
  { label: 'مباني طوب (م2)', k: ['مباني', 'طوب'], unit: 'm2', price: 400 },
  { label: 'مباني طوب (عام - م2)', k: ['طوب'], not: ['عزل', 'عازل'], unit: 'm2', price: 400 },
  { label: 'مباني طوب (عام - م3)', k: ['طوب'], not: ['عزل', 'عازل'], unit: 'm3', price: 2300 },
  { label: 'بياض/محارة', k: [['بياض', 'محاره', 'فطيمه']], unit: 'm2', price: 135 },

  // ============ عزل ============
  { label: 'عزل بيتومين/رطوبة', k: [['عزل', 'عازل'], ['بيتومين', 'رطوبه', 'مائي']], unit: 'm2', price: 320 },
  { label: 'عزل حراري', k: [['عزل', 'عازل'], 'حراري'], unit: 'm2', price: 280 },
  { label: 'عزل (عام)', k: [['عزل', 'عازل']], unit: 'm2', price: 300 },

  // ============ كسوات (m2) ============
  { label: 'كسوة رخام', k: [['كسوه', 'تكسيه', 'كسوة'], ['رخام', 'الرخام']], unit: 'm2', price: 2000 },
  { label: 'رخام أحواض', k: ['رخام', ['احواض', 'حوائط']], unit: 'm2', price: 2000 },
  { label: 'رخام عام', k: ['رخام'], unit: 'm2', price: 2000 },
  { label: 'كسوة بلاطات', k: [['كسوه', 'تكسيه', 'كسوة'], ['بلاطات', 'البلاطات', 'بلاط', 'احجار']], unit: 'm2', price: 1500 },
  { label: 'حجر مايكا للواجهات', k: ['مايكا'], unit: 'm2', price: 850 },

  // ============ تشطيبات (m2) ============
  { label: 'جرانيت', k: ['جرانيت'], not: ['درج', 'سلم'], unit: 'm2', price: 1500 },
  { label: 'بورسلين', k: ['بورسلين'], unit: 'm2', price: 750 },
  { label: 'بلاط موزايكو', k: ['موزايكو'], unit: 'm2', price: 380 },
  { label: 'سيراميك/بلاط', k: [['سيراميك', 'بلاط']], not: ['احواض', 'حوائط'], unit: 'm2', price: 520 },
  { label: 'دهانات', k: [['دهان', 'بويه', 'طلاء']], unit: 'm2', price: 115 },
  { label: 'أسقف جبس', k: [['جبس', 'سقف معلق']], unit: 'm2', price: 650 },
  { label: 'ألوميتال/زجاج', k: [['المونيوم', 'الوميتال', 'زجاج']], unit: 'm2', price: 5200 },
  { label: 'رصف/إنترلوك', k: [['انترلوك', 'رصف']], unit: 'm2', price: 450 },
  { label: 'أسفلت', k: ['اسفلت'], unit: 'm2', price: 320 },
  { label: 'برجولات/مظلات', k: [['برجوله', 'مظله']], unit: 'm2', price: 3500 },

  // ============ أطوال (m) ============
  { label: 'كرانيش GRC', k: [['grc', 'كورنيش', 'كرانيش']], unit: 'm', price: 450 },
  { label: 'كسوة درج/نائمة', k: [['كسوه', 'تكسيه'], ['درج', 'نائمه', 'سلم']], unit: 'm', price: 1100 },
  { label: 'درابزين/handrail', k: [['درابزين', 'handrail', 'هاند ريل']], unit: 'm', price: 2800 },
  { label: 'بردورات', k: ['بردور'], unit: 'm', price: 190 },

  // ============ أبواب (م2) ============
  { label: 'باب نموذج (م2)', k: ['باب', 'نموج'], unit: 'm2', price: 5000 },
  { label: 'قالب حمام (م2)', k: [['قالب', 'قوالب'], ['حمام', 'للحمام', 'الحمام']], unit: 'm2', price: 5000 },
  { label: 'باب بي في سي (م2)', k: ['باب', ['بي', 'سي', 'في']], unit: 'm2', price: 5000 },
  { label: 'باب عام (م2)', k: ['باب'], unit: 'm2', price: 5000 },

  // ============ أبواب (العدد) ============
  { label: 'باب نموذج (العدد)', k: ['باب', 'نموج'], unit: 'no', price: 5000 },
  { label: 'قالب للحمام (العدد)', k: [['قالب', 'قوالب'], ['حمام', 'للحمام', 'الحمام']], unit: 'no', price: 5000 },
  { label: 'باب بي في سي (العدد)', k: ['باب', ['بي', 'سي', 'في']], unit: 'no', price: 5000 },
  { label: 'باب عام (العدد)', k: ['باب'], unit: 'no', price: 5000 },
  { label: 'مفصل (العدد)', k: [['مفصل', 'مفصلي']], unit: 'no', price: 2500 },

  // ============ شبابيك (م2) ============
  { label: 'شبابيك بي في سي (م2)', k: ['شبابيك', ['بي', 'سي', 'في']], unit: 'm2', price: 5500 },
  { label: 'شبابيك عام (م2)', k: ['شبابيك'], unit: 'm2', price: 5500 },
  { label: 'شباك (م2)', k: ['شباك'], unit: 'm2', price: 5500 },

  // ============ شبابيك (العدد) ============
  { label: 'شبابيك بي في سي (العدد)', k: ['شبابيك', ['بي', 'سي', 'في']], unit: 'no', price: 5500 },
  { label: 'شبابيك عام (العدد)', k: ['شبابيك'], unit: 'no', price: 5500 },
  { label: 'شباك (العدد)', k: ['شباك'], unit: 'no', price: 5500 },

  // ============ شبابيك (م3 — خطأ استيراد شائع) ============
  { label: 'شبابيك (م3)', k: ['شبابيك'], unit: 'm3', price: 5500 },
  { label: 'شباك (م3)', k: ['شباك'], unit: 'm3', price: 5500 },

  // ============ حديد الأبواب والمناخل (كجم) ============
  { label: 'باب منخل العمارة', k: ['منخل', 'عماره'], unit: 'kg', price: 120 },
  { label: 'باب منخل المصعد', k: ['منخل', 'مصعد'], unit: 'kg', price: 120 },
  { label: 'حديد منخل عام', k: ['منخل'], unit: 'kg', price: 120 },
  { label: 'منخل (العدد)', k: ['منخل'], unit: 'no', price: 2500 },

  // ============ تشطيات معدنية (العدد) ============
  { label: 'تشطية زوايا صاج (العدد)', k: [['تشطيه', 'تشطية']], unit: 'no', price: 250 },
  { label: 'تشطية زوايا صاج (م)', k: [['تشطيه', 'تشطية']], unit: 'm', price: 250 },
  { label: 'تشطية زوايا صاج (م2)', k: [['تشطيه', 'تشطية']], unit: 'm2', price: 250 },

  // ============ قواعد إنقاذ (كلمة واحدة) ============
  // كلمة واحدة بس — للبنود اللي فشلت
  { label: 'رخام (إنقاذ)', k: ['رخام'], unit: 'm2', price: 2000 },
  { label: 'الرخام (إنقاذ)', k: ['الرخام'], unit: 'm2', price: 2000 },
  { label: 'كسوة (إنقاذ)', k: ['كسوه'], unit: 'm2', price: 1500 },
  { label: 'كسوه (إنقاذ)', k: ['كسوه'], unit: 'm2', price: 1500 },
  { label: 'تكسيه (إنقاذ)', k: ['تكسيه'], unit: 'm2', price: 1500 },
  { label: 'بلاطات (إنقاذ)', k: ['بلاطات'], unit: 'm2', price: 1500 },
  { label: 'البلاطات (إنقاذ)', k: ['البلاطات'], unit: 'm2', price: 1500 },
  { label: 'حمام (إنقاذ - عدد)', k: ['حمام'], unit: 'no', price: 5000 },
  { label: 'للحمام (إنقاذ - عدد)', k: ['للحمام'], unit: 'no', price: 5000 },
  { label: 'الحمام (إنقاذ - عدد)', k: ['الحمام'], unit: 'no', price: 5000 },
  { label: 'حمام (إنقاذ - م2)', k: ['حمام'], unit: 'm2', price: 5000 },
  { label: 'للحمام (إنقاذ - م2)', k: ['للحمام'], unit: 'm2', price: 5000 },
  { label: 'الحمام (إنقاذ - م2)', k: ['الحمام'], unit: 'm2', price: 5000 },
];

// ---------- أدوات ----------
const norm = (v: any) =>
  String(v ?? '').toLowerCase()
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export function unitClass(u: any): string {
  const t = norm(u).replace(/\s/g, '').replace('²', '2').replace('³', '3');

  // m3
  if (/^(m3|cum|cbm|م3|مترمكعب)$/.test(t)) return 'm3';

  // m2
  if (/^(m2|sqm|م2|متر2|مترمربع)$/.test(t)) return 'm2';

  // m (linear)
  if (/^(m|lm|rm|م|مط|متر|مترطولي)$/.test(t)) return 'm';

  // no (عدد)
  if (/^(no|nos|nr|ea|each|pc|pcs|set|sets|عدد|العدد|نمره|نمر|معد|piece|pieces)$/.test(t)) return 'no';

  // ton
  if (/^(ton|t|طن)$/.test(t)) return 'ton';

  // kg
  if (/^(kg|kgs|كجم|كيلو|كيلوجرام)$/.test(t)) return 'kg';

  return t;
}

const kn = (k: string) => norm(k);
const PREFIX = /^(وال|بال|لل|ال|و|ب|ل|ك|ف)/;
const stem = (t: string) => {
  const r = t.replace(PREFIX, '');
  return r.length >= 2 ? r : t;
};

// البحث عن كل الكلمات في أي مكان (بدون اشتراط تتابع)
function findKw(tokens: string[], kw: string): number {
  const words = kn(kw).split(' ').filter(Boolean);
  if (words.length === 0) return -1;

  let minPos = Infinity;
  for (const w of words) {
    let found = -1;
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      const st = stem(t);
      if (
        t === w ||
        t.startsWith(w) ||
        st.startsWith(w) ||
        w.startsWith(st) ||
        w.startsWith(t)
      ) {
        found = i;
        break;
      }
    }
    if (found < 0) return -1;
    if (found < minPos) minPos = found;
  }
  return minPos;
}

export function rateBookPrice(description: string, unit: string) {
  const tokens = norm(description).split(' ').filter(Boolean);
  const uc = unitClass(unit);
  const factor = Number(process.env.RATE_BOOK_FACTOR || 1) || 1;

  let best: { rule: Rule; pos: number; spec: number } | null = null;

  for (const rule of RULES) {
    if (rule.unit !== uc) continue;
    if (rule.not?.some((n) => findKw(tokens, n) >= 0)) continue;

    let pos = -1;
    let ok = true;

    for (let i = 0; i < rule.k.length; i++) {
      const alts = Array.isArray(rule.k[i]) ? (rule.k[i] as string[]) : [rule.k[i] as string];
      const idx = alts.map((a) => findKw(tokens, a)).filter((x) => x >= 0);
      if (!idx.length) {
        ok = false;
        break;
      }
      if (i === 0) pos = Math.min(...idx);
    }

    if (!ok) continue;

    const spec = rule.k.length;
    if (!best || pos < best.pos || (pos === best.pos && spec > best.spec))
      best = { rule, pos, spec };
  }

  if (!best) return null;

  const up = Math.round(best.rule.price * factor);
  return {
    up,
    low: Math.round(up * 0.7),
    high: Math.round(up * 1.4),
    label: best.rule.label,
  };
}