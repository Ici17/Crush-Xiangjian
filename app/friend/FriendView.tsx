"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PERSONALITY_TYPES, type PersonalityType } from "@/lib/data";
import ComparisonRadarChart from "@/components/ComparisonRadarChart";
import { calculateCompatibility, type CompatibilityResult } from "@/lib/friendMatch";
import {
  getMyPersonalityId,
  getInviterIdFromUrl,
  markInviteePending,
  encodeInvite,
  decodeInvite,
  encodeCpPair,
  decodeCpPair,
  getInviteState,
} from "@/lib/inviteState";
import { markCpLit, getCpLitCount, CP_TOTAL } from "@/lib/cpCodex";
import PersonalityIcon from "@/components/PersonalityIcon";
import RadarChart from "@/components/RadarChart";
import CpBlendCard from "@/components/CpBlendCard";
import ShareImagePreviewModal from "@/components/ShareImagePreviewModal";
import { PERSONALITY_NAME_MAP, getRadarScores, brandLabel, getRecommendations } from "@/lib/personalities";
import { saveShareCard, isWeChat } from "@/lib/saveShareImage";

/** 契合度四档解读 */
function getCompatibilityStory(score: number): { tier: string; copy: string } {
  if (score >= 75)
    return {
      tier: "气息同频",
      copy: "你们的香气频率高度共振——靠近，就像回到了该在的地方。",
    };
  if (score >= 55)
    return {
      tier: "惊喜感",
      copy: "意外调出的好味道——你们的差异里，藏着彼此最缺的那一味。",
    };
  if (score >= 42)
    return {
      tier: "新鲜感",
      copy: "闻到陌生，也闻到新鲜——你们之间，总有还没说完的香气故事。",
    };
  return {
    tier: "吸引力",
    copy: "忍不住想靠近，再靠近一点——截然不同的香调，却莫名相互吸引。",
  };
}


/** 契合度颜色 */
function getCompatibilityColor(score: number): string {
  if (score >= 80) return "#C2843A"; // amber-700
  if (score >= 60) return "#D97706"; // amber-600
  if (score >= 40) return "#92400E"; // amber-800
  return "#B45309"; // amber-700
}

/** Stagger reveal hook */
function useStaggerReveal(delayMs: number, count: number) {
  const [visible, setVisible] = useState<boolean[]>(Array(count).fill(false));
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < count; i++) {
      timers.push(
        setTimeout(() => {
          setVisible((prev) => {
            const next = [...prev];
            next[i] = true;
            return next;
          });
        }, delayMs + i * 120),
      );
    }
    return () => timers.forEach(clearTimeout);
  }, [delayMs, count]);
  return visible;
}

/** Toast 提示 */
function Toast({ message }: { message: string }) {
  return (
    <div
      className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] bg-amber-900 text-amber-50 rounded-full px-5 py-2 text-sm font-sans shadow-lg"
      style={{ animation: "fadeInDown 0.3s ease-out" }}
      aria-live="polite"
    >
      {message}
    </div>
  );
}

interface FriendViewProps {
  inviterName?: string;
}

