-- =====================================================================
-- 06_breakdown_library — نسخة مخصصة لقاعدة بياناتك
-- الأكواد الحقيقية: MAT-XXX / LBR-XXX / EQP-XXX
-- =====================================================================
begin;

-- تأكد من وجود الجداول الأساسية
do $$
begin
  if to_regclass('public.materials') is null then
    raise exception 'جدول materials مش موجود';
  end if;
  if to_regclass('public.labor_rates') is null then
    raise exception 'جدول labor_rates مش موجود';
  end if;
  if to_regclass('public.equipment_rates') is null then
    raise exception 'جدول equipment_rates مش موجود';
  end if;
end $$;

-- =====================================================================
-- 1) دوال مساعدة
-- =====================================================================
create or replace function public._norm_unit(p text)
returns text language sql immutable
set search_path = public, pg_temp
as $f$
  select case when p is null then null else (
    select case
      when s ~ '^(m3|m³|cum|cbm|م3|م³|مترمكعب|متر3)$' then 'm3'
      when s ~ '^(m2|m²|sqm|م2|م²|مترمربع|متر2)$' then 'm2'
      when s ~ '^(m|lm|rm|مط|متر|مترطولي)$' then 'm'
      when s ~ '^(kg|كجم|كيلو|كغم|كيلوجرام)$' then 'kg'
      when s ~ '^(ton|tonne|t|طن)$' then 'ton'
      when s ~ '^(day|days|يوم|يومية)$' then 'day'
      when s ~ '^(hr|hour|ساعة|ساعه)$' then 'hr'
      when s ~ '^(l|lt|ltr|liter|litre|لتر)$' then 'l'
      when s ~ '^(1000no|1000pcs|الف|ألف|1000طوبة|1000طوبه|1000قطعة|ألفطوبة|الفطوبه)$' then '1000no'
      when s ~ '^(no|nr|number|عدد|قطعة|قطعه|طوبة|طوبه|each|ea|pcs|pc|وحدة)$' then 'no'
      when s ~ '^(bag|كيس|شكارة|شكاره)$' then 'bag'
      when s ~ '^(ls|lump|lumpsum|مقطوعية|مقطوعيه)$' then 'ls'
      else s end
    from (select regexp_replace(lower(btrim(p)), '[\s.]', '', 'g') as s) x) end
$f$;

create or replace function public._num(p text, d numeric)
returns numeric language sql immutable
set search_path = public, pg_temp
as $f$
  select case when p ~ '^\s*-?[0-9]+(\.[0-9]+)?\s*$' then btrim(p)::numeric else d end
$f$;

create or replace function public._ar_norm(p text)
returns text language sql immutable
set search_path = public, pg_temp
as $$
  select btrim(regexp_replace(
           regexp_replace(
             translate(lower(coalesce(p,'')), 'أإآةىؤئ', 'اااهيوي'),
             '[ً-ْـ]', '', 'g'),
           '[\s\.,;:\(\)\-_/\\×\*،]+', ' ', 'g'))
$$;

-- =====================================================================
-- 2) price_bank — View موحّد على الجداول بتاعتك
-- =====================================================================
create or replace view public.price_bank
with (security_invoker = true)
as
  select 'material'::text as kind, code, name_ar, unit, price as rate
    from public.materials
  union all
  select 'labor'::text, code, trade_ar, unit, coalesce(nullif(unit_rate,0), nullif(daily_rate,0), 0)
    from public.labor_rates
  union all
  select 'equipment'::text, code, name_ar, unit,
         coalesce(rental_rate, 0) + coalesce(operation_cost, 0)
    from public.equipment_rates;

revoke all on public.price_bank from public, anon, authenticated;
grant select on public.price_bank to authenticated;

-- =====================================================================
-- 3) جداول المفاتيح والوصفات
-- =====================================================================
create table if not exists public.breakdown_price_keys (
  price_key     text primary key,
  kind          text not null check (kind in ('material', 'labor', 'equipment')),
  description   text not null,
  expected_unit text not null,
  bound_code    text,
  conv_factor   numeric not null default 1 check (conv_factor > 0),
  verified      boolean not null default false,
  note          text,
  created_at    timestamptz not null default now()
);

