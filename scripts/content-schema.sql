-- ============================================================
-- Crush香鉴 — 内容配置表（L1 展示文案 + L2 算法配置版本化）
-- 2026-11-23 新增。用户已授权应用一次生产 DDL。
--
-- 设计要点：
--   1. 只新建 cx_content_config，**绝不动 cx_events**（埋点表是另一套口径）。
--   2. 默认无 anon 策略 + 开启 RLS → 只有 service_role 可读写，
--      与线上埋点表一致；公开读取走 /api/content 服务端代理，不直接暴露表。
--   3. scope='copy' 是展示文案（不进推荐算法，改了不用重跑任何门禁）；
--      scope='config' 是算法输入（题库/香水库/价格带/推荐理由），
--      必须带 version 且经过运行时校验才能发布。
--   4. published 是发布开关：同一 key 只让一个版本 published=true，
--      发布新版本时先把旧版置 false（在事务里完成，避免双版本同时生效）。
-- ============================================================

create table if not exists public.cx_content_config (
  key         text        primary key,
  scope       text        not null check (scope in ('copy', 'config')),
  value       jsonb       not null,
  version     integer     not null default 1,
  published   boolean     not null default false,
  note        text,
  updated_at  timestamptz not null default now(),
  updated_by  text
);

create index if not exists cx_content_config_scope_pub_idx
  on public.cx_content_config (scope, published);

alter table public.cx_content_config enable row level security;

-- 不建 anon 策略：公开读取由 Next.js API 用 service_role 代理，
-- 避免把整张配置表（含算法参数）暴露给任何持 anon key 的人。
