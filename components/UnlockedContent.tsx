'use client';

import { useMemo, useState } from 'react';
import MemorySceneSection from './MemorySceneSection';

import {
  getHiddenFace,
  getScentBlueprint,
  getPerfumeDetails,
  getContrastScent,
  getUsageGuide,
  getPersonality,
  getScentAdvice,
  RADAR_DIMS,
  type RadarDim,
  type PerfumeDetail,
  type ContrastScent,
  type ScentAdvice,
  type UsageTip,
} from '@/lib/personalities';
import PerfumeBottle from '@/components/PerfumeBottle';
import RadarChart from '@/components/RadarChart';
import { ScentPreferenceBar } from '@/components/ScentPreferenceBar';

export const FAMILY_COLORS: Record<string, string> = {
  木质: '#5C3A24',
  花香: '#C8849E',
  柑橘: '#E8A13A',
  清新: '#6B9E8A',
  东方: '#8B5E3C',
  美食: '#D9773E',
};

export const FAMILY_BG: Record<string, string> = {
  木质: 'rgba(92,58,36,0.08)',
  花香: 'rgba(200,132,158,0.10)',
  柑橘: 'rgba(232,161,58,0.10)',
  清新: 'rgba(107,158,138,0.10)',
  东方: 'rgba(139,94,60,0.10)',
  美食: 'rgba(217,119,62,0.10)',
};

/** 截断香调列表：用 / 分割后保留前 N 项，超出部分加省略号 */
function truncateNotes(notes: string, max: number): string {
  const parts = notes.split(/[/\s·]+/).map((s) => s.trim()).filter(Boolean);
  if (parts.length <= max) return parts.join(' / ');
  return parts.slice(0, max).join(' / ') + ' …';
}

export function detectFamily(direction: string, notes: string | string[]): string {
  const noteText = Array.isArray(notes) ? notes.join(' ') : notes;
  const text = `${direction} ${noteText}`;
  const order = ['木质', '东方', '花香', '美食', '柑橘', '清新'];
  for (const k of order) if (text.includes(k)) return k;
  return '木质';
}

