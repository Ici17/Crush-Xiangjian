import { PERSONALITY_TYPES } from "@/lib/data";
import { getGuardianPerfume, GUARDIAN_PERFUME } from "@/lib/personalities";

const names = PERSONALITY_TYPES.map((t) => t.name);
console.log(`人格数: ${names.length}  映射数: ${Object.keys(GUARDIAN_PERFUME).length}`);
let allOk = true;
const used = new Map<string, string>();
console.log("人格\t守护香\t品牌\t印\t契合%\t档位");
for (const n of names) {
  const g = getGuardianPerfume(n);
  if (!g) { console.log(`${n}\t❌ 未解析`); allOk = false; continue; }
  if (used.has(g.name)) { console.log(`${n}\t⚠️ 重复: ${g.name} (也属 ${used.get(g.name)})`); allOk = false; }
  else used.set(g.name, n);
  console.log(`${n}\t${g.name}\t${g.brandCn}\t${g.seal}\t${g.match}\t${g.tier}`);
}
console.log(`\n唯一性: ${used.size === names.length ? "✅ 16 支互不重复" : "❌ 有重复"}`);
console.log(`全部解析: ${allOk ? "✅" : "❌"}`);
