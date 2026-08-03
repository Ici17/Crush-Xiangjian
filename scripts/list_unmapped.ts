// 列出未被 INGREDIENT_MAP 覆盖的香料名
// 运行: npm run list:unmapped
import { PERFUMES } from "../lib/data";
import { INGREDIENT_MAP } from "../lib/matchPerfumes";

const mapKeys = Object.keys(INGREDIENT_MAP);

// 收集所有 note
const allNotes = new Set<string>();
for (const p of Object.values(PERFUMES)) {
  for (const layer of ["top", "heart", "base"] as const) {
    for (const note of p.notes[layer]) {
      allNotes.add(note);
    }
  }
}

// 确定是否被关键词覆盖（substring 匹配）
const unmapped: string[] = [];
for (const note of allNotes) {
  const mapped = mapKeys.some((kw) => note.includes(kw));
  if (!mapped) unmapped.push(note);
}

unmapped.sort((a, b) => a.localeCompare(b, "zh"));

console.log(`总香料名: ${allNotes.size}`);
console.log(`已映射:   ${allNotes.size - unmapped.length}`);
console.log(`未映射:   ${unmapped.length}`);
console.log("── 未映射列表 ──");
for (const n of unmapped) {
  console.log(`  ${n}`);
}
