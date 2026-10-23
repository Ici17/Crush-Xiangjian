/**
 * perfumeProfile.ts —— 单香档案（F7）的**唯一取值口**
 *
 * 为什么不能直接 import perfumeProfiles 去查：
 *   档案的键是 PERFUMES 的**对象键**，而 UI 手里拿到的 Perfume 对象只有 `id` 和 `name`。
 *   两者并不总是一致 —— 实测有 3 支 `id ≠ key`（无花果 / 同名版 / 旷野），
 *   直接 `PERFUME_PROFILES[p.id]` 会静默查空，界面上表现为「这支香没有档案」。
 *
 * 这里做的三步：
 *   1. 一次遍历建三向索引（key / id / name → 档案）
 *   2. 已用脚本验证：id 全局唯一、name 全局唯一、id 与 name 无跨组冲突 → 索引不会串档
 *   3. 查询顺序固定为 id → name（两者都能唯一定位一支香）
 *
 * ⚠️ 覆盖率由 scripts/audit-perfume-data.ts 的 I 项守着（225/225 双向全等），
 *    所以这里查不到只可能是「传了空值」，不再做 exists 分支去掩盖数据缺口。
 */

import { PERFUMES } from "@/lib/data";
import { PERFUME_PROFILES, type PerfumeProfile } from "@/lib/data/perfumeProfiles";

type Index = Map<string, PerfumeProfile>;

let cached: Index | null = null;

function buildIndex(): Index {
  const m: Index = new Map();
  for (const [key, p] of Object.entries(PERFUMES)) {
    const prof = PERFUME_PROFILES[key];
    if (!prof) continue; // I 项门禁已保证不存在这种情况
    m.set(key, prof);
    m.set(p.id, prof);
    m.set(p.name, prof);
  }
  cached = m;
  return m;
}

/**
 * 取一支香的档案文案（离线生成 + 人工校订，运行时零 LLM 调用）。
 * 传 null/undefined 或查不到都返回 null —— 调用方自行决定要不要回落到 description。
 */
export function getPerfumeProfile(
  p: { id?: string; name?: string } | null | undefined,
): PerfumeProfile | null {
  if (!p) return null;
  const m = cached ?? buildIndex();
  return (p.id ? m.get(p.id) : undefined) ?? (p.name ? m.get(p.name) : undefined) ?? null;
}