create table if not exists public.breakdown_recipe_lines (
  id                 bigint generated always as identity primary key,
  template_item_code text not null,
  line_no            integer not null,
  component_type     text not null,
  component_name     text not null,
  price_key          text not null references public.breakdown_price_keys(price_key),
  qty_per_unit       numeric,
  unit               text not null,
  required           boolean not null default true,
  note               text,
  unique (template_item_code, line_no)
);

alter table public.breakdown_price_keys   enable row level security;
alter table public.breakdown_recipe_lines enable row level security;

drop policy if exists bpk_read on public.breakdown_price_keys;
drop policy if exists brl_read on public.breakdown_recipe_lines;

create policy bpk_read on public.breakdown_price_keys
  for select to authenticated using (true);

create policy brl_read on public.breakdown_recipe_lines
  for select to authenticated using (true);

revoke all on public.breakdown_price_keys, public.breakdown_recipe_lines from anon, authenticated;
grant select on public.breakdown_price_keys, public.breakdown_recipe_lines to authenticated;

-- =====================================================================
-- 4) مفاتيح الأسعار — مربوطة بأكوادك الحقيقية
-- =====================================================================
insert into public.breakdown_price_keys
  (price_key, kind, description, expected_unit, bound_code, verified)
values
  -- ============ خامات (MAT-*) ============
  ('MAT_CEMENT',       'material', 'أسمنت بورتلاندي عادي', 'ton', 'MAT-001', true),
  ('MAT_CEMENT_WHITE', 'material', 'أسمنت أبيض',          'ton', 'MAT-002', true),
  ('MAT_SAND',         'material', 'رمل ناعم',              'm3',  'MAT-003', true),
  ('MAT_SAND_COARSE',  'material', 'رمل خشن',              'm3',  'MAT-004', true),
  ('MAT_GRAVEL',       'material', 'سن 1',                 'm3',  'MAT-005', true),

  -- ============ مصنعيات (LBR-*) ============
  ('LBR_EXCAVATION',   'labor', 'حفر ونقل ناتج الحفر',   'm3', 'LBR-001',   true),
  ('LBR_BACKFILL',     'labor', 'ردم Backfill',          'm3', 'LBR-001-B', true),
  ('LBR_PC',           'labor', 'خرسانة عادية',          'm3', 'LBR-002',   true),
  ('LBR_RC',           'labor', 'خرسانة مسلحة',          'm3', 'LBR-003',   true),
  ('LBR_CARPENTER',    'labor', 'نجارة مسلح',            'm3', 'LBR-004',   true),

  -- ============ معدات (EQP-*) ============
  ('EQP_LOADER',       'equipment', 'لودر',              'day', 'EQP-001', true),
  ('EQP_EXCAVATOR',    'equipment', 'حفار',              'day', 'EQP-002', true),
  ('EQP_BREAKER',      'equipment', 'حفار بمطرقة',       'day', 'EQP-003', true),
  ('EQP_BULLDOZER',    'equipment', 'بلدوزر',            'day', 'EQP-004', true),
  ('EQP_GRADER',       'equipment', 'جريدر',             'day', 'EQP-005', true)
on conflict (price_key) do nothing;

-- =====================================================================
-- 5) الوصفات — لكل قالب، المكونات المطلوبة لكل وحدة
-- =====================================================================

-- ============ BQ-01: مباني بلوك 12سم ============
insert into public.breakdown_recipe_lines
  (template_item_code, line_no, component_type, component_name, price_key, qty_per_unit, unit, required)
values
  ('BQ-01', 1, 'خامات', 'رمل',        'MAT_SAND',        0.02,  'm3',  true),
  ('BQ-01', 2, 'خامات', 'أسمنت',      'MAT_CEMENT',      0.007, 'ton', true),
  ('BQ-01', 3, 'مصنعيات', 'بناء طوب 12سم', 'LBR_CARPENTER', 0.05, 'm3', true)
on conflict (template_item_code, line_no) do nothing;

