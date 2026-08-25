import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "服务条款 | Crush香鉴",
  description:
    "Crush香鉴 服务条款。本服务面向 18 岁及以上用户免费提供香气人格测试,并提供可选的完整版内容解锁。",
};

export default function TermsPage() {
  return (
    <main
      className="mx-auto max-w-3xl px-6 py-12"
      style={{ fontFamily: "Noto Serif SC, serif", color: "#3D2817" }}
    >
      <h1 className="text-3xl font-semibold mb-2">服务条款</h1>
      <p className="text-sm text-amber-700/80 mb-10">
        最后更新:2026 年 8 月 25 日 · 生效日期:2026 年 8 月 25 日
      </p>

      <Section title="1. 服务概述">
        Crush 香鉴(以下简称"本服务")由 Crush 香鉴运营团队提供,是一款面向中文用户的
        香气人格测试工具。本服务免费提供 16 型香气人格测试、雷达图、好友匹配与分享图
        生成;同时提供可选的「完整版解锁」付费内容。
      </Section>

      <Section title="2. 使用资格">
        本服务面向 <strong>18 周岁及以上</strong>的用户。未成年人请在监护人陪同下使用。
        使用本服务即视为您已阅读并同意本条款与《
        <Link href="/privacy" className="underline">
          隐私政策
        </Link>
        》。
      </Section>

      <Section title="3. 免费内容与付费内容">
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>免费内容</strong>:人格测试、雷达图、本命香方向推荐、好友匹配、分享图生成。
          </li>
          <li>
            <strong>付费内容</strong>:完整版解锁(隐藏人格面、反差香、气味底稿、关系解读等)。
            当前为「限时免费」活动期,全部模块免费解锁;活动结束后将开放三档付费解锁
            (基础版 ¥6.6 / 标准版 ¥9.9 / 完整版 ¥59.9,具体价格以页面实际展示为准),
            支付完成后立即解锁,无自动续费。小程序端付费将经由微信虚拟支付完成,遵循微信平台规则。
          </li>
          <li>
            所有付费内容一旦解锁或领取生效,<strong>不提供无理由退款</strong>,但您可在
            7 天内因技术故障(页面无法正常显示、支付成功但未解锁等)联系客服全额退款。
          </li>
        </ul>
      </Section>

      <Section title="4. 用户行为规范">
        您承诺不以本服务从事任何违反中国法律法规的活动,不得:
        <ul className="list-disc pl-6 space-y-2 mt-2">
          <li>利用测试结果从事歧视、骚扰、侮辱他人的行为;</li>
          <li>利用分享图功能传播违法、虚假或误导性内容;</li>
          <li>对本服务进行反向工程、爬取、注入攻击或破坏性测试;</li>
          <li>冒用他人身份、伪造他人测试结果用于商业用途。</li>
        </ul>
      </Section>

      <Section title="4.1 违约责任与处置措施">
        若您违反本条款第 4 条或相关法律法规,本平台有权根据违规情节独立判断,
        采取以下一种或多种处置措施:
        <ul className="list-disc pl-6 space-y-2 mt-2">
          <li>发出警告邮件,要求限期改正;</li>
          <li>限制或暂停您使用部分功能(如分享图生成、好友匹配);</li>
          <li>暂停或终止您的付费内容访问,已支付的费用按违规情节酌情处理;</li>
          <li>封禁违规账号或设备标识(localStorage 中的测试记录);</li>
          <li>依法向主管机关报告或提起诉讼。</li>
        </ul>
        涉嫌违法犯罪的,本平台将依法移交有关主管部门,并保留追究法律责任的权利。
      </Section>

      <Section title="5. 知识产权">
        本服务的品牌、设计、文案、雷达算法、香水数据库与人格解读模型
        均归 Crush 香鉴运营团队所有。测试结果属于个人,您可在个人社交分享中自由使用,
        商业使用需事先获得书面许可。
      </Section>

      <Section title="6. 内容免责">
        本服务的香水推荐、香气人格解读、关系解读均为基于算法的
        <strong> 娱乐性参考内容</strong>,不构成医学、心理学、婚恋或投资建议。
        请理性对待测试结果。
      </Section>

      <Section title="7. 服务变更与终止">
        我们保留在合理范围内变更或中止部分功能的权利。若涉及已付费内容的重大变更,
        将提前通过站内公告或邮件告知,并提供合理替代方案。
      </Section>

      <Section title="8. 争议解决">
        本条款适用中华人民共和国大陆地区法律。如发生争议,
        双方应优先协商解决;协商不成的,提交上海仲裁委员会按其规则仲裁。
      </Section>

      <Section title="9. 联系方式">
        如对本条款有任何疑问、申诉或退订需求,请联系:
        <br />
        客服邮箱:
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