-- Crush 香鉴 · 匿名埋点数据表（Supabase SQL Editor 执行）
-- 用法：Supabase 控制台 → SQL Editor → New query → 整段粘贴 → Run

-- 1. 事件明细表（一行 = 一条匿名事件，无 IP / UA / 任何 PII）
create table if not exists public.cx_events (
  id     bigint generated always as identity primary key,
  ts     timestamptz not null default now(),
  day    date not null,
  event  text not null,
  path   text,
  sid    text,
  props  jsonb not null default '{}'::jsonb
);

create index if not exists cx_events_day_idx on public.cx_events (day desc);
create index if not exists cx_events_ts_idx  on public.cx_events (ts desc);
create index if not exists cx_events_sid_idx on public.cx_events (sid);

-- 2. 会话首次出现日 → 后台「新访客」指标用
create or replace view public.cx_session_first_day as
  select sid, min(day) as first_day
  from public.cx_events
  where sid is not null
  group by sid;

-- 3. RLS：默认全关，只对服务端角色放开（anon key 除下面这条策略外无权限）
alter table public.cx_events enable row level security;

-- 若你只想用 service_role key（推荐），下面两段不要执行：
drop policy if exists cx_events_insert_anon on public.cx_events;
create policy cx_events_insert_anon on public.cx_events
  for insert to anon with check (true);

drop policy if exists cx_events_select_anon on public.cx_events;
create policy cx_events_select_anon on public.cx_events
  for select to anon using (true);

-- 4. 常用分析查询（可直接复制到 SQL Editor 用）
--
-- 核心漏斗（近 7 天）：
--   select event, count(*) from public.cx_events
--   where day >= current_date - 7 group by 1 order by 2 desc;
--
-- 人格分布：
--   select props->>'personality' as personality, count(*) from public.cx_events
--   where event = 'test_complete' and props ? 'personality'
--   group by 1 order by 2 desc;
--
-- 按天 PV / UV：
--   select day, count(*) as pv, count(distinct sid) as uv
--   from public.cx_events group by 1 order by 1 desc limit 30;
