'use client';

import { Suspense, useEffect, useState, useCallback, useMemo } from 'react';
import QRCode from 'qrcode';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  getPersonality,
  getRadarScores,
  getRecommendations,
  getDynamicRecommendations,
  getCachedDynamicRecommendations,
  getPersonalityNameFromStorage,
  getRadarScoresFromStorage,
  getPathLabelsFromStorage,
  getScentAdvice,
  getShareQuote,
  getSharePerfumeReason,
  getSimilarPersonalities,
  STORAGE_KEYS,
  TIER_META,
  type Recommendation,
  type PerfumeDetail,
} from '@/lib/personalities';
import { PERSONALITY_TYPES } from '@/lib/data';
import { useInviteStatus, setAsInviter, encodeInvite } from '@/lib/inviteState';
import PaymentModal, { type PaymentContext } from '@/components/PaymentModal';
import UnlockedContent from '@/components/UnlockedContent';
import ScarcityStrip from '@/components/ScarcityStrip';
import { markPaid, getPaidLevel, PRICE_CONFIG, type PriceKey } from '@/lib/payment';
import RadarChart from '@/components/RadarChart';
import PerfumeBottle from '@/components/PerfumeBottle';
import ShareGuideModal from '@/components/ShareGuideModal';
import { ScentPreferenceBar } from '@/components/ScentPreferenceBar';
import { clearMyTestProgress } from '@/lib/useMyTestStatus';