export default function UnlockedContent({
  personalityName,
  radarData,
  shareLink,
  justPaid = false,
  perfumes: providedPerfumes,
}: {
  personalityName: string;
  radarData: Record<RadarDim, number>;
  shareLink: string;
  justPaid?: boolean;
  perfumes?: PerfumeDetail[];
}) {
  const personality = useMemo(() => getPersonality(personalityName), [personalityName]);
  const perfumes = useMemo(
    () => providedPerfumes ?? getPerfumeDetails(personalityName),
    [providedPerfumes, personalityName]
  );
  const hidden = useMemo(() => getHiddenFace(personalityName), [personalityName]);
  const blueprint = useMemo(() => getScentBlueprint(personalityName), [personalityName]);
  const contrast = useMemo(() => getContrastScent(personalityName), [personalityName]);
  const guide = useMemo(() => getUsageGuide(personalityName), [personalityName]);
  const advice = useMemo(() => getScentAdvice(personalityName), [personalityName]);

  const radarGrid = useMemo(
    () =>
      RADAR_DIMS.map((dim) => ({
        dim,
        value: Math.round((radarData[dim] ?? 0) * 100),
      })),
    [radarData]
  );

  const contrastMatch = useMemo(() => {
    const self = Object.values(radarData).map((v) => v ?? 0);
    // 反差香匹配度：越远越“冒险”，显示 55–72%
    const avg = self.reduce((a, b) => a + b, 0) / self.length;
    return Math.min(72, Math.max(55, Math.round((1 - avg) * 100)));
  }, [radarData]);

  const descriptionParagraphs = useMemo(() => {
    return personality.description
      .split(/(?<=[。！？])/g)
      .map((s) => s.trim())
      .filter(Boolean);
  }, [personality.description]);

  return (
    <div className="animate-fadeIn space-y-10 pb-8">
      {justPaid && (
        <div
          className="shimmer mx-6 rounded-lg px-5 py-3 flex items-center gap-3"
          style={{ background: 'linear-gradient(120deg,#8B5E3C,#C4956A,#8B5E3C,#C4956A,#8B5E3C)' }}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-800 text-sm font-bold">
            ✓
          </span>
          <span className="text-sm font-medium tracking-wide text-amber-50">
            完整版已解锁 · 你的香气真相，尽在以下
          </span>
        </div>
      )}

      {/* ── 香气光谱：雷达图 ── */}
      <section className="px-6 pt-6 pb-8" aria-label="香气光谱">
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
            <li key={dim}>{dim}：{Math.round((val ?? 0) * 100)}%</li>
          ))}
        </ul>
      </section>

      {/* ━━━ 解析金句 ━━━ */}
      <div className="px-6 pb-2 text-center">
        <p className="font-serif text-amber-700/80 italic leading-7" style={{ fontSize: '14px' }}>
          「香气不是面具，是尚未被说出口的自我。」
        </p>
      </div>

      {/* ── 令人心动的瞬间 ── */}
      <MemorySceneSection
          personalityName={personalityName}
          perfume={perfumes.find(p => p.role === 'signature')}
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
          {perfumes.map((p) => (
            <PerfumeCard key={p.name} perfume={p} direction={personality.direction} />
          ))}
        </div>
      </section>

      {/* ━━━ 性格解读 ━━━ */}
      <section className="px-6" aria-label="性格解读">
        <div className="flex items-center justify-center gap-3 mb-7">
          <span className="h-px w-6 bg-amber-400" />
          <h2 className="font-serif text-lg font-medium text-amber-950">性格解读</h2>
          <span className="h-px w-6 bg-amber-400" />
        </div>
        <div className="space-y-4">
          {descriptionParagraphs.map((para, i) => (
            <p
              key={i}
              className="text-amber-800"
              style={{ fontSize: '16px', lineHeight: 1.75 }}
            >
              {para}
            </p>
          ))}
        </div>
        <div className="flex items-center justify-center gap-2 mt-5">
          <span className="h-px w-5 bg-amber-400" />
          <span className="w-1 h-1 rounded-full bg-amber-400" />
          <span className="h-px w-5 bg-amber-400" />
        </div>
      </section>

      {/* ━━━ 用香哲学 ━━━ */}
      <section className="px-6" aria-label="用香哲学">
        <div className="flex items-center justify-center gap-3 mb-7">
          <span className="h-px w-6 bg-amber-400" />
          <h2 className="font-serif text-lg font-medium text-amber-950">用香哲学</h2>
          <span className="h-px w-6 bg-amber-400" />
        </div>
        <p
          className="text-amber-800 italic text-center mb-5"
          style={{ fontSize: '16px', lineHeight: 1.75 }}
        >
          你的香水不是用来遮盖什么，而是用来提醒自己——你比你以为的更深。
        </p>
        <div className="space-y-3">
          {guide.map((g) => (
            <UsageCard key={g.scene} tip={g} />
          ))}
        </div>
      </section>

      {/* ━━━ 香调偏好 ━━━ */}
      <section className="px-6" aria-label="香调偏好">
        <div className="flex items-center justify-center gap-3 mb-7">
          <span className="h-px w-6 bg-amber-400" />
          <h2 className="font-serif text-lg font-medium text-amber-950">香调偏好</h2>
          <span className="h-px w-6 bg-amber-400" />
        </div>
        <div className="mb-5">
          <ScentPreferenceBar
            data={Object.fromEntries(radarGrid.map(({ dim, value }) => [dim, value]))}
          />
        </div>
        <div className="flex items-center justify-center gap-2 mb-4">
          <span className="h-px w-8 bg-amber-400" />
        </div>
        <h4 className="font-serif text-base font-medium text-amber-950 mb-3">推荐探索方向</h4>
        <ul className="space-y-2">
          <li className="text-sm text-amber-800" style={{ lineHeight: 1.7 }}>
            · {getTopDimName(radarData)} 是你的舒适区
          </li>
          <li className="text-sm text-amber-800" style={{ lineHeight: 1.7 }}>
            · {advice.explore1}
          </li>
          <li className="text-sm text-amber-800" style={{ lineHeight: 1.7 }}>
            · {advice.explore2}
          </li>
        </ul>
      </section>

      {/* ━━━ 关系解读 ━━━ */}
      <section className="px-6" aria-label="关系解读">
        <div className="flex items-center justify-center gap-3 mb-7">
          <span className="h-px w-6 bg-amber-400" />
          <h2 className="font-serif text-lg font-medium text-amber-950">关系解读</h2>
          <span className="h-px w-6 bg-amber-400" />
        </div>
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-white border border-amber-100 rounded-xl p-4">
            <h4 className="font-serif text-sm font-medium text-amber-950 mb-2">初次见面</h4>
            <p className="text-xs text-amber-800 leading-relaxed">
              {advice.firstMeeting}
            </p>
          </div>
          <div className="bg-white border border-amber-100 rounded-xl p-4">
            <h4 className="font-serif text-sm font-medium text-amber-950 mb-2">亲密关系</h4>
            <p className="text-xs text-amber-800 leading-relaxed">
              {advice.intimateRelation}
            </p>
          </div>
        </div>
        <p className="text-sm text-amber-800 leading-relaxed">
          <span className="font-serif font-medium text-amber-950">香气建议：</span>
          {advice.relationAdvice}
        </p>
      </section>

      {/* ── 朋友匹配入口 ── */}
      <section className="px-6 pb-2">
        <a
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
            <span className="text-amber-400" style={{ fontSize: '18px' }}>›</span>
          </div>
        </a>
      </section>

      {/* ── 隐藏人格面：深色杂志区块 ── */}
      <section
        className="mx-6 rounded-3xl p-8 animate-blurReveal"
        style={{ background: '#3D2817', color: '#FAF3EA' }}
        aria-label="隐藏人格面"
      >
        <p
          className="uppercase text-center mb-3"
          style={{ fontSize: '10px', letterSpacing: '0.3em', color: '#D4A574' }}
        >
          HIDDEN SIDE
        </p>
        <h3
          className="font-serif text-center font-medium mb-3"
          style={{ fontSize: '22px', color: '#D4A574' }}
        >
          你不知道的自己
        </h3>
        <div className="flex items-center justify-center gap-2 mb-5">
          <span className="h-px w-5" style={{ background: '#D4A574' }} />
          <span className="w-1 h-1 rounded-full" style={{ background: '#D4A574' }} />
          <span className="h-px w-5" style={{ background: '#D4A574' }} />
        </div>
        <p
          className="leading-relaxed mb-5"
          style={{ fontSize: '15px', lineHeight: 1.75, color: 'rgba(212,165,116,0.9)' }}
        >
          {hidden.content}
        </p>
        <div className="flex flex-wrap gap-2 mb-5">
          {hidden.traits.map((t) => (
            <span
              key={t}
              className="text-xs px-3 py-1.5 rounded-full"
              style={{ background: 'rgba(212,165,116,0.12)', color: '#D4A574' }}
            >
              {t}
            </span>
          ))}
        </div>
        <div
          className="rounded-xl p-4 text-center"
          style={{
            background: 'rgba(212,165,116,0.10)',
            border: '0.5px solid rgba(212,165,116,0.3)',
          }}
        >
          <p style={{ fontSize: '14px', color: '#D4A574' }}>
            试着这周做一件“不像你”的事
          </p>
        </div>
      </section>

      {/* ━━━ 反差香 ━━━ */}
      <section className="px-6" aria-label="反差香">
        <div className="flex items-center justify-center gap-3 mb-7">
          <span className="h-px w-6 bg-amber-400" />
          <h2 className="font-serif text-lg font-medium text-amber-950">反差香</h2>
          <span className="h-px w-6 bg-amber-400" />
        </div>
        <p className="text-center text-amber-700 mb-4" style={{ fontSize: '14px' }}>
          你不会选，但值得试
        </p>
        <div className="flex justify-center">
          <ContrastCard contrast={contrast} match={contrastMatch} direction={personality.direction} />
        </div>
      </section>

      {/* ━━━ 气味底稿 ━━━ */}
      <section className="px-6" aria-label="气味底稿">
        <div className="flex items-center justify-center gap-3 mb-7">
          <span className="h-px w-6 bg-amber-400" />
          <h2 className="font-serif text-lg font-medium text-amber-950">气味底稿</h2>
          <span className="h-px w-6 bg-amber-400" />
        </div>
        <p className="text-center text-amber-700 mb-5" style={{ fontSize: '14px' }}>
          你的专属香方起点
        </p>
        <BlueprintRows blueprint={blueprint} />
        <p
          className="mt-5 flex items-start gap-2 text-sm text-amber-700 leading-relaxed"
          style={{ lineHeight: 1.7 }}
        >
          <span>💡</span>
          <span>你可以带着这份底稿去香水店，让调香师帮你找到最接近的那一支。</span>
        </p>
      </section>
    </div>
  );
}