-- ============ BQ-02: مباني بلوك 25سم ============
insert into public.breakdown_recipe_lines
  (template_item_code, line_no, component_type, component_name, price_key, qty_per_unit, unit, required)
values
  ('BQ-02', 1, 'خامات', 'رمل',        'MAT_SAND',        0.04,  'm3',  true),
  ('BQ-02', 2, 'خامات', 'أسمنت',      'MAT_CEMENT',      0.014, 'ton', true),
  ('BQ-02', 3, 'مصنعيات', 'بناء طوب 25سم', 'LBR_CARPENTER', 0.08, 'm3', true)
on conflict (template_item_code, line_no) do nothing;

-- ============ BQ-04: بياض أسمنتي 2سم ============
insert into public.breakdown_recipe_lines
  (template_item_code, line_no, component_type, component_name, price_key, qty_per_unit, unit, required)
values
  ('BQ-04', 1, 'خامات', 'رمل',        'MAT_SAND',        0.025, 'm3',  true),
  ('BQ-04', 2, 'خامات', 'أسمنت',      'MAT_CEMENT',      0.008, 'ton', true),
  ('BQ-04', 3, 'مصنعيات', 'محارة',    'LBR_PC',          0.05,  'm3',  true)
on conflict (template_item_code, line_no) do nothing;

-- ============ BQ-43: ردم بتربة معتمدة ============
insert into public.breakdown_recipe_lines
  (template_item_code, line_no, component_type, component_name, price_key, qty_per_unit, unit, required)
values
  ('BQ-43', 1, 'خامات', 'رمل خشن',    'MAT_SAND_COARSE', 1.25,  'm3',  true),
  ('BQ-43', 2, 'معدات', 'لودر',       'EQP_LOADER',      0.003, 'day', true),
  ('BQ-43', 3, 'معدات', 'حفار',       'EQP_EXCAVATOR',   0.002, 'day', true),
  ('BQ-43', 4, 'مصنعيات', 'ردم',      'LBR_BACKFILL',    1.0,   'm3',  true)
on conflict (template_item_code, line_no) do nothing;

-- ============ BQ-50: حفر صخري ============
insert into public.breakdown_recipe_lines
  (template_item_code, line_no, component_type, component_name, price_key, qty_per_unit, unit, required)
values
  ('BQ-50', 1, 'معدات', 'حفار بمطرقة', 'EQP_BREAKER',  0.008, 'day', true),
  ('BQ-50', 2, 'معدات', 'لودر',        'EQP_LOADER',   0.005, 'day', true),
  ('BQ-50', 3, 'مصنعيات', 'حفر ونقل', 'LBR_EXCAVATION', 1.0, 'm3',  true)
on conflict (template_item_code, line_no) do nothing;

-- ============ BQ-51: ردم إنشائي ============
insert into public.breakdown_recipe_lines
  (template_item_code, line_no, component_type, component_name, price_key, qty_per_unit, unit, required)
values
  ('BQ-51', 1, 'معدات', 'بلدوزر',     'EQP_BULLDOZER', 0.003, 'day', true),
  ('BQ-51', 2, 'معدات', 'جريدر',      'EQP_GRADER',    0.002, 'day', true),
  ('BQ-51', 3, 'معدات', 'لودر',       'EQP_LOADER',    0.003, 'day', true),
  ('BQ-51', 4, 'مصنعيات', 'ردم',      'LBR_BACKFILL',  1.0,   'm3',  true)
on conflict (template_item_code, line_no) do nothing;

-- =====================================================================
-- 6) القوالب — breakdown_templates
-- =====================================================================

-- تأكد إن جدول القوالب موجود
create table if not exists public.breakdown_templates (
  item_code             text primary key,
  item_name_ar          text not null,
  unit                  text not null,
  category              text,
  description           text,
  default_wastage_pct   numeric default 5,
  default_overhead_pct  numeric default 18,
  default_risk_pct      numeric default 3,
  default_profit_pct    numeric default 10,
  created_at            timestamptz default now()
);

