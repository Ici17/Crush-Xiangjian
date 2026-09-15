/**
 * 全站页脚
 *
 * 2026-09-16：恢复了「隐私政策 / 用户协议」入口。
 * 原先为了「纯前端零 PII」把入口摘了，但一旦接入真实支付，交易类页面的
 * 隐私政策与用户协议入口是主流平台的硬性要求（PRD 10.3 已自书这一条）。
 * /privacy 与 /terms 页面一直都在，此前属于「有页面无入口」。
 *
 * 保留：一行娱乐性参考免责声明（覆盖合规底线）。
 */
import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer
      aria-label="页脚"
      className="mt-20 border-t border-amber-200/70 bg-[#FAF3EA]"
      style={{ fontFamily: "Noto Sans SC, sans-serif" }}
    >
      <div className="mx-auto max-w-5xl px-6 py-8 space-y-2">
        <div className="text-center text-[11px] text-amber-700/60 leading-relaxed">
          本测试为娱乐性参考，不构成医学 / 心理 / 婚恋 / 投资建议
        </div>
        <div className="flex items-center justify-center gap-3 text-center text-[12px]">
          <Link
            href="/privacy"
            className="text-amber-700/70 underline decoration-amber-700/30 underline-offset-2 hover:text-amber-900 transition-colors"
          >
            隐私政策
          </Link>
          <span className="text-amber-700/40">·</span>
          <Link
            href="/terms"
            className="text-amber-700/70 underline decoration-amber-700/30 underline-offset-2 hover:text-amber-900 transition-colors"
          >
            用户协议
          </Link>
        </div>
        <div className="text-center text-[12px] text-amber-700/70">
          © 2026 Crush 香鉴 · crushxiangjian.com · 保留所有权利
        </div>
      </div>
    </footer>
  );
}
