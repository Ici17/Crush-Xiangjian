/**
 * 全站页脚（精简版）
 * 按要求已移除：定价说明、联系方式、服务条款 / 隐私政策入口。
 * 仅保留版权信息。如需恢复，从下方注释块还原即可。
 */
export default function SiteFooter() {
  return (
    <footer
      aria-label="页脚"
      className="mt-20 border-t border-amber-200/70 bg-[#FAF3EA]"
      style={{ fontFamily: "Noto Sans SC, sans-serif" }}
    >
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="text-center text-[12px] text-amber-700/70">
          © 2026 Crush 香鉴 · crushxiangjian.com · 保留所有权利
        </div>
      </div>
    </footer>
  );
}