-- ============ قوالب الأعمال الترابية والطرق ============
insert into public.breakdown_templates
  (item_code, item_name_ar, unit, category, description,
   default_wastage_pct, default_overhead_pct, default_risk_pct, default_profit_pct)
values
  ('BQ-43', 'ردم بتربة معتمدة على طبقات 30سم', 'm3', 'أعمال ترابية',
   'ردم ودمك على طبقات', 3, 18, 3, 10),
  ('BQ-44', 'توريد وتركيب إنترلوك 8سم', 'm2', 'طرق',
   'إنترلوك 8سم على فرشة رمل', 5, 18, 3, 10),
  ('BQ-45', 'طبقة أساس حجر جيري مجروش 20سم', 'm3', 'طرق',
   'أساس حصوي', 3, 18, 3, 10),
  ('BQ-47', 'توريد وتركيب بردورة خرسانية', 'm', 'طرق',
   'بردورة على فرشة خرسانة', 3, 18, 3, 10),
  ('BQ-48', 'دهان تخطيط أسفلت ثيرموبلاستيك', 'm2', 'طرق',
   'تخطيط أصفر AASHTO', 5, 18, 3, 10),
  ('BQ-50', 'حفر في تربة صخرية بمطرقة هيدروليكية', 'm3', 'أعمال ترابية',
   'حفر صخري', 0, 18, 3, 10),
  ('BQ-51', 'ردم إنشائي بحجر مجروش ≤75مم', 'm3', 'أعمال ترابية',
   'ردم إنشائي', 0, 18, 3, 10),
  ('BQ-52', 'توريد وتركيب جيوتكستايل 400', 'm2', 'أعمال ترابية',
   'جيوتكستايل', 5, 18, 3, 10)
on conflict (item_code) do update set
  item_name_ar         = excluded.item_name_ar,
  unit                 = excluded.unit,
  category             = excluded.category,
  description          = excluded.description,
  default_wastage_pct  = excluded.default_wastage_pct,
  default_overhead_pct = excluded.default_overhead_pct,
  default_risk_pct     = excluded.default_risk_pct,
  default_profit_pct   = excluded.default_profit_pct;

-- =====================================================================
-- 7) ربط القوالب بدالة الحساب
-- =====================================================================
create table if not exists public.breakdown_template_functions (
  template_item_code text primary key,
  function_name      text not null,
  verified           boolean default true,
  note               text
);

insert into public.breakdown_template_functions
  (template_item_code, function_name, verified, note)
values
  ('BQ-43', 'calculate_breakdown_recipe', true, 'redm'),
  ('BQ-44', 'calculate_breakdown_recipe', true, 'interlock'),
  ('BQ-45', 'calculate_breakdown_recipe', true, 'road base'),
  ('BQ-47', 'calculate_breakdown_recipe', true, 'curb'),
  ('BQ-48', 'calculate_breakdown_recipe', true, 'marking'),
  ('BQ-50', 'calculate_breakdown_recipe', true, 'rock excavation'),
  ('BQ-51', 'calculate_breakdown_recipe', true, 'structural fill'),
  ('BQ-52', 'calculate_breakdown_recipe', true, 'geotextile')
on conflict (template_item_code) do update set
  function_name = excluded.function_name,
  verified      = excluded.verified;

-- =====================================================================
-- 8) الكلمات المفتاحية للمطابقة التلقائية
-- =====================================================================
create table if not exists public.breakdown_template_keywords (
  id                 bigint generated always as identity primary key,
  template_item_code text not null,
  keyword            text not null,
  weight             int not null default 10,
  unique (template_item_code, keyword)
);

insert into public.breakdown_template_keywords
  (template_item_code, keyword, weight)
values
  ('BQ-43', 'backfill', 30),
  ('BQ-43', 'ردم', 20),
  ('BQ-44', 'interlock', 30),
  ('BQ-44', 'إنترلوك', 20),
  ('BQ-45', 'crushed', 20),
  ('BQ-45', 'حجر جيري', 20),
  ('BQ-47', 'curbstone', 30),
  ('BQ-47', 'بردورة', 20),
  ('BQ-48', 'marking', 30),
  ('BQ-48', 'تخطيط', 20),
  ('BQ-50', 'excavation in rock', 40),
  ('BQ-50', 'rock', 20),
  ('BQ-51', 'structural fill', 40),
  ('BQ-51', 'ردم إنشائي', 30),
  ('BQ-52', 'geotextile', 40),
  ('BQ-52', 'جيوتكستايل', 30)
