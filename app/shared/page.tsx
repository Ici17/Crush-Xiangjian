import { Metadata } from 'next';
import { Suspense } from 'react';
import SharedViewClient from './SharedViewClient';

// 静态预渲染 16 人格 → 每种人格的 /shared?p=X 都有正确 og: 标签
export async function generateStaticParams() {
  const { PERSONALITIES } = await import('@/lib/personalities');
  return PERSONALITIES.map((p) => ({ p: p.name }));
}

// 服务器端生成 og: 标签，WeChat 爬虫可见
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}): Promise<Metadata> {
  const rawName = (await searchParams).p ?? '朋友';
  // 支持拼音 ID（如 chonglang）或中文名（如 冲浪）
  const { PERSONALITY_NAME_MAP, PERSONALITIES } = await import('@/lib/personalities');
  const name = PERSONALITY_NAME_MAP[rawName] || rawName;
  const p = PERSONALITIES.find((x) => x.name === name);
  const tagline = p?.tagline ?? '灵魂香气的秘密';
  const title = `${name}的香气人格 | Crush香鉴`;
  const description = `${name} · ${tagline}。测一测你的灵魂人格，找到与你共振的那支香。`;
  const ogImage = `/api/og?p=${encodeURIComponent(name)}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  };
}

// 页面加载时先读取 url 参数中的 p，再传给 client 组件
function SharedFallback() {
  return (
    <main className="min-h-dvh bg-cream flex items-center justify-center">
      <div className="text-amber-400 text-sm font-sans animate-pulse">加载中...</div>
    </main>
  );
}

export default async function SharedPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}) {
  const rawName = (await searchParams).p ?? '';

  return (
    <Suspense fallback={<SharedFallback />}>
      <SharedViewClient personalityName={rawName} />
    </Suspense>
  );
}
