import Link from "next/link";

/**
 * 全站页脚 — 满足 Waffo 自检：
 *   3. 客服联系方式（邮件）
 *   4. 定价摘要（免费测 + 解锁档 + 一次性香气盒）
 *   同时提供「服务条款 / 隐私政策」入口
 */
export default function SiteFooter() {
  return (
    <footer
      aria-label="页脚"
      className="mt-20 border-t border-amber-200/70 bg-[#FAF3EA]"
      style={{ fontFamily: "Noto Sans SC, sans-serif" }}
    >
      <div className="mx-auto max-w-5xl px-6 py-10">
        {/* 定价摘要 */}
        <div className="mb-8">
          <h3 className="text-amber-900 mb-3 text-[15px] font-semibold tracking-wide">
            定价说明
          </h3>
          <p className="text-amber-800/85 text-[13px] leading-[1.85]">
            Crush 香鉴提供
            <strong className="text-amber-900"> 免费的 16 型香气人格测试</strong>
            ，包含雷达图、本命香方向与好友匹配。
            若希望解锁完整版（隐藏人格面、反差香、气味底稿、关系解读），
            可选择一次性解锁：
            <strong className="text-amber-900"> ¥6.6 / ¥9.9</strong>
            ；或一次性领取香气盒（实物寄送）：
            <strong className="text-amber-900"> ¥59.9</strong>
            。支付完成后立即解锁，无自动续费。
          </p>
        </div>

        {/* 联系方式 + 链接 */}
        <div className="flex flex-col gap-6 text-[13px] text-amber-800/85 sm:flex-row sm:justify-between sm:items-start">
          <div>
            <h3 className="text-amber-900 mb-2 text-[15px] font-semibold tracking-wide">
              联系方式
            </h3>
            <p className="leading-[1.85]">
              客服邮箱：
              <a
                href="mailto:hi@crushxiangjian.com"
                className="text-amber-900 underline underline-offset-2 hover:text-amber-700"
              >
                hi@crushxiangjian.com
              </a>
              <br />
              反馈、申诉与退订请通过邮件联系，通常 1–2 个工作日内回复。
            </p>
          </div>

          <div>
            <h3 className="text-amber-900 mb-2 text-[15px] font-semibold tracking-wide">
              法律
            </h3>
            <ul className="space-y-1.5 leading-[1.85]">
              <li>
                <Link href="/terms" className="hover:text-amber-700 underline underline-offset-2">
                  服务条款
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-amber-700 underline underline-offset-2">
                  隐私政策
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* 版权 */}
        <div className="mt-8 border-t border-amber-200/70 pt-4 text-center text-[12px] text-amber-700/70">
          © 2026 Crush 香鉴 · crushxiangjian.com · 保留所有权利
        </div>
      </div>
    </footer>
  );
}