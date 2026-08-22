/**
 * 全站页脚（精简版）
 * 按要求已移除：定价说明、联系方式、服务条款 / 隐私政策入口。
 * 保留：版权信息 + 一行娱乐性参考免责声明（覆盖合规底线，纯前端无 PII 采集）。
 * 如需恢复隐私/条款入口，从下方注释块还原即可。
 */
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
        <div className="text-center text-[12px] text-amber-700/70">
          © 2026 Crush 香鉴 · crushxiangjian.com · 保留所有权利
        </div>
      </div>
    </footer>
  );
}
