/**
 * resultSections.ts —— 结果页各章节的**唯一真源**（标题 + 锚点 id + 导航短名）
 *
 * 为什么要有它：
 *   原来导航条（ResultSectionNav）里写了一份 `ITEMS` 短名，页面里又各写了一遍 `<h2>` 标题，
 *   两份文案互不相干 —— 结果是「反差香」胶囊和「反差香」大标题一字不差地重复出现，
 *   而「用香哲学」「香调偏好」两个区块在导航里干脆没有入口（写漏了）。
 *
 *   现在标题与导航短名都从这里取，改一处两边同步，并且下面有断言保证：
 *   · 导航短名互不重复
 *   · 导航短名 ≠ 章节标题（避免用户在同一屏看到两个一样的词）
 *
 * ⚠️ 新增章节：在这里加一项，再去页面里给对应 section 挂上 `id`。
 */

export const SECTIONS = {
  spectrum: { id: "sec-spectrum", nav: "光谱", title: "你的香气光谱" },
  perfume: { id: "sec-perfume", nav: "本命", title: "本命香水" },
  personality: { id: "sec-personality", nav: "性格", title: "性格解读" },
  philosophy: { id: "sec-philosophy", nav: "用香", title: "用香哲学" },
  preference: { id: "sec-preference", nav: "偏好", title: "香调偏好" },
  relation: { id: "sec-relation", nav: "关系", title: "关系解读" },
  hidden: { id: "sec-hidden", nav: "隐藏", title: "你不知道的自己" },
  // 标题就叫「反差香」，导航必须换词，否则同屏出现两个「反差香」
  contrast: { id: "sec-contrast", nav: "反差", title: "反差香" },
  blueprint: { id: "sec-blueprint", nav: "底稿", title: "气味底稿" },
} as const;

export type SectionKey = keyof typeof SECTIONS;

/** 页面自上而下的顺序（导航与阅读顺序一致） */
export const SECTION_ORDER: SectionKey[] = [
  "spectrum",
  "perfume",
  "personality",
  "philosophy",
  "preference",
  "relation",
  "hidden",
  "contrast",
  "blueprint",
];

// ── 断言：在模块加载时就把「重复」拦下来，而不是等用户看见 ──
// 注意：`as const` 让 nav / title 成为字面量类型，直接比较会被 TS 判为「无交集、永远不等」而报错。
// 那是类型层面的结论（当前确实没人重复），但断言是给**将来**用的 —— 所以先放宽成 string 再比。
{
  const navs: string[] = SECTION_ORDER.map((k) => SECTIONS[k].nav as string);
  const dupNav = navs.filter((n, i) => navs.indexOf(n) !== i);
  if (dupNav.length) {
    throw new Error(`[resultSections] 导航短名重复：${[...new Set(dupNav)].join("、")}`);
  }
  const sameAsTitle = SECTION_ORDER.filter(
    (k) => (SECTIONS[k].nav as string) === (SECTIONS[k].title as string),
  );
  if (sameAsTitle.length) {
    throw new Error(
      `[resultSections] 导航短名与章节标题完全相同（用户会看到两次同一个词）：` +
        sameAsTitle.map((k) => `「${SECTIONS[k].title}」`).join("、"),
    );
  }
  const ids: string[] = SECTION_ORDER.map((k) => SECTIONS[k].id as string);
  if (new Set(ids).size !== ids.length) {
    throw new Error("[resultSections] 锚点 id 重复");
  }
}