function getTopDimName(radarData: Record<RadarDim, number>): string {
  return RADAR_DIMS.reduce((a, b) => ((radarData[a] ?? 0) > (radarData[b] ?? 0) ? a : b));
}

/** 三调分层色阶：前调（浅）→ 中调（中）→ 后调（深），每个 chip 不同色调 */
const TIER_PALETTE: Record<'top' | 'heart' | 'base', { label: string; bg: string; text: string; labelColor: string }> = {
  top:   { label: '前', bg: '#F8EFD9', text: '#9A7B4E', labelColor: '#B8956A' }, // 浅金
  heart: { label: '中', bg: '#EFD9B8', text: '#8B5E3C', labelColor: '#9A6E3F' }, // 中琥珀
  base:  { label: '后', bg: '#D4A574', text: '#FBF6EE', labelColor: '#FAEEDA' }, // 深金
};

function NoteTier({
  tier,
  notes,
}: {
  tier: 'top' | 'heart' | 'base';
  notes: string[];
}) {
  const palette = TIER_PALETTE[tier];
  const isDeep = tier === 'base';
  return (
    <div className="flex items-center gap-2">
      {/* 左侧等级标 */}
      <span
        className="inline-flex items-center justify-center font-serif shrink-0"
        style={{
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          background: palette.bg,
          color: palette.labelColor,
          fontSize: '10px',
          fontWeight: 600,
        }}
        aria-label={`${palette.label}调`}
      >
        {palette.label}
      </span>
      {/* chip 列表 */}
      <div className="flex flex-wrap gap-1.5 flex-1">
        {notes.map((note) => (
          <span
            key={note}
            className="inline-block font-serif"
            style={{
              fontSize: '11px',
              padding: '3px 8px',
              borderRadius: '10px',
              background: palette.bg,
              color: palette.text,
              fontWeight: isDeep ? 500 : 400,
              border: isDeep ? 'none' : '0.5px solid rgba(154,123,78,0.18)',
            }}
          >
            {note}
          </span>
        ))}
      </div>
    </div>
  );
}

