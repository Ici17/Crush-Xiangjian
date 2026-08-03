'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { PERSONALITIES, type Personality, getPersonality } from '@/lib/personalities';
import { useMyTestStatus, clearMyTestProgress } from '@/lib/useMyTestStatus';
import PersonalityIcon from '@/components/PersonalityIcon';

/**
 * 落地页 — 保留设计师品牌符号 + 恢复原始结构，只压缩 hero 高度
 *
 * 设计师品牌符号（已保留）：CRUSH FRAGRANCE 文字标 + 上下琥珀色横线
 * - 左上导航：小号，深色
 * - hero 居中大标：大号，浅色（headline 角色）
 * - hero 底部：小号，浅色（呼应顶部）
 *
 * 本轮微调：仅 hero 高度 85vh → 60vh（Adam 反馈"压缩头部尺寸"）
 * - 浮动光斑：5 颗（恢复）
 * - 香水瓶尺寸：160×220（恢复）
 * - "Crush / 香鉴" 双行大标题（恢复）
 * - 数据条 16/110/10（恢复）
 * - 16 人格胶囊（保留）
 * - About Section（恢复）
 */

/** 人格主调色：由 direction 字段解析主导香调（零数据改动，语义对应「灵魂香调」） */
function personalityAromaColor(p: Personality): string {
  const d = p.direction;
  const rules: [RegExp, string][] = [
    [/木质|雪松|檀|香根草/, '#8B5E3C'],
    [/玫瑰|花香|白花|鸢尾|紫罗兰|晚香玉|橙花|棉/, '#B56B7A'],
    [/柑橘|橙/, '#D9A441'],
    [/清新|海洋|海盐|芳香|鼠尾草/, '#6B8E5A'],
    [/东方|乌木|沉香|琥珀|藏红花|皮革|焚香/, '#9A4B2E'],
    [/美食|甜|麝香|茶/, '#C08A3E'],
  ];
  for (const [re, color] of rules) {
    if (re.test(d)) return color;
  }
  return '#8B5E3C';
}

/** 品牌符号：上下各一条两端渐变细线 + CRUSH FRAGRANCE 文字（设计师规范 v2） */
function BrandSymbol({
  size = 'sm',
  variant = 'dark',
}: {
  size?: 'sm' | 'lg';
  variant?: 'dark' | 'light';
}) {
  const isLarge = size === 'lg';
  const lineColor = '#D4A574';
  const textColor = variant === 'dark' ? '#2C1810' : '#FAF3EA';

  return (
    <div
      className="flex flex-col items-center w-full"
      style={{ fontFamily: 'Noto Serif SC, serif' }}
    >
      <div
        style={{
          width: '100%',
          height: '0.5px',
          background: `linear-gradient(90deg, transparent 0%, ${lineColor} 30%, ${lineColor} 70%, transparent 100%)`,
          opacity: 0.5,
        }}
        aria-hidden
      />
      <span
        className={isLarge ? 'text-[28px] sm:text-[32px] font-bold' : 'text-[11px] font-medium'}
        style={{
          letterSpacing: '0.45em',
          color: textColor,
          padding: isLarge ? '12px 0' : '8px 0',
          fontWeight: 500,
          marginLeft: '0.45em',
          opacity: 0.85,
        }}
      >
        CRUSH&nbsp;&nbsp;FRAGRANCE
      </span>
      <div
        style={{
          width: '100%',
          height: '0.5px',
          background: `linear-gradient(90deg, transparent 0%, ${lineColor} 30%, ${lineColor} 70%, transparent 100%)`,
          opacity: 0.5,
        }}
        aria-hidden
      />
    </div>
  );
}

