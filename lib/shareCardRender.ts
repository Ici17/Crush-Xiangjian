/**
 * Crush香鉴 — 服务端分享图渲染 v2
 *
 * 三个场景：
 *   self    结果页本人（人格名 + 三香横排 + tagline）
 *   friend  朋友匹配页（A主B辅 + 圆环契合度）
 *   shared  /shared 分享卡（拉新为主 + 强CTA）
 *
 * 技术栈：satori（JSX→SVG）+ sharp（SVG→PNG）+ qrcode
 * 字体：Noto Serif SC（public/fonts，运行时读磁盘 / 失败则同源HTTP拉取）
 * 输出：1:1 (1080×1080) / 3:4 (1080×1440)
 *
 * ⚠️ satori 布局规则（v0.29）：
 *   1. 所有 <div> 必须显式 display: flex / contents / none
 *   2. inset shorthand 不支持 → 用 top/left/right/bottom
 *   3. gap 不支持 → 用 margin
 *   4. <p>/<ul> 等默认不是 flex → 用 <div>/<span> 代替
 *   5. 分隔线：用 <span> + border-top
 *   6. 绝对定位：父 div 需 display:flex，overlay 子 div 也需 display:flex
 */

import sharp from "sharp";
import QRCode from "qrcode";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ── 类型定义 ───────────────────────────────────────────────────────────────

export type ShareScene = "self" | "friend" | "shared";

export interface PerfumeCard {
  name: string;
  tier: string; // 本命香 | 进阶香 | 尝试香
  match: number; // 0-100
}

export interface SelfShareData {
  scene: "self";
  name: string;
  tagline: string; // 人格扎心短句（SHARE_QUOTES）
  perfumeA: PerfumeCard;
  perfumeB: PerfumeCard;
  perfumeC: PerfumeCard;
  // 锁定版内容（2026-08-13 改：分享图=锁定版，不含解锁内容）
  radar?: Record<string, number>; // 六维雷达 0~1（香气图谱）
  memoryScene?: string; // 记忆点区块文案
  format?: "1to1" | "3to4";
}

export interface FriendShareData {
  scene: "friend";
  nameA: string;
  nameB: string;
  perfumeNameA: string; // A 的本命香名
  perfumeNameB: string; // B 的本命香名
  score: number;
  tier: string;
  story: string;
  sharedNotes?: string[];
  // 新增 v2
  perfumeTierA?: string; // A 的本命香 tier
  perfumeTierB?: string; // B 的本命香 tier
  inviteCode: string;
  format?: "1to1" | "3to4";
}

export interface SharedShareData {
  scene: "shared";
  sharerName: string; // 分享者名字（人格名）
  name: string; // 人格名
  description: string; // 人格 description
  perfumeName: string; // 本命香名
  // 新增 v2
  perfumeTier?: string; // 本命香 tier
  blueprint?: { top: string[]; heart: string[]; base: string[] }; // 气味底稿
  radarTop3?: string[]; // 香调偏好 top 3 (3:4)
  inviteCode: string;
  format?: "1to1" | "3to4";
}

export type ShareCardData = SelfShareData | FriendShareData | SharedShareData;

// ── 颜色常量 ───────────────────────────────────────────────────────────────

const C = {
  BG: "#FAF3EA",
  AMBER_DARK: "#2C1810",
  AMBER_MID: "#5C3826",
  AMBER_ACCENT: "#C8A36A",
  AMBER_LIGHT: "#D4A574",
  AMBER_PALE: "#F8EAD9",
  TEXT_MUTED: "#8B6F5C",
  WHITE: "#FFFFFF",
};

// tier 颜色
const TIER_COLOR: Record<string, string> = {
  本命香: "#C4956A",
  进阶香: "#8B7A6B",
  尝试香: "#9BA8AB",
};
const TIER_BG: Record<string, string> = {
  本命香: "#FDF3E7",
  进阶香: "#F5F0EB",
  尝试香: "#F0F4F4",
};

// ── 字体管理 ───────────────────────────────────────────────────────────────

let _fontData: Buffer | null = null;