on conflict (template_item_code, keyword) do update set
  weight = excluded.weight;

-- =====================================================================
-- 9) دالة تسعير الوصفة (price_recipe_template)
-- =====================================================================
create or replace function public.price_recipe_template(
  p_template_code text,
  p_qty numeric default 1
)
returns jsonb
language plpgsql stable
set search_path = public, pg_temp
as $$
declare
  t record; r record;
  v_rate numeric; v_q numeric; v_tot numeric;
  v_count int := 0;
  v_direct numeric := 0;
  v_lines jsonb := '[]'::jsonb;
  v_missing text[] := '{}';
  v_wp numeric; v_op numeric; v_kp numeric; v_pp numeric;
  v_w numeric; v_sub numeric; v_o numeric; v_k numeric; v_p numeric; v_final numeric;
begin
  select * into t from breakdown_templates where item_code = p_template_code;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'template_not_found', 'template', p_template_code);
  end if;

  for r in
    select l.price_key, l.qty_per_unit, l.component_name, l.unit as line_unit,
           k.kind, k.bound_code, k.expected_unit
      from breakdown_recipe_lines l
      join breakdown_price_keys k on k.price_key = l.price_key
     where l.template_item_code = p_template_code
     order by l.line_no
  loop
    v_count := v_count + 1;
    v_rate := null;

    -- جيب السعر من price_bank
    if r.bound_code is not null then
      select b.rate into v_rate
        from public.price_bank b
       where b.kind = r.kind and b.code = r.bound_code
       limit 1;
    end if;

    if v_rate is null or v_rate <= 0 then
      v_missing := v_missing || coalesce(r.price_key, '?');
      continue;
    end if;

    v_q   := coalesce(r.qty_per_unit, 1);
    v_tot := v_q * v_rate;
    v_direct := v_direct + v_tot;
    v_lines := v_lines || jsonb_build_object(
      'component_type', case r.kind
                          when 'material' then 'خامات'
                          when 'labor' then 'مصنعيات'
                          when 'equipment' then 'معدات'
                          else r.kind end,
      'price_key',  r.price_key,
      'name',       r.component_name,
      'quantity',   v_q,
      'unit',       r.line_unit,
      'unit_rate',  v_rate,
      'total_cost', round(v_tot, 2)
    );
  end loop;

  if v_count = 0 then
    return jsonb_build_object('ok', false, 'error', 'no_recipe', 'template', p_template_code);
  end if;

  if array_length(v_missing, 1) > 0 then
    return jsonb_build_object('ok', false, 'error', 'missing_rates',
                              'missing', to_jsonb(v_missing),
                              'template', p_template_code);
  end if;

  v_wp := coalesce(t.default_wastage_pct, 5);
  v_op := coalesce(t.default_overhead_pct, 18);
  v_kp := coalesce(t.default_risk_pct, 3);
  v_pp := coalesce(t.default_profit_pct, 10);

  v_w     := v_direct * v_wp / 100.0;
  v_sub   := v_direct + v_w;
  v_o     := v_sub * v_op / 100.0;
  v_k     := v_sub * v_kp / 100.0;
  v_p     := (v_sub + v_o + v_k) * v_pp / 100.0;
  v_final := v_sub + v_o + v_k + v_p;

  return jsonb_build_object(
    'ok', true,
    'template', p_template_code,
    'name', t.item_name_ar,
    'unit', t.unit,
    'direct_cost',  round(v_direct, 2),
    'wastage_cost', round(v_w, 2),
    'subtotal',     round(v_sub, 2),
    'overhead_cost', round(v_o, 2),
    'risk_cost',    round(v_k, 2),
    'profit_cost',  round(v_p, 2),
    'unit_price',   round(v_final, 2),
    'total_price',  round(v_final * coalesce(p_qty, 1), 2),
    'components_count', v_count,
    'lines', v_lines
  );
