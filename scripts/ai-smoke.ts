/**
 * ai-smoke.ts —— AI 通道冒烟测试（生成管线的第一道闸）
 *
 * 为什么要单独一个脚本：
 * 离线生成一旦跑起来就是几百次请求。**先花一次请求确认通道是通的、JSON 模式可用、
 * 且能读回实际模型名**，比跑到一半才发现配置错了要省事得多。
 *
 * 它守四件事：
 *  1. env 齐全（base / key / 两个模型别名）
 *  2. 通道真的能出内容
 *  3. `response_format: json_object` 生效（生成管线全靠它拿结构化数据）
 *  4. **能读回实际模型名** —— 《暂行办法》要求公示模型名称 + 备案号，
 *     公示必须以供应商实际使用的那个为准，不能写我们以为的那个
 *
 * 用法：npx tsx scripts/ai-smoke.ts
 */

import "./_env";
import { aiConfig, chat, chatJson } from "@/lib/ai/client";

async function main() {
  console.log("══════ AI 通道冒烟测试 ══════\n");

  const cfg = aiConfig();
  console.log("A. 环境变量");
  if (!cfg.ready) {
    console.log(`  ❌ 缺少：${cfg.missing.join(" / ")}`);
    console.log("     → 请在 .env.local 里补齐（该文件已被 .gitignore 忽略）");
    process.exit(1);
  }
  console.log(`  ✅ base  = ${cfg.base}`);
  console.log(`  ✅ fast  = ${cfg.fast}`);
  console.log(`  ✅ smart = ${cfg.smart}`);
  console.log("  ✅ key 已配置（不打印）");

  console.log("\nB. 普通文本输出");
  try {
    const r = await chat({
      model: "fast",
      system: "你是一个只输出中文短句的助手。",
      prompt: "用一句话描述「雨后的木头」是什么气味。不超过 20 字。",
      maxTokens: 120,
    });
    console.log(`  ✅ 有内容：${r.text.slice(0, 60)}`);
    console.log(`  ✅ 实际模型：${r.actualModel}`);
    if (r.usage?.totalTokens) console.log(`  ℹ️ 本次 token：${r.usage.totalTokens}`);
  } catch (e) {
    console.log(`  ❌ ${(e as Error).message}`);
    process.exit(1);
  }

  console.log("\nC. JSON 模式（生成管线依赖它拿结构化数据）");
  try {
    const r = await chatJson<{ ok: boolean; word: string }>({
      model: "fast",
      system: "你只输出 JSON，不要任何解释。",
      prompt: '输出形如 {"ok":true,"word":"木质"} 的 JSON，word 填一个香调词。',
      maxTokens: 120,
    });
    if (r.data.ok === true && typeof r.data.word === "string") {
      console.log(`  ✅ JSON 可用：${JSON.stringify(r.data)}`);
    } else {
      console.log(`  ❌ JSON 结构不对：${JSON.stringify(r.data)}`);
      process.exit(1);
    }
  } catch (e) {
    console.log(`  ❌ ${(e as Error).message}`);
    console.log("     → 若供应商不支持 response_format json_object，" +
      "生成管线需要改成「让模型用代码块包 JSON」的解析兜底");
    process.exit(1);
  }

  console.log("\n══════ 通过：通道可用 ══════");
  console.log("提示：把上面「实际模型」记进备案公示清单 —— 公示必须以它为准。");
}

main();