async function getFont(): Promise<Buffer> {
  if (_fontData) return _fontData;
  const __dir = (() => { try { return dirname(fileURLToPath(import.meta.url)); } catch { return ""; } })();
  const candidates = [
    join(process.cwd(), "public", "fonts", "NotoSerifSC.woff"),
    join(__dir, "..", "..", "..", "public", "fonts", "NotoSerifSC.woff"),
    join(__dir, "..", "public", "fonts", "NotoSerifSC.woff"),
    join(__dir, "public", "fonts", "NotoSerifSC.woff"),
    "/var/task/public/fonts/NotoSerifSC.woff",
  ].filter(Boolean);
  for (const p of candidates) {
    try {
      const buf = readFileSync(p);
      if (buf.byteLength > 0) { _fontData = buf; return _fontData; }
    } catch { /* try next */ }
  }
  // HTTP 兜底
  try {
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? "https://crushxiangjian.com";
    const res = await fetch(`${base}/fonts/NotoSerifSC.woff`);
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.byteLength > 0) { _fontData = buf; return _fontData; }
    }
  } catch (e) {
    console.error("[shareCard] Font HTTP failed:", (e as Error).message);
  }
  _fontData = Buffer.alloc(0);
  return _fontData;
}

// ── 二维码生成 ─────────────────────────────────────────────────────────────

async function generateQR(url: string, size: number): Promise<string> {
  const buf = await QRCode.toBuffer(url, {
    errorCorrectionLevel: "M",
    type: "png",
    width: size,
    margin: 2,
    color: { dark: C.AMBER_DARK, light: C.WHITE },
  });
  return `data:image/png;base64,${buf.toString("base64")}`;
}

// ── 渐变圆环 SVG ───────────────────────────────────────────────────────────

function buildRingSVG(score: number, size: number): string {
  const cx = size / 2, cy = size / 2;
  const r = Math.round(size * 0.2);
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - score / 100);
  const strokeW = Math.round(size * 0.028);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs>
      <linearGradient id="rg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#D4A574"/>
        <stop offset="100%" stop-color="#5C3826"/>
      </linearGradient>
    </defs>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(44,24,16,0.10)" stroke-width="${strokeW}"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="url(#rg)" stroke-width="${strokeW}"
      stroke-linecap="round"
      stroke-dasharray="${circumference}"
      stroke-dashoffset="${dashOffset}"
      transform="rotate(-90 ${cx} ${cy})"/>
  </svg>`;
}

// ── 香水瓶 SVG（代码画瓶型，无外部图片）────────────────────────────────────

function buildBottleSVG(tier: string, size: number): string {
  const color = TIER_COLOR[tier] ?? C.AMBER_ACCENT;
  const dark = C.AMBER_DARK;
  // 瓶型比例：总高 size，瓶身 68%，瓶盖 18%，瓶口 14%
  const bodyH = Math.round(size * 0.68);
  const capH = Math.round(size * 0.18);
  const neckH = Math.round(size * 0.14);
  const bodyW = Math.round(size * 0.58);
  const capW = Math.round(size * 0.32);
  const bodyX = (size - bodyW) / 2;
  const bodyY = capH + neckH;
  const capX = (size - capW) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs>
      <linearGradient id="bottleGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="${color}" stop-opacity="0.85"/>
        <stop offset="40%" stop-color="${color}"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0.70"/>
      </linearGradient>
    </defs>
    <!-- 瓶盖 -->
    <rect x="${capX}" y="0" width="${capW}" height="${capH}" rx="${Math.round(capW*0.25)}" fill="${dark}"/>
    <!-- 瓶颈 -->
    <rect x="${(size-capW*0.5)/2}" y="${capH}" width="${Math.round(capW*0.5)}" height="${neckH}" fill="${color}" opacity="0.9"/>
    <!-- 瓶身 -->
    <rect x="${bodyX}" y="${bodyY}" width="${bodyW}" height="${bodyH}" rx="${Math.round(bodyW*0.12)}" fill="url(#bottleGrad)"/>
    <!-- 高光 -->
    <rect x="${bodyX+Math.round(bodyW*0.12)}" y="${bodyY+Math.round(bodyH*0.05)}" width="${Math.round(bodyW*0.12)}" height="${Math.round(bodyH*0.55)}" rx="${Math.round(bodyW*0.06)}" fill="${C.WHITE}" opacity="0.25"/>
  </svg>`;
}

// ── 香气图谱（六维雷达图）──────────────────────────────────────────────────
// 维度顺序：上=木质，顺时针 → 清新 → 东方 → 美食 → 柑橘 → 花香
const RADAR_DIM_LIST = ['木质', '清新', '东方', '美食', '柑橘', '花香'];

