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
--
-- 会话数（第 2 批，sess 为 30 分钟滚动会话 ID，历史行 sess 为 NULL）：
--   select day, count(distinct sess) as sessions
--   from public.cx_events where sess is not null group by 1 order by 1 desc limit 30;
--
-- 新访客（仍按访客列 sid，口径不变）：
--   select min(day) as first_day, count(distinct sid) from public.cx_events group by 1;

-- ============================================================
-- 第 2 批增量（2026-09-16）：会话拆分 + 幂等（additive，纯追加，幂等可重复执行）
-- ============================================================
--
-- ⚠️ 语义说明：既有的 sid 列**不改名、不迁移**，继续承载「长期访客 ID」。
--    会话 ID 写入新列 sess；事件幂等 ID 写入新列 eid。
--    因此已有数据的 UV / 新访客 / 漏斗口径**完全连续**，本批所有历史行不受影响。
--    会话分析仅对「含 sess 的新行」生效（历史行 sess 为 NULL，会话数从上线日起算）。
--    cx_session_first_day 视图按 sid 分组（＝按访客），无需改动，NV 口径连续。
--
-- 代码已做「列缺失降级」：若本 DDL 尚未执行，写入会自动去掉 sess/eid 重试一次，
-- 保证 code-first 部署不丢数（届时仅失去会话 / 幂等能力，基本计数不受影响）。

alter table public.cx_events add column if not exists sess text; -- 会话 ID（30 分钟滚动窗口）
alter table public.cx_events add column if not exists eid  text; -- 事件幂等 ID

create index        if not exists cx_events_sess_idx on public.cx_events (sess);
create unique index if not exists cx_events_eid_uniq on public.cx_events (eid) where eid is not null;