end;
$$;

-- =====================================================================
-- 10) دالة تسعير بند BOQ (price_recipe_for_boq)
-- =====================================================================
create or replace function public.price_recipe_for_boq(
  p_template text,
  p_desc text,
  p_unit text,
  p_qty numeric default 1
)
returns jsonb
language plpgsql stable
set search_path = public, pg_temp
as $$
declare
  base jsonb;
begin
  base := public.price_recipe_template(p_template, p_qty);
  if not coalesce((base->>'ok')::boolean, false) then
    return base;
  end if;
  return base;
end;
$$;

-- =====================================================================
-- 11) دالة المطابقة (resolve_breakdown_template) — مبسّطة
-- =====================================================================
create or replace function public.resolve_breakdown_template(
  p_item_code text,
  p_desc text,
  p_unit text
)
returns jsonb
language plpgsql stable
set search_path = public, pg_temp
as $$
declare
  v_unit text := nullif(public._norm_unit(nullif(btrim(coalesce(p_unit, '')), '')), '');
  v_desc text := public._ar_norm(p_desc);
  top record;
  sec record;
  cands jsonb;
begin
  -- A) بالكود مباشرة
  if exists (
    select 1 from public.breakdown_templates bt
     where bt.item_code = btrim(coalesce(p_item_code, ''))
       and (v_unit is null or public._norm_unit(bt.unit) = v_unit)
  ) then
    return jsonb_build_object(
      'method', 'code',
      'confidence', 'high',
      'template', btrim(p_item_code),
      'function', 'calculate_breakdown_recipe',
      'candidates', '[]'::jsonb
    );
  end if;

  -- B) بالكلمات المفتاحية
  select s.template_item_code as template,
         bt.item_name_ar as name,
         s.score
    into top
    from (
      select k.template_item_code, sum(k.weight)::int as score
        from public.breakdown_template_keywords k
       where v_desc <> ''
         and position(public._ar_norm(k.keyword) in v_desc) > 0
       group by k.template_item_code
       having sum(k.weight) > 0
    ) s
    join public.breakdown_templates bt on bt.item_code = s.template_item_code
   where v_unit is null or public._norm_unit(bt.unit) = v_unit
   order by s.score desc
   limit 1;

  if top.template is not null and top.score >= 20 then
    return jsonb_build_object(
      'method', 'keywords',
      'confidence', 'high',
      'template', top.template,
      'function', 'calculate_breakdown_recipe',
      'candidates', jsonb_build_array(jsonb_build_object(
        'template', top.template, 'name', top.name, 'score', top.score,
        'function', 'calculate_breakdown_recipe'
      ))
    );
  end if;

  -- C) مفيش مطابقة — رجّع أفضل المرشحين
  select coalesce(jsonb_agg(to_jsonb(x) order by x.score desc), '[]'::jsonb)
    into cands
    from (
      select s.template_item_code as template,
             bt.item_name_ar as name,
             s.score,
             'calculate_breakdown_recipe' as function
        from (
          select k.template_item_code, sum(k.weight)::int as score
            from public.breakdown_template_keywords k
           where v_desc <> ''
             and position(public._ar_norm(k.keyword) in v_desc) > 0
           group by k.template_item_code
           having sum(k.weight) > 0
        ) s
        join public.breakdown_templates bt on bt.item_code = s.template_item_code
       where v_unit is null or public._norm_unit(bt.unit) = v_unit
       order by s.score desc
       limit 3
    ) x;

  return jsonb_build_object(
    'method', case when cands = '[]'::jsonb then 'none' else 'keywords' end,
    'confidence', 'low',
    'template', null,
    'candidates', cands
  );
end;
$$;

-- =====================================================================
-- 12) الصلاحيات
-- =====================================================================
grant execute on function public.price_recipe_template(text, numeric) to authenticated;
grant execute on function public.price_recipe_for_boq(text, text, text, numeric) to authenticated;
grant execute on function public.resolve_breakdown_template(text, text, text) to authenticated;

commit;

notify pgrst, 'reload schema';