function buildRadarSVG(values: Record<string, number>, size: number): string {
  const VB = 280;
  const CX = VB / 2;
  const CY = VB / 2;
  const R = 92;
  const N = RADAR_DIM_LIST.length;
  const RINGS = [0.2, 0.4, 0.6, 0.8, 1];
  const toXY = (radius: number, angleDeg: number): [number, number] => {
    const a = (angleDeg * Math.PI) / 180;
    return [CX + radius * Math.cos(a), CY + radius * Math.sin(a)];
  };
  const angleOf = (i: number) => -90 + i * (360 / N);
  const VISUAL_FLOOR = 0.22;
  const visualValue = (v: number) => VISUAL_FLOOR + v * (1 - VISUAL_FLOOR);
  const ringPoints = (radius: number): string =>
    RADAR_DIM_LIST.map((_, i) => toXY(radius, angleOf(i)).join(',')).join(' ');
  const dataPoints = RADAR_DIM_LIST.map((dim, i) =>
    toXY(R * visualValue(values[dim] ?? 0), angleOf(i)).join(',')
  ).join(' ');

  const labelPos = (i: number) => {
    const angle = angleOf(i);
    const rad = R + 22;
    const [x, y] = toXY(rad, angle);
    const anchor = Math.abs(Math.cos((angle * Math.PI) / 180)) < 0.25
      ? 'middle'
      : Math.cos((angle * Math.PI) / 180) > 0
      ? 'start'
      : 'end';
    return { x, y, anchor };
  };

  const ringsSvg = RINGS.map((scale, idx) =>
    `<polygon points="${ringPoints(R * scale)}" fill="none" stroke="#D4A574" stroke-opacity="${idx === RINGS.length - 1 ? 0.6 : 0.32}" stroke-width="${idx === RINGS.length - 1 ? 1.5 : 1.0}" ${idx === RINGS.length - 1 ? '' : 'stroke-dasharray="2 3"'}/>`
  ).join('');

  const axesSvg = RADAR_DIM_LIST.map((_, i) => {
    const [x, y] = toXY(R, angleOf(i));
    return `<line x1="${CX}" y1="${CY}" x2="${x}" y2="${y}" stroke="#D4A574" stroke-opacity="0.32" stroke-width="0.8"/>`;
  }).join('');

  const dotsSvg = RADAR_DIM_LIST.map((dim, i) => {
    const [x, y] = toXY(R * visualValue(values[dim] ?? 0), angleOf(i));
    return `<circle cx="${x}" cy="${y}" r="2.6" fill="#B4783C" stroke="#FBF6EE" stroke-width="1.2"/>`;
  }).join('');

  const labelsSvg = RADAR_DIM_LIST.map((dim, i) => {
    const pos = labelPos(i);
    const yOffset =
      Math.sin((angleOf(i) * Math.PI) / 180) < -0.5
        ? pos.y - 2
        : Math.sin((angleOf(i) * Math.PI) / 180) > 0.5
        ? pos.y + 12
        : pos.y + 4;
    return `<text x="${pos.x}" y="${yOffset}" text-anchor="${pos.anchor}" fill="#6F4E37" font-size="13" font-family="'Noto Serif SC', serif" font-weight="500">${dim}</text>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${VB} ${VB}">
    <g stroke="#D4A574" fill="none">${ringsSvg}</g>
    <g>${axesSvg}</g>
    <polygon points="${dataPoints}" fill="rgba(196,149,106,0.16)" stroke="#B4783C" stroke-width="2.0" stroke-linejoin="round"/>
    <g>${dotsSvg}</g>
    <g>${labelsSvg}</g>
  </svg>`;
}

// ── 底部品牌行（共用）──────────────────────────────────────────────────────

function brandRow(qrBase64: string, qrSize: number, showBrand = true) {
  return {
    type: "bottom",
    qrBase64,
    qrSize,
    showBrand,
  };
}

// ── 核心渲染函数（分发三场景）──────────────────────────────────────────────

export async function renderShareCard(
  data: ShareCardData,
  format: "1to1" | "3to4" = "1to1"
): Promise<Buffer> {
  const fontData = await getFont();
  const W = 1080;
  const H = format === "1to1" ? 1080 : 1440;
  const pad = format === "3to4" ? "80px 64px" : "64px";
  const qrSize = format === "1to1" ? 130 : 150;

  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "https://crushxiangjian.com";

  // 动态导入 satori
  // @ts-ignore
  const satoriMod: any = await import("satori");
  const satori = satoriMod.default;
  // @ts-ignore
  const jsxMod: any = await import("satori/jsx/jsx-runtime");
  const JSX = jsxMod.jsx;

  // QR 目标 URL 按场景决定
  let qrUrl = base;
  if (data.scene === "friend" || data.scene === "shared") {
    const code = (data as FriendShareData | SharedShareData).inviteCode;
    if (code) qrUrl = `${base}/friend?inv=${code}`;
  }

  const qrBase64 = await generateQR(qrUrl, qrSize);

  // 分场景渲染
  let root: any;
  if (data.scene === "self") {
    root = buildSelfCard(JSX, data as SelfShareData, W, H, pad, qrBase64, qrSize, base, fontData);
  } else if (data.scene === "friend") {
    root = buildFriendCard(JSX, data as FriendShareData, W, H, pad, qrBase64, qrSize, base, satori, buildRingSVG, fontData);
  } else {
    root = buildSharedCard(JSX, data as SharedShareData, W, H, pad, qrBase64, qrSize, base, buildBottleSVG, fontData);
  }

  const svgRaw = await (satori as any)(root, {
    width: W, height: H,
    fonts: fontData.byteLength > 0
      ? [
          { name: "Noto Serif SC", data: fontData, weight: 400 as const, style: "normal" as const },
          { name: "Noto Serif SC", data: fontData, weight: 700 as const, style: "normal" as const },
        ]
      : [],
  });

  const pngBuffer = await sharp(Buffer.from(svgRaw)).png({ compressionLevel: 8 }).toBuffer();
  return pngBuffer;
}

// ─────────────────────────────────────────────────────────────────────────────
// 场景一：结果页本人（self）
// 布局：人格名大字 → 三香横排 → tagline → 品牌行+QR
// ─────────────────────────────────────────────────────────────────────────────

function buildSelfCard(
  JSX: any, d: SelfShareData, W: number, H: number, pad: string,
  qrBase64: string, qrSize: number, _base: string, fontData: Buffer
) {
  const is3to4 = H > W;

  // 人格名大字
  const nameBlock = JSX("div", {
    style: { display: "flex", flexDirection: "column", alignItems: "center", marginBottom: is3to4 ? "28px" : "24px" },
    children: [
      JSX("span", {
        style: { color: C.AMBER_DARK, fontSize: is3to4 ? "88px" : "72px", fontWeight: 700, lineHeight: 1, letterSpacing: "0.08em" },
        children: d.name,
      }),
    ],
  });

  // 三香横排卡
  const perfumeCards = [d.perfumeA, d.perfumeB, d.perfumeC].map((p, i) => {
    const bottleSize = is3to4 ? 140 : 120;
    const bottleSVG = `data:image/svg+xml;base64,${Buffer.from(buildBottleSVG(p.tier, bottleSize)).toString("base64")}`;
    const tierColor = TIER_COLOR[p.tier] ?? C.AMBER_ACCENT;
    const tierBg = TIER_BG[p.tier] ?? C.AMBER_PALE;
    const cardW = is3to4 ? 280 : 260;
    const cardH = is3to4 ? 240 : 210;

    return JSX("div", {
      key: i,
      style: {
        display: "flex", flexDirection: "column", alignItems: "center",
        width: `${cardW}px`, minHeight: `${cardH}px`,
        background: C.WHITE,
        borderRadius: "16px",
        border: `1px solid ${C.AMBER_LIGHT}50`,
        padding: `${is3to4 ? "18px" : "14px"} ${is3to4 ? "12px" : "10px"}`,
        boxShadow: `0 2px 12px rgba(92,56,38,0.08)`,
      },
      children: [
        // 瓶型图
        JSX("img", {
          src: bottleSVG, width: bottleSize, height: bottleSize,
          style: { display: "block", marginBottom: "10px" },
        }),
        // 香水名
        JSX("span", {
          style: { color: C.AMBER_DARK, fontSize: "20px", fontWeight: 700, textAlign: "center", marginBottom: "6px", lineHeight: 1.2 },
          children: p.name,
        }),
        // tier 徽章
        JSX("div", {
          style: {
            display: "flex", alignItems: "center", justifyContent: "center",
            background: tierBg, borderRadius: "999px",
            padding: "4px 14px", marginBottom: "6px",
            border: `1px solid ${tierColor}40`,
          },
          children: [
            JSX("span", { style: { color: tierColor, fontSize: "18px", fontWeight: 600 }, children: p.tier }),
          ],
        }),
        // match%
        JSX("span", {
          style: { color: C.AMBER_ACCENT, fontSize: "20px", fontWeight: 700 },
          children: `${p.match}%`,
        }),
      ],
    });
  });

  const perfumesRow = JSX("div", {
    style: { display: "flex", flexDirection: "row", alignItems: "stretch", justifyContent: "center", gap: is3to4 ? "16px" : "12px", marginBottom: is3to4 ? "24px" : "20px" },
    children: perfumeCards,
  });

  // tagline 扎心句
  const taglineEl = JSX("div", {
    style: { display: "flex", flexDirection: "column", alignItems: "center", marginBottom: is3to4 ? "16px" : "12px" },
    children: [
      JSX("span", {
        style: { color: C.AMBER_MID, fontSize: is3to4 ? "26px" : "22px", textAlign: "center", lineHeight: 1.5, fontStyle: "italic" },
        children: d.tagline,
      }),
    ],
  });

  // ━━ 香气图谱（六维雷达图）━━
  const radarEl = d.radar ? (() => {
    const radarSize = is3to4 ? 320 : 220;
    const radarSVG = `data:image/svg+xml;base64,${Buffer.from(buildRadarSVG(d.radar, radarSize)).toString("base64")}`;
    return JSX("div", {
      style: { display: "flex", flexDirection: "column", alignItems: "center", marginBottom: is3to4 ? "20px" : "16px" },
      children: [
        JSX("span", { style: { color: C.TEXT_MUTED, fontSize: "16px", marginBottom: "8px" }, children: "香气图谱" }),
        JSX("img", { src: radarSVG, width: radarSize, height: radarSize, style: { display: "block" } }),
      ],
    });
  })() : null;

  // ━━ 记忆点区块（令人心动的瞬间）━━
  const memoryEl = d.memoryScene ? JSX("div", {
    style: { display: "flex", flexDirection: "column", alignItems: "center", marginBottom: is3to4 ? "20px" : "16px", paddingHorizontal: "16px" },
    children: [
      JSX("div", {
        style: { display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: "10px", width: "100%" },
        children: [
          JSX("span", { style: { flexGrow: 1, height: "1px", background: C.AMBER_LIGHT }, children: "" }),
          JSX("span", { style: { color: C.AMBER_DARK, fontSize: "20px", fontWeight: 500, marginLeft: "12px", marginRight: "12px", whiteSpace: "nowrap" }, children: "令人心动的瞬间" }),
          JSX("span", { style: { flexGrow: 1, height: "1px", background: C.AMBER_LIGHT }, children: "" }),
        ],
      }),
      JSX("span", {
        style: { color: C.AMBER_MID, fontSize: is3to4 ? "20px" : "17px", textAlign: "center", lineHeight: 1.7 },
        children: d.memoryScene,
      }),
    ],
  }) : null;

  // 品牌行 + QR
  const bottomRow = JSX("div", {
    style: { display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", paddingTop: "16px", borderTop: `1px solid ${C.AMBER_LIGHT}40` },
    children: [
      JSX("div", {
        style: { display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "center" },
        children: [
          JSX("span", { style: { color: C.AMBER_DARK, fontSize: "20px", fontWeight: 600, letterSpacing: "0.04em" }, children: "Crush 香鉴" }),
          JSX("span", { style: { color: C.AMBER_MID, fontSize: "14px", fontStyle: "italic", lineHeight: 1.4, marginTop: "4px" }, children: "你身上，藏着哪种香气？" }),
        ],
      }),
      JSX("img", {
        src: qrBase64, width: qrSize, height: qrSize,
        style: { borderRadius: "10px", border: `1px solid ${C.AMBER_LIGHT}60`, background: C.WHITE },
      }),
    ],
  });

  const centerChildren: any[] = [nameBlock, taglineEl, memoryEl, perfumesRow];
  if (radarEl && is3to4) centerChildren.push(radarEl);

  return JSX("div", {
    style: {
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between",
      width: `${W}px`, height: `${H}px`,
      background: C.BG, padding: pad,
      fontFamily: fontData.byteLength > 0 ? '"Noto Serif SC"' : "serif",
    },
    children: [
      JSX("div", {
        style: { display: "flex", flexDirection: "column", alignItems: "center", flexGrow: 1, justifyContent: "center" },
        children: centerChildren,
      }),
      bottomRow,
    ],
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 场景二：朋友匹配页（friend）
// 布局：A 60%左 / B 40%右 → 圆环居中契合度 → tier → 关系句 → 品牌行+QR
// ─────────────────────────────────────────────────────────────────────────────

function buildFriendCard(
  JSX: any, d: FriendShareData, W: number, H: number, pad: string,
  qrBase64: string, qrSize: number, _base: string, _satori: any, buildRingSVGFn: (score: number, size: number) => string, fontData: Buffer
) {
  const is3to4 = H > W;
  const ringSize = is3to4 ? 260 : 220;

  const ringBase64 = `data:image/svg+xml;base64,${Buffer.from(buildRingSVGFn(d.score, ringSize)).toString("base64")}`;

  // 顶部品牌行
  const brandLine = JSX("div", {
    style: { display: "flex", flexDirection: "row", alignItems: "center", width: "100%", marginBottom: is3to4 ? "24px" : "20px" },
    children: [
      JSX("span", { style: { flexGrow: 1, borderTop: `1px solid ${C.AMBER_LIGHT}` }, children: "" }),
      JSX("span", {
        style: { color: C.TEXT_MUTED, fontSize: "22px", letterSpacing: "0.2em", whiteSpace: "nowrap", marginLeft: "8px", marginRight: "8px" },
        children: "Crush 香鉴",
      }),
      JSX("span", { style: { flexGrow: 1, borderTop: `1px solid ${C.AMBER_LIGHT}` }, children: "" }),
    ],
  });

  // 双人名字行（60% / 40%）
  const nameRow = JSX("div", {
    style: { display: "flex", flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", width: "100%", marginBottom: is3to4 ? "20px" : "16px" },
    children: [
      JSX("div", {
        style: { display: "flex", flexDirection: "column", alignItems: "flex-start", flex: "0 0 60%" },
        children: [
          JSX("span", { style: { color: C.AMBER_DARK, fontSize: is3to4 ? "72px" : "58px", fontWeight: 700, lineHeight: 1.1 }, children: d.nameA }),
          JSX("span", { style: { color: C.TEXT_MUTED, fontSize: "20px", marginTop: "6px" }, children: d.perfumeNameA }),
        ],
      }),
      JSX("div", {
        style: { display: "flex", flexDirection: "column", alignItems: "flex-end", flex: "0 0 36%" },
        children: [
          JSX("span", { style: { color: C.AMBER_DARK, fontSize: is3to4 ? "60px" : "48px", fontWeight: 700, lineHeight: 1.1 }, children: d.nameB }),
          JSX("span", { style: { color: C.TEXT_MUTED, fontSize: "18px", marginTop: "6px" }, children: d.perfumeNameB }),
        ],
      }),
    ],
  });

  // 圆环 + 契合度（居中）
  const ringOverlay = JSX("div", {
    style: {
      position: "absolute", top: "0px", left: "0px", right: "0px", bottom: "0px",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    },
    children: [
      JSX("span", { style: { color: C.AMBER_DARK, fontSize: is3to4 ? "80px" : "68px", fontWeight: 700, lineHeight: 1 }, children: String(d.score) }),
    ],
  });
  const ringContainer = JSX("div", {
    style: { position: "relative", display: "flex", width: `${ringSize}px`, height: `${ringSize}px`, marginBottom: "16px" },
    children: [
      JSX("img", { src: ringBase64, width: ringSize, height: ringSize, style: { position: "absolute", top: "0px", left: "0px" } }),
      ringOverlay,
    ],
  });
  const scoreLabelEl = JSX("div", {
    style: { display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: "20px" },
    children: [JSX("span", { style: { color: C.AMBER_MID, fontSize: "24px", fontWeight: 600 }, children: `% 共鸣度` })],
  });

  // tier 徽章
  const tierBadge = JSX("div", {
    style: {
      display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center",
      background: C.AMBER_PALE, borderRadius: "999px",
      padding: "10px 28px", marginBottom: is3to4 ? "20px" : "16px",
      border: `1px solid ${C.AMBER_ACCENT}40`,
    },
    children: [JSX("span", { style: { color: C.AMBER_MID, fontSize: "26px", fontWeight: 600 }, children: d.tier })],
  });

  // 关系解读句
  const storyEl = JSX("div", {
    style: { display: "flex", flexDirection: "column", alignItems: "center", marginBottom: is3to4 ? "16px" : "12px" },
    children: [
      JSX("span", { style: { color: C.TEXT_MUTED, fontSize: "22px", textAlign: "center", lineHeight: 1.5 }, children: d.story }),
    ],
  });

  // 共享香调（仅 3:4）
  const sharedNotesEl = is3to4 && d.sharedNotes && d.sharedNotes.length > 0
    ? JSX("div", {
        style: { display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: "16px" },
        children: [JSX("span", { style: { color: C.TEXT_MUTED, fontSize: "20px" }, children: `共享 ${d.sharedNotes.join(" · ")}` })],
      })
    : null;

  // 品牌行 + QR
  const bottomRow = JSX("div", {
    style: { display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", paddingTop: "16px", borderTop: `1px solid ${C.AMBER_LIGHT}40` },
    children: [
      JSX("div", {
        style: { display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "center" },
        children: [
          JSX("span", { style: { color: C.AMBER_DARK, fontSize: "20px", fontWeight: 600, letterSpacing: "0.04em" }, children: "Crush 香鉴" }),
          JSX("span", { style: { color: C.AMBER_MID, fontSize: "14px", fontStyle: "italic", lineHeight: 1.4, marginTop: "4px" }, children: "你身上，藏着哪种香气？" }),
        ],
      }),
      JSX("img", {
        src: qrBase64, width: qrSize, height: qrSize,
        style: { borderRadius: "10px", border: `1px solid ${C.AMBER_LIGHT}60`, background: C.WHITE },
      }),
    ],
  });

  const centerChildren: any[] = [nameRow, ringContainer, scoreLabelEl, tierBadge, storyEl];
  if (sharedNotesEl) centerChildren.push(sharedNotesEl);

  return JSX("div", {
    style: {
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between",
      width: `${W}px`, height: `${H}px`,
      background: C.BG, padding: pad,
      fontFamily: fontData.byteLength > 0 ? '"Noto Serif SC"' : "serif",
    },
    children: [
      JSX("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", flexGrow: 1, justifyContent: "center" }, children: [brandLine, ...centerChildren] }),
      bottomRow,
    ],
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 场景三：/shared 分享卡（shared）
// 布局：品牌行 → "这是 XXX 的香气" 副标题 → 人格名大字 → description → 本命香瓶+名 → CTA大字 → 品牌行+QR
// ─────────────────────────────────────────────────────────────────────────────

function buildSharedCard(
  JSX: any, d: SharedShareData, W: number, H: number, pad: string,
  qrBase64: string, qrSize: number, _base: string, buildBottleSVGFn: (tier: string, size: number) => string, fontData: Buffer
) {
  const is3to4 = H > W;
  const bottleSize = is3to4 ? 200 : 170;
  const bottleSVG = `data:image/svg+xml;base64,${Buffer.from(buildBottleSVGFn("本命香", bottleSize)).toString("base64")}`;

  // 品牌行
  const brandLine = JSX("div", {
    style: { display: "flex", flexDirection: "row", alignItems: "center", width: "100%", marginBottom: is3to4 ? "24px" : "20px" },
    children: [
      JSX("span", { style: { flexGrow: 1, borderTop: `1px solid ${C.AMBER_LIGHT}` }, children: "" }),
      JSX("span", {
        style: { color: C.TEXT_MUTED, fontSize: "22px", letterSpacing: "0.2em", whiteSpace: "nowrap", marginLeft: "8px", marginRight: "8px" },
        children: "Crush 香鉴",
      }),
      JSX("span", { style: { flexGrow: 1, borderTop: `1px solid ${C.AMBER_LIGHT}` }, children: "" }),
    ],
  });

  // 副标题
  const subtitle = JSX("div", {
    style: { display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: "12px" },
    children: [
      JSX("span", { style: { color: C.TEXT_MUTED, fontSize: "22px" }, children: `这是 ${d.sharerName} 的香气` }),
    ],
  });

  // 人格名大字
  const nameBlock = JSX("div", {
    style: { display: "flex", flexDirection: "column", alignItems: "center", marginBottom: is3to4 ? "20px" : "16px" },
    children: [
      JSX("span", {
        style: { color: C.AMBER_DARK, fontSize: is3to4 ? "96px" : "80px", fontWeight: 700, lineHeight: 1, letterSpacing: "0.06em" },
        children: d.name,
      }),
    ],
  });

  // description
  const descEl = JSX("div", {
    style: { display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: is3to4 ? "28px" : "24px" },
    children: [
      JSX("span", { style: { color: C.AMBER_MID, fontSize: is3to4 ? "24px" : "22px", textAlign: "center", lineHeight: 1.5 }, children: d.description }),
    ],
  });

  // 本命香瓶 + 名
  const perfumeBlock = JSX("div", {
    style: {
      display: "flex", flexDirection: "column", alignItems: "center",
      background: C.WHITE, borderRadius: "20px",
      border: `1px solid ${C.AMBER_LIGHT}50`,
      padding: is3to4 ? "24px 32px" : "20px 28px",
      marginBottom: is3to4 ? "28px" : "24px",
      boxShadow: `0 4px 20px rgba(92,56,38,0.10)`,
    },
    children: [
      JSX("img", { src: bottleSVG, width: bottleSize, height: bottleSize, style: { display: "block", marginBottom: "12px" } }),
      JSX("span", { style: { color: C.AMBER_DARK, fontSize: is3to4 ? "24px" : "22px", fontWeight: 700, textAlign: "center", marginBottom: "8px" }, children: d.perfumeName }),
      JSX("div", {
        style: { display: "flex", alignItems: "center", justifyContent: "center", background: TIER_BG["本命香"], borderRadius: "999px", padding: "5px 18px", border: `1px solid ${TIER_COLOR["本命香"]}40` },
        children: [JSX("span", { style: { color: TIER_COLOR["本命香"], fontSize: "18px", fontWeight: 600 }, children: "本命香" })],
      }),
    ],
  });

  // CTA
  const ctaEl = JSX("div", {
    style: { display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: is3to4 ? "20px" : "16px" },
    children: [
      JSX("span", {
        style: { color: C.AMBER_ACCENT, fontSize: is3to4 ? "30px" : "26px", fontWeight: 700, letterSpacing: "0.04em" },
        children: "3 分钟测你的香气 >",
      }),
    ],
  });

  // 品牌行 + QR
  const bottomRow = JSX("div", {
    style: { display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", paddingTop: "16px", borderTop: `1px solid ${C.AMBER_LIGHT}40` },
    children: [
      JSX("div", {
        style: { display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "center" },
        children: [
          JSX("span", { style: { color: C.AMBER_DARK, fontSize: "20px", fontWeight: 600, letterSpacing: "0.04em" }, children: "Crush 香鉴" }),
          JSX("span", { style: { color: C.AMBER_MID, fontSize: "14px", fontStyle: "italic", lineHeight: 1.4, marginTop: "4px" }, children: "你身上，藏着哪种香气？" }),
        ],
      }),
      JSX("img", {
        src: qrBase64, width: qrSize, height: qrSize,
        style: { borderRadius: "10px", border: `1px solid ${C.AMBER_LIGHT}60`, background: C.WHITE },
      }),
    ],
  });

  return JSX("div", {
    style: {
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between",
      width: `${W}px`, height: `${H}px`,
      background: C.BG, padding: pad,
      fontFamily: fontData.byteLength > 0 ? '"Noto Serif SC"' : "serif",
    },
    children: [
      JSX("div", {
        style: { display: "flex", flexDirection: "column", alignItems: "center", flexGrow: 1, justifyContent: "center" },
        children: [brandLine, subtitle, nameBlock, descEl, perfumeBlock, ctaEl],
      }),
      bottomRow,
    ],
  });
}

// ── 内存缓存（LRU，50 条 / 5 分钟 TTL）────────────────────────────────────

const _cache = new Map<string, { buffer: Buffer; ts: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX = 50;

function _cacheKey(data: ShareCardData, format: string) {
  const base = `${data.scene}|${format}`;
  if (data.scene === "self") {
    const d = data as SelfShareData;
    return `${base}|${d.name}|${d.perfumeA.match}|${d.perfumeB.match}|${d.perfumeC.match}`;
  } else if (data.scene === "friend") {
    const d = data as FriendShareData;
    return `${base}|${d.nameA}|${d.nameB}|${d.score}`;
  } else {
    const d = data as SharedShareData;
    return `${base}|${d.sharerName}|${d.name}`;
  }
}

export async function renderShareCardCached(
  data: ShareCardData,
  format: "1to1" | "3to4" = "1to1"
): Promise<Buffer> {
  const key = _cacheKey(data, format);
  const cached = _cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.buffer;

  const buffer = await renderShareCard(data, format);

  if (_cache.size >= CACHE_MAX) {
    const oldest = [..._cache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
    _cache.delete(oldest[0]);
  }
  _cache.set(key, { buffer, ts: Date.now() });
  return buffer;
}
