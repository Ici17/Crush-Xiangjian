import { ImageResponse } from 'next/og';
import { PERSONALITIES, getRecommendations } from '@/lib/personalities';

export const runtime = 'edge';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('p') ?? '暗流';
  const p = PERSONALITIES.find((x) => x.name === name);
  const tagline = p?.tagline ?? '未知的灵魂香气';
  const firstRec = getRecommendations(name)[0];
  const brand = firstRec?.brand ?? '';
  const perfume = firstRec?.name ?? '';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(160deg, #2C1810 0%, #4A2E1A 55%, #FAF3EA 100%)',
          fontFamily: 'serif',
        }}
      >
        {/* 顶部标签 */}
        <div
          style={{
            display: 'flex',
            width: 1100,
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 40,
          }}
        >
          <span style={{ fontSize: 26, color: '#D4A574', letterSpacing: '0.35em' }}>
            YOUR SOUL SCENT
          </span>
          <span style={{ fontSize: 26, color: '#D4A574', letterSpacing: '0.15em' }}>
            Crush 香鉴
          </span>
        </div>

        {/* 人格名 */}
        <div
          style={{
            fontSize: 168,
            color: '#FAF3EA',
            fontWeight: 700,
            letterSpacing: '0.04em',
            lineHeight: 1,
            marginBottom: 24,
          }}
        >
          {name}
        </div>

        {/* tagline */}
        <div
          style={{
            fontSize: 40,
            color: '#D4A574',
            marginBottom: 56,
            fontStyle: 'italic',
            letterSpacing: '0.05em',
          }}
        >
          「{tagline}」
        </div>

        {/* 分隔线 */}
        <div
          style={{
            width: 480,
            height: 2,
            background: 'linear-gradient(90deg, transparent 0%, #D4A574 50%, transparent 100%)',
            marginBottom: 56,
          }}
        />

        {/* 本命香 */}
        {brand && perfume && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              background: 'rgba(250,243,234,0.08)',
              border: '1px solid rgba(212,165,116,0.3)',
              borderRadius: 24,
              padding: '28px 52px',
              marginBottom: 60,
            }}
          >
            <span style={{ fontSize: 22, color: '#D4A574', letterSpacing: '0.3em', marginBottom: 12 }}>
              本命香水
            </span>
            <span style={{ fontSize: 44, color: '#FAF3EA', fontWeight: 500 }}>
              {brand} · {perfume}
            </span>
          </div>
        )}

        {/* CTA */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <span style={{ fontSize: 28, color: '#FAF3EA', letterSpacing: '0.1em' }}>
            长按识别二维码 · 测你的灵魂香气 →
          </span>
        </div>

        {/* 二维码占位（白底方框） */}
        <div
          style={{
            width: 140,
            height: 140,
            background: '#FFFFFF',
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 24,
            fontSize: 14,
            color: '#8B5E3C',
          }}
        >
          {/* QR placeholder — replaced at render time by og:image service */}
          <span style={{ fontSize: 12, color: '#C4A882', textAlign: 'center', lineHeight: 1.4 }}>
            二维码
          </span>
        </div>

        {/* 底部 */}
        <div
          style={{
            position: 'absolute',
            bottom: 32,
            display: 'flex',
            width: 1100,
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 22, color: '#8B5E3C' }}>crushxiangjian.com</span>
          <span style={{ fontSize: 22, color: '#8B5E3C', fontStyle: 'italic' }}>
            找到与你共振的那一支香
          </span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
