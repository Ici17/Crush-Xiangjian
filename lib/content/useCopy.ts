"use client";

/**
 * 展示文案覆盖 hook（L1）。
 * 公开 /api/content 只返回已发布的 copy；读不到就返回空，组件用静态兜底。
 * 模块级共享一次请求，避免同页多个组件各打一次。
 */

import { useEffect, useState } from "react";

let shared: Promise<Record<string, string>> | null = null;

function load(): Promise<Record<string, string>> {
  if (!shared) {
    shared = fetch("/api/content", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { copy: {} }))
      .then((d: { copy?: Record<string, string> }) => d.copy ?? {})
      .catch(() => ({}));
  }
  return shared;
}

export function useCopy(): Record<string, string> {
  const [copy, setCopy] = useState<Record<string, string>>({});
  useEffect(() => {
    let alive = true;
    void load().then((c) => { if (alive) setCopy(c); });
    return () => { alive = false; };
  }, []);
  return copy;
}

/** 取覆盖值，空串视为没配（避免后台误清空导致页面空白） */
export function pickCopy(copy: Record<string, string>, key: string, fallback: string): string {
  const v = copy[key];
  return typeof v === "string" && v.trim().length > 0 ? v : fallback;
}
