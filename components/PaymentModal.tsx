"use client";

import { useState, useEffect } from "react";
import { isWechatBrowser, PRICE_CONFIG, type PriceKey } from "@/lib/payment";

/** Waffo 产品 ID 映射（Waffo 后台创建产品后填入）*/
export const WAFFO_PRODUCT_MAP: Record<PriceKey, string> = {
  unlockDiscounted: process.env.NEXT_PUBLIC_WAFFO_PRODUCT_DISCOUNTED ?? "",
  unlockFull: process.env.NEXT_PUBLIC_WAFFO_PRODUCT_FULL ?? "",
  subscriptionBox: process.env.NEXT_PUBLIC_WAFFO_PRODUCT_SUBSCRIPTION ?? "",
};

export type PaymentContext = 'full' | 'perfume' | 'preference' | 'subscription';

interface PaymentModalProps {
  priceKey: PriceKey;
  context?: PaymentContext;
  onSuccess: (priceKey: PriceKey) => void;
  onClose: () => void;
}

/** Waffo 结账弹窗：创建 Checkout Session → 跳转收银台 → 支付后返回验单 */
const CONTEXT_COPY: Record<PaymentContext, { title: string; subtitle: string; benefits: string[]; cta: string }> = {
  full: {
    title: '解锁完整版',
    subtitle: '完整报告 · 6 大模块全部解锁',
    benefits: ['隐藏人格面', '反差香推荐', '气味底稿', '用香哲学', '关系解读全篇', '朋友契合度'],
    cta: '去支付',
  },
  perfume: {
    title: '查看完整香调档案',
    subtitle: '3 支本命香水的前中后调、品牌故事与适配场景',
    benefits: ['3 支本命香水完整档案', '前调 · 中调 · 后调解析', '每支香的用香场景', '品牌灵感与香材故事'],
    cta: '解锁查看',
  },
  preference: {
    title: '获取专属用香指南',
    subtitle: '基于你的香气人格 × 雷达偏好，生成 4 个具体用香方向',
    benefits: ['你的香气舒适区分析', '进阶探索方向', '约会 / 办公 / 旅行场景建议', '与本命香的搭配逻辑'],
    cta: '解锁指南',
  },
  subscription: {
    title: '领取一次性香气盒',
    subtitle: '为你甄选一支 15ml 小众孤香小样，一次寄到家，无自动续费',
    benefits: ['依人格甄选小众香', '私享之选不入俗流', '专属香方启封'],
    cta: '去支付',
  },
};

export default function PaymentModal({ priceKey, context = 'full', onSuccess, onClose }: PaymentModalProps) {
  const config = PRICE_CONFIG[priceKey];
  const ctx = CONTEXT_COPY[context];
  const amountYuan = (config.amount / 100).toFixed(1);
  const originalYuan = (config.originalAmount / 100).toFixed(1);
  const inWechat = isWechatBrowser();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const productId = WAFFO_PRODUCT_MAP[priceKey];

  // 点击「去支付」→ 创建 Waffo Checkout Session → 跳转
  const handleCheckout = async () => {
    if (!productId) {
      setError("产品未配置（请联系管理员）");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          currency: "CNY",
          metadata: {
            priceKey,
            // 支付成功后返回到结果页，带上 orderId 和 priceKey
            returnUrl: `${window.location.origin}/result`,
          },
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.checkoutUrl) {
        throw new Error(data.error ?? "创建订单失败");
      }

      // 跳转到 Waffo 托管收银台
      window.location.href = data.checkoutUrl;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "下单失败，请重试";
      setError(msg);
      setLoading(false);
    }
  };

  // 微信内打开：提示用浏览器打开（Waffo CNY 支持微信支付，但需在微信浏览器外跳转）
  if (inWechat) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label={`支付 ${config.label}`}
      >
        <div
          className="w-full max-w-[440px] bg-cream rounded-t-3xl p-6 pb-8"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-serif font-bold text-amber-950 text-lg">{ctx.title}</h3>
            <button
              onClick={onClose}
              className="text-amber-500 text-2xl leading-none w-8 h-8 flex items-center justify-center"
              aria-label="关闭"
            >
              ×
            </button>
          </div>
          <p className="text-amber-600 text-xs mb-4 leading-relaxed">{ctx.subtitle}</p>
          <div className="py-6 text-center">
            <div className="text-4xl mb-3">↗</div>
            <p className="text-amber-800 text-sm leading-relaxed">
              请点击右上角 <span className="font-bold">···</span> →{" "}
              <span className="font-bold">在浏览器打开</span>
              <br />
              即可使用微信支付
            </p>
            <button
              onClick={onClose}
              className="mt-6 px-5 py-2.5 rounded-full bg-amber-100 text-amber-800 text-sm"
            >
              我知道了
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`支付 ${config.label}`}
    >
      <div
        className="w-full max-w-[440px] bg-cream rounded-t-3xl p-6 pb-8 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif font-bold text-amber-950 text-lg">{ctx.title}</h3>
          <button
            onClick={onClose}
            className="text-amber-500 text-2xl leading-none w-8 h-8 flex items-center justify-center"
            aria-label="关闭"
          >
            ×
          </button>
        </div>

        <p className="text-amber-600 text-xs mb-4 leading-relaxed">{ctx.subtitle}</p>

        {/* 价格展示 */}
        <div className="mb-4 flex items-baseline gap-2">
          <span className="font-serif font-bold text-amber-950" style={{ fontSize: '36px' }}>
            ¥{amountYuan}
          </span>
          {config.originalAmount > config.amount && (
            <span className="text-amber-400 text-sm line-through">¥{originalYuan}</span>
          )}
        </div>

        {/* 权益清单 */}
        <ul className="mb-5 space-y-2">
          {ctx.benefits.map((item) => (
            <li key={item} className="flex items-start gap-2 text-amber-800 text-sm">
              <span className="text-amber-600 font-bold" aria-hidden>✓</span>
              {item}
            </li>
          ))}
        </ul>

        {/* 错误提示 */}
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* CTA */}
        <button
          type="button"
          onClick={handleCheckout}
          disabled={loading}
          className="w-full rounded-full py-4 font-semibold text-base text-amber-50 disabled:opacity-60"
          style={{
            background: "linear-gradient(135deg, #b45309, #92400e)",
            fontSize: "16px",
          }}
        >
          {loading ? "跳转支付中…" : `¥${amountYuan} ${ctx.cta}`}
        </button>

        <p className="text-amber-500 text-xs text-center mt-3 leading-relaxed">
          跳转至 Waffo 安全收银台 · 支持微信 / 支付宝 / 银行卡
        </p>

        <button
          type="button"
          onClick={onClose}
          className="w-full text-amber-500 text-sm py-2 mt-2"
        >
          取消
        </button>

        {/* 信任标识 */}
        <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-amber-100">
          <span className="text-amber-400 text-[11px]">🔒 支付安全</span>
          <span className="text-amber-400 text-[11px]">💳 合规通道</span>
          <span className="text-amber-400 text-[11px]">📧 7日无忧</span>
        </div>
      </div>
    </div>
  );
}