// 微信环境检测
function isInWeChat(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent.toLowerCase();
  return ua.includes('micromessenger');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 结果页入口（Suspense 包裹 useSearchParams）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export default function ResultPage() {
  return (
    <Suspense fallback={<ResultSkeleton />}>
      <ResultInner />
    </Suspense>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SSR 骨架屏（避免空白，Adam 反馈结果页打不开）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function ResultSkeleton() {
  return (
    <main className="bg-cream min-h-screen overflow-x-hidden relative">
      {/* 顶部占位 */}
      <div className="h-14" />

      {/* 揭晓区占位 */}
      <div className="max-w-[390px] mx-auto px-6 pt-6 pb-8">
        <div className="text-center">
          <div className="h-4 w-24 bg-amber-200/40 rounded mx-auto mb-4 animate-pulse" />
          <div className="h-10 w-32 bg-amber-300/40 rounded mx-auto mb-2 animate-pulse" />
          <div className="h-5 w-48 bg-amber-200/40 rounded mx-auto animate-pulse" />
        </div>

        {/* 雷达图占位 */}
        <div className="mt-8 flex justify-center">
          <div className="w-64 h-64 rounded-full bg-amber-100/50 animate-pulse" />
        </div>

        {/* 推荐区占位 */}
        <div className="mt-8 space-y-4">
          <div className="h-4 w-32 bg-amber-200/40 rounded animate-pulse" />
          <div className="h-24 bg-amber-100/50 rounded-xl animate-pulse" />
          <div className="h-24 bg-amber-100/50 rounded-xl animate-pulse" />
        </div>
      </div>

      {/* 底部占位 */}
      <div className="h-20" />
    </main>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 关系解读区块（锁定版与解锁版共用数据源）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function RelationAdviceSection({ personalityName }: { personalityName: string }) {
  const advice = getScentAdvice(personalityName);
  return (
    <section className="px-6 pb-10" aria-label="关系解读">
      <div className="flex items-center justify-center gap-3 mb-7">
        <span className="h-px w-6 bg-amber-400" />
        <h2 className="font-serif text-lg font-medium text-amber-950">关系解读</h2>
        <span className="h-px w-6 bg-amber-400" />
      </div>
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-white border border-amber-100 rounded-xl p-4 text-left">
          <h4 className="font-serif text-sm font-medium text-amber-950 mb-2">初次见面</h4>
          <p className="text-xs text-amber-800 leading-relaxed">
            {advice.firstMeeting}
          </p>
        </div>
        <div className="bg-white border border-amber-100 rounded-xl p-4 text-left">
          <h4 className="font-serif text-sm font-medium text-amber-950 mb-2">亲密关系</h4>
          <p className="text-xs text-amber-800 leading-relaxed">
            {advice.intimateRelation}
          </p>
        </div>
      </div>
      <p className="text-amber-800 leading-relaxed" style={{ fontSize: '14px' }}>
        <span className="font-serif font-medium text-amber-950">香气建议：</span>
        {advice.relationAdvice}
      </p>
    </section>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 结果页主体
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function ResultInner() {
  const params = useSearchParams();
  const [personalityName, setPersonalityName] = useState<string>('暗流'); // 黄金兜底人格兜底
  const [radarData, setRadarData] = useState(getRadarScores('暗流')); // 黄金兜底雷达兜底
  const [pathLabels, setPathLabels] = useState<string[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [shareHint, setShareHint] = useState('');
  const [shareLink, setShareLink] = useState('');
  const [shareQrSvg, setShareQrSvg] = useState('');
  // 分享图专用 0-100 原始雷达分数（页面其他部分仍用归一化后的 radarData）
  const [shareRadarRaw, setShareRadarRaw] = useState<Record<string, number> | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);

  // 邀请状态订阅（实时同步 canDiscount）
  const inviteStatus = useInviteStatus();
  // 有微信好友参与测试：通过邀请链接（任一方向）测完的好友计入 totalCompleted
  const hasFriend = inviteStatus.totalCompleted > 0;

  // 支付弹窗状态 + 已购档位 + 触发场景
  const [payKey, setPayKey] = useState<PriceKey | null>(null);
  const [payContext, setPayContext] = useState<PaymentContext>('full');
  const [paidLevel, setPaidLevel] = useState<number>(0);
  const [justPaid, setJustPaid] = useState(false);
  const [isDemo, setIsDemo] = useState(false);

  // 分享引导弹层状态
  const [showShareGuide, setShowShareGuide] = useState(false);

  // 重新测试
  const handleRestart = useCallback(() => {
    if (typeof window !== 'undefined') {
      if (window.confirm(`重新测试将清除当前人格「${personalityName}」，确定继续？`)) {
        clearMyTestProgress();
        window.location.href = '/question';
      }
    }
  }, [personalityName]);

  // ── 优先读 URL 参数（人格名），回退到 localStorage ──
  useEffect(() => {
    const urlName = params.get('p');
    const demoName = params.get('demo');
    if (urlName) {
      setPersonalityName(decodeURIComponent(urlName));
      setRadarData(getRadarScores(decodeURIComponent(urlName)));
      setPathLabels(getPathLabelsFromStorage());
      setIsDemo(false);
    } else if (demoName) {
      // 演示模式：预览任意人格，不污染真实邀请链
      const name = demoName === '1' || demoName === '' ? '暗流' : decodeURIComponent(demoName);
      setPersonalityName(name);
      setRadarData(getRadarScores(name));
      setPathLabels(getPathLabelsFromStorage());
      setIsDemo(true);
    } else {
      // 无 URL 参数时，读 localStorage（问卷完成跳转）
      const name = getPersonalityNameFromStorage();
      if (name) {
        setPersonalityName(name);
        setRadarData(getRadarScoresFromStorage() ?? getRadarScores(name));
        setPathLabels(getPathLabelsFromStorage());
        // 注册自己为邀请者（让朋友 B 能标记我）
        setAsInviter(name);
      }
      // 若两者皆无，保持黄金兜底「暗流」兜底
      setIsDemo(false);
    }
  }, [params]);

  // ── 支付回跳处理 ──
  // 优先顺序：Waffo 验单（?orderId） > Stripe 兼容（?paid） > 预览（?previewPaid）
  useEffect(() => {
    const orderId = params.get('orderId');
    const paid = params.get('paid');
    const previewPaid = params.get('previewPaid') === '1';

    const unlockAndClean = (level: number) => {
      if (level > 0) {
        setPaidLevel(level);
        setJustPaid(true);
        setTimeout(() => setJustPaid(false), 4000);
      }
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, '', window.location.pathname);
      }
    };

    if (orderId) {
      // Waffo 真实支付：验证订单状态后解锁
      fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.valid && data.paidLevel > 0) {
            unlockAndClean(data.paidLevel);
          }
        })
        .catch(() => {});
    } else if (paid && paid in PRICE_CONFIG) {
      // Stripe 兼容：本地乐观解锁（测试期）
      markPaid(paid as PriceKey);
      unlockAndClean(getPaidLevel());
    }

    if (previewPaid) {
      setPaidLevel(2);
      setIsDemo(true);
    } else if (!orderId && !paid) {
      // 无解锁参数时清除持久化付费标记（避免测试态的 paid_level 残留）
      if (typeof window !== 'undefined') localStorage.removeItem('crushxiangjian_paid_level');
      setPaidLevel(0);
    }
  }, [params]);

  // ── 分享链接 + 本地 SVG 二维码 + 原始 0-100 雷达分数 ──
  useEffect(() => {
    const path = `/shared?p=${encodeURIComponent(personalityName)}`;
    setShareLink(path);
    const fullUrl = `https://crushxiangjian.com${path}`;
    QRCode.toString(fullUrl, {
      type: 'svg',
      width: 200,
      margin: 2,
      color: { dark: '#3D2817', light: '#FFFFFF' },
      errorCorrectionLevel: 'M',
    }).then((svg) => setShareQrSvg(svg)).catch(() => setShareQrSvg(''));
  }, [personalityName]);

  // 读原始 0-100 雷达分数（localStorage 优先，否则从人格类型推算）
  useEffect(() => {
    // 从 localStorage 直读原始 JSON（getRadarScoresFromStorage 会除以 100，不能用）
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.RADAR_SCORES);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, number>;
        setShareRadarRaw({
          木质: parsed.woody ?? 0,
          清新: parsed.fresh ?? 0,
          东方: parsed.oriental ?? 0,
          美食: parsed.gourmand ?? 0,
          柑橘: parsed.citrus ?? 0,
          花香: parsed.floral ?? 0,
        });
        return;
      }
    } catch {}
    // fallback：从人格静态定义取（也是 0-100 原始值）
    const type = PERSONALITY_TYPES.find((t) => t.name === personalityName);
    if (type?.radarScores) {
      const r = type.radarScores;
      setShareRadarRaw({
        木质: r.woody,
        清新: r.fresh,
        东方: r.oriental,
        美食: r.gourmand,
        柑橘: r.citrus,
        花香: r.floral,
      });
    } else {
      setShareRadarRaw(null);
    }
  }, [personalityName]);

  // ── 人格揭晓动画 ──
  useEffect(() => {
    const timer = setTimeout(() => setRevealed(true), 600);
    return () => clearTimeout(timer);
  }, [personalityName]);

  // ── 复制邀请链接 ──
  const handleCopyInvite = useCallback(async () => {
    try {
      const encoded = encodeInvite(personalityName);
      const inviteUrl = `${window.location.origin}/friend?inv=${encoded}`;
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 2000);
    } catch {
      setShareHint('复制失败，请手动复制链接');
      setTimeout(() => setShareHint(''), 2000);
    }
  }, [personalityName]);

  // ── 下载分享图（html2canvas 截图 share-card）──
  const handleSaveShareImage = useCallback(() => {
    const element = document.getElementById('share-card');
    if (element) {
      import('html2canvas').then(({ default: html2canvas }) => {
        html2canvas(element, { backgroundColor: '#FAF3EA' }).then((canvas) => {
          const link = document.createElement('a');
          link.download = `crush-${personalityName}.png`;
          link.href = canvas.toDataURL('image/png');
          link.click();
        });
      });
    }
  }, [personalityName]);

  const personality = getPersonality(personalityName);

  // ── 分享意图函数（锁定/解锁统一调用）━━
  // 顺序：保存分享图（html2canvas）→ 复制邀请链接 → 弹引导弹层
  const handleShare = useCallback(async () => {
    try { handleSaveShareImage(); } catch {}
    try {
      await navigator.clipboard.writeText(shareLink);
    } catch {}
    setShowShareGuide(true);
  }, [shareLink, personalityName]);

  // 动态推荐：同步读缓存 → useEffect 异步补算
  // 优先使用校准匹配，降级为固定映射
  // 跨刷新锁定同一批 3 支：先同步读 localStorage 缓存，命中则跳过 async 调用（避免重开后换一批）
  const [recommendations, setRecommendations] = useState<readonly Recommendation[]>(() => {
    const cached = getCachedDynamicRecommendations(personalityName);
    return cached ?? getRecommendations(personalityName);
  });
  useEffect(() => {
    // 缓存命中：personalityName 不变就不重跑（保留同一批）；人格换了才覆盖
    const cached = getCachedDynamicRecommendations(personalityName);
    if (cached) {
      setRecommendations(cached);
      return;
    }
    getDynamicRecommendations(personalityName).then(setRecommendations);
  }, [personalityName]);

  // 锁定版动态 Recommendation[] → 解锁版 PerfumeDetail[] 映射
  // 目的：保留锁定版那 3 支香水，解锁后不换一批（与『同一批去模糊』承诺一致）
  const displayPerfumes = useMemo<PerfumeDetail[]>(
    () =>
      recommendations.map((r) => ({
        name: r.name,
        brand: r.brand,
        brandCn: r.brandCn,
        tier: r.tier,
        top: r.notesStructured.top,
        heart: r.notesStructured.heart,
        base: r.notesStructured.base,
        quote: r.quote,
        match: r.match,
        priceRange: r.priceRange,
        intensity: r.intensity,
        longevity: r.longevity,
        ...TIER_META[r.tier],
      })),
    [recommendations]
  );

  const discounted = inviteStatus.canDiscount;
  const currentKey: PriceKey = discounted ? 'unlockDiscounted' : 'unlockFull';
  const cfg = PRICE_CONFIG[currentKey];

  const currentPrice = (cfg.amount / 100).toFixed(1);
  const originalPrice = (cfg.originalAmount / 100).toFixed(1);
  const savePrice = ((cfg.originalAmount - cfg.amount) / 100).toFixed(1);

  return (
    <main className="app-shell">
      <div className="overflow-y-auto no-scrollbar pb-32 max-w-[430px] mx-auto">

        {/* 顶部重新测试按钮 */}
        <div className="sticky top-0 z-50 px-4 py-2 flex justify-between items-center bg-cream/80 backdrop-blur-sm border-b border-amber-100/50">
          <div className="flex items-center gap-2">
            <span className="text-amber-600 text-xs font-sans">Crush 香鉴</span>
          </div>
          <button
            onClick={handleRestart}
            className="px-3 py-1 bg-white border border-amber-200 rounded-full text-xs text-amber-600 font-sans hover:border-amber-400 transition-colors"
          >
            重新测试
          </button>
        </div>

        {/* 支付成功提示横幅 */}
        {isDemo && (
          <div
            className="sticky top-0 z-40 text-center py-1 px-4"
            style={{
              background: 'rgba(250,238,218,0.65)',
              color: '#BA7517',
              fontSize: '11px',
              backdropFilter: 'blur(4px)',
            }}
            role="status"
          >
            演示模式 · 预览数据（非真实结果）
          </div>
        )}
        {justPaid && (
          <div
            className="sticky top-0 z-40 bg-gradient-to-r from-amber-700 via-amber-600 to-amber-700 text-amber-50 text-center text-sm py-2 px-4 shadow-md shimmer"
            role="status"
            aria-live="polite"
          >
            ✦ 支付成功，已解锁完整版内容！
          </div>
        )}

        {/* ━━━ 人格揭晓区 ━━━ */}
        <section
          className="relative flex flex-col items-center justify-center text-center px-6 pt-8 pb-3.5 min-h-[200px]"
          aria-label="人格揭晓"
        >
          {paidLevel >= 2 && (
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] rounded-full"
              style={{
                background: 'radial-gradient(circle, rgba(212,165,116,0.35) 0%, transparent 65%)',
              }}
            />
          )}
          {/* 极淡香水瓶水印：为人格名提供视觉锚点 */}
          <PerfumeBottle
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 opacity-[0.06]"
            stroke="#D4A574"
          />
          <div className="relative z-10 flex flex-col items-center">
          {!revealed && (
            <p className="text-amber-700 mb-2.5" style={{ fontSize: '15px' }}>
              你的灵魂香气，正在浮现……
            </p>
          )}

          {revealed && (
            <p className="text-amber-500 uppercase tracking-[0.3em] mb-2" style={{ fontSize: '11px', fontFamily: 'Noto Sans SC, sans-serif' }} aria-hidden>
              YOUR SOUL SCENT
            </p>
          )}
          <motion.h1
            className="font-serif font-medium text-amber-950 leading-[1.1]"
            style={{ fontSize: 'clamp(2.5rem, 12vw, 40px)', letterSpacing: '0.08em' }}
            initial={{ filter: 'blur(24px)', scale: 0.95, opacity: 0 }}
            animate={
              revealed
                ? { filter: 'blur(0px)', scale: 1, opacity: 1 }
                : { filter: 'blur(24px)', scale: 0.95, opacity: 0 }
            }
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            aria-live="polite"
          >
            {personality.name}
          </motion.h1>

          {revealed && (
            <motion.p
              className="text-amber-700 mt-2.5"
              style={{ fontSize: '16px' }}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5, ease: 'easeOut' }}
            >
              {personality.tagline}
            </motion.p>
          )}
          {revealed && (
            <div className="flex items-center justify-center gap-1.5 mt-3">
              <span className="h-px w-6 bg-amber-400" />
              <span className="w-1 h-1 rounded-full bg-amber-400" />
              <span className="h-px w-6 bg-amber-400" />
            </div>
          )}
          {revealed && paidLevel >= 2 && (
            <motion.div
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium px-4 py-1.5 rounded-full bg-amber-100 text-amber-700"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.4 }}
            >
              ✦ 已解锁完整版报告
            </motion.div>
          )}
          </div>
        </section>

        {/* ━━━ 锁定态：雷达图 + 本命香水 + 免费解锁 ━━━ */}
        {paidLevel < 2 && (
          <>
            {/* ━━━ 雷达图（纳入首屏可见区）━━━ */}
            <section className="px-6 pt-6 pb-8" aria-label="香气光谱雷达图">
          <h3
            className="font-serif text-amber-950 text-center mb-1"
            style={{ fontSize: '24px' }}
          >
            你的香气光谱
          </h3>
          <p className="text-center text-amber-700 mb-4" style={{ fontSize: '13px' }}>
            六个维度，勾勒你的气质坐标。
          </p>
          <div className="flex justify-center">
            <RadarChart values={radarData} />
          </div>
          {/* 无障碍文字版 */}
          <ul className="sr-only">
            {Object.entries(radarData).map(([dim, val]) => (
              <li key={dim}>{dim}：{Math.round(val * 100)}%</li>
            ))}
          </ul>
        </section>

        {/* ━━━ 解析金句 ━━━ */}
        <div className="px-6 pb-2 text-center">
          <p className="font-serif text-amber-700/80 italic leading-7" style={{ fontSize: '14px' }}>
            「香气不是面具，是未说出口的自我。」
          </p>
        </div>

        {/* ━━━ 香气探索路径（下移至雷达图之后，保证雷达图纳入首屏）━━━ */}
        {pathLabels.length > 0 && (
          <div
            className="flex gap-2 overflow-x-auto no-scrollbar px-6 pb-3.5"
            aria-label="香气探索路径"
          >
            <span
              className="flex-none text-amber-600 self-center mr-1"
              style={{ fontSize: '12px' }}
            >
              你的香气探索路径
            </span>
            {pathLabels.map((label, index) => (
              <span
                key={index}
                className="flex-none bg-amber-100 text-amber-700 rounded-full px-3 py-1.5 whitespace-nowrap"
                style={{ fontSize: '12px' }}
              >
                {label}
              </span>
            ))}
          </div>
        )}

        {/* ━━━ 本命香水 ━━━ */}
        <section className="px-6 pt-4 pb-10" aria-label="本命香水推荐">
          <div className="flex items-center justify-center gap-3 mb-7">
            <span className="h-px w-6 bg-amber-400" />
            <h2 className="font-serif text-lg font-medium text-amber-950">本命香水</h2>
            <span className="h-px w-6 bg-amber-400" />
          </div>
          <p className="text-center text-amber-700 mb-6" style={{ fontSize: '14px' }}>
            三支香气，与你的灵魂共振。
          </p>
          <div className="flex gap-3.5 overflow-x-auto no-scrollbar px-1">
            {recommendations.map((rec) => {
              const isSignature = rec.tier === 'signature';
              const tierLabel =
                rec.tier === 'signature'
                  ? '本命香'
                  : rec.tier === 'advanced'
                  ? '进阶香'
                  : '尝试香';
              // 锁定态：signature 本命香全展示，其余 blur
              const isLocked = paidLevel < 2 && !isSignature;
              return (
                <article
                  key={`${rec.tier}-${rec.name}`}
                  className="flex-none text-center p-5 rounded-2xl relative overflow-hidden"
                  style={{
                    width: '200px',
                    background: '#FDF8F3',
                    border: isSignature
                      ? '1.5px solid #BA7517'
                      : '0.5px solid #D3D1C7',
                  }}
                  aria-label={`${tierLabel} · ${rec.name}`}
                >
                  {/* Tier 徽章 */}
                  <span
                    className="inline-block text-xs px-2.5 py-1 rounded-full mb-3"
                    style={{
                      background: isSignature ? '#FAEEDA' : '#F5EDE0',
                      color: '#8B5E3C',
                    }}
                  >
                    {tierLabel}
                  </span>

                  {rec.match > 0 && (
                    <span className="inline-block text-xs px-2 py-0.5 rounded-full ml-1.5 mb-3" style={{ background: '#F5EDE0', color: '#8B5E3C' }}>
                      匹配 {rec.match}%
                    </span>
                  )}

                  {/* 香水图（与解锁版一致：白色 SVG 瓶型）*/}
                  <div
                    className="w-full h-[120px] rounded-2xl flex items-center justify-center mb-3"
                    style={{ background: '#F5EDE0' }}
                  >
                    <PerfumeBottle
                      className="w-14 h-[90px]"
                      stroke="#5C3A24"
                    />
                  </div>

                  {/* 品牌 */}
                  <div
                    className="font-serif font-medium text-amber-950 mb-1"
                    style={{ fontSize: '16px' }}
                  >
                    {rec.brand}
                  </div>

                  {/* 香水名 */}
                  <div className="text-amber-800 mb-2" style={{ fontSize: '14px' }}>
                    {rec.name}
                  </div>

                  {/* 香调（锁定态 non-signature blur + 仅显示前调摘要）*/}
                  {isLocked ? (
                    <div className="relative mb-3">
                      <div
                        className="select-none pointer-events-none space-y-1"
                        style={{ filter: 'blur(6px)' }}
                        aria-hidden
                      >
                        <div className="text-amber-600" style={{ fontSize: '12px' }}>
                          {rec.notesStructured.top.join(' · ')} · {rec.notesStructured.heart.join(' · ')} · {rec.notesStructured.base.join(' · ')}
                        </div>
                        <div
                          className="italic text-amber-700 leading-snug"
                          style={{
                            fontSize: '13px',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {rec.quote}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setPayContext('perfume');
                          setPayKey(
                            inviteStatus.canDiscount
                              ? 'unlockDiscounted'
                              : 'unlockFull'
                          );
                        }}
                        className="absolute inset-0 flex items-center justify-center bg-amber-50/40 backdrop-blur-[1px]"
                        aria-label={`查看 ${rec.name} 的完整香调档案`}
                      >
                        <span
                          className="inline-flex items-center gap-1 bg-amber-800 text-amber-50 rounded-full px-3 py-1.5"
                          style={{ fontSize: '12px' }}
                        >
                          查看完整香调档案 →
                        </span>
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* 锁定版 signature：仅显示前调摘要 + quote，不显示价格 */}
                      <div className="text-amber-600 mb-3" style={{ fontSize: '12px' }}>
                        {rec.notesStructured.top.join(' · ')}
                      </div>
                      <div
                        className="italic text-amber-700 leading-snug"
                        style={{
                          fontSize: '13px',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {rec.quote}
                      </div>
                    </>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        {/* ━━━ 免费内容：性格解读 ━━━ */}
        <section className="px-6 pb-10" aria-label="性格解读">
          <div className="flex items-center justify-center gap-3 mb-7">
            <span className="h-px w-6 bg-amber-400" />
            <h2 className="font-serif text-lg font-medium text-amber-950">性格解读</h2>
            <span className="h-px w-6 bg-amber-400" />
          </div>
          <p className="text-amber-800" style={{ fontSize: '16px', lineHeight: 1.75 }}>
            {personality.description}
          </p>
          <div className="flex flex-wrap gap-2 mt-5">
            {personality.mbti && (
              <span className="bg-amber-100 text-amber-700 text-xs px-3 py-1.5 rounded-full">
                {personality.mbti}
              </span>
            )}
            <span className="bg-amber-100 text-amber-700 text-xs px-3 py-1.5 rounded-full">
              {personality.direction}
            </span>
          </div>
        </section>

        {/* ━━━ 免费内容：用香哲学 ━━━ */}
        <section className="px-6 pb-10" aria-label="用香哲学">
          <div className="flex items-center justify-center gap-3 mb-7">
            <span className="h-px w-6 bg-amber-400" />
            <h2 className="font-serif text-lg font-medium text-amber-950">用香哲学</h2>
            <span className="h-px w-6 bg-amber-400" />
          </div>
          <p className="text-amber-800 italic text-center" style={{ fontSize: '16px', lineHeight: 1.75 }}>
            「香气不是面具，是未说出口的自我。」闻香如识人，不在于它多贵，而在于它多像你。
          </p>
        </section>

        {/* ━━━ 免费内容：香调偏好 ━━━ */}
        <section className="px-6 pb-10" aria-label="香调偏好">
          <div className="flex items-center justify-center gap-3 mb-7">
            <span className="h-px w-6 bg-amber-400" />
            <h2 className="font-serif text-lg font-medium text-amber-950">香调偏好</h2>
            <span className="h-px w-6 bg-amber-400" />
          </div>
          {/* 6 维度数据条（始终清晰：免费内容）*/}
          <div className="mb-6">
            <ScentPreferenceBar
              data={Object.fromEntries(
                Object.entries(radarData).map(([k, v]) => [k, v > 1 ? v : v * 100])
              )}
            />
          </div>
          {/* 「推荐探索方向」解读（锁定态模糊）*/}
          <div className="relative">
            <div className="select-none pointer-events-none" style={{ filter: 'blur(5px)' }} aria-hidden>
              <h4 className="font-serif text-base font-medium text-amber-950 mb-2">推荐探索方向</h4>
              <ul className="space-y-1.5">
                <li className="text-sm text-amber-800" style={{ lineHeight: 1.7 }}>
                  · {Object.entries(radarData).sort(([, a], [, b]) => b - a)[0]?.[0]} 是你的舒适区
                </li>
                <li className="text-sm text-amber-800" style={{ lineHeight: 1.7 }}>
                  · 加一点琥珀，增加温暖感
                </li>
                <li className="text-sm text-amber-800" style={{ lineHeight: 1.7 }}>
                  · 试试皮革调，制造意外的反差
                </li>
              </ul>
            </div>
            <button
              onClick={() => {
                setPayContext('preference');
                setPayKey(inviteStatus.canDiscount ? 'unlockDiscounted' : 'unlockFull');
              }}
              className="absolute inset-0 flex items-center justify-center bg-amber-50/30 backdrop-blur-[1px] rounded-lg"
              aria-label="获取专属用香指南"
            >
              <span
                className="inline-flex items-center gap-1 bg-amber-800 text-amber-50 rounded-full px-4 py-1.5 shadow-sm"
                style={{ fontSize: '12px' }}
              >
                获取专属用香指南 →
              </span>
            </button>
          </div>
        </section>

        {/* ━━━ 免费内容：关系解读 ━━━ */}
        <RelationAdviceSection personalityName={personalityName} />

          {/* ━━━ 朋友匹配入口 ━━━ */}
          <section className="px-6 pb-8">
            <Link
              href="/friend"
              className="block rounded-2xl border border-amber-200 p-4 active:scale-[0.98] transition-transform hover:shadow-sm"
              style={{ background: 'linear-gradient(135deg, #FDF8F3, #FFF9F2)' }}
            >
              <div className="flex items-center gap-3">
                <span style={{ fontSize: '22px' }}>💫</span>
                <div className="flex-1 text-left">
                  <p className="font-serif text-amber-950" style={{ fontSize: '15px', fontWeight: 500 }}>
                    找朋友比比香气契合度
                  </p>
                  <p className="text-amber-600 mt-0.5" style={{ fontSize: '12px' }}>
                    发给 TA，一起测 → 看看你们的匹配等级
                  </p>
                </div>
                <span className="text-amber-400" style={{ fontSize: '18px' }}>→</span>
              </div>
            </Link>
          </section>
          </>
        )}

        {/* ━━━ 已解锁内容 / 付费墙（条件渲染）━━━ */}
        {paidLevel >= 2 ? (
          <UnlockedContent personalityName={personalityName} radarData={radarData} shareLink={shareLink} justPaid={justPaid} perfumes={displayPerfumes} />
        ) : (
        /* ━━━ 内联付费墙 ━━━ */
        <section className="mx-6 my-6" aria-label="解锁完整报告">
          <h4
            className="font-serif font-medium text-amber-950 mb-2 text-center"
            style={{ fontSize: '20px', letterSpacing: '0.05em' }}
          >
            完整报告
          </h4>
          <p className="text-amber-700 mb-5 text-center" style={{ fontSize: '13px', lineHeight: 1.6 }}>
            还有 4 段关于你的真相，等你解开。
          </p>

          {/* 稀缺性条：限时优惠倒计时 + 实时参与人数 */}
          <ScarcityStrip />

          {/* ── 主推卡：完整版 ── */}
          <div
            className="relative bg-cream-dark border-2 border-amber-700 rounded-3xl p-6 mb-3 overflow-hidden shadow-brand"
            role="group"
            aria-label={discounted ? '完整版 ¥20.9 已抵扣价' : '完整版 ¥29.9 限时 5 折'}
          >
            {/* 右上角徽章 */}
            <div className="absolute right-4 top-4 bg-amber-700 text-amber-50 rounded-lg px-2 py-1" style={{ fontSize: '11px' }}>
              ★ 最受欢迎
            </div>

            {discounted && (
              <div className="absolute left-5 top-4 bg-amber-700 text-amber-50 rounded-lg px-2 py-1" style={{ fontSize: '11px' }}>
                ✓ 好友已完成 · 已抵扣 ¥9
              </div>
            )}

            <h5 className="font-serif font-bold text-amber-950 text-lg text-left mt-5 mb-1">
              完整版
            </h5>
            <p className="text-amber-700 text-left mb-2" style={{ fontSize: '13px' }}>
              {discounted ? '好友测试完成，全额抵扣中' : '解锁你的灵魂香气全档案'}
            </p>

            <div className="flex items-baseline gap-2 mb-1 text-left">
              <span
                className="font-serif font-bold text-amber-950"
                style={{ fontSize: '36px' }}
                aria-label={`现价 ${currentPrice} 元`}
              >
                ¥{currentPrice}
              </span>
              <span className="text-amber-400 line-through" style={{ fontSize: '13px' }}>
                ¥{originalPrice}
              </span>
            </div>

            <span className="inline-block text-left mb-5" style={{ fontSize: '12px', fontWeight: 600, color: '#C2410C' }}>
              {discounted
                ? `已省 ¥${savePrice} · 好友测试完成自动抵扣`
                : `省 ¥${savePrice}`}
            </span>

            <ul className="text-left mb-5 space-y-2" role="list">
              {cfg.description.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-amber-800"
                  style={{ fontSize: '13px' }}
                >
                  <span className="text-amber-600 font-bold" aria-hidden>
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>

            <button
              onClick={() => {
                setPayContext('full');
                setPayKey(currentKey);
              }}
              className="w-full rounded-full font-sans font-bold text-base text-amber-50 bg-gradient-to-r from-amber-800 to-amber-900 hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98] transition-all duration-200 py-4"
              aria-label={`¥${currentPrice} 解锁完整灵魂香气报告`}
            >
              ¥{currentPrice} 解锁完整灵魂香气报告
            </button>
            <span className="block mt-2 text-xs text-amber-700 text-center">
              {discounted
                ? '好友测试完成 · 已自动抵扣'
                : '限时 5 折 · 一次解锁全部内容'}
            </span>
          </div>

          {/* ── 邀请抵扣进度 ── */}
          {!discounted && (
            <div className="bg-white border border-amber-200 rounded-2xl p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-1.5" style={{ fontSize: '13px' }}>
                  <span style={{ fontSize: '14px' }}>🎁</span>
                  <span className="font-serif font-semibold text-amber-950">
                    邀请好友享特惠
                  </span>
                </span>
                <span className="font-serif font-bold text-amber-700" style={{ fontSize: '13px' }}>
                  {inviteStatus.totalCompleted} / 3
                </span>
              </div>
              <div
                className="w-full rounded-full overflow-hidden mb-2"
                style={{ background: 'rgba(194, 65, 12, 0.12)', height: '6px' }}
                role="progressbar"
                aria-valuenow={Math.min(inviteStatus.totalCompleted, 3)}
                aria-valuemin={0}
                aria-valuemax={3}
              >
                <div
                  className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-amber-600 to-amber-800"
                  style={{
                    width: `${Math.min((inviteStatus.totalCompleted / 3) * 100, 100)}%`,
                  }}
                />
              </div>
              <p className="text-amber-700 text-left mb-3" style={{ fontSize: '12px', lineHeight: 1.6 }}>
                {inviteStatus.totalCompleted === 0 ? (
                  <>邀请 <strong className="text-amber-950">3 位</strong> 好友测试，立减 <strong className="text-amber-950">{'¥9'}</strong> → 实付 <strong className="text-amber-950">{'¥20.9'}</strong></>
                ) : (
                  <>已邀请 <strong className="text-amber-950">{inviteStatus.totalCompleted}</strong> 位，再邀请 <strong className="text-amber-950">{3 - inviteStatus.totalCompleted}</strong> 位 → 解锁 <strong className="text-amber-950">{'¥20.9'}</strong></>
                )}
              </p>
              <button
                onClick={handleCopyInvite}
                className="w-full bg-amber-50 border border-amber-700 text-amber-800 rounded-full active:scale-[0.98] transition-transform"
                style={{ fontSize: '14px', padding: '12px 0' }}
                aria-label="复制邀请链接，邀请 3 位好友测试后抵扣 9 元"
              >
                {copiedInvite
                  ? '已复制邀请链接 ✓'
                  : inviteStatus.canDiscount
                  ? '已邀请 3 位，继续分享'
                  : `立即邀请好友（${3 - inviteStatus.totalCompleted} / 3）`}
              </button>
            </div>
          )}

          {/* ── 支付信任标识（与解锁版同款：simple-icons 饱满图标 + 品牌色文字） ── */}
          <div className="mt-5 pt-4 border-t border-amber-200 flex items-center justify-center mb-2.5">
            {/* 微信支付（simple-icons 官方 path） */}
            <span className="inline-flex items-center gap-1.5" aria-label="支持微信支付">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088V8.89c-.135-.01-.27-.027-.407-.03zm-2.53 3.274c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982z" fill="#07C160"/>
              </svg>
              <span style={{ color: '#07C160', fontSize: '14px', fontWeight: 500 }}>微信支付</span>
            </span>

            {/* 竖线分隔 */}
            <span className="mx-4 block h-4 w-px bg-amber-300" aria-hidden="true" />

            {/* 支付宝（simple-icons 官方 path） */}
            <span className="inline-flex items-center gap-1.5" aria-label="支持支付宝">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M19.695 15.07c3.426 1.158 4.203 1.22 4.203 1.22V3.846c0-2.124-1.705-3.845-3.81-3.845H3.914C1.808.001.102 1.722.102 3.846v16.31c0 2.123 1.706 3.845 3.813 3.845h16.173c2.105 0 3.81-1.722 3.81-3.845v-.157s-6.19-2.602-9.315-4.119c-2.096 2.602-4.8 4.181-7.607 4.181-4.75 0-6.361-4.19-4.112-6.949.49-.602 1.324-1.175 2.617-1.497 2.025-.502 5.247.313 8.266 1.317a16.796 16.796 0 0 0 1.341-3.302H5.781v-.952h4.799V6.975H4.77v-.953h5.81V3.591s0-.409.411-.409h2.347v2.84h5.744v.951h-5.744v1.704h4.69a19.453 19.453 0 0 1-1.986 5.06c1.424.52 2.702 1.011 3.654 1.333m-13.81-2.032c-.596.06-1.71.325-2.321.869-1.83 1.608-.735 4.55 2.968 4.55 2.151 0 4.301-1.388 5.99-3.61-2.403-1.182-4.438-2.028-6.637-1.809" fill="#1677FF"/>
              </svg>
              <span style={{ color: '#1677FF', fontSize: '14px', fontWeight: 500 }}>支付宝</span>
            </span>
          </div>
          <p className="text-amber-600 text-center inline-flex items-center justify-center gap-1 w-full" style={{ fontSize: '11px' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#D97706" aria-hidden="true">
              <path d="M12 1l3.09 6.26L22 8.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 13.14 2 8.27l6.91-1.01L12 1z"/>
            </svg>
            安全加密支付 · 7 天不满意全额退款
          </p>

          <p
            className="text-amber-700/80 mt-3 leading-6 text-center"
            style={{ fontSize: '12px', fontFamily: '"Noto Serif SC", serif' }}
          >
            一份关于你的香气答案，值得被认真看见。
          </p>
        </section>
        )}
      </div>

      {/* ━━━ 分享操作 Toast ━━━ */}
      {shareHint && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-50 bg-amber-900 text-amber-50 rounded-full px-5 py-2.5 shadow-lg text-sm font-sans"
          style={{
            bottom: 'calc(78px + var(--safe-bottom))',
            animation: 'fadeIn 0.3s ease-out',
          }}
          role="status"
          aria-live="polite"
        >
          {shareHint}
        </div>
      )}

      {/* ━━━ 底部固定 CTA（智能单/双按钮）━━━ */}
      <div
        className="fixed left-0 right-0 bottom-0 px-[18px] pt-3 bg-cream/90 backdrop-blur-md border-t border-amber-100 z-10"
        style={{ paddingBottom: 'calc(12px + var(--safe-bottom))' }}
        role="toolbar"
        aria-label={hasFriend ? '分享和查看契合度' : '分享测试结果'}
      >
        {/* 有朋友参与测试：双 CTA（分享 + 契合度）；否则单分享 ━━━ */}
        {hasFriend ? (
          <div className="flex gap-3">
            <button
              onClick={handleShare}
              className="flex-1 border-none rounded-full shadow-brand text-amber-50 font-medium transition-transform duration-200 active:scale-[0.98]"
              style={{
                fontSize: '15px',
                padding: '15px 0',
                background: 'linear-gradient(135deg, #b45309, #92400e)',
              }}
              aria-label="分享你的灵魂香气"
            >
              分享你的灵魂香气 →
            </button>
            <Link
              href="/friend"
              className="flex-1 flex items-center justify-center rounded-full font-medium transition-transform duration-200 active:scale-[0.98]"
              style={{
                fontSize: '15px',
                padding: '15px 0',
                background: 'transparent',
                border: '1.5px solid #8B5E3C',
                color: '#8B5E3C',
              }}
              aria-label="查看和朋友的香气契合度"
            >
              查看契合度 →
            </Link>
          </div>
        ) : (
          /* 无朋友参与：单分享 CTA */
          <button
            onClick={handleShare}
            className="w-full border-none rounded-full shadow-brand text-amber-50 font-medium transition-transform duration-200 active:scale-[0.98]"
            style={{
              fontSize: '16px',
              padding: '16px 0',
              background: 'linear-gradient(135deg, #b45309, #92400e)',
            }}
            aria-label="分享你的灵魂香气"
          >
            分享你的灵魂香气 →
          </button>
        )}
      </div>

      {/* ━━━ 隐藏分享图卡片（html2canvas 截图源）━━━
          v2.0 升级：按设计评审重构（主视觉强化 / 100 清晰度 / 二维码品牌容器 / 统一配色） */ }
      <div id="share-card" style={{ position: 'fixed', left: '-9999px', top: 0, width: '420px', background: 'linear-gradient(160deg, #FAF3EA 0%, #FDF8F3 100%)', borderRadius: '28px', fontFamily: '"Noto Serif SC", serif', overflow: 'hidden', color: '#3D2817' }}>

        {/* ── 顶部品牌带（左对齐，删除 .com）── */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '22px 28px 0' }}>
          <p style={{ fontSize: '11px', color: '#B8612C', letterSpacing: '0.15em', textTransform: 'uppercase', margin: 0, fontWeight: 600 }}>YOUR SOUL SCENT</p>
        </div>

        {/* ── 人格徽章区（删除方块，MBTI 改胶囊标签）── */}
        <div style={{ textAlign: 'center', padding: '16px 28px 0' }}>
          <h2 style={{ fontSize: '60px', color: '#3D2817', margin: '0 0 12px', fontWeight: 700, letterSpacing: '0.04em', lineHeight: 1.05 }}>{personality.name}</h2>
          <div style={{ display: 'inline-block', background: '#F7F0E8', borderRadius: '20px', padding: '6px 16px', border: '1px solid #EBE0D7', marginBottom: '16px' }}>
            <span style={{ fontSize: '12px', color: '#6B4F3F', letterSpacing: '0.08em', fontWeight: 500 }}>{personality.mbti}</span>
          </div>
          <p style={{ fontSize: '14px', color: '#6B4F3F', margin: 0, lineHeight: 1.6 }}>{personality.tagline}</p>
        </div>

        {/* ── 扎心短句（白底卡片 + 轻投影）── */}
        <div style={{ margin: '20px 28px 0', background: '#FFFFFF', borderLeft: '3px solid #C8956B', borderRadius: '0 12px 12px 0', padding: '14px 18px', boxShadow: '0 2px 8px rgba(61,40,23,0.06)' }}>
          <p style={{ fontSize: '14px', color: '#5C4A3F', margin: 0, lineHeight: 1.7 }}>{getShareQuote(personality.name)}</p>
          <p style={{ fontSize: '10px', color: '#9E887A', margin: '8px 0 0', textAlign: 'right', letterSpacing: '0.03em' }}>— Crush 香鉴</p>
        </div>

        {/* ── 数据主角区（最高维放大 + 100 清晰度修复）── */}
        {shareRadarRaw && (() => {
          const dims = ['木质','东方','花香','美食','柑橘','清新'] as const;
          let maxDim: typeof dims[number] = dims[0];
          let maxVal = 0;
          dims.forEach(d => { const v = shareRadarRaw[d] ?? 0; if (v > maxVal) { maxVal = v; maxDim = d; } });
          const topDims = dims.map(d => ({ dim: d, v: Math.round(shareRadarRaw[d] ?? 0) })).sort((a, b) => b.v - a.v);
          return (
            <>
              {/* 主角：最高维大字号（% + 维度名 + 清晰度）*/}
              <div style={{ margin: '20px 28px 0', background: '#3D2817', borderRadius: '16px', padding: '20px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '48px', color: '#E8A86A', fontWeight: 700, lineHeight: 1 }}>{Math.round(maxVal)}</span>
                  <span style={{ fontSize: '24px', color: '#E8A86A', fontWeight: 600 }}>%</span>
                  <span style={{ fontSize: '14px', color: '#C9A87C', marginLeft: '8px', letterSpacing: '0.05em' }}>契合度</span>
                </div>
                <div style={{ fontSize: '28px', color: '#F5E6D0', fontWeight: 600, marginBottom: '10px', letterSpacing: '0.03em' }}>{maxDim}</div>
                <div style={{ height: '10px', borderRadius: '5px', background: 'rgba(245,230,208,0.15)', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${maxVal}%`, background: 'linear-gradient(90deg, #E8A86A 0%, #C8956B 100%)', borderRadius: '5px' }} />
                </div>
                <p style={{ fontSize: '10px', color: '#C9A87C', margin: '8px 0 0' }}>主型气质 · 五维独立打分 · 满分各 100</p>
              </div>
              {/* 其他5维：横向条形图 */}
              <div style={{ margin: '16px 28px 0' }}>
                {topDims.slice(1).map(({ dim, v }, idx) => (
                  <div key={dim} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: idx < 4 ? '8px' : 0 }}>
                    <span style={{ fontSize: '11px', color: '#6B4F3F', width: '36px', textAlign: 'right' }}>{dim}</span>
                    <div style={{ flex: 1, height: '6px', borderRadius: '3px', background: '#EFE6D8', position: 'relative', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${v}%`, background: '#D4C8BE', borderRadius: '3px' }} />
                    </div>
                    <span style={{ fontSize: '11px', color: '#8B7A6E', width: '28px', textAlign: 'left' }}>{v}</span>
                  </div>
                ))}
              </div>
            </>
          );
        })()}

        {/* ── 本命香 + 匹配理由 ── */}
        <div style={{ margin: '20px 28px 0', background: '#FFFFFF', borderRadius: '16px', padding: '16px 18px', border: '1px solid #EBE0D7', boxShadow: '0 2px 8px rgba(61,40,23,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ width: '20px', height: '1px', background: '#C8956B' }} />
            <span style={{ fontSize: '10px', color: '#C8956B', letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 600 }}>本命香</span>
            <span style={{ width: '20px', height: '1px', background: '#C8956B' }} />
          </div>
          <p style={{ fontSize: '16px', color: '#3D2B1F', margin: '0 0 8px', fontWeight: 600, textAlign: 'center' }}>
            <span style={{ fontWeight: 400 }}>{recommendations[0]?.brand}</span> · {recommendations[0]?.name}
          </p>
          <p style={{ fontSize: '12px', color: '#5C4A3F', margin: 0, lineHeight: 1.6, textAlign: 'center' }}>
            {getSharePerfumeReason(personality.name)}
          </p>
        </div>

        {/* ── 同类人格（实心底色标签）── */}
        {(() => {
          const similar = getSimilarPersonalities(personality.name);
          if (!similar.length) return null;
          return (
            <div style={{ margin: '16px 28px 0', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '11px', color: '#8B7A6E', whiteSpace: 'nowrap', letterSpacing: '0.03em' }}>与你气味相近</div>
              {similar.map((name, i) => (
                <div key={name} style={{ background: i === 0 ? '#3D2B1F' : '#F7F0E8', borderRadius: '14px', padding: '6px 14px', border: `1px solid ${i === 0 ? '#3D2B1F' : '#EBE0D7'}`, fontWeight: i === 0 ? 600 : 400 }}>
                  <span style={{ fontSize: '11px', color: i === 0 ? '#F5E6D0' : '#6B4F3F' }}>{name}</span>
                </div>
              ))}
            </div>
          );
        })()}

        {/* ── 底部转化区（浅米色卡片容器 + 圆角二维码）── */}
        <div style={{ margin: '20px 28px 0', background: '#F7F0E8', borderRadius: '20px', padding: '20px', border: '1px solid #EBE0D7' }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            {/* 二维码（圆角白底容器）*/}
            <div style={{ flexShrink: 0, width: '96px', height: '96px', background: '#FFFFFF', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(61,40,23,0.08)', overflow: 'hidden', padding: '6px' }}>
              {shareQrSvg ? (
                <div style={{ width: '84px', height: '84px' }} dangerouslySetInnerHTML={{ __html: shareQrSvg }} />
              ) : (
                <div style={{ fontSize: '10px', color: '#C9A87C' }}>生成中…</div>
              )}
            </div>
            {/* CTA 文字 */}
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '18px', color: '#3D2B1F', margin: '0 0 4px', fontWeight: 600, lineHeight: 1.3 }}>测测你的灵魂香气</p>
              <p style={{ fontSize: '13px', color: '#6B4F3F', margin: '0 0 8px', lineHeight: 1.5 }}>3 分钟，找到与你共振的那支香</p>
              <p style={{ fontSize: '11px', color: '#C8956B', margin: 0, letterSpacing: '0.02em' }}>长按识别 · 立即测试</p>
            </div>
          </div>
        </div>

        {/* ── 页脚 ── */}
        <p style={{ margin: '20px 28px 18px', fontSize: '11px', color: '#9E887A', textAlign: 'center', letterSpacing: '0.02em' }}>© Crush 香鉴 · 基于 12,000+ 用户香气测试</p>

      </div>

      {/* ━━━ Waffo 支付弹窗 ━━━ */}
      {payKey && (
        <PaymentModal
          priceKey={payKey}
          context={payContext}
          onSuccess={(key: PriceKey) => {
            markPaid(key);
            setPaidLevel(getPaidLevel());
            setJustPaid(true);
            setTimeout(() => setJustPaid(false), 4000);
            setPayKey(null);
          }}
          onClose={() => setPayKey(null)}
        />
      )}

      {/* ━━━ 分享引导弹层（琥珀主题）━━━ */}
      <ShareGuideModal
        isOpen={showShareGuide}
        onClose={() => setShowShareGuide(false)}
        onCopyLink={() => {
          navigator.clipboard.writeText(shareLink).catch(() => {});
          setShareHint('链接已复制 ✓');
        }}
        onSaveImage={() => {
          handleSaveShareImage();
          setShareHint('分享图已保存 ✓');
        }}
        isInWeChat={isInWeChat()}
      />
    </main>
  );
}
