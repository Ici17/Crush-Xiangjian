/**
 * Crush香鉴 - 支付配置(微信/支付宝收款二维码 + 乐观解锁)
 *
 * 付费策略：阶梯解锁 + 锚定定价
 * - ￥20.9：裂变优惠价（转发 3 人解锁，原价 ￥29.9）
 * - ￥29.9：完整版（原价 ￥59.9，限时 5 折）
 *
 * 收款方式:展示微信 / 支付宝个人收款码,用户扫码后点「我已支付」乐观解锁。
 * 无后端、无 OpenID 依赖(微信内提示用浏览器打开)。
 */

// ============================================================
// 价格配置(2 档付费架构)
// ============================================================
// 免费版:本命香 + 基础人格 + 朋友匹配 + 基础分享图(带水印)
// 完整版:全部 3 支香水 + 深度报告 + 去水印分享图 + 专属购买链接
// 裂变：转发 3 人 → ￥20.9 解锁完整版

export const PRICE_CONFIG = {
  // 档位 1:裂变优惠价(转发 3 人解锁)
  unlockDiscounted: {
    amount: 2090,
    originalAmount: 2990,
    level: 2,
    label: "完整版",
    subtitle: "转发 3 位好友解锁特惠",
    description: [
      "香气光谱 · 性格解读 · 用香哲学",
      "3 支本命香水 · 完整香调档案",
      "隐藏人格面 · 反差香 · 气味底稿",
      "香调偏好 · 关系解读 · 朋友契合度",
    ],
    badge: "省¥9",
    popular: false,
    requiresReferral: true,
    referralCount: 3,
  },
  // 档位 2:完整版(主推档位)
  unlockFull: {
    amount: 2990,
    originalAmount: 5990,
    level: 3,
    label: "完整版",
    subtitle: "一次解锁，全部内容",
    description: [
      "香气光谱 + 性格解读 + 用香哲学",
      "3 支本命香水完整香调档案",
      "隐藏人格面 · 反差香 · 气味底稿",
      "香调偏好 + 关系解读 + 朋友契合度",
    ],
    badge: "5折",
    popular: true,
    requiresReferral: false,
  },
  } as const;

export type PriceKey = keyof typeof PRICE_CONFIG;

// ============================================================
// 收款二维码配置(图片放 public/pay/ 下)
// ============================================================
// 生成方式:
// - 微信:我 → 服务 → 收付款 → 二维码收款 → 保存收款码图片 → 命名为 wechat.png
// - 支付宝:收钱 → 保存二维码 → 命名为 alipay.png
// 把图片放到 public/pay/ 目录即可自动加载;缺失时弹窗内显示占位提示。
export const PAYMENT_QR = {
  wechat: "/pay/wechat.png",
  alipay: "/pay/alipay.png",
};

// ============================================================
// 微信内浏览器检测(JSAPI 需 OpenID,本项目不接,故提示用浏览器打开)
// ============================================================
export function isWechatBrowser(): boolean {
  if (typeof window === "undefined") return false;
  return /micromessenger/i.test(navigator.userAgent);
}

// ============================================================
// 本地解锁状态(测试期无后端,客户端标记已购档位)
// ============================================================
export const PAID_STORAGE_KEY = "crushxiangjian_paid";

/** 记录已购档位(取最高 level 持久化)*/
export function markPaid(priceKey: PriceKey): void {
  if (typeof window === "undefined") return;
  const level = PRICE_CONFIG[priceKey].level;
  const prev = getPaidLevel();
  if (level > prev) {
    localStorage.setItem(PAID_STORAGE_KEY, String(level));
  }
}

/** 读取已购最高档位 level(0 = 未购)*/
export function getPaidLevel(): number {
  if (typeof window === "undefined") return 0;
  const raw = localStorage.getItem(PAID_STORAGE_KEY);
  const n = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(n) ? n : 0;
}

/** 是否已购指定档位或更高 */
export function hasPaid(level: number): boolean {
  return getPaidLevel() >= level;
}

// ============================================================
// 支付通道(预留接口:未来接入微信 / 支付宝 / Stripe)
// ============================================================
// 当前未接入任何支付服务商。点击「去支付」调用此处,返回 ok:false 时
// 付费墙显示「支付通道升级中」。未来实现:根据 provider 调对应 SDK / 后端下单。
export type PaymentProvider = "wechat" | "alipay" | "stripe";
export interface PaymentRequest {
  priceKey: PriceKey;
  provider?: PaymentProvider;
}
export interface PaymentResult {
  ok: boolean;
  orderId?: string;
}
export async function initiatePayment(_req: PaymentRequest): Promise<PaymentResult> {
  console.warn("[payment] 支付通道待接入", _req);
  return { ok: false };
}

// ============================================================
// 限时免费活动（营销开关：活动期内全部付费模块免费开放）
// ============================================================
// 用途：临时把「完整版」所有付费模块设为免费；活动到期自动恢复付费墙。
// 关闭方式：把 enabled 改为 false，或把 endTime 设为过去时间 —— 均无需改动其他代码。
export const LIMITED_FREE = {
  enabled: true,
  // 活动截止时间（北京时间，ISO 8601 含时区）。超过此刻即恢复付费墙。
  endTime: '2026-09-30T23:59:59+08:00', // 【可按需修改】限时免费截止时间
} as const;

/** 当前是否处于「限时免费」活动期（客户端安全：SSR/无 window 时返回 false，避免水合不一致） */
export function isPromoFree(): boolean {
  if (!LIMITED_FREE.enabled) return false;
  if (typeof window === 'undefined') return false;
  const end = new Date(LIMITED_FREE.endTime).getTime();
  if (!Number.isFinite(end)) return false;
  return Date.now() < end;
}

/** 限时免费剩余毫秒；非活动期返回 0 */
export function getPromoRemainingMs(): number {
  if (!LIMITED_FREE.enabled) return 0;
  const end = new Date(LIMITED_FREE.endTime).getTime();
  if (!Number.isFinite(end)) return 0;
  return Math.max(0, end - Date.now());
}

/** 把剩余毫秒格式化为「X 天 Y 小时」/「Y 小时 Z 分」/「Z 分」 */
export function formatPromoRemaining(ms: number): string {
  if (ms <= 0) return '已结束';
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days} 天 ${hours} 小时`;
  if (hours > 0) return `${hours} 小时 ${minutes} 分`;
  return `${minutes} 分`;
}