function PerfumeCard({ perfume, direction }: { perfume: PerfumeDetail; direction: string }) {
  const family = detectFamily(direction, perfume.top);
  const color = FAMILY_COLORS[family];
  const bg = FAMILY_BG[family];
  // 展示角色用 role（方案 B：本命香可能来自 advanced 池，tier 是真实档位）
  const tierLabel =
    perfume.role === 'signature' ? '本命香' : perfume.role === 'advanced' ? '进阶香' : '尝试香';
  const isSignature = perfume.role === 'signature';

  return (
    <article
      className="flex-none text-center p-5 rounded-2xl"
      style={{
        width: '200px',
        background: '#FDF8F3',
        border: isSignature ? '1.5px solid #BA7517' : '0.5px solid #D3D1C7',
      }}
      aria-label={`${tierLabel}：${perfume.name}`}
    >
      <span
        className="inline-block text-xs px-2.5 py-1 rounded-full mb-3"
        style={{ background: '#FAEEDA', color: '#8B5E3C' }}
      >
        {tierLabel}
      </span>
      {perfume.match > 0 && (
        <span className="inline-block text-xs px-2 py-0.5 rounded-full ml-1.5 mb-3" style={{ background: '#F5EDE0', color: '#8B5E3C' }}>
          匹配 {perfume.match}%
        </span>
      )}
      <div
        className="w-full h-[120px] rounded-2xl flex items-center justify-center mb-3"
        style={{ background: bg }}
      >
        <PerfumeBottle className="w-14 h-[90px]" stroke={color} />
      </div>
      <div className="font-serif font-medium text-amber-950 mb-1" style={{ fontSize: '16px' }}>
        {perfume.brand}
      </div>
      <div className="text-amber-800 mb-2" style={{ fontSize: '14px' }}>
        {perfume.name}
      </div>

      {/* 三调分层展示：渐进式色阶 + chip 药丸 */}
      <div className="space-y-2 mb-3">
        <NoteTier tier="top" notes={perfume.top} />
        <NoteTier tier="heart" notes={perfume.heart} />
        <NoteTier tier="base" notes={perfume.base} />
      </div>

      {/* 香调族 */}
      <div className="text-amber-600 mb-2" style={{ fontSize: '12px' }}>
        {family}调
      </div>

      {/* 价格区间 */}
      <div className="text-amber-500 mb-2" style={{ fontSize: '11px' }}>
        {perfume.priceRange}
      </div>

      {/* 扩散力 + 留香 */}
      <div className="flex justify-center gap-3 mb-3" style={{ fontSize: '10px', color: '#8B6F5C' }}>
        <span>扩散 {'●'.repeat(perfume.intensity)}{'○'.repeat(5 - perfume.intensity)}</span>
        <span>留香 {'●'.repeat(perfume.longevity)}{'○'.repeat(5 - perfume.longevity)}</span>
      </div>

      <p
        className="italic text-amber-700 leading-snug"
        style={{
          fontSize: '13px',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {perfume.quote}
      </p>
    </article>
  );
}

function UsageCard({ tip }: { tip: UsageTip }) {
  return (
    <div className="bg-white border border-amber-100 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <span style={{ fontSize: '18px' }}>{tip.icon}</span>
        <h4 className="font-sans text-sm font-medium text-amber-950">{tip.scene}</h4>
      </div>
      <p className="text-sm text-amber-800 leading-relaxed">{tip.text}</p>
    </div>
  );
}

function ContrastCard({
  contrast,
  match,
  direction,
}: {
  contrast: ContrastScent;
  match: number;
  direction: string;
}) {
  const family = detectFamily(direction, contrast.notes);
  return (
    <article
      className="text-center p-6 rounded-2xl"
      style={{ width: '260px', background: '#FDF8F3', border: '0.5px solid #D3D1C7' }}
    >
      <div
        className="w-full h-[120px] rounded-2xl flex items-center justify-center mb-4"
        style={{ background: FAMILY_BG[family] }}
      >
        <PerfumeBottle className="w-14 h-[90px]" stroke={FAMILY_COLORS[family]} />
      </div>
      {/* 品牌小标签（在产品名上方，与 PerfumeCard 风格一致） */}
      <div
        className="font-serif font-medium text-amber-950 mb-1"
        style={{ fontSize: '14px' }}
      >
        {contrast.brand}
      </div>
      {/* 产品名（短名自动拼接 brandCn/brand 增强识别） */}
      <h4
        className="font-serif text-amber-800 mb-2"
        style={{ fontSize: contrast.name.length <= 2 ? '20px' : '18px', fontWeight: 500 }}
      >
        {contrast.name.length <= 2
          ? `${contrast.brand} · ${contrast.name}`
          : contrast.name}
      </h4>
      {/* 香调截断（最多前 4 项，避免长列表压垮卡片） */}
      <p className="text-xs text-amber-700 mb-3" style={{ lineHeight: 1.5 }}>
        {truncateNotes(contrast.notes, 4)}
      </p>
      <p
        className="italic text-amber-800 leading-relaxed mb-4"
        style={{ fontSize: '14px' }}
      >
        {contrast.why}
      </p>
      <span
        className="inline-block text-xs px-3 py-1.5 rounded-full"
        style={{ background: '#F8EDD8', color: '#8B5E3C' }}
      >
        冒险匹配度：{match}%
      </span>
    </article>
  );
}

function BlueprintRows({ blueprint }: { blueprint: { top: string; heart: string; base: string; signature: string } }) {
  const rows = [
    { label: '前调', value: blueprint.top },
    { label: '中调', value: blueprint.heart },
    { label: '后调', value: blueprint.base },
  ];
  return (
    <div className="space-y-5">
      {rows.map((row) => (
        <div key={row.label}>
          <h4 className="font-serif text-base font-medium text-amber-950 mb-3">{row.label}</h4>
          <div className="flex flex-wrap gap-2">
            {row.value.split('·').map((m) => (
              <span
                key={m}
                className="text-sm px-4 py-2 rounded-lg text-amber-800"
                style={{ background: '#FAEEDA' }}
              >
                {m.trim()}
              </span>
            ))}
          </div>
        </div>
      ))}

      {/* ── 签名调性：拉开间距 + 装饰分隔符 ── */}
      <div className="pt-8 pb-2">
        {/* 装饰：渐隐短线 + 中央金色八角星 + 渐隐短线 */}
        <div className="flex items-center justify-center gap-2.5 mb-5">
          <span
            className="h-px block"
            style={{
              width: '40px',
              background: 'linear-gradient(90deg, transparent 0%, #D4A574 100%)',
            }}
          />
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
            <path
              d="M6 0L7 5L12 6L7 7L6 12L5 7L0 6L5 5L6 0Z"
              fill="#BA7517"
            />
          </svg>
          <span
            className="h-px block"
            style={{
              width: '40px',
              background: 'linear-gradient(90deg, #D4A574 0%, transparent 100%)',
            }}
          />
        </div>

        {/* 签名调性小标签 */}
        <div className="text-center">
          <span
            className="text-amber-600/70 font-sans"
            style={{ fontSize: '11px', letterSpacing: '0.2em' }}
          >
            签名调性
          </span>
          {/* 主文本：衬线大字号，强化仪式感 */}
          <div
            className="font-serif text-amber-950 mt-3"
            style={{ fontSize: '24px', fontWeight: 500, letterSpacing: '0.08em', lineHeight: 1.3 }}
          >
            {blueprint.signature}
          </div>
        </div>
      </div>
    </div>
  );
}