export default function FriendView({ inviterName: initialInviterName = "" }: FriendViewProps) {
  const router = useRouter();
  const [inviterId, setInviterId] = useState<string | null>(initialInviterName || null);
  const [myTypeId, setMyTypeId] = useState<string>("");
  const [friendTypeId, setFriendTypeId] = useState<string>("");
  const [showPicker, setShowPicker] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<"me">("me");
  const [result, setResult] = useState<CompatibilityResult | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareFormat, setShareFormat] = useState<'1to1' | '3to4'>('1to1');
  const [showSharePicker, setShowSharePicker] = useState(false);
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // 微信 / iOS 预览保存：内联展示图片供用户长按保存（blob URL 由弹层关闭时释放）
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  // 「我的灵魂香气榜」名单（来自 localStorage 邀请记录）
  const [friendList, setFriendList] = useState<Array<{ name: string }>>([]);
  // ⑦ 合香双人链接：?cp=<encA>~<encB> 与 ?me=<enc>（有人称时直接进结果态）
  const [cpPair, setCpPair] = useState<[string, string] | null>(null);
  const [meId, setMeId] = useState<string | null>(null);

  // 邀请态 stagger：0=header 1=inviter 2=inviteText 3=CTA 4=secondary
  const staggerInvite = useStaggerReveal(300, 5);
  // 结果态 stagger：0=score 1=tier 2=radar 3=text-sections 4=action
  const staggerResult = useStaggerReveal(200, 5);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const inv = getInviterIdFromUrl();
    const cpRaw = sp.get('cp');
    const cp = cpRaw ? decodeCpPair(cpRaw) : null;
    const meRaw = sp.get('me');
    const me = meRaw ? decodeInvite(meRaw) : null;

    if (cp) {
      setCpPair(cp);
      if (me) {
        // 带人称：A=cp[0] 当作邀请者，me 当作「我」→ 直接进结果态
        setInviterId(cp[0]);
        markInviteePending(cp[0]);
        setMyTypeId(me);
      } else if (!inv) {
        // 仅 cp、无人称、无 inv → 合香预览态（下面单独渲染）
      }
    } else if (inv) {
      setInviterId(inv);
      markInviteePending(inv);
    } else if (initialInviterName) {
      setInviterId(initialInviterName);
      markInviteePending(initialInviterName);
    }
    const my = getMyPersonalityId();
    if (my) setMyTypeId(my);
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialInviterName]);

  // 同步朋友名单（本地邀请记录中的已完成项）
  useEffect(() => {
    if (!ready) return;
    const sync = () => {
      const { invitees } = getInviteState();
      // 只取已完成的 + 去重 + 排除掉自己
      const mine = getMyPersonalityId();
      const list = invitees
        .filter((i) => i.status === 'completed')
        .map((i) => ({ name: i.name }))
        .filter((p) => p.name !== mine);
      setFriendList(list);
    };
    sync();
    const interval = setInterval(sync, 1500);
    window.addEventListener('storage', sync);
    window.addEventListener('focus', sync);
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', sync);
      window.removeEventListener('focus', sync);
    };
  }, [ready]);

  // 调试参数：?demo=1&a=暗流&b=残温 强制渲染两人对比
  const [demoA, setDemoA] = useState<PersonalityType | null>(null);
  const [demoB, setDemoB] = useState<PersonalityType | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('demo') === '1') {
      const aRaw = sp.get('a') ?? '暗流';
      const bRaw = sp.get('b') ?? '残温';
      const aName = PERSONALITY_NAME_MAP[aRaw] || aRaw;
      const bName = PERSONALITY_NAME_MAP[bRaw] || bRaw;
      const a = PERSONALITY_TYPES.find((t) => t.name === aName) ?? null;
      const b = PERSONALITY_TYPES.find((t) => t.name === bName) ?? null;
      setDemoA(a);
      setDemoB(b);
    }
  }, []);

  const inviterType: PersonalityType | null = demoA ?? (inviterId
    ? PERSONALITY_TYPES.find((t) => t.name === inviterId) ?? null
    : null);
  const myType = demoB ?? (myTypeId
    ? PERSONALITY_TYPES.find((t) => t.id === myTypeId) ?? null
    : null);
  const friendType = friendTypeId
    ? PERSONALITY_TYPES.find((t) => t.id === friendTypeId) ?? null
    : null;

  // ⑦ 合香预览：?cp=A|B 且无人称、无邀请者
  const cpAType: PersonalityType | null = cpPair
    ? PERSONALITY_TYPES.find((t) => t.name === cpPair[0]) ?? null
    : null;
  const cpBType: PersonalityType | null = cpPair
    ? PERSONALITY_TYPES.find((t) => t.name === cpPair[1]) ?? null
    : null;
  const isCpPreview = !!(cpPair && cpAType && cpBType && !meId && !inviterId);

  // 已有测试结果时：直接算匹配
  useEffect(() => {
    if (inviterType && myType) {
      setResult(calculateCompatibility(inviterType, myType));
    } else if (!inviterType && myType && friendType) {
      setResult(calculateCompatibility(myType, friendType));
    } else {
      setResult(null);
    }
  }, [inviterType, myType, friendType]);

  const shareA = inviterType ?? myType;
  const shareB = inviterType ? myType : friendType;

  const inviteLink =
    inviterId
      ? `${typeof window !== "undefined" ? window.location.origin : ""}/friend?inv=${encodeInvite(inviterId)}`
      : null;

  // ⑦ 合香分享链接（?cp=A|B），优先于普通邀请链接
  const cpShareLink =
    cpPair && cpAType && cpBType
      ? `${typeof window !== "undefined" ? window.location.origin : ""}/friend?cp=${encodeCpPair(cpAType.name, cpBType.name)}`
      : null;

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }, []);

  // 关闭预览弹层并释放 blob URL（避免内存泄漏）
  const handleClosePreview = useCallback(() => {
    setPreviewUrl((url) => {
      if (url) URL.revokeObjectURL(url);
      return null;
    });
  }, []);

  const handleCopyInvite = useCallback(async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      showToast("邀请链接已复制 ✓");
    } catch { /* 静默 */ }
  }, [inviteLink, showToast]);

  // ⑦ 复制合香双人链接（?cp=A|B）
  const handleCopyCpShare = useCallback(async () => {
    if (!cpShareLink) return;
    try {
      await navigator.clipboard.writeText(cpShareLink);
      showToast("合香链接已复制 ✓");
    } catch { /* 静默 */ }
  }, [cpShareLink, showToast]);

  const handleCopyShareText = useCallback(() => {
    if (!result || !shareA || !shareB) return;
    const tier = getCompatibilityStory(result.score);
    const text = `测了测我们的灵魂香气，共鸣度 ${result.score}%——原来我们是「${tier.tier}」。${shareA.name} × ${shareB.name}，你也来试试？👇`;
    navigator.clipboard.writeText(text).then(() => showToast("分享文案已复制 ✓"));
  }, [result, shareA, shareB, showToast]);

  async function generateShare(format: '1to1' | '3to4') {
    if (!result || !shareA || !shareB) return;
    setShareLoading(true);
    try {
      const flatNotes = (n?: { top: string[]; heart: string[]; base: string[] }) =>
        n ? [...n.top, ...n.heart, ...n.base].join('·') : '';

      const params = new URLSearchParams({
        scene: 'friend',
        nameA: shareA.name,
        nameB: shareB.name,
        perfumeNameA: getRecommendations(shareA.name)[0].name,
        perfumeNameB: getRecommendations(shareB.name)[0].name,
        score: String(result.score),
        tier: getCompatibilityStory(result.score).tier,
        format,
        inv: encodeInvite(shareA.name),
        shared: result.sharedNotes.map(n => n.split(' ')[1]).join(','),
        story: result.story,
        notesA: flatNotes(getRecommendations(shareA.name)[0].notesStructured),
        notesB: flatNotes(getRecommendations(shareB.name)[0].notesStructured),
        brandA: brandLabel(getRecommendations(shareA.name)[0]),
        brandB: brandLabel(getRecommendations(shareB.name)[0]),
        radarA: JSON.stringify(getRadarScores(shareA.name)),
        radarB: JSON.stringify(getRadarScores(shareB.name)),
      });
      // 加 cache-buster 避免旧图缓存
      params.append('_t', String(Date.now()));
      const filename = `crush香鉴-${shareA.name}x${shareB.name}-${format}.png`;
      const r = await saveShareCard(params, filename);
      if (!r.ok) {
        showToast('分享图生成失败，请重试');
        return;
      }
      setShowSharePicker(false);
      if (r.method === 'preview' && r.url) {
        // 微信 / iOS：内联预览，用户长按保存
        setPreviewUrl(r.url);
      } else {
        // 桌面端：saveShareCard 已触发下载
        showToast(format === '1to1' ? '朋友圈分享图已保存 ✓' : '小红书分享图已保存 ✓');
      }
    } catch (e) {
      console.error('[friend] 分享图生成失败', e);
      showToast('分享图生成失败，请重试');
    } finally {
      setShareLoading(false);
    }
  }

  function pickFormatAndShare(format: '1to1' | '3to4') {
    setShareFormat(format);
    setShowSharePicker(false);
    generateShare(format);
  }

  // 有邀请者 + 双方都测过 → 结果态
  const isResultState = !!(inviterType && myType && result);
  // 有邀请者 + 我还没测 → 邀请态
  const isInviteState = !!(inviterType && !myType);
  // 无邀请态 + 人格已选 + 结果已出
  const isManualState = !!(!inviterType && myType && friendType && result);

  // ⑦ 匹配成功即点亮合香图鉴（结果态 / 合香预览态都记；合香对称双亮）
  useEffect(() => {
    if (shareA && shareB && (isResultState || isCpPreview)) {
      markCpLit(shareA.name, shareB.name);
    }
  }, [shareA?.name, shareB?.name, isResultState, isCpPreview]);

  if (!ready) {
    return (
      <main className="min-h-dvh bg-cream flex flex-col items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-4 opacity-50">🌫</div>
          <h1 className="font-serif font-semibold text-amber-900 text-xl mb-2">香气契合度</h1>
          <p className="text-amber-500/70 font-sans text-sm leading-relaxed">
            正在加载你的朋友匹配记录…
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-cream pb-36">
      <style>{`
        @keyframes fadeInDown {
          from { opacity: 0; transform: translate(-50%, -12px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        @keyframes circleReveal {
          from { stroke-dashoffset: 277; }
          to { stroke-dashoffset: var(--target-offset); }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>

      {/* Toast */}
      {toast && <Toast message={toast} />}

      {/* ── 邀请态：PRD 还原 ── */}
      {isInviteState && (
        <div className="min-h-dvh flex flex-col">
          {/* 顶部小字 */}
          <div
            className={`pt-safe-top px-5 pt-8 text-center transition-all duration-500 ${
              staggerInvite[0] ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            <p className="text-amber-400/70 font-sans text-xs tracking-widest uppercase mb-6">
              你收到了一份香气邀请
            </p>

            {/* 邀請函装饰 */}
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-amber-100 border border-amber-200 rounded-2xl flex items-center justify-center shadow-sm">
                <span className="text-3xl">✉</span>
              </div>
            </div>

            {/* 邀请人人格名 */}
            <div
              className={`mb-3 transition-all duration-500 ${
                staggerInvite[1] ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
              }`}
            >
              <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-4 py-2 mb-3">
                <PersonalityIcon name={inviterType.name} className="w-5 h-5 text-amber-600" />
                <span className="font-serif font-bold text-amber-900 text-base">{inviterType.name}</span>
              </div>
              <p className="text-amber-500/70 font-sans text-sm mb-4">{inviterType.tagline}</p>
            </div>

            {/* 引导句 */}
            <div
              className={`px-6 mb-6 transition-all duration-500 ${
                staggerInvite[2] ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
              }`}
            >
              <p className="text-amber-700 font-sans text-sm leading-relaxed mb-3">
                {inviterType.name} 想知道，
                <br />
                你们的气味，能不能走到一起。
              </p>
              <p className="text-amber-400/60 font-serif text-sm italic">
                「我和你之间，
                <br />
                隔了几种香调的距离？」
              </p>
            </div>

            {/* 主 CTA */}
            <div
              className={`px-5 transition-all duration-500 ${
                staggerInvite[3] ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
              }`}
            >
              <button
                onClick={() =>
                  router.push(
                    `/question?inv=${inviterId ? encodeInvite(inviterId) : ""}`,
                  )
                }
                className="w-full py-4 bg-amber-800 text-amber-50 rounded-full font-sans font-semibold text-base active:scale-95 transition-transform shadow-brand"
              >
                开始测试 →
              </button>
            </div>

            {/* 次级 CTA */}
            <div
              className={`px-5 mt-3 transition-all duration-500 ${
                staggerInvite[4] ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
              }`}
            >
              <button
                onClick={() => setMyTypeId(getMyPersonalityId() ?? "")}
                className="w-full py-3 text-amber-600 font-sans text-sm"
              >
                我已经测过了，查看契合度 →
              </button>
            </div>
          </div>

          {/* 底部装饰 */}
          <div className="mt-auto px-5 pb-8 text-center">
            <p className="text-amber-400/40 font-sans text-xs">
              Crush 香鉴 · 测测你们的灵魂香气
            </p>
          </div>
        </div>
      )}

      {/* ── ⑦ 合香预览态：收到一张合香卡（?cp=A|B 且无人称） ── */}
      {isCpPreview && cpAType && cpBType && (
        <div className="pb-8">
          {/* 顶部深琥珀背景 */}
          <div
            className="px-5 pt-safe-top pt-6 pb-8 text-center relative overflow-hidden"
            style={{
              background:
                'radial-gradient(ellipse 70% 50% at 50% 35%, rgba(220,160,90,0.32) 0%, rgba(122,74,46,0) 60%),' +
                'linear-gradient(180deg,#2A1810 0%,#3D2418 25%,#5C3826 55%,#9B6A47 80%,#FAF3EA 100%)',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <span
                className="text-amber-300 font-sans text-sm hover:text-amber-100 transition-colors"
                style={{ cursor: 'pointer' }}
                onClick={() => router.back()}
              >
                ← 返回
              </span>
              <span className="text-amber-300/70 font-serif text-xs tracking-widest">合香</span>
            </div>
            <p className="text-amber-200/80 font-sans text-sm mb-1">你收到一张合香卡</p>
            <p className="font-serif font-bold text-2xl text-cream mb-1">
              {cpAType.name}
              <span className="mx-1.5 text-amber-300/80">×</span>
              {cpBType.name}
            </p>
            <p className="text-amber-300/60 font-serif text-xs italic">
              你们合在一起，是什么味道？
            </p>
          </div>

          {/* 内容区 */}
          <div className="px-5 pt-6 space-y-6">
            <CpBlendCard nameA={cpAType.name} nameB={cpBType.name} footnote="来自朋友的合香邀请" />

            <button
              onClick={() => router.push(`/question?cp=${encodeCpPair(cpAType.name, cpBType.name)}`)}
              className="w-full py-3.5 bg-amber-900 text-amber-50 rounded-full font-sans font-semibold text-sm active:scale-95 transition-all"
              style={{ boxShadow: '0 4px 14px rgba(92,58,36,0.2)' }}
            >
              测测你与 TA 的合香 →
            </button>
            <p className="text-center text-amber-500/60 font-sans text-xs leading-relaxed">
              测完即解锁你与 TA 的合香，<br />并点亮你们的合香图鉴一格
            </p>
          </div>
        </div>
      )}

      {/* ── 结果态：契合度揭晓（重设：香调对比→共鸣气味→场景故事→互补解读→分享图） ── */}
      {(isResultState || isManualState) && result && shareA && shareB && (
        <div className="pb-8">
          {/* ── 顶部：深琥珀径向背景 ── */}
          <div
            className="px-5 pt-safe-top pt-6 pb-8 text-center relative overflow-hidden"
            style={{
              background:
                'radial-gradient(ellipse 70% 50% at 50% 35%, rgba(220,160,90,0.32) 0%, rgba(122,74,46,0) 60%),' +
                'linear-gradient(180deg,#2A1810 0%,#3D2418 25%,#5C3826 55%,#9B6A47 80%,#FAF3EA 100%)',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <Link href="/result" className="text-amber-300 font-sans text-sm hover:text-amber-100 transition-colors">
                ← 返回报告
              </Link>
              <span className="text-amber-300/70 font-serif text-xs tracking-widest">02</span>
            </div>

            {/* 大数字揭晓 + 双人格 + tier 胶囊 */}
            <div
              className={`transition-all duration-700 ${
                staggerResult[0] ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
              }`}
              style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
            >
              <div className="flex items-center justify-center gap-4 mb-3">
                <div className="flex flex-col items-center gap-1.5">
                  <div className="w-14 h-14 bg-amber-100/95 backdrop-blur-sm border border-amber-200 rounded-2xl flex items-center justify-center">
                    <PersonalityIcon name={shareA.name} className="w-8 h-8 text-amber-700" />
                  </div>
                  <span className="font-serif font-bold text-cream text-sm">{shareA.name}</span>
                </div>
                <span className="font-serif text-3xl text-amber-300/80 mb-5">×</span>
                <div className="flex flex-col items-center gap-1.5">
                  <div className="w-14 h-14 bg-amber-100/95 backdrop-blur-sm border border-amber-200 rounded-2xl flex items-center justify-center">
                    <PersonalityIcon name={shareB.name} className="w-8 h-8 text-amber-700" />
                  </div>
                  <span className="font-serif font-bold text-cream text-sm">{shareB.name}</span>
                </div>
              </div>

              <div className="relative w-32 h-32 mx-auto mb-3">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,225,170,0.25)" strokeWidth="6" />
                  <circle
                    cx="50" cy="50" r="44" fill="none"
                    stroke="#F8EAD9" strokeWidth="6" strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 44}`}
                    strokeDashoffset={
                      staggerResult[0]
                        ? `${2 * Math.PI * 44 * (1 - result.score / 100)}`
                        : `${2 * Math.PI * 44}`
                    }
                    style={{ transition: 'stroke-dashoffset 1400ms cubic-bezier(0.4, 0, 0.2, 1)' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-serif font-bold text-5xl text-cream" style={{ textShadow: '0 2px 12px rgba(0,0,0,0.2)' }}>
                    {staggerResult[0] ? result.score : '?'}
                  </span>
                  <span className="text-amber-200 font-sans text-xs mt-0.5">% 共鸣度</span>
                </div>
              </div>

              {staggerResult[1] && (
                <>
                  <span
                    className="inline-block text-amber-950 font-sans font-semibold text-xs rounded-full px-4 py-1.5 mb-2"
                    style={{ backgroundColor: '#F8EAD9', boxShadow: '0 4px 20px rgba(248,234,217,0.4)' }}
                  >
                    ⭐ {getCompatibilityStory(result.score).tier}
                  </span>
                  {/* M1: 超越 XX% 的测试关系 */}
                  <p className="font-sans text-amber-200/70 text-xs">
                    超越 {Math.round(result.score + 3)}% 的测试关系
                  </p>
                </>
              )}
            </div>
          </div>

          {/* ── 内容区 ── */}
          <div className="px-5 space-y-6 pt-6">

            {/* 1. 香调对比雷达 */}
            <section
              className={`transition-all duration-500 ${
                staggerResult[2] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
              }`}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-4 bg-amber-700 rounded-full" />
                <h3 className="font-serif font-semibold text-amber-900 text-sm">◆ 香调对比</h3>
              </div>
              <div className="bg-cream rounded-2xl border border-amber-100 p-4 shadow-sm">
                <ComparisonRadarChart
                  scores={shareA.radarScores}
                  compareScores={shareB.radarScores}
                  mainLabel={shareA.name}
                  compareLabel={shareB.name}
                  mainIsMe={shareA === inviterType}
                />
                <div className="flex items-center justify-center gap-6 mt-3 text-xs font-sans">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-amber-300/40 border border-amber-600/40" />
                    <span className="text-amber-700">
                      {shareA === inviterType ? `${shareA.name}（朋友）` : `${shareA.name}（你）`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-0.5 border-t border-dashed border-amber-500" />
                    <span className="text-amber-500">
                      {shareA === inviterType ? `${shareB.name}（你）` : `${shareB.name}（朋友）`}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* 2. 共鸣气味（关键词胶囊） */}
            {result.sharedNotes.length > 0 && (
              <section
                className={`transition-all duration-500 ${
                  staggerResult[3] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
                }`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-4 bg-amber-700 rounded-full" />
                  <h3 className="font-serif font-semibold text-amber-900 text-sm">◆ 共鸣气味</h3>
                </div>
                <div className="bg-cream rounded-2xl border border-amber-100 p-5 shadow-sm">
                  <p className="text-amber-700/90 font-sans text-sm mb-3">
                    你们共同偏爱：
                    {result.sharedNotes.map(n => n.split(' ')[1]).join(' · ')}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {result.sharedNotes.map((note) => (
                      <span
                        key={note}
                        className="inline-flex items-center px-3 py-1.5 bg-amber-100 border border-amber-200 rounded-full text-amber-800 font-sans text-xs"
                      >
                        {note}
                      </span>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* 3. 场景故事（斜体引用） */}
            <section
              className={`transition-all duration-500 ${
                staggerResult[3] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
              }`}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-4 bg-amber-700 rounded-full" />
                <h3 className="font-serif font-semibold text-amber-900 text-sm">◆ 场景故事</h3>
              </div>
              <div className="bg-cream rounded-2xl border border-amber-100 p-5 shadow-sm">
                <p className="text-amber-700/90 font-serif text-sm italic leading-loose">
                  {result.story}
                </p>
              </div>
            </section>

            {/* 4. 互补解读（公式：X × Y = Z） */}
            <section
              className={`transition-all duration-500 ${
                staggerResult[3] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
              }`}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-4 bg-amber-700 rounded-full" />
                <h3 className="font-serif font-semibold text-amber-900 text-sm">◆ 互补解读</h3>
              </div>
              <div className="bg-cream rounded-2xl border border-amber-100 p-5 shadow-sm text-center">
                <p className="font-serif text-amber-900 text-base mb-1">
                  你的<span className="font-bold">{shareA.name}</span>
                  <span className="mx-1.5 text-amber-400">×</span>
                  朋友的<span className="font-bold">{shareB.name}</span>
                </p>
                <p className="font-serif text-amber-700/80 text-sm mb-4">
                  = {result.score >= 75 ? '气息同频' : result.score >= 65 ? '默契成对' : result.score >= 55 ? '有趣的碰撞' : result.score >= 42 ? '气味互补' : '不同的香气世界'}
                </p>
                <p className="text-amber-700/90 font-sans text-sm leading-relaxed text-left">
                  你的<span className="font-medium">{shareA.name}</span>特质为这段关系提供定调，
                  朋友的<span className="font-medium">{shareB.name}</span>特质则打开你未曾留意的香气维度。
                  两种香气的交汇，让彼此独一无二的共鸣悄然发生。
                </p>
              </div>
            </section>

            {/* 4.5 合香卡（CP 共振核心产物） */}
            <section
              className={`transition-all duration-500 ${
                staggerResult[3] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
              }`}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-4 bg-amber-700 rounded-full" />
                <h3 className="font-serif font-semibold text-amber-900 text-sm">◆ 合香卡</h3>
              </div>
              <CpBlendCard
                nameA={shareA.name}
                nameB={shareB.name}
                onShare={() => setShowSharePicker(true)}
                footnote={cpPair ? "你与 TA 的合香" : undefined}
              />
            </section>

            {/* 5. 分享图下载 */}
            <section
              className={`transition-all duration-500 ${
                staggerResult[4] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
              }`}
            >
              {/* 主 CTA：打开比例选择 */}
              <button
                onClick={() => setShowSharePicker(true)}
                disabled={shareLoading}
                className="w-full py-3.5 bg-amber-900 text-amber-50 rounded-full font-sans font-semibold text-sm active:scale-95 transition-all disabled:opacity-50 mb-3"
                style={{ boxShadow: '0 4px 14px rgba(92,58,36,0.2)' }}
              >
                {shareLoading ? '生成中…' : '生成分享图'}
              </button>

              {/* 次要操作 */}
              <div className="flex items-center justify-center gap-4 text-xs font-sans text-amber-600/70">
                <button
                  onClick={handleCopyShareText}
                  className="hover:text-amber-900 transition-colors underline underline-offset-2"
                >
                  复制分享文案
                </button>
                <button
                  onClick={cpShareLink ? handleCopyCpShare : handleCopyInvite}
                  className="hover:text-amber-900 transition-colors underline underline-offset-2"
                >
                  {cpShareLink ? "复制合香链接" : "@好友来测默契度"}
                </button>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* ── 无邀请态：我的香气伴侣榜 ── */}
      {!inviterType && !result && (
        <div>
          {/* 顶部 */}
          <div className="bg-gradient-to-b from-amber-50 to-cream px-5 pt-safe-top pt-6 pb-5">
            <h1 className="font-serif font-medium text-amber-950" style={{ fontSize: '20px', letterSpacing: "0.05em" }}>
              朋友匹配
            </h1>
            <p className="text-amber-600/70 font-sans mt-1" style={{ fontSize: '13px' }}>
              {friendList.length > 0
                ? `已和你测过的 ${friendList.length} 位朋友 · 点开看契合度`
                : myType
                ? "邀请朋友来测，你们的契合度会出现在这里"
                : "先完成测试，再看谁与你的香气频率共振"}
            </p>
          </div>

          <div className="px-5 py-6 space-y-4">
            {/* 「我」卡片（锁定头部） */}
            <section className="card">
              <label className="font-serif font-semibold text-amber-900 text-sm mb-2 block">我的灵魂人格</label>
              {myType ? (
                <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
                  <div className="w-10 h-10 bg-white border border-amber-200 rounded-xl flex items-center justify-center">
                    <PersonalityIcon name={myType.name} className="w-6 h-6 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-serif font-bold text-amber-900">{myType.name}</p>
                    <p className="text-amber-500/70 font-sans text-xs">{myType.tagline}</p>
                  </div>
                  <span className="text-amber-400/50 font-sans text-xs">你</span>
                </div>
              ) : (
                <button
                  onClick={() => { setPickerTarget("me"); setShowPicker(true); }}
                  className="w-full py-3 px-4 border border-amber-200 bg-white rounded-xl text-amber-700 font-sans text-sm hover:border-amber-500 hover:bg-amber-50/30 transition-colors flex items-center justify-between"
                  aria-label="选择我的灵魂人格"
                >
                  <span>选择你的人格</span>
                  <span className="text-amber-400 text-xs">▾</span>
                </button>
              )}
            </section>

            {/* 「我的香气伴侣榜」：做过测试的朋友名单 */}
            {myType && (
              <section className="card">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-serif font-semibold text-amber-900 text-sm">我的香气伴侣榜</h3>
                  {friendList.length > 0 && (
                    <span className="text-amber-400/60 font-sans text-xs">{friendList.length} 位</span>
                  )}
                </div>

                {/* 名单 */}
                {friendList.length === 0 ? (
                  <div className="py-8 text-center">
                    <div className="text-4xl mb-3 opacity-40">🌫</div>
                    <p className="text-amber-500/70 font-sans text-sm mb-1">还没有朋友通过你的链接来测</p>
                    <p className="text-amber-400/50 font-sans text-xs">分享邀请，朋友测完后会出现在这里</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {friendList.map((friend) => {
                      const friendType = PERSONALITY_TYPES.find((t) => t.name === friend.name);
                      if (!friendType || !myType) return null;
                      const compat = calculateCompatibility(myType, friendType);
                      return (
                        <button
                          key={friend.name}
                          onClick={() => { setFriendTypeId(friendType.id); }}
                          className="w-full flex items-center gap-3 p-3 bg-amber-50 hover:bg-amber-100 active:scale-[0.98] rounded-xl border border-amber-200 transition-all text-left"
                        >
                          <div className="w-10 h-10 bg-white border border-amber-200 rounded-xl flex items-center justify-center flex-shrink-0">
                            <PersonalityIcon name={friendType.name} className="w-6 h-6 text-amber-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-serif font-bold text-amber-900 text-sm">
                              <span className="text-amber-500/60">{myType.name}</span>
                              <span className="mx-1 text-amber-400">×</span>
                              {friendType.name}
                            </p>
                            <p className="text-amber-500/70 font-sans text-xs truncate">{friendType.tagline}</p>
                    {compat.sharedNotes.length > 0 && (
                      <p className="text-amber-600/80 font-sans text-[11px] truncate mt-0.5">
                        共同偏爱 · {compat.sharedNotes[0].split(' ').pop()}
                      </p>
                    )}
                          </div>
                          <div className="flex flex-col items-end flex-shrink-0">
                            <span className="font-serif font-bold text-base" style={{ color: getCompatibilityColor(compat.score) }}>
                              {compat.score}%
                            </span>
                            <span className="text-amber-400/60 font-sans text-[9px] mt-0.5">共鸣度</span>
                    <span className="text-amber-800 bg-amber-100 rounded-full px-1.5 py-0.5 font-sans text-[10px] mt-1">
                      {compat.grade}
                    </span>
                          </div>
                          <span className="text-amber-400/50 ml-1">›</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {/* 「邀请朋友」动作区 */}
            {myType && (
              <>
                <button
                  onClick={handleCopyInvite}
                  disabled={!inviteLink}
                  className="w-full py-3 bg-amber-800 text-amber-50 rounded-full font-sans font-semibold text-sm active:scale-95 transition-transform shadow-brand disabled:opacity-40"
                >
                  邀请朋友来测 →
                </button>
                <Link
                  href="/codex"
                  className="block w-full py-3 text-center bg-white border border-amber-200 text-amber-700 rounded-full font-sans font-medium text-sm hover:border-amber-400 transition-colors"
                >
                  合香图鉴 · 已点亮 {getCpLitCount()}/{CP_TOTAL} →
                </Link>
              </>
            )}
          </div>

          {/* 底部引导：未测时 */}
          {!myType && (
            <div className="fixed bottom-0 left-0 right-0 bg-cream/95 backdrop-blur-md border-t border-amber-100 p-4 safe-bottom z-30">
              <Link
                href="/question"
                className="block w-full py-3 text-center bg-amber-800 text-amber-50 rounded-full font-sans font-semibold text-sm active:scale-95 transition-transform shadow-brand"
              >
                先测我的灵魂人格 →
              </Link>
            </div>
          )}
        </div>
      )}

      {/* ── 分享图比例选择器 ── */}
      {showSharePicker && (
        <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-end">
          <div
            className="bg-amber-50 w-full rounded-t-3xl p-5 safe-bottom"
            style={{ animation: "slideUp 0.3s ease-out" }}
          >
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-serif font-semibold text-amber-900 text-lg">选择分享图比例</h3>
              <button onClick={() => setShowSharePicker(false)} className="text-amber-400/60 font-sans text-sm active:scale-95 transition-transform">
                ✕ 关闭
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-2">
              <button
                onClick={() => pickFormatAndShare('1to1')}
                disabled={shareLoading}
                className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all active:scale-95 ${
                  shareFormat === '1to1'
                    ? 'bg-amber-900 border-amber-900 text-amber-50'
                    : 'bg-white border-amber-200 text-amber-900 hover:border-amber-400'
                }`}
              >
                <span className="font-serif text-2xl mb-1">□</span>
                <span className="font-sans font-semibold text-sm">1:1 朋友圈</span>
              </button>
              <button
                onClick={() => pickFormatAndShare('3to4')}
                disabled={shareLoading}
                className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all active:scale-95 ${
                  shareFormat === '3to4'
                    ? 'bg-amber-900 border-amber-900 text-amber-50'
                    : 'bg-white border-amber-200 text-amber-900 hover:border-amber-400'
                }`}
              >
                <span className="font-serif text-2xl mb-1">▯</span>
                <span className="font-sans font-semibold text-sm">3:4 小红书</span>
              </button>
            </div>
            <p className="text-center text-amber-500/60 font-sans text-xs mt-3">
              点击即可生成并保存对应尺寸
            </p>
          </div>
        </div>
      )}

      {/* ── 人格选择器（只有「我」可手动选） ── */}
      {showPicker && !inviterType && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end">
          <div
            className="bg-amber-50 w-full rounded-t-3xl p-5 safe-bottom max-h-[80vh] overflow-y-auto"
            style={{ animation: "slideUp 0.3s ease-out" }}
          >
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-serif font-semibold text-amber-900 text-lg">选择我的灵魂人格</h3>
              <button onClick={() => setShowPicker(false)} className="text-amber-400/60 font-sans text-sm active:scale-95 transition-transform">
                ✕ 关闭
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {PERSONALITY_TYPES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setMyTypeId(t.id);
                    setShowPicker(false);
                    setResult(null);
                  }}
                  className="text-left p-3 rounded-xl border border-amber-100 bg-white hover:border-amber-300 active:scale-95 transition-all flex items-start gap-2.5"
                >
                  <span className="text-amber-600 mt-0.5 flex-shrink-0">
                    <PersonalityIcon name={t.name} className="w-5 h-5" />
                  </span>
                  <span>
                    <p className="font-serif font-bold text-amber-900 text-sm leading-tight">{t.name}</p>
                    <p className="text-amber-500/70 font-sans text-xs mt-0.5 line-clamp-1">{t.tagline}</p>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── 微信 / iOS 分享图预览（长按保存） ── */}
      <ShareImagePreviewModal
        previewUrl={previewUrl}
        onClose={handleClosePreview}
        isInWeChat={isWeChat()}
      />

    </main>
  );
}