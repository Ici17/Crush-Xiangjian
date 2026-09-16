// 付费链路与「限时免费」窗口自检（地基①②）。
// 重点：删掉 ?paid= 后门后，解锁只能来自持久化档位；storage key 升到 v2 作废旧白嫖标记。
const pass: string[] = [];
const fail: string[] = [];
const warn: string[] = [];
const ck = (cond: boolean, label: string, detail = "") => {
  (cond ? pass : fail).push(`${cond ? "✅" : "❌"} ${label}${detail ? "  — " + detail : ""}`);
};

async function main() {
  const store = new Map<string, string>();
  (globalThis as unknown as { window: unknown }).window = {};
  (globalThis as unknown as { localStorage: unknown }).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
  };

  const pay = await import("../lib/payment");

  // ── 1. storage key 版本 ──────────────────────────────
  console.log("PAID_STORAGE_KEY =", pay.PAID_STORAGE_KEY);
  ck(pay.PAID_STORAGE_KEY === "crushxiangjian_paid_v2", "解锁标记已升到 v2");

  // 旧 key 写入白嫖标记，不应该被读到
  store.set("crushxiangjian_paid", "3");
  store.set("crushxiangjian_paid_level", "3");
  ck(pay.getPaidLevel() === 0, "旧 key 的残留白嫖标记已失效",
     `读到 ${pay.getPaidLevel()}`);

  // ── 2. 档位只升不降 ─────────────────────────────────
  pay.markPaid("unlockDiscounted");            // level 2
  ck(pay.getPaidLevel() === 2, "购买裂变档后 level=2", `实际 ${pay.getPaidLevel()}`);
  pay.markPaid("unlockFull");                  // level 3
  ck(pay.getPaidLevel() === 3, "再购完整档后 level=3", `实际 ${pay.getPaidLevel()}`);
  pay.markPaid("unlockDiscounted");            // 不应降级
  ck(pay.getPaidLevel() === 3, "重复购买低价档不会降级", `实际 ${pay.getPaidLevel()}`);

  // ── 3. 容错 ─────────────────────────────────────────
  store.set(pay.PAID_STORAGE_KEY, "abc");
  ck(pay.getPaidLevel() === 0, "非法存储值安全回退 0", `实际 ${pay.getPaidLevel()}`);
  store.set(pay.PAID_STORAGE_KEY, "3");
  ck(pay.hasPaid(2) === true, "hasPaid(2) 为真");
  ck(pay.hasPaid(4) === false, "hasPaid(4) 为假");

  // ── 4. 无 window（SSR）时不得抛错 ────────────────────
  const savedWin = (globalThis as unknown as { window: unknown }).window;
  const savedLs = (globalThis as unknown as { localStorage: unknown }).localStorage;
  delete (globalThis as unknown as { window?: unknown }).window;
  delete (globalThis as unknown as { localStorage?: unknown }).localStorage;
  ck(pay.getPaidLevel() === 0, "SSR（无 window）下 getPaidLevel 返回 0 不抛错");
  ck(pay.isPromoFree() === false, "SSR 下 isPromoFree 返回 false（避免水合不一致）");
  (globalThis as unknown as { window: unknown }).window = savedWin;
  (globalThis as unknown as { localStorage: unknown }).localStorage = savedLs;

  // ── 5. 限时免费窗口 ─────────────────────────────────
  const end = new Date(pay.LIMITED_FREE.endTime).getTime();
  const days = (end - Date.now()) / 86400000;
  console.log(`限时免费截止 = ${pay.LIMITED_FREE.endTime}  剩余 ${days.toFixed(1)} 天`);
  ck(Number.isFinite(end), "endTime 可被正确解析");
  ck(days > 0, "活动尚未过期");
  ck(days >= 20 && days <= 90, "窗口长度合理（20-90 天滚动）",
     `实际 ${days.toFixed(1)} 天${days > 90 ? " → 又变成长期零收入承诺" : ""}`);
  ck(pay.isPromoFree() === true, "活动期内 isPromoFree 为真");

  // ── 6. 倒计时格式化 ─────────────────────────────────
  ck(pay.formatPromoRemaining(0) === "已结束", "0 毫秒 → 已结束");
  ck(pay.formatPromoRemaining(-1) === "已结束", "负数 → 已结束");
  ck(pay.formatPromoRemaining(3 * 86400000 + 5 * 3600000) === "3 天 5 小时",
     "天+小时格式", pay.formatPromoRemaining(3 * 86400000 + 5 * 3600000));
  ck(pay.formatPromoRemaining(5 * 3600000 + 20 * 60000) === "5 小时 20 分",
     "小时+分格式", pay.formatPromoRemaining(5 * 3600000 + 20 * 60000));
  ck(pay.formatPromoRemaining(42 * 60000) === "42 分",
     "仅分钟格式", pay.formatPromoRemaining(42 * 60000));

  // ── 7. 价格配置 ─────────────────────────────────────
  const cfg = pay.PRICE_CONFIG;
  ck(cfg.unlockDiscounted.amount === 2090 && cfg.unlockDiscounted.level === 2,
     "裂变档 ¥20.9 / level 2");
  ck(cfg.unlockFull.amount === 2990 && cfg.unlockFull.level === 3,
     "主推档 ¥29.9 / level 3");
  ck(cfg.unlockFull.amount < cfg.unlockFull.originalAmount, "主推档锚定原价高于实价");

  // ── 8. 支付接口未接通（预期行为，不是 bug）────────────
  const r = await pay.initiatePayment({ priceKey: "unlockFull" });
  ck(r.ok === false, "支付通道仍是未接通状态（符合预期，非缺陷）");

  console.log("\n════════ 结果 ════════");
  pass.forEach((l) => console.log(l));
  warn.forEach((l) => console.log(l));
  fail.forEach((l) => console.log(l));
  console.log(`\n通过 ${pass.length} / 失败 ${fail.length} / 提醒 ${warn.length}`);
  if (fail.length > 0) process.exitCode = 1;
}

main();
