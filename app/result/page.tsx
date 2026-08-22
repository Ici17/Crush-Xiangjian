'use client';

import { Suspense, useEffect, useState, useCallback, useMemo } from 'react';
import QRCode from 'qrcode';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import MemorySceneSection from '@/components/MemorySceneSection';
import { getMemoryScene, type PerfumeSnapshot } from '@/lib/memoryScenes';
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
  getParseQuote,
  getUsagePhilosophy,
  STORAGE_KEYS,
  TIER_META,
  type Recommendation,
  type PerfumeDetail,
  PERSONALITY_NAME_MAP,
  RADAR_DIM_LABELS,
} from '@/lib/personalities';
import { PERSONALITY_TYPES } from '@/lib/data';
import { useInviteStatus, setAsInviter, encodeInvite } from '@/lib/inviteState';
import PaymentModal, { type PaymentContext } from '@/components/PaymentModal';
import UnlockedContent, { detectFamily, FAMILY_COLORS, FAMILY_BG } from '@/components/UnlockedContent';
import ScarcityStrip from '@/components/ScarcityStrip';
import { markPaid, getPaidLevel, PRICE_CONFIG, isPromoFree, formatPromoRemaining, getPromoRemainingMs, type PriceKey } from '@/lib/payment';
import RadarChart from '@/components/RadarChart';
import PerfumeBottle from '@/components/PerfumeBottle';
import GuardianScentCard from '@/components/GuardianScentCard';
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
          <h4 className="font-serif text-sm font-medium text-amber-950 mb-2">初见印象</h4>
          <p className="text-xs text-amber-800 leading-relaxed">
            {advice.firstMeeting}
          </p>
        </div>
        <div className="bg-white border border-amber-100 rounded-xl p-4 text-left">
          <h4 className="font-serif text-sm font-medium text-amber-950 mb-2">亲密时刻</h4>
          <p className="text-xs text-amber-800 leading-relaxed">
            {advice.intimateRelation}
          </p>
        </div>
      </div>
      <p className="text-amber-800 leading-relaxed" style={{ fontSize: '14px' }}>
        <span className="font-serif font-medium text-amber-950">用香建议：</span>
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
  const [showUntestedHint, setShowUntestedHint] = useState(false); // 裸开 / 无测试记录时提示示例人格
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

  // 限时免费活动态（客户端挂载后判定，避免 SSR 水合不一致）
  const [promoFree, setPromoFree] = useState(false);
  const [promoRemaining, setPromoRemaining] = useState('');
  useEffect(() => {
    if (isPromoFree()) {
      setPromoFree(true);
      const tick = () => setPromoRemaining(formatPromoRemaining(getPromoRemainingMs()));
      tick();
      const id = setInterval(tick, 60_000);
      return () => clearInterval(id);
    }
  }, []);
  // 付费 或 限时免费 任一命中 → 视为已解锁（驱动付费墙 / 模糊遮罩 / 解锁徽章）
  const unlocked = paidLevel >= 2 || promoFree;

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
      // 支持拼音 ID（如 chonglang）或中文名（如 冲浪）
      const decoded = decodeURIComponent(urlName);
      const mappedName = PERSONALITY_NAME_MAP[decoded] || decoded;
      setPersonalityName(mappedName);
      setRadarData(getRadarScores(mappedName));
      setPathLabels(getPathLabelsFromStorage());
      setIsDemo(false);
      setShowUntestedHint(false);
    } else if (demoName) {
      // 演示模式：预览任意人格，不污染真实邀请链
      const name = demoName === '1' || demoName === '' ? '暗流' : decodeURIComponent(demoName);
      setPersonalityName(name);
      setRadarData(getRadarScores(name));
      setPathLabels(getPathLabelsFromStorage());
      setIsDemo(true);
      setShowUntestedHint(false);
    } else {
      // 无 URL 参数时，读 localStorage（问卷完成跳转）
      const name = getPersonalityNameFromStorage();
      if (name) {
        setPersonalityName(name);
        setRadarData(getRadarScoresFromStorage() ?? getRadarScores(name));
        setPathLabels(getPathLabelsFromStorage());
        // 注册自己为邀请者（让朋友 B 能标记我）
        setAsInviter(name);
        setShowUntestedHint(false);
      } else {
        // 无 URL 参数、也无本地测试记录 → 裸开 / 未测试，用黄金兜底「暗流」并提示示例
        setShowUntestedHint(true);
      }
      // 若两者皆无，保持黄金兜底「暗流」兜底
      setIsDemo(false);
    }
  }, [params]);

  // ── 支付回跳处理 ──
  // 解锁参数：本地解锁（?paid）> 预览（?previewPaid）；真实支付回跳预留（未来接入）
  useEffect(() => {
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

    if (paid && paid in PRICE_CONFIG) {
      // 本地乐观解锁（测试期 / 未来支付回跳预留）
      markPaid(paid as PriceKey);
      unlockAndClean(getPaidLevel());
    }

    if (previewPaid) {
      setPaidLevel(2);
      setIsDemo(true);
    } else if (!paid) {
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

  // ── 下载分享图（服务端 API 渲染）──
  // 返回结构化结果，由调用方决定：桌面端直接下载 / 移动端微信内联预览长按保存
  type SaveResult = { ok: boolean; method: 'download' | 'preview'; url?: string; error?: string };
  const handleSaveShareImage = useCallback(async (format: '1to1' | '3to4' = '1to1'): Promise<SaveResult> => {
    if (!personalityName) return { ok: false, method: 'download', error: 'no personality' };
    // 运行时从 DOM 读当前 state，避免声明顺序问题
    const recs = recommendations; // 运行时读取，当前值
    const dims = shareRadarRaw
      ? Object.entries(shareRadarRaw).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([d]) => d)
      : [];

    // 锁定版内容（2026-08-13 改：分享图=锁定版，不含解锁内容）
    const personality = getPersonality(personalityName);
    // 香气图谱：六维雷达 0~1
    const radar: Record<string, number> = {};
    if (shareRadarRaw) {
      Object.entries(shareRadarRaw).forEach(([dim, val]) => {
        radar[dim] = Math.max(0, Math.min(1, val / 100));
      });
    }
    // 记忆点区块：基于本命香（recs[0]）
    let memoryScene: string | undefined;
    if (recs[0]) {
      const snapshot: PerfumeSnapshot = {
        name: recs[0].name,
        brand: recs[0].brand,
        notesStructured: recs[0].notesStructured,
      };
      memoryScene = getMemoryScene(personalityName, snapshot).description;
    }

    const flatNotes = (n?: { top: string[]; heart: string[]; base: string[] }) =>
      n ? [...n.top, ...n.heart, ...n.base].join('·') : '';

    const params = new URLSearchParams({
      scene: 'self', format,
      name: personalityName,
      tagline: getShareQuote(personalityName),
      perfumeA: recs[0]?.name ?? '', matchA: String(recs[0]?.match ?? 0),
      perfumeB: recs[1]?.name ?? '', matchB: String(recs[1]?.match ?? 0),
      perfumeC: recs[2]?.name ?? '', matchC: String(recs[2]?.match ?? 0),
      shared: dims.join(','),
      // 锁定版内容
      radar: JSON.stringify(radar),
      memoryScene: memoryScene ?? '',
      // 增强区块：人格副标题 + 三香三调关键词
      desc: personality.description ?? '',
      notesA: flatNotes(recs[0]?.notesStructured),
      notesB: flatNotes(recs[1]?.notesStructured),
      notesC: flatNotes(recs[2]?.notesStructured),
      // 品牌名（高级感杠杆）：recs[i].brand 已是 brandLabel 智能译名
      brandA: recs[0]?.brand ?? '',
      brandB: recs[1]?.brand ?? '',
      brandC: recs[2]?.brand ?? '',
    });
    let res: Response;
    try {
      res = await fetch(`/api/share-card?${params}`);
    } catch (e) {
      console.error('[share] fetch failed', e);
      return { ok: false, method: 'download', error: 'network' };
    }
    if (!res.ok) {
      console.error('[share] API', res.status);
      return { ok: false, method: 'download', error: `API ${res.status}` };
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);

    // 微信 / iOS：浏览器不触发 a.download，改为内联预览让用户长按保存
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isWX = /MicroMessenger/i.test(ua);
    const isIOS = /iPad|iPhone|iPod/i.test(ua);
    if (isWX || isIOS) {
      return { ok: true, method: 'preview', url };
    }

    // 桌面端：直接下载（延迟释放 blob URL，确保下载已开始）
    const link = document.createElement('a');
    link.download = `crush香鉴-${personalityName}-${format}.png`;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return { ok: true, method: 'download' };
  }, [personalityName]); // 不声明 recommendations/shareRadarDims，运行时读取

  // 统一保存入口：根据结果给出真实反馈（下载成功 / 内联预览 / 失败），不再假成功
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const triggerSave = useCallback(async (format: '1to1' | '3to4' = '1to1') => {
    const r = await handleSaveShareImage(format);
    if (!r.ok) {
      setShareHint('分享图生成失败，请重试');
      return;
    }
    if (r.method === 'preview' && r.url) {
      setPreviewUrl(r.url);
    } else {
      setShareHint('分享图已保存 ✓');
      setShowShareGuide(false);
    }
  }, [personalityName]);

  const personality = getPersonality(personalityName);

  // ── 分享意图函数（锁定/解锁统一调用）━━
  // 顺序：保存分享图（预览/下载）→ 复制邀请链接 → 弹引导弹层
  const handleShare = useCallback(async () => {
    setPreviewUrl(null);
    await triggerSave('1to1');
    try {
      await navigator.clipboard.writeText(shareLink);
    } catch {}
    setShowShareGuide(true);
  }, [shareLink, personalityName, triggerSave]);

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
        role: r.role,
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
      <div className="overflow-y-auto no-scrollbar pb-20 max-w-[430px] mx-auto">

        {/* 顶部导航：首页返回（两态共用）+ 重新测试 */}
        <div className="sticky top-0 z-50 px-4 py-2 flex items-center justify-between gap-2 bg-cream/80 backdrop-blur-sm border-b border-amber-100/50">
          <div className="flex items-center gap-2 min-w-0">
            <Link
              href="/"
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-amber-200 rounded-full text-xs text-amber-600 font-sans hover:border-amber-400 active:scale-95 transition-all flex-none"
              aria-label="返回首页"
            >
              <span aria-hidden style={{ fontSize: '11px', lineHeight: 1 }}>←</span>
              首页
            </Link>
            <span className="text-amber-600 text-xs font-sans truncate">Crush 香鉴</span>
          </div>
          <button
            onClick={handleRestart}
            className="px-3 py-1 bg-white border border-amber-200 rounded-full text-xs text-amber-600 font-sans hover:border-amber-400 active:scale-95 transition-all flex-none"
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

        {/* 限时免费活动横幅（活动期内常驻，告知用户当前为临时免费） */}
        {promoFree && (
          <div
            className="sticky top-0 z-40 text-center text-sm py-2 px-4 shadow-sm"
            style={{
              background: 'linear-gradient(135deg,#3D2817,#5C3826)',
              color: '#F8EAD9',
              backdropFilter: 'blur(4px)',
            }}
            role="status"
            aria-live="polite"
          >
            🎉 限时免费开放中 · 完整版全部模块免费解锁{promoRemaining ? ` · 距结束 ${promoRemaining}` : ''}（结果为娱乐性参考）
          </div>
        )}

        {/* 未测试示例提示横幅（裸开 / 无测试记录时出现，不破坏既有渲染） */}
        {showUntestedHint && (
          <div
            className="flex items-center justify-center gap-1.5 px-4 py-2 text-center"
            style={{
              background: 'rgba(250,238,218,0.7)',
              borderBottom: '1px solid rgba(168,136,78,0.25)',
              color: '#8B5E3C',
              fontSize: '12px',
              backdropFilter: 'blur(4px)',
            }}
            role="status"
          >
            <span>你还没测香，这是示例人格「暗流」</span>
            <Link
              href="/question"
              className="text-amber-600 font-medium hover:text-amber-700 underline decoration-amber-400"
              style={{ textUnderlineOffset: '2px' }}
            >
              去测香 →
            </Link>
          </div>
        )}

        {/* ━━━ 人格揭晓区 ━━━ */}
        <section
          className="relative flex flex-col items-center justify-center text-center px-6 pt-8 pb-3.5 min-h-[200px]"
          aria-label="人格揭晓"
        >
          {unlocked && (
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
              你的灵魂香气，正在浮现…
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
          {revealed && unlocked && (
            <motion.div
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium px-4 py-1.5 rounded-full bg-amber-100 text-amber-700"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.4 }}
            >
              {promoFree ? '✦ 限时免费 · 完整版开放中' : '✦ 已解锁完整版报告'}
            </motion.div>
          )}
          </div>
        </section>

        {/* ━━━ 本命守护香（常驻 · 16 人格唯一锚定，测完立刻可见，两态共用）━━━ */}
        {revealed && <GuardianScentCard personalityName={personalityName} />}

        {/* ━━━ ⑦ 合香回流 banner：来自朋友的合香邀请 ━━━ */}
        {revealed && params.get('cp') && (
          <section className="px-6 pt-2 pb-1">
            <Link
              href={`/friend?cp=${encodeURIComponent(params.get('cp')!)}&me=${encodeInvite(personalityName)}`}
              className="block w-full py-3.5 rounded-2xl text-center font-sans font-semibold text-sm active:scale-95 transition-transform"
              style={{
                background: 'linear-gradient(160deg,#2A1810 0%,#5C3826 100%)',
                color: '#F8EAD9',
                boxShadow: '0 4px 14px rgba(92,58,36,0.2)',
              }}
            >
              你和 TA 的合香已生成 · 查看合香卡 →
            </Link>
          </section>
        )}

        {/* ━━━ 锁定态：雷达图 + 本命香水 + 免费解锁 ━━━ */}
        {!unlocked && (
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
            六个维度 · 勾勒你独有的气质坐标
          </p>
          <div className="flex justify-center">
            <RadarChart values={radarData} size={260} />
          </div>
          {/* 无障碍文字版 */}
          <ul className="sr-only">
            {Object.entries(radarData).map(([dim, val]) => (
              <li key={dim}>{RADAR_DIM_LABELS[dim] ?? dim}：{Math.round(val * 100)}%</li>
            ))}
          </ul>
        </section>

        {/* ━━━ 解析金句 ━━━ */}
        <div className="px-6 pb-2 text-center">
          <p className="font-serif text-amber-700/80 italic leading-7" style={{ fontSize: '14px' }}>
            {getParseQuote(personalityName)}
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

        {/* ━━━ 令人心动的瞬间 ━━━ */}
        <MemorySceneSection
          personalityName={personalityName}
          perfume={displayPerfumes.find(p => p.role === 'signature')}
        />

        {/* ━━━ 本命香水 ━━━ */}
        <section className="px-6 pt-4 pb-10" aria-label="本命香水推荐">
          <div className="flex items-center justify-center gap-3 mb-7">
            <span className="h-px w-6 bg-amber-400" />
            <h2 className="font-serif text-lg font-medium text-amber-950">本命香水</h2>
            <span className="h-px w-6 bg-amber-400" />
          </div>
          <p className="text-center text-amber-700 mb-6" style={{ fontSize: '14px' }}>
            三支香气，与你的灵魂产生共振
          </p>
          <div className="flex gap-3.5 overflow-x-auto no-scrollbar px-1">
            {recommendations.map((rec) => {
              // 展示角色用 role（方案 B：本命香可能来自 advanced 池，tier 是真实档位）
              const isSignature = rec.role === 'signature';
              const tierLabel =
                rec.role === 'signature'
                  ? '本命香'
                  : rec.role === 'advanced'
                  ? '进阶香'
                  : '尝试香';
              // 锁定态：本命香全展示，其余 blur
              const isLocked = !unlocked && !isSignature;
              // 锁定态瓶型配色与解锁版统一：按香调族动态着色
              const family = detectFamily(personality.direction, rec.notesStructured.top);
              return (
                <article
                  key={`${rec.role}-${rec.name}`}
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

                  {/* 香水图（与解锁版一致：按香调族动态着色）*/}
                  <div
                    className="w-full h-[120px] rounded-2xl flex items-center justify-center mb-3"
                    style={{ background: FAMILY_BG[family] ?? '#F5EDE0' }}
                  >
                    <PerfumeBottle
                      className="w-14 h-[90px]"
                      stroke={FAMILY_COLORS[family] ?? '#5C3A24'}
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
            {getUsagePhilosophy(personalityName)}
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
              dimLabels={RADAR_DIM_LABELS}
            />
          </div>
          {/* 「推荐探索方向」解读（锁定态模糊）*/}
          <div className="relative">
            <div className="select-none pointer-events-none" style={{ filter: 'blur(5px)' }} aria-hidden>
              <h4 className="font-serif text-base font-medium text-amber-950 mb-2">推荐探索方向</h4>
              <ul className="space-y-1.5">
                <li className="text-sm text-amber-800" style={{ lineHeight: 1.7 }}>
                  · {Object.entries(radarData).sort(([, a], [, b]) => b - a)[0]?.[0]} 是你的主型气质
                </li>
                <li className="text-sm text-amber-800" style={{ lineHeight: 1.7 }}>
                  · 加一点琥珀，为日常添一层温度
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
                    测测你们的香气契合度
                  </p>
                  <p className="text-amber-600 mt-0.5" style={{ fontSize: '12px' }}>
                    发给 TA → 一起测，看看你们的灵魂匹配等级
                  </p>
                </div>
                <span className="text-amber-400" style={{ fontSize: '18px' }}>→</span>
              </div>
            </Link>
          </section>
          </>
        )}

        {/* ━━━ 已解锁内容 / 付费墙（条件渲染）━━━ */}
        {unlocked ? (
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
            还有 4 段关于你的真相，等你揭开
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
              {discounted ? '好友已完成测试，已自动抵扣' : '解锁你的完整香气档案'}
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
                ? `已省 ¥${savePrice} · 好友已完成自动抵扣`
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
              ¥{currentPrice} 解锁完整报告
            </button>
            <span className="block mt-2 text-xs text-amber-700 text-center">
              {discounted
                ? '好友已完成 · 已自动抵扣'
                : '限时 5 折 · 一次解锁全部'}
            </span>
          </div>

          {/* ── 邀请抵扣进度 ── */}
          {!discounted && (
            <div className="bg-white border border-amber-200 rounded-2xl p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-1.5" style={{ fontSize: '13px' }}>
                  <span style={{ fontSize: '14px' }}>🎁</span>
                  <span className="font-serif font-semibold text-amber-950">
                    邀请好友，立享特惠
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
                  <>邀请 <strong className="text-amber-950">3 位</strong> 好友完成测试，立减 <strong className="text-amber-950">{'¥9'}</strong> → 实付 <strong className="text-amber-950">{'¥20.9'}</strong></>
                ) : (
                  <>已邀请 <strong className="text-amber-950">{inviteStatus.totalCompleted}</strong> 位，再邀请 <strong className="text-amber-950">{3 - inviteStatus.totalCompleted}</strong> 位 → 解锁 <strong className="text-amber-950">{'¥20.9'}</strong></>
                )}
              </p>
              <button
                onClick={handleCopyInvite}
                className="w-full bg-amber-50 border border-amber-700 text-amber-800 rounded-full active:scale-[0.98] transition-transform"
                style={{ fontSize: '14px', padding: '12px 0' }}
                aria-label="复制邀请链接，邀请 3 位好友完成测试后抵扣 9 元"
              >
                {copiedInvite
                  ? '已复制邀请链接 ✓'
                  : inviteStatus.canDiscount
                  ? '已邀请 3 位，继续分享'
                  : `立即邀请好友（还需 ${3 - inviteStatus.totalCompleted} 位）`}
              </button>
            </div>
          )}

          <p
            className="text-amber-700/80 mt-3 leading-6 text-center"
            style={{ fontSize: '12px', fontFamily: '"Noto Serif SC", serif' }}
          >
            一份关于你的香气答案，值得被认真看见
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
        style={{ paddingBottom: 'calc(8px + var(--safe-bottom))' }}
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
              aria-label="分享我的灵魂香气"
            >
              分享我的灵魂香气
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
            aria-label="分享我的灵魂香气"
          >
            分享我的灵魂香气
          </button>
        )}
      </div>


      {/* ━━━ 支付弹窗 ━━━ */}
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
        onClose={() => { setShowShareGuide(false); setPreviewUrl(null); }}
        onCopyLink={() => {
          navigator.clipboard.writeText(shareLink).catch(() => {});
          setShareHint('链接已复制 ✓');
        }}
        onSaveImage={(format) => { triggerSave(format); }}
        previewUrl={previewUrl}
        isInWeChat={isInWeChat()}
      />
    </main>
  );
}
