'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  getPersonality,
  getRadarScores,
  getRecommendations,
  type Recommendation,
  PERSONALITY_NAME_MAP,
} from '@/lib/personalities';
import RadarChart from '@/components/RadarChart';
import PersonalityIcon from '@/components/PersonalityIcon';
import ShareImagePreviewModal from '@/components/ShareImagePreviewModal';
import { useMyTestStatus, clearMyTestProgress } from '@/lib/useMyTestStatus';
import { encodeInvite } from '@/lib/inviteState';
import { saveShareCard, isWeChat } from '@/lib/saveShareImage';

function Toast({ message }: { message: string }) {
  return (
    <div
      className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] bg-amber-900 text-amber-50 rounded-full px-5 py-2 text-sm font-sans shadow-lg"
      style={{ animation: 'fadeInDown 0.3s ease-out' }}
      aria-live="polite"
    >
      {message}
    </div>
  );
}

interface SharedViewClientProps {
  personalityName: string;
}

export default function SharedViewClient({ personalityName }: SharedViewClientProps) {
  const [toast, setToast] = useState<string | null>(null);
  const [stagger, setStagger] = useState(0);
  const [showQR, setShowQR] = useState(false);
  const [copied, setCopied] = useState(false);
  // 微信 / iOS 预览保存：内联展示图片供用户长按保存（blob URL 由弹层关闭时释放）
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const router = useRouter();
  const myStatus = useMyTestStatus();

  const handleStartTest = () => {
    if (!myStatus.completed && !myStatus.inProgress) {
      router.push('/question');
      return;
    }
    let msg = '';
    if (myStatus.completed) {
      msg = `你之前测过的人格是「${myStatus.personalityName}」。\n\n重新测试将清除你当前的所有答案与结果。确定继续？`;
    } else {
      msg = `你上次测到 ${myStatus.answeredCount}/10 题。\n\n「重新开始」将清除进度从头测；「继续」会接上次。\n\n选「重新开始」？`;
    }
    const ok = typeof window !== 'undefined' ? window.confirm(msg) : true;
    if (ok) {
      clearMyTestProgress();
      router.push('/question');
    } else if (myStatus.inProgress) {
      router.push('/question');
    }
  };

  const handleRetest = () => {
    const msg = `你之前测过的人格是「${myStatus.personalityName}」。\n\n重新测试将清除你当前的所有答案与结果。确定继续？`;
    const ok = typeof window !== 'undefined' ? window.confirm(msg) : true;
    if (ok) {
      clearMyTestProgress();
      router.push('/question');
    }
  };

  // 支持拼音 ID（如 chonglang）或中文名（如 冲浪）
  const mappedName = personalityName ? (PERSONALITY_NAME_MAP[personalityName] || personalityName) : '';

  const friendLink = mappedName
    ? `/friend?inv=${encodeInvite(mappedName)}`
    : '/friend';

  const personality = mappedName ? getPersonality(mappedName) : null;
  const radarData = mappedName ? getRadarScores(mappedName) : null;
  const recommendations: readonly Recommendation[] = mappedName
    ? getRecommendations(mappedName)
    : [];

  const shareLink =
    typeof window !== 'undefined'
      ? `${window.location.origin}/shared?p=${encodeURIComponent(mappedName || personalityName)}`
      : '';
  const qrUrl = shareLink
    ? `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=8&data=${encodeURIComponent(shareLink)}`
    : '';

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    [0, 1, 2, 3, 4, 5, 6].forEach((i) => {
      timers.push(setTimeout(() => setStagger(i), 300 + i * 100));
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  // 首次测用户（无 localStorage 结果）：直接跳 /question，不展示朋友结果
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const pid = localStorage.getItem('crushxiangjian_personality_id');
    if (!pid) {
      const inv = mappedName ? `?inv=${encodeInvite(mappedName)}` : '';
      router.replace(`/question${inv}`);
    }
  }, [personalityName, router]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  // 关闭预览弹层并释放 blob URL（避免内存泄漏）
  const handleClosePreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  async function handleCopyLink() {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      showToast('链接已复制');
    } catch {}
  }

  async function handleSaveImage() {
    if (!mappedName || !personality || !firstRec) return;
    try {
      const params = new URLSearchParams({
        scene: 'shared',
        sharerName: mappedName,
        name: mappedName,
        description: personality.description,
        perfumeName: firstRec.name,
        inv: encodeInvite(mappedName),
        format: '3to4',
      });
      const filename = `${mappedName}的香气人格.png`;
      const r = await saveShareCard(params, filename);
      if (!r.ok) {
        showToast('分享图生成失败，请重试');
        return;
      }
      if (r.method === 'preview' && r.url) {
        // 微信 / iOS：内联预览，用户长按保存
        setPreviewUrl(r.url);
      } else {
        // 桌面端：saveShareCard 已触发下载
        showToast('分享图已保存 ✓');
      }
    } catch (e) {
      console.error('[shared] 分享图生成失败', e);
      showToast('分享图生成失败，请重试');
    }
  }

  if (!personalityName || !personality || !radarData) {
    return (
      <main className="min-h-dvh bg-cream flex flex-col items-center justify-center px-6">
        <div className="text-center">
          <div className="text-5xl mb-4">🌫</div>
          <h1 className="font-serif font-bold text-2xl text-amber-950 mb-2">找不到这封香气档案</h1>
          <p className="text-amber-500/70 font-sans text-sm mb-6">
            这封香气邀请，似乎已过期。
          </p>
          <Link
            href="/"
            className="inline-block py-3 px-6 bg-amber-800 text-amber-50 rounded-full font-sans font-semibold text-sm"
          >
            去测测我的香气 →
          </Link>
        </div>
      </main>
    );
  }

  const firstRec = recommendations[0];

  return (
    <main className="min-h-dvh bg-cream pb-32">
      <style>{`
        @keyframes fadeInDown {
          from { opacity: 0; transform: translate(-50%, -12px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>

      {toast && <Toast message={toast} />}

      {/* 顶部区域 */}
      <div className="bg-gradient-to-b from-amber-50 to-cream px-5 pt-safe-top pt-6 pb-6">
        <div className="flex items-center justify-between mb-4">
          <Link href="/" className="text-amber-600 font-sans text-sm hover:text-amber-800 transition-colors">
            ← Crush香鉴
          </Link>
          <span className="text-amber-400 font-sans text-xs bg-amber-100 rounded-full px-3 py-1">
            朋友的香气人格
          </span>
        </div>

        {myStatus.completed && (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-white/80 px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <PersonalityIcon name={myStatus.personalityName ?? ''} className="w-7 h-7 text-amber-600 flex-shrink-0" />
              <div className="min-w-0">
                <p className="font-sans text-xs text-amber-700 leading-tight">
                  你是「{myStatus.personalityName}」
                </p>
                <p className="font-sans text-[10px] text-amber-500 leading-tight mt-0.5">下面是朋友的报告</p>
              </div>
            </div>
            <Link
              href="/result"
              className="flex-shrink-0 px-3 py-1.5 bg-amber-800 text-amber-50 rounded-full text-xs font-sans font-medium active:scale-95 transition-transform"
            >
              查看我的 →
            </Link>
          </div>
        )}

        <div
          className={`text-center transition-all duration-500 ${
            stagger >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <p className="text-amber-400/70 font-sans text-xs tracking-widest uppercase mb-3">
            朋友分享了他的灵魂人格
          </p>
          <div className="flex justify-center mb-3">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center border border-amber-200 bg-white shadow-sm"
              style={{ boxShadow: '0 4px 20px rgba(180,120,60,0.15)' }}
            >
              <PersonalityIcon name={mappedName || personalityName} className="w-12 h-12 text-amber-600" />
            </div>
          </div>
          <h1 className="font-serif font-bold text-4xl text-amber-950 mb-2" style={{ letterSpacing: '0.08em' }}>
            {mappedName || personalityName}
          </h1>
          <p className="text-amber-600/70 font-sans text-sm leading-relaxed">{personality.tagline}</p>
        </div>
      </div>

      {/* 内容区 */}
      <div className="px-5 space-y-4">
        <div
          className={`card transition-all duration-500 ${
            stagger >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
          }`}
        >
          <h2 className="font-serif font-semibold text-amber-900 text-sm mb-3 flex items-center gap-2">
            <span className="text-amber-400">◆</span> 六维气质雷达
          </h2>
          <div className="flex justify-center py-2">
            <RadarChart values={radarData} size={200} />
          </div>
        </div>

        {firstRec && (
          <div
            className={`card border-amber-200 transition-all duration-500 ${
              stagger >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
            }`}
          >
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1.5 h-5 rounded-full" style={{ backgroundColor: '#B4783C' }} />
                <h3 className="font-serif font-semibold text-amber-900 text-sm">本命香水</h3>
              </div>
              <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100">
                <p className="font-serif font-bold text-amber-950 text-lg mb-1">{firstRec.name}</p>
                <p className="text-amber-600/80 font-sans text-xs mb-2">{firstRec.brand}</p>
                <div className="text-amber-700/80 font-sans text-xs leading-relaxed space-y-0.5">
                  <p>前调：{firstRec.notesStructured.top.join(' · ')}</p>
                  <p>中调：{firstRec.notesStructured.heart.join(' · ')}</p>
                  <p>后调：{firstRec.notesStructured.base.join(' · ')}</p>
                </div>
              </div>
              {recommendations.length > 1 && (
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                  {recommendations.slice(1, 3).map((rec) => (
                    <div
                      key={rec.name}
                      className="flex-shrink-0 bg-white rounded-xl border border-amber-100 p-3 min-w-[120px]"
                    >
                      <p className="font-serif font-semibold text-amber-900 text-xs">{rec.name}</p>
                      <p className="text-amber-500/70 font-sans text-[10px]">{rec.brand}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div
          className={`card transition-all duration-500 ${
            stagger >= 4 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
          }`}
        >
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1.5 h-5 rounded-full" style={{ backgroundColor: '#B4783C' }} />
              <h3 className="font-serif font-semibold text-amber-900 text-sm">人格解读</h3>
            </div>
            <p className="text-amber-700/90 font-sans text-sm leading-relaxed">{personality.description}</p>
          </div>
        </div>

        <div
          className={`space-y-3 transition-all duration-500 ${
            stagger >= 5 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
          }`}
        >
          <button
            onClick={handleStartTest}
            className="block w-full py-4 bg-amber-800 text-amber-50 rounded-full font-sans font-semibold text-base text-center active:scale-95 transition-transform"
            style={{ boxShadow: '0 4px 20px rgba(92,58,36,0.25)' }}
          >
            {myStatus.completed
              ? '查看我的香气结果 →'
              : myStatus.inProgress
              ? `继续测试（已答 ${myStatus.answeredCount}/10）→`
              : '我也来测测我的香气 →'}
          </button>

          <Link
            href={friendLink}
            className="block w-full py-3 bg-white border border-amber-300 text-amber-800 rounded-full font-sans font-medium text-sm text-center active:scale-95 transition-all hover:border-amber-500"
          >
            测完看契合度 →
          </Link>

          {myStatus.completed && (
            <button
              onClick={handleRetest}
              className="block w-full py-2 text-amber-600 font-sans text-xs text-center underline-offset-4 hover:underline"
              aria-label="清除人格并从头测"
            >
              重新测试（将清除当前人格「{myStatus.personalityName}」）
            </button>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleCopyLink}
              className="flex-1 py-3 bg-white border border-amber-200 text-amber-700 rounded-full font-sans font-medium text-sm active:scale-95 transition-all hover:border-amber-400"
            >
              复制链接
            </button>
            <button
              onClick={handleSaveImage}
              className="flex-1 py-3 bg-amber-50 border border-amber-200 text-amber-700 rounded-full font-sans font-medium text-sm active:scale-95 transition-all hover:border-amber-400"
            >
              下载分享图
            </button>
            <button
              onClick={() => setShowQR(true)}
              className="flex-1 py-3 bg-white border border-amber-200 text-amber-700 rounded-full font-sans font-medium text-sm active:scale-95 transition-all hover:border-amber-400"
            >
              扫码分享
            </button>
          </div>
        </div>

        <div
          className={`text-center pt-4 transition-all duration-500 ${
            stagger >= 6 ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <div className="w-5 h-5 bg-amber-100 rounded flex items-center justify-center">
              <span className="text-amber-400 text-[8px]">◆</span>
            </div>
            <p className="text-amber-800 font-sans text-xs font-medium">Crush香鉴</p>
          </div>
          <p className="text-amber-400/50 font-sans text-[10px] mt-1">10题 · 16人格 · 110支香水库</p>
        </div>
      </div>

      {/* 扫码分享弹层 */}
      {showQR && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(44,24,16,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowQR(false)}
          role="dialog"
          aria-modal
          aria-label="扫码分享"
        >
          <div
            className="bg-[#FAF3EA] rounded-3xl w-[340px] overflow-hidden"
            style={{ boxShadow: '0 20px 60px rgba(44,24,16,0.3)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 pt-6 pb-4 text-center">
              <div className="inline-flex items-center gap-2 bg-amber-100 rounded-full px-4 py-1.5 mb-3">
                <span className="text-amber-400 text-xs">◆</span>
                <span className="text-amber-700 font-sans text-xs font-medium">分享邀请</span>
              </div>
              <p className="font-serif font-bold text-xl text-amber-950" style={{ letterSpacing: '0.06em' }}>
                {mappedName || personalityName}
              </p>
              <p className="text-amber-600/70 font-sans text-xs mt-1">{personality.tagline}</p>
            </div>
            <div className="flex flex-col items-center px-6 pb-4">
              <div className="bg-white rounded-2xl p-3 border border-amber-100">
                <img
                  src={qrUrl}
                  alt="扫码测试你的灵魂香气"
                  width={200}
                  height={200}
                  className="block"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(shareLink)}`;
                  }}
                />
              </div>
              <p className="text-amber-700 font-sans text-xs mt-3 text-center leading-relaxed">
                扫码 · 分享你的灵魂香气<br />
                朋友无需答题，直接看你的报告
              </p>
            </div>
            <div className="px-5 pb-5 flex flex-col gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(shareLink).catch(() => {});
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="w-full py-3 bg-amber-800 text-amber-50 rounded-full font-sans font-semibold text-sm"
              >
                {copied ? '已复制链接 ✓' : '复制链接'}
              </button>
              <button
                onClick={() => setShowQR(false)}
                className="w-full py-3 bg-white border border-amber-200 text-amber-700 rounded-full font-sans font-medium text-sm"
              >
                关闭
              </button>
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
