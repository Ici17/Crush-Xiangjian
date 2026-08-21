import { ImageResponse } from 'next/og';
import QRCode from 'qrcode';
import { PERSONALITIES, getRecommendations, PERSONALITY_NAME_MAP } from '@/lib/personalities';

// edge runtime：ImageResponse 在 nodejs 下触发本机 sharp/libvips colourspace 异常，edge 渲染栈无此问题
export const runtime = 'edge';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawName = searchParams.get('p') ?? '暗流';
  const decoded = decodeURIComponent(rawName);
  const name = PERSONALITY_NAME_MAP[decoded] || decoded;
  const p = PERSONALITIES.find((x) => x.name === name);
  const tagline = p?.tagline ?? '未知的灵魂香气';
  const firstRec = getRecommendations(name)[0];
  const brand = firstRec?.brand ?? '';
  const perfume = firstRec?.name ?? '';

  // 真实可扫码二维码：指向该人格结果页（不再是占位白框）
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://crushxiangjian.com';
  const qrUrl = `${base}/result?p=${encodeURIComponent(name)}`;
  const qrSvg = await QRCode.toString(qrUrl, {
    type: 'svg',
    margin: 2,
    color: { dark: '#2C1810', light: '#FAF3EA' },
  });
  const qrDataUrl = `data:image/svg+xml;base64,${btoa(qrSvg)}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(160deg, #2C1810 0%, #4A2E1A 55%, #FAF3EA 100%)',
          fontFamily: 'serif',
        }}
      >
        {/* 顶部标签 */}
        <div
          style={{
            position: 'absolute',
            top: 32,
            left: 60,
            right: 60,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 24, color: '#D4A574', letterSpacing: '0.35em' }}>
            YOUR SOUL SCENT
          </span>
          <span style={{ fontSize: 24, color: '#D4A574', letterSpacing: '0.15em' }}>
            Crush 香鉴
          </span>
        </div>

        {/* 人格名 */}
        <div
          style={{
            position: 'absolute',
            top: 72,
            left: 0,
            width: 1200,
            display: 'flex',
            justifyContent: 'center',
            fontSize: 108,
            color: '#FAF3EA',
            fontWeight: 700,
            letterSpacing: '0.04em',
            lineHeight: 1,
          }}
        >
          {name}
        </div>

        {/* tagline */}
        <div
          style={{
            position: 'absolute',
            top: 176,
            left: 0,
            width: 1200,
            display: 'flex',
            justifyContent: 'center',
            fontSize: 34,
            color: '#D4A574',
            fontStyle: 'italic',
            letterSpacing: '0.05em',
            lineHeight: 1.3,
            textAlign: 'center',
            padding: '0 120px',
          }}
        >
          「{tagline}」
        </div>

        {/* 分隔线 */}
        <div
          style={{
            position: 'absolute',
            top: 222,
            left: 390,
            width: 420,
            height: 2,
            background: 'linear-gradient(90deg, transparent 0%, #D4A574 50%, transparent 100%)',
          }}
        />

        {/* 本命香 */}
        {brand && perfume && (
          <div
            style={{
              position: 'absolute',
              top: 240,
              left: 0,
              width: 1200,
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                background: 'rgba(250,243,234,0.08)',
                border: '1px solid rgba(212,165,116,0.3)',
                borderRadius: 20,
                padding: '18px 44px',
              }}
            >
              <span style={{ fontSize: 20, color: '#D4A574', letterSpacing: '0.3em', marginBottom: 10 }}>
                本命香水
              </span>
              <span style={{ fontSize: 40, color: '#FAF3EA', fontWeight: 500 }}>
                {brand} · {perfume}
              </span>
            </div>
          </div>
        )}

        {/* CTA + 真实二维码（并排） */}
        <div
          style={{
            position: 'absolute',
            top: 382,
            left: 0,
            width: 1200,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 24,
          }}
        >
          <span style={{ fontSize: 26, color: '#FAF3EA', letterSpacing: '0.1em', lineHeight: 1.4 }}>
            长按识别二维码 · 测你的灵魂香气 →
          </span>
          <img src={qrDataUrl} width={110} height={110} alt="二维码" style={{ borderRadius: 10 }} />
        </div>

        {/* 底部 */}
        <div
          style={{
            position: 'absolute',
            bottom: 28,
            left: 60,
            right: 60,
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 20, color: '#8B5E3C' }}>crushxiangjian.com</span>
          <span style={{ fontSize: 20, color: '#8B5E3C', fontStyle: 'italic' }}>
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