/** 落地页 — 回退到原始结构，仅 hero 高度压缩 */
export default function LandingPage() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [selected, setSelected] = useState<Personality>(PERSONALITIES[0]);
  const myStatus = useMyTestStatus();

  const handleOpenSheet = (name: string): void => {
    const found = PERSONALITIES.find((p) => p.name === name);
    setSelected(found ?? PERSONALITIES[0]);
    setIsOpen(true);
  };

  const handleCloseSheet = (): void => setIsOpen(false);

  const handleViewReport = (name: string): void => {
    router.push(`/result?p=${encodeURIComponent(name)}`);
  };

  const handleStartTest = (): void => {
    router.push('/question');
  };

  return (
    <main className="bg-cream min-h-screen overflow-x-hidden relative">
      {/* ─── SVG Noise Filter ─── */}
      <svg className="hidden" width="0" height="0" aria-hidden>
        <filter id="noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
          <feBlend in="SourceGraphic" mode="multiply" result="blend" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.04" />
          </feComponentTransfer>
        </filter>
      </svg>
      <div className="fixed inset-0 pointer-events-none z-50" style={{ filter: 'url(#noise)', mixBlendMode: 'multiply' }} aria-hidden />

      <div className="max-w-[430px] mx-auto relative">
        {/* ─── ① Top Navigation 已删除（Adam 反馈，CRUSH FRAGRANCE 文字标 + 查看示例报告按钮全部移除） ─── */}

        {/* ─── ② Atmosphere Hero — 高度 46vh（进一步压缩顶部留白） ─── */}
        <div
          className="relative w-full animate-fadeIn"
          style={{ height: '46vh', minHeight: 320, animationDelay: '60ms' }}
          aria-label="品牌氛围主视觉"
        >
          {/* 深色渐变背景 */}
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(180deg, #2C1810 0%, #4A2E1A 70%, #FAF3EA 100%)',
            }}
            aria-hidden
          />

          {/* 浮动光斑（5 颗，恢复） */}
          {[
            { top: '15%', left: '10%', size: 80, color: 'rgba(212,165,116,0.4)', blur: 12, delay: 0 },
            { top: '30%', right: '15%', size: 64, color: 'rgba(212,165,116,0.3)', blur: 10, delay: 1.5 },
            { bottom: '25%', left: '25%', size: 48, color: 'rgba(212,165,116,0.25)', blur: 8, delay: 3 },
            { top: '45%', right: '30%', size: 40, color: 'rgba(139,94,60,0.3)', blur: 6, delay: 2 },
            { bottom: '35%', right: '10%', size: 56, color: 'rgba(212,165,116,0.2)', blur: 10, delay: 0.8 },
          ].map((orb, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full"
              style={{
                top: orb.top,
                left: orb.left,
                right: orb.right,
                bottom: orb.bottom,
                width: orb.size,
                height: orb.size,
                background: `radial-gradient(circle, ${orb.color} 0%, transparent 70%)`,
                filter: `blur(${orb.blur}px)`,
              }}
              animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.7, 0.5] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: orb.delay }}
              aria-hidden
            />
          ))}

          {/* 居中香水瓶（缩小+下移，远离顶部留白区） */}
          <div
            className="absolute inset-0 flex items-end justify-center px-8"
            style={{ paddingBottom: '64px' }}
          >
            <svg
              style={{ width: '110px', height: '152px' }}
              viewBox="0 0 100 140"
              fill="none"
              aria-hidden
            >
              <rect x="38" y="5" width="24" height="12" rx="3" stroke="#D4A574" strokeWidth="1.5" fill="none" opacity="0.8" />
              <path d="M42 17 L42 30 L38 38 L38 38" stroke="#D4A574" strokeWidth="1.2" fill="none" opacity="0.7" />
              <path d="M58 17 L58 30 L62 38 L62 38" stroke="#D4A574" strokeWidth="1.2" fill="none" opacity="0.7" />
              <defs>
                <linearGradient id="bottleFill" x1="50" y1="38" x2="50" y2="125" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#D4A574" stopOpacity="0.05" />
                  <stop offset="50%" stopColor="#D4A574" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#8B5E3C" stopOpacity="0.08" />
                </linearGradient>
              </defs>
              <path
                d="M35 38 Q30 50 30 70 Q30 110 50 125 Q70 110 70 70 Q70 50 65 38"
                stroke="#D4A574"
                strokeWidth="1.8"
                fill="url(#bottleFill)"
                opacity="0.9"
              />
              <path d="M42 55 Q50 80 50 105" stroke="#D4A574" strokeWidth="0.8" fill="none" opacity="0.4" />
              <path d="M58 55 Q50 80 50 105" stroke="#D4A574" strokeWidth="0.8" fill="none" opacity="0.4" />
            </svg>
          </div>

          {/* hero 底部品牌符号（小）— 呼应顶部 */}
          <div className="absolute bottom-0 left-0 right-0 px-5 pb-3">
            <BrandSymbol size="sm" variant="light" />
          </div>
        </div>

        {/* ─── ③ Main Title Area（"Crush / 香鉴" 双行） ─── */}
        <div
          className="px-6 pt-6 pb-2 text-center animate-fadeIn"
          style={{ animationDelay: '180ms' }}
        >
          <p
            className="text-amber-800"
            style={{ fontFamily: 'Noto Serif SC, serif', fontSize: '22px', fontWeight: 400, lineHeight: 1.4, letterSpacing: '0.05em', margin: 0 }}
          >
            Crush
          </p>
          <h1
            className="text-amber-950"
            style={{ fontFamily: 'Noto Serif SC, serif', fontSize: '36px', fontWeight: 500, lineHeight: 1.4, letterSpacing: '0.08em', margin: '4px 0 0' }}
          >
            香鉴
          </h1>
          <p
            className="mt-5 text-amber-600"
            style={{ fontFamily: 'Noto Sans SC, sans-serif', fontSize: '16px', lineHeight: 1.6, letterSpacing: '0.02em' }}
          >
            你的灵魂，藏在哪种香气里？
          </p>
        </div>

        {/* ─── ④ Data Strip（压缩视觉占比：字号↓ 间距↓） ─── */}
        <div
          className="flex items-center justify-center px-4 mt-4 animate-fadeIn"
          style={{ animationDelay: '280ms' }}
        >
          <div className="flex items-center gap-0">
            <div className="text-center px-4">
              <span className="block text-amber-950" style={{ fontFamily: 'Noto Serif SC, serif', fontSize: '24px', fontWeight: 500 }}>
                16
              </span>
              <span className="block text-amber-700" style={{ fontFamily: 'Noto Sans SC, sans-serif', fontSize: '12px' }}>
                人格
              </span>
            </div>
            <div className="w-px h-8 bg-amber-300/60" aria-hidden />
            <div className="text-center px-4">
              <span className="block text-amber-950" style={{ fontFamily: 'Noto Serif SC, serif', fontSize: '24px', fontWeight: 500 }}>
                110
              </span>
              <span className="block text-amber-700" style={{ fontFamily: 'Noto Sans SC, sans-serif', fontSize: '12px' }}>
                香水
              </span>
            </div>
            <div className="w-px h-8 bg-amber-300/60" aria-hidden />
            <div className="text-center px-4">
              <span className="block text-amber-950" style={{ fontFamily: 'Noto Serif SC, serif', fontSize: '24px', fontWeight: 500 }}>
                10
              </span>
              <span className="block text-amber-700" style={{ fontFamily: 'Noto Sans SC, sans-serif', fontSize: '12px' }}>
                题
              </span>
            </div>
          </div>
        </div>

        {/* ─── ⑤ 16 Personality Capsule Scroll（边缘渐变提示可滑动） ─── */}
        <div
          className="mt-4 animate-fadeIn relative"
          style={{ animationDelay: '380ms' }}
          aria-label="16种人格预览"
        >
          <div
            className="personality-scroll flex gap-2 overflow-x-auto px-4 py-2 scrollbar-none"
            role="list"
          >
            {PERSONALITIES.map((p) => (
              <button
                key={p.name}
                role="listitem"
                onClick={() => handleOpenSheet(p.name)}
                className="shrink-0 w-[104px] bg-cream-dark rounded-2xl border border-amber-100 overflow-hidden text-left cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-sm flex flex-col"
                aria-label={`了解 ${p.name} 人格`}
              >
                <span className="block h-1.5 w-full" style={{ backgroundColor: personalityAromaColor(p) }} aria-hidden />
                <span className="block px-3 pt-2.5 pb-2.5">
                  <span className="block text-amber-950 text-[15px] font-medium leading-tight" style={{ fontFamily: 'Noto Sans SC, sans-serif' }}>{p.name}</span>
                  <span className="block text-amber-700 text-[11px] leading-snug mt-1 line-clamp-1" style={{ fontFamily: 'Noto Sans SC, sans-serif' }}>{p.tagline}</span>
                </span>
              </button>
            ))}
          </div>
          {/* 右边缘渐变：暗示「可滑动」 */}
          <div
            className="pointer-events-none absolute top-0 right-0 bottom-0 w-12"
            style={{ background: 'linear-gradient(270deg, #FAF3EA 0%, transparent 100%)' }}
            aria-hidden
          />
        </div>

        {/* ─── ⑥ 社会证明：已有 N 人测试 + 头像堆叠 ─── */}
        <div
          className="px-5 mt-6 flex items-center justify-center gap-2.5 animate-fadeIn"
          style={{ animationDelay: '440ms' }}
          aria-label="已有 12047 人完成测试"
        >
          {/* 头像堆叠（静态占位，强调“真实用户参与”） */}
          <div className="flex -space-x-2">
            {['#D4A574', '#9A4B2E', '#6B8E5A', '#B56B7A', '#8B5E3C'].map((c, i) => (
              <div
                key={i}
                className="w-7 h-7 rounded-full border-2 border-cream flex items-center justify-center text-[10px] font-bold text-cream"
                style={{ backgroundColor: c, opacity: 0.85 - i * 0.05 }}
                aria-hidden
              >
                {['珊','落','渊','舟','砚'][i]}
              </div>
            ))}
          </div>
          <div className="text-left">
            <p className="text-amber-950 font-serif" style={{ fontSize: '13px', fontWeight: 600, lineHeight: 1.2 }}>
              已有 <span style={{ color: '#B45309' }}>12,047</span> 人完成
            </p>
            <p className="text-amber-600" style={{ fontSize: '11px', lineHeight: 1.2 }}>
              90% 表示“找到了自己没意识到的部分”
            </p>
          </div>
        </div>

        {/* ─── ⑦ Main CTA Button（脉冲动画） ─── */}
        <div
          className="px-5 mt-5 animate-fadeIn relative"
          style={{ animationDelay: '480ms' }}
        >
          {/* 已测用户：人格胶囊 + 双按钮 */}
          {myStatus.completed && myStatus.personalityName ? (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-3 py-4 px-5 bg-white rounded-2xl border border-amber-200 shadow-sm">
                <PersonalityIcon name={myStatus.personalityName} className="w-10 h-10 text-amber-600" />
                <div className="text-left">
                  <p className="font-serif text-lg text-amber-950 font-semibold">{myStatus.personalityName}</p>
                  <p className="text-amber-600/70 text-xs">{getPersonality(myStatus.personalityName)?.tagline}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => router.push('/result')}
                  className="flex-1 bg-amber-700 text-white rounded-full py-3 text-sm font-medium hover:bg-amber-800 transition-colors"
                >
                  查看结果 →
                </button>
                <button
                  onClick={() => {
                    if (typeof window !== 'undefined' && window.confirm(`重新测试将清除当前人格「${myStatus.personalityName}」，确定继续？`)) {
                      clearMyTestProgress();
                      router.push('/question');
                    }
                  }}
                  className="flex-1 bg-white border border-amber-300 text-amber-700 rounded-full py-3 text-sm font-medium hover:border-amber-500 transition-colors"
                >
                  重新测试
                </button>
              </div>
            </div>
          ) : (
            <div className="relative">
              {/* 脉冲光环：两层叠加，营造“呼吸”感 */}
              <span
                className="cta-pulse-ring absolute inset-0 rounded-[28px]"
                aria-hidden
              />
              <span
                className="cta-pulse-ring-delayed absolute inset-0 rounded-[28px]"
                aria-hidden
              />
              <button
                onClick={handleStartTest}
                className="cta-shine relative w-full bg-amber-700 text-white rounded-[28px] py-[18px] text-[17px] font-medium border-none cursor-pointer transition-all duration-300 hover:bg-amber-800 hover:shadow-[0_4px_16px_rgba(44,24,16,0.12)] active:scale-[0.98]"
                style={{ fontFamily: 'Noto Sans SC, sans-serif' }}
                aria-label="开始寻找我的本命香"
              >
                开始寻找我的本命香 →
              </button>
            </div>
          )}
        </div>

        {/* ─── ⑦ Bottom Small Text（边距↓） ─── */}
        <div
          className="text-center mt-3 pb-3 animate-fadeIn"
          style={{ animationDelay: '580ms' }}
        >
          <span className="text-amber-700 text-[12px]" style={{ fontFamily: 'Noto Sans SC, sans-serif' }}>
            3 分钟 · 16 种人格 · 免费开始
          </span>
        </div>

        {/* ─── ⑧ About Section（边距↓ 内边距↓） ─── */}
        <div
          className="bg-cream px-4 pt-8 pb-12 animate-fadeIn"
          style={{ animationDelay: '680ms' }}
        >
          <div
            className="bg-white rounded-[24px] p-6"
            style={{ boxShadow: '0 2px 8px rgba(44,24,16,0.08)' }}
          >
            <h3
              className="text-amber-950 text-[18px] mb-4"
              style={{ fontFamily: 'Noto Serif SC, serif', fontWeight: 600 }}
            >
              关于测试
            </h3>
            <p
              className="text-amber-700 text-[14px] leading-[1.7]"
              style={{ fontFamily: 'Noto Sans SC, sans-serif' }}
            >
              「Crush 香鉴」基于嗅觉心理学与人格特质理论，通过 10 道沉浸式情境题探索你的感官偏好与内心世界。我们将为你匹配 16 种灵魂人格之一，并推荐最适合你的本命香水。
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span
                className="bg-cream-dark text-amber-700 rounded-full px-3 py-1 text-[12px]"
                style={{ fontFamily: 'Noto Sans SC, sans-serif' }}
              >
                嗅觉心理学
              </span>
              <span
                className="bg-cream-dark text-amber-700 rounded-full px-3 py-1 text-[12px]"
                style={{ fontFamily: 'Noto Sans SC, sans-serif' }}
              >
                人格特质
              </span>
              <span
                className="bg-cream-dark text-amber-700 rounded-full px-3 py-1 text-[12px]"
                style={{ fontFamily: 'Noto Sans SC, sans-serif' }}
              >
                情境探索
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 人格 Bottom Sheet（保留 framer-motion） ─── */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseSheet}
              aria-hidden
            />
            <motion.div
              className="fixed left-0 right-0 bottom-0 z-40 bg-cream rounded-t-3xl px-6 pt-3.5 max-w-[390px] mx-auto"
              style={{ paddingBottom: 'calc(28px + var(--safe-bottom))' }}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'tween', duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              role="dialog"
              aria-modal="true"
              aria-label={`${selected.name} 人格详情`}
            >
              <div className="w-10 h-1 rounded-full bg-amber-300 mx-auto mb-4" aria-hidden />

              <div
                className="text-center text-amber-500 tracking-wide mb-1.5"
                style={{ fontSize: '12px', fontFamily: 'Noto Sans SC, sans-serif' }}
              >
                {selected.mbti} · {selected.direction}
              </div>

              <div
                className="text-center font-serif font-bold text-amber-950 mb-1.5"
                style={{ fontSize: '24px' }}
              >
                【 {selected.name} 】
              </div>

              <div
                className="text-center text-amber-600 mb-4"
                style={{ fontSize: '14px', fontFamily: 'Noto Sans SC, sans-serif' }}
              >
                {selected.tagline}
              </div>

              <p
                className="text-amber-700/80 mb-5 leading-[1.85]"
                style={{ fontSize: '14px', fontFamily: 'Noto Sans SC, sans-serif' }}
              >
                {selected.description}
              </p>

              <button
                onClick={() => handleViewReport(selected.name)}
                className="block w-full text-center bg-amber-700 text-white rounded-full mb-2.5 border-none cursor-pointer transition-all hover:bg-amber-800"
                style={{ fontSize: '15px', padding: '14px 0', fontFamily: 'Noto Sans SC, sans-serif' }}
                aria-label={`查看 ${selected.name} 示例报告`}
              >
                查看该人格示例报告
              </button>

              <button
                onClick={handleCloseSheet}
                className="block w-full text-center bg-transparent text-amber-700 py-3 border-none cursor-pointer"
                style={{ fontSize: '14px', fontFamily: 'Noto Sans SC, sans-serif' }}
                aria-label="关闭弹层"
              >
                我已经测过了，看看我的 ›
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </main>
  );
}
