// ============================================================
// 文案质量闸（生成脚本共用）
//
// 与 contentGuard 的分工：
//   contentGuard 管**合规**（迷信 / 医疗 / 财务 / 编造香调）—— 不合格就是红线，绝不能上线。
//   本模块管**质量**（复读人格一句话 / 香调词罗列成成分表）—— 合规过了也可能难看。
//
// 为什么质量也要自动化：48 条靠人眼扫不干净，而且「过闸 ≠ 能用」。
// 两条判据都来自首轮 48 条抽检的量化结果（44% 复读、均值 3.5 个香调词）。
// ============================================================

/** line2 里最多允许点到的香调词个数（再多就成成分表了） */
export const MAX_NOTE_WORDS_IN_LINE2 = 2;

/**
 * 文案里实际点到的香调词（贪心最长匹配后去重）。
 * 排序按长度降序，避免「橙」先吃掉「橙花」。
 */
export function countNoteWords(text: string, vocab: string[]): string[] {
  const sorted = [...vocab].filter(Boolean).sort((a, b) => b.length - a.length);
  let rest = text;
  const hits: string[] = [];
  for (const w of sorted) {
    let idx = rest.indexOf(w);
    if (idx < 0) continue;
    hits.push(w);
    while (idx >= 0) {
      rest = rest.slice(0, idx) + " ".repeat(w.length) + rest.slice(idx + w.length);
      idx = rest.indexOf(w);
    }
  }
  return hits;
}

/**
 * 文案是不是在复读人格一句话。
 * 判据：人格一句话按标点切段后，任意 ≥5 字的片段原样出现在文案里，或两者开头 8 字相同。
 *
 * 可传多段「不许复述」的底稿（CP 文案要同时避开两个人格的一句话）。
 */
export function echoSegments(text: string, ...sources: string[]): string[] {
  const norm = (s: string) => s.replace(/[\s，。、；：！？,.!?;:：""''（）()]/g, "");
  const t = norm(text ?? "");
  const hits: string[] = [];
  for (const src of sources) {
    if (!src) continue;
    const s = norm(src);
    for (const seg of s.split(/[，。、；：！？,.!?;:]/)) {
      const g = seg.trim();
      if (g.length >= 5 && t.includes(g)) hits.push(g);
    }
    if (t.length >= 8 && s.slice(0, 8) === t.slice(0, 8)) hits.push(s.slice(0, 8));
  }
  return [...new Set(hits)];
}
