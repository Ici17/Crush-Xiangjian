import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "隐私政策 | Crush香鉴",
  description:
    "Crush香鉴 隐私政策。我们不收集账号、不读取手机号，答题与雷达数据存储在您的设备本地，支付由 Waffo 处理。",
};

export default function PrivacyPage() {
  return (
    <main
      className="mx-auto max-w-3xl px-6 py-12"
      style={{ fontFamily: "Noto Serif SC, serif", color: "#3D2817" }}
    >
      <h1 className="text-3xl font-semibold mb-2">隐私政策</h1>
      <p className="text-sm text-amber-700/80 mb-10">
        最后更新：2026 年 8 月 6 日 · 生效日期：2026 年 8 月 6 日
      </p>

      <Section title="概述">
        Crush 香鉴（以下简称"我们"）尊重并保护您的隐私。
        <strong className="text-amber-900">
          本服务不要求注册账号，不读取您的手机号、通讯录、地理位置或设备标识符。
        </strong>
        您的测试答题、雷达数据、好友邀请状态默认存储在您的浏览器本地（localStorage），
        我们无法访问、也不会上传到我们的服务器。
      </Section>

      <Section title="1. 我们收集的数据">
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>答题与雷达数据</strong>：仅存储在您的浏览器 localStorage，
            清除浏览器数据会一并清除。我们不收集原始答题内容到服务器。
          </li>
          <li>
            <strong>分享图生成</strong>：完全在您的浏览器内由 html2canvas 生成，
            图片不经过我们的服务器中转。
          </li>
          <li>
            <strong>支付信息</strong>：当您选择解锁或领取一次性香气盒时，付款流程由
            <strong> Waffo Pancake</strong> 处理；我们仅接收支付结果（订单状态 + 档位）
            用于解锁内容，<strong>不接触您的银行卡、支付密码或账单明细</strong>。
          </li>
          <li>
            <strong>客服沟通</strong>：您主动发邮件给我们时，我们仅保留您提供的邮箱
            与沟通内容，用于回复与售后，不会用于营销。
          </li>
        </ul>
      </Section>

      <Section title="2. 我们不收集的数据">
        为避免误解，特别声明以下数据我们<strong>不收集</strong>：
        姓名、手机号、身份证号、人脸、指纹、地理位置（GPS/IP 定位）、
        通讯录、相册、麦克风/摄像头内容、设备 IMEI / IDFA / OpenID、
        任何来自您第三方账号的关联信息。
      </Section>

      <Section title="3. 第三方共享">
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>支付</strong>：Waffo Pancake（api.waffo.ai）— 仅在您点击「去支付」时，
            您的浏览器跳转到 Waffo 收银台，由 Waffo 处理支付；我们不接收卡号。
          </li>
          <li>
            <strong>网站部署</strong>：Vercel（vercel.com）— 静态资源 CDN，
            仅记录访问 IP 与 User-Agent 用于反滥用与限流。
          </li>
          <li>
            <strong>字体</strong>：Google Fonts（fonts.googleapis.com）— 加载 Noto Serif/Sans SC 字体。
            Google 可能会收到您的 IP，建议在意隐私的用户使用浏览器的隐私插件拦截。
          </li>
        </ul>
        我们不会将您的任何数据出售、出租或交换给广告平台或数据中介。
      </Section>

      <Section title="4. 数据存储与保护">
        您的 localStorage 数据仅存在于您当前设备与浏览器。
        我们建议：
        <ul className="list-disc pl-6 space-y-2 mt-2">
          <li>不要在公共设备上完成测试；</li>
          <li>使用设备的锁屏密码 / 生物识别保护浏览器；</li>
          <li>退出浏览器时选择「关闭并清除」或手动清除站点数据。</li>
        </ul>
      </Section>

      <Section title="5. 用户数据权利">
        您对自己的数据拥有以下权利：
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>查阅</strong>：在浏览器 DevTools → Application → Local Storage 查看。
          </li>
          <li>
            <strong>更正</strong>：通过「重新测试」覆盖历史结果。
          </li>
          <li>
            <strong>删除</strong>：在结果页底部点击「清除我的测试记录」，或手动清除浏览器数据。
          </li>
          <li>
            <strong>导出</strong>：截图保存分享图；如需 JSON 原始数据，发邮件给我们，1 个工作日内回复。
          </li>
        </ul>
      </Section>

      <Section title="6. 未成年人">
        本服务面向 18 周岁及以上用户。我们不会主动收集未成年人信息；
        如发现未成年人使用且产生了支付，请监护人联系
        <a href="mailto:hi@crushxiangjian.com" className="underline">
          hi@crushxiangjian.com
        </a>
        ，我们将协助退款与数据清除。
      </Section>

      <Section title="7. 政策变更">
        如本政策有重大变更，我们会通过站内公告或邮件告知。继续使用本服务即视为接受
        变更后的政策。
      </Section>

      <Section title="8. 联系方式">
        关于本政策的任何疑问、申诉、数据请求，请联系：
        <br />
        客服邮箱：
        <a href="mailto:hi@crushxiangjian.com" className="underline">
          hi@crushxiangjian.com
        </a>
      </Section>

      <div className="mt-12 text-sm text-amber-700/70">
        <Link href="/" className="hover:text-amber-900 underline">
          ← 返回首页
        </Link>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-7">
      <h2 className="text-xl font-semibold mb-2 text-amber-900">{title}</h2>
      <div className="text-[15px] leading-[1.95] text-amber-900/90">{children}</div>
    </section>
  );
}