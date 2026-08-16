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
  desc?: string; // 人格一句话简介（副标题）
  notesA?: string; // 本命香三调关键词（点分隔）
  notesB?: string; // 进阶香三调关键词
  notesC?: string; // 尝试香三调关键词
  brandA?: string; // 本命香品牌
  brandB?: string; // 进阶香品牌
  brandC?: string; // 尝试香品牌
  // 3:4 专属深度内容（用香哲学 / 香调偏好）
  scentPhilosophy?: string; // 用香哲学（编辑式金句）
  radarTop3?: string[]; // 香调偏好 top 3
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
  notesA?: string; // A 的签名香三调关键词（点分隔）
  notesB?: string; // B 的签名香三调关键词
  brandA?: string; // A 的本命香品牌
  brandB?: string; // B 的本命香品牌
  radarA?: Record<string, number>; // A 六维雷达 0~1
  radarB?: Record<string, number>; // B 六维雷达 0~1
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
  blueprint?: { top: string[]; heart: string[]; base: string[] }; // 气味底稿（已弃用，保留兼容）
  radarTop3?: string[]; // 香调偏好 top 3 (3:4)（已弃用，保留兼容）
  scentPhilosophy?: string; // 用香哲学（编辑式金句，与 self 卡统一）
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
  // ── 新编辑式调色板（self / friend 重做用）──
  INK: "#2A211B", // 暖炭黑
  GOLD: "#A8884E", // 哑光金
  GOLD_SOFT: "#C2A877",
  MUTED: "#8B7C68", // 次级文字
  HAIR: "rgba(42,33,27,0.14)", // 发丝分隔线
  PAPER: "#F8F2E8",
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
  // 大圆环：让数字舒适地居于环内，不再"出圈"
  const r = Math.round(size * 0.36);
  const rInner = Math.round(size * 0.26);
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - score / 100);
  const strokeW = Math.round(size * 0.012);
  const innerW = Math.max(1, Math.round(size * 0.005));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs>
      <linearGradient id="rg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#C2A877"/>
        <stop offset="100%" stop-color="#8B7349"/>
      </linearGradient>
    </defs>
    <!-- 外圈：极淡背景环 -->
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(44,24,16,0.07)" stroke-width="${strokeW}"/>
    <!-- 内圈：虚线装饰环，增加调香感 -->
    <circle cx="${cx}" cy="${cy}" r="${rInner}" fill="none" stroke="rgba(44,24,16,0.10)" stroke-width="${innerW}" stroke-dasharray="5 9"/>
    <!-- 分数进度弧：金色渐变，从顶部顺时针 -->
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="url(#rg)" stroke-width="${strokeW}"
      stroke-linecap="round"
      stroke-dasharray="${circumference}"
      stroke-dashoffset="${dashOffset}"
      transform="rotate(-90 ${cx} ${cy})"/>
  </svg>`;
}

// ── 香水瓶 SVG（代码画瓶型，无外部图片）────────────────────────────────────

function buildBottleSVG(tier: string, size: number): string {
  const color = BOTTLE_COLOR[tier] ?? C.AMBER_ACCENT;
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

// ── 香调 → 瓶身颜色（方案 A：三香瓶型按香调染色）──
const FAMILY_COLOR: Record<string, string> = {
  木质: "#B98A5E",
  柑橘: "#E0B84A",
  花香: "#D98AA8",
  东方: "#9A7BB5",
  清新: "#7FB0C0",
  美食: "#C98A6A",
};
const BOTTLE_COLOR: Record<string, string> = { ...TIER_COLOR, ...FAMILY_COLOR };

// 由三调关键词推断香调族（用于瓶身染色；无 notes 时回落 tier 色）
// 加权计分：避免单一关键词误命中，玫瑰/茉莉/紫罗兰/橙花等强花香标记权重更高
function inferFamily(notes?: string): string | undefined {
  if (!notes) return undefined;
  const FAMILY_ORDER = ["花香", "木质", "东方", "清新", "柑橘", "美食"];
  const scored: Array<[string[], string, number]> = [
    [["木", "雪松", "檀香", "香根草", "松", "柏", "橡"], "木质", 1],
    [["柑橘", "香柠檬", "柠檬", "橙", "佛手柑", "葡萄柚", "柚"], "柑橘", 1],
    [["玫瑰", "茉莉", "鸢尾", "紫罗兰", "铃兰", "晚香玉", "桂花", "牡丹", "橙花"], "花香", 2],
    [["花"], "花香", 1],
    [["琥珀", "香草", "麝香", "广藿香", "焚香", "没药", "乳香", "胡椒", "辛"], "东方", 1],
    [["海", "盐", "水", "莲", "青", "草", "薄荷", "茶", "无花果", "叶"], "清新", 1],
    [["焦糖", "可可", "咖啡", "坚果", "椰", "奶", "糖", "食"], "美食", 1],
  ];
  const counts: Record<string, number> = {};
  for (const [keys, fam, weight] of scored) {
    for (const k of keys) {
      let pos = notes.indexOf(k);
      while (pos !== -1) {
        counts[fam] = (counts[fam] || 0) + weight;
        pos = notes.indexOf(k, pos + 1);
      }
    }
  }
  if (Object.keys(counts).length === 0) return undefined;
  const sorted = Object.entries(counts).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return FAMILY_ORDER.indexOf(a[0]) - FAMILY_ORDER.indexOf(b[0]);
  });
  return sorted[0][0];
}

// ── 视觉锤：per-personality 线性手绘母题 + 极淡色晕（方案 A 增补）──
type MotifStyle = "wave" | "ridge" | "dune" | "ember" | "line" | "dots";
const PERSONALITY_VISUAL: Record<string, { color: string; motif: MotifStyle }> = {
  暗流: { color: "#3A5A7A", motif: "wave" },
  荒岛: { color: "#C9B79C", motif: "ridge" },
  残温: { color: "#B07256", motif: "ember" },
  裂岸: { color: "#7C8B8A", motif: "ridge" },
  寒岭: { color: "#6E8CA0", motif: "ridge" },
  极夜: { color: "#4A4A6E", motif: "dots" },
  砾迹: { color: "#A8927A", motif: "dots" },
  冲浪: { color: "#D98A4A", motif: "wave" },
  温砾: { color: "#C19A6B", motif: "dune" },
  空号: { color: "#8A8A8A", motif: "line" },
  冷砚: { color: "#4E5C5A", motif: "line" },
  渊海: { color: "#2E5A6E", motif: "wave" },
  沉湾: { color: "#6E8E8A", motif: "dune" },
  霜冷: { color: "#9DB0C0", motif: "line" },
  荒原: { color: "#B08968", motif: "dune" },
  烬生: { color: "#9A4A3A", motif: "ember" },
};

function motifMarkup(motif: MotifStyle, W: number, H: number, color: string): string {
  const stroke = `stroke="${color}" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.13"`;
  const y0 = Math.round(H * 0.22);
  const y1 = Math.round(H * 0.34);
  const y2 = Math.round(H * 0.46);
  const a = Math.round(H * 0.03);
  if (motif === "wave") {
    const amp = Math.round(H * 0.02);
    const p1 = `M0 ${y0} Q ${W * 0.25} ${y0 - amp} ${W * 0.5} ${y0} T ${W} ${y0}`;
    const p2 = `M0 ${y1} Q ${W * 0.25} ${y1 + amp} ${W * 0.5} ${y1} T ${W} ${y1}`;
    return `<path d="${p1}" ${stroke}/><path d="${p2}" ${stroke}/>`;
  }
  if (motif === "ridge") {
    const p = `M0 ${y1} L ${W * 0.2} ${y0} L ${W * 0.4} ${y1 + a} L ${W * 0.6} ${y0 - a} L ${W * 0.8} ${y1} L ${W} ${y0}`;
    return `<path d="${p}" ${stroke}/>`;
  }
  if (motif === "dune") {
    const p = `M0 ${y1} Q ${W * 0.3} ${y0} ${W * 0.5} ${y1} T ${W} ${y1}`;
    return `<path d="${p}" ${stroke}/>`;
  }
  if (motif === "ember") {
    return [0.2, 0.35, 0.5, 0.65, 0.8]
      .map((fx) => {
        const x = Math.round(W * fx);
        const top = Math.round(y0 - H * 0.05);
        const bot = Math.round(y1);
        return `<path d="M${x} ${bot} L ${x} ${top}" ${stroke}/>`;
      })
      .join("");
  }
  if (motif === "line") {
    return [y0, y1, y2]
      .map((y) => {
        const seg = Math.round(W * 0.18);
        return `<path d="M${seg} ${y} L ${W - seg} ${y}" ${stroke}/>`;
      })
      .join("");
  }
  // dots
  return [0.25, 0.4, 0.55, 0.7, 0.85]
    .map((fx, i) => {
      const x = Math.round(W * fx);
      const y = i % 2 === 0 ? y0 : y1;
      return `<circle cx="${x}" cy="${y}" r="3" fill="${color}" opacity="0.13"/>`;
    })
    .join("");
}

function buildMotifSVG(name: string, W: number, H: number): string {
  const v = PERSONALITY_VISUAL[name] ?? { color: C.GOLD, motif: "line" as MotifStyle };
  const wash = `<rect x="0" y="0" width="${W}" height="${H}" fill="${v.color}" opacity="0.05"/>`;
  const motif = motifMarkup(v.motif, W, H, v.color);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${wash}${motif}</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

// ── 香气图谱（六维雷达图）──────────────────────────────────────────────────
// 维度顺序：上=木质，顺时针 → 清新 → 东方 → 美食 → 柑橘 → 花香
const RADAR_DIM_LIST = ['木质', '清新', '东方', '美食', '柑橘', '花香'];

function buildRadarSVG(values: Record<string, number>, size: number): string {
  const VB = 380;
  const CX = VB / 2;
  const CY = VB / 2;
  const R = 118;
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
    const rad = R + 28;
    const [x, y] = toXY(rad, angle);
    const anchor = Math.abs(Math.cos((angle * Math.PI) / 180)) < 0.25
      ? 'middle'
      : Math.cos((angle * Math.PI) / 180) > 0
      ? 'start'
      : 'end';
    return { x, y, anchor };
  };

  const ringsSvg = RINGS.map((scale, idx) =>
    `<polygon points="${ringPoints(R * scale)}" fill="none" stroke="#C2A877" stroke-opacity="${idx === RINGS.length - 1 ? 0.6 : 0.32}" stroke-width="${idx === RINGS.length - 1 ? 2.0 : 1.2}" ${idx === RINGS.length - 1 ? '' : 'stroke-dasharray="3 4"'}/>`
  ).join('');

  const axesSvg = RADAR_DIM_LIST.map((_, i) => {
    const [x, y] = toXY(R, angleOf(i));
    return `<line x1="${CX}" y1="${CY}" x2="${x}" y2="${y}" stroke="#C2A877" stroke-opacity="0.32" stroke-width="1.0"/>`;
  }).join('');

  const dotsSvg = RADAR_DIM_LIST.map((dim, i) => {
    const [x, y] = toXY(R * visualValue(values[dim] ?? 0), angleOf(i));
    return `<circle cx="${x}" cy="${y}" r="3.2" fill="#A8884E" stroke="#F8F2E8" stroke-width="1.5"/>`;
  }).join('');

  const labelsSvg = RADAR_DIM_LIST.map((dim, i) => {
    const pos = labelPos(i);
    const score = Math.round((values[dim] ?? 0) * 100);
    const label = `${dim} ${score}`;
    const sin = Math.sin((angleOf(i) * Math.PI) / 180);
    const yOffset =
      sin < -0.5
        ? pos.y - 2
        : sin > 0.5
        ? pos.y + 14
        : pos.y + 5;
    return `<text x="${pos.x}" y="${yOffset}" text-anchor="${pos.anchor}" fill="#6F5A3E" font-size="16" font-family="'Noto Serif SC', serif" font-weight="500">${label}</text>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${VB} ${VB}">
    <g stroke="#C2A877" fill="none">${ringsSvg}</g>
    <g>${axesSvg}</g>
    <polygon points="${dataPoints}" fill="rgba(168,136,78,0.16)" stroke="#A8884E" stroke-width="2.4" stroke-linejoin="round"/>
    <g>${dotsSvg}</g>
    <g>${labelsSvg}</g>
  </svg>`;
}

// ── 双人对冲雷达（A 金 / B 墨，叠加对比）──────────────────────────────────

function buildDualRadarSVG(valuesA: Record<string, number>, valuesB: Record<string, number>, size: number): string {
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
  const polyPoints = (vals: Record<string, number>): string =>
    RADAR_DIM_LIST.map((dim, i) => toXY(R * visualValue(vals[dim] ?? 0), angleOf(i)).join(',')).join(' ');
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
    `<polygon points="${ringPoints(R * scale)}" fill="none" stroke="#C2A877" stroke-opacity="${idx === RINGS.length - 1 ? 0.6 : 0.30}" stroke-width="${idx === RINGS.length - 1 ? 1.5 : 1.0}" ${idx === RINGS.length - 1 ? '' : 'stroke-dasharray="2 3"'}/>`
  ).join('');

  const axesSvg = RADAR_DIM_LIST.map((_, i) => {
    const [x, y] = toXY(R, angleOf(i));
    return `<line x1="${CX}" y1="${CY}" x2="${x}" y2="${y}" stroke="#C2A877" stroke-opacity="0.30" stroke-width="0.8"/>`;
  }).join('');

  const labelsSvg = RADAR_DIM_LIST.map((dim, i) => {
    const pos = labelPos(i);
    const yOffset =
      Math.sin((angleOf(i) * Math.PI) / 180) < -0.5
        ? pos.y - 2
        : Math.sin((angleOf(i) * Math.PI) / 180) > 0.5
        ? pos.y + 12
        : pos.y + 4;
    return `<text x="${pos.x}" y="${yOffset}" text-anchor="${pos.anchor}" fill="#6F5A3E" font-size="13" font-family="'Noto Serif SC', serif" font-weight="500">${dim}</text>`;
  }).join('');

  const aPoly = polyPoints(valuesA);
  const bPoly = polyPoints(valuesB);
  const dotsA = RADAR_DIM_LIST.map((dim, i) => {
    const [x, y] = toXY(R * visualValue(valuesA[dim] ?? 0), angleOf(i));
    return `<circle cx="${x}" cy="${y}" r="2.4" fill="#A8884E" stroke="#F8F2E8" stroke-width="1.1"/>`;
  }).join('');
  const dotsB = RADAR_DIM_LIST.map((dim, i) => {
    const [x, y] = toXY(R * visualValue(valuesB[dim] ?? 0), angleOf(i));
    return `<circle cx="${x}" cy="${y}" r="2.4" fill="#2A211B" stroke="#F8F2E8" stroke-width="1.1"/>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${VB} ${VB}">
    <g>${ringsSvg}</g>
    <g>${axesSvg}</g>
    <polygon points="${aPoly}" fill="rgba(168,136,78,0.18)" stroke="#A8884E" stroke-width="2.0" stroke-linejoin="round"/>
    <polygon points="${bPoly}" fill="rgba(42,33,27,0.08)" stroke="#2A211B" stroke-width="2.0" stroke-dasharray="4 3" stroke-linejoin="round"/>
    <g>${dotsA}</g>
    <g>${dotsB}</g>
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

// 内部：只构建并返回 satori 的 SVG（便于本地布局验证）
async function buildSvg(
  data: ShareCardData,
  format: "1to1" | "3to4" = "1to1"
): Promise<{ svgRaw: string; W: number; H: number }> {
  const fontData = await getFont();
  const W = 1080;
  const H = format === "1to1" ? 1080 : 1440;
  const pad = format === "3to4" ? "80px 64px" : "52px";
  const qrSize = format === "1to1" ? 130 : 110;

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

  return { svgRaw, W, H };
}

export async function renderShareCard(
  data: ShareCardData,
  format: "1to1" | "3to4" = "1to1"
): Promise<Buffer> {
  const { svgRaw } = await buildSvg(data, format);
  const pngBuffer = await sharp(Buffer.from(svgRaw)).png({ compressionLevel: 8 }).toBuffer();
  return pngBuffer;
}

// 调试/验证用：返回 SVG 字符串（供本地布局溢出检测）
export async function renderShareCardSVG(
  data: ShareCardData,
  format: "1to1" | "3to4" = "1to1"
): Promise<string> {
  const { svgRaw } = await buildSvg(data, format);
  return svgRaw;
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
  const INK = C.INK, GOLD = C.GOLD, MUTED = C.MUTED, HAIR = C.HAIR;

  // 报头：品牌小标（去掉两侧灰色细杠）
  const masthead = JSX("div", {
    style: { display: "flex", flexDirection: "row", justifyContent: "center", width: "100%", marginBottom: is3to4 ? "14px" : "28px" },
    children: [
      JSX("span", { style: { color: MUTED, fontSize: is3to4 ? "24px" : "22px", letterSpacing: "0.4em", whiteSpace: "nowrap" }, children: "CRUSH XIANGJIAN" }),
    ],
  });

  // eyebrow
  const eyebrow = JSX("div", {
    style: { display: "flex", flexDirection: "row", justifyContent: "center", marginBottom: is3to4 ? "6px" : "12px" },
    children: [JSX("span", { style: { color: GOLD, fontSize: is3to4 ? "23px" : "21px", letterSpacing: "0.3em" }, children: "灵魂香气鉴定" })],
  });

  // 巨型人格名（字标）
  const hero = JSX("div", {
    style: { display: "flex", flexDirection: "column", alignItems: "center" },
    children: [JSX("span", { style: { color: INK, fontSize: is3to4 ? "68px" : "84px", fontWeight: 700, lineHeight: 1, letterSpacing: "0.06em" }, children: d.name })],
  });
  const heroRule = JSX("div", {
    style: { display: "flex", width: "120px", height: "2px", background: GOLD, marginTop: is3to4 ? "8px" : "14px", marginBottom: is3to4 ? "8px" : "10px" },
  });

  // tagline 扎心句（斜体）
  const tagline = JSX("div", {
    style: { display: "flex", flexDirection: "row", justifyContent: "center", marginBottom: is3to4 ? "4px" : "18px" },
    children: [JSX("span", { style: { color: "#5A4A39", fontSize: is3to4 ? "22px" : "26px", fontStyle: "italic", textAlign: "center", lineHeight: is3to4 ? 1.45 : 1.55 }, children: d.tagline })],
  });

  // 区块小标题（纯文字标签，去掉右侧灰色细杠）
  const secHead = (t: string) => JSX("div", {
    style: { display: "flex", flexDirection: "row", alignItems: "center", width: "100%", marginTop: is3to4 ? "8px" : "18px", marginBottom: is3to4 ? "6px" : "8px" },
    children: [
      JSX("span", { style: { color: INK, fontSize: is3to4 ? "25px" : "23px", letterSpacing: "0.16em", fontWeight: 500, whiteSpace: "nowrap" }, children: t }),
    ],
  });

  // 香气图谱（六维雷达图）——1:1 空间有限不展示，仅 3:4 展示
  const radarEl = (is3to4 && d.radar) ? (() => {
    const radarSize = is3to4 ? 260 : 140;
    const radarSVG = `data:image/svg+xml;base64,${Buffer.from(buildRadarSVG(d.radar, radarSize)).toString("base64")}`;
    return JSX("div", {
      style: { display: "flex", flexDirection: "row", justifyContent: "center", width: "100%", marginBottom: is3to4 ? "6px" : "14px" },
      children: [JSX("img", { src: radarSVG, width: radarSize, height: radarSize, style: { display: "block" } })],
    });
  })() : null;

  // 香气台账（左侧瓶型按香调染色，发丝线分隔，无白卡）
  const perfumeNotes = [d.notesA, d.notesB, d.notesC];
  const perfumeBrands = [d.brandA, d.brandB, d.brandC];
  const ledgerRows = [d.perfumeA, d.perfumeB, d.perfumeC].map((p, i) => {
    const notes = perfumeNotes[i];
    const brand = perfumeBrands[i];
    const family = inferFamily(notes);
    const accent = family ? (BOTTLE_COLOR[family] ?? GOLD) : (TIER_COLOR[p.tier] ?? GOLD);
    const bottleSize = is3to4 ? 64 : 68;
    const bottleSVG = `data:image/svg+xml;base64,${Buffer.from(buildBottleSVG(family ?? p.tier, bottleSize)).toString("base64")}`;
    return JSX("div", {
      style: {
        display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        paddingTop: is3to4 ? "10px" : "10px", paddingBottom: is3to4 ? "10px" : "10px",
      },
      children: [
        JSX("img", { src: bottleSVG, width: bottleSize, height: bottleSize, style: { display: "block", flexShrink: 0, marginRight: is3to4 ? "26px" : "22px" } }),
        JSX("div", {
          style: { display: "flex", flexDirection: "column", alignItems: "flex-start", flexGrow: 1, marginRight: "16px" },
          children: [
            JSX("span", { style: { color: accent, fontSize: is3to4 ? "15px" : "14px", letterSpacing: "0.22em", marginBottom: is3to4 ? "6px" : "8px" }, children: p.tier }),
            JSX("span", { style: { color: INK, fontSize: is3to4 ? "24px" : "24px", fontWeight: 600, marginBottom: (brand || notes) ? "4px" : "0px" }, children: p.name }),
            brand ? JSX("span", { style: { color: MUTED, fontSize: is3to4 ? "13px" : "14px", letterSpacing: "0.14em", marginBottom: notes ? "4px" : "0px" }, children: brand }) : null,
            notes ? JSX("span", { style: { color: MUTED, fontSize: is3to4 ? "13px" : "14px", letterSpacing: "0.03em" }, children: notes }) : null,
          ].filter(Boolean),
        }),
        JSX("span", { style: { color: INK, fontSize: is3to4 ? "36px" : "34px", fontWeight: 500, lineHeight: 1, paddingTop: "4px", flexShrink: 0 }, children: `${p.match}%` }),
      ],
    });
  });
  const ledger = JSX("div", { style: { display: "flex", flexDirection: "column", width: "100%" }, children: ledgerRows });

  // 记忆点（令人心动的瞬间）——HERO 区块，1:1 与 3:4 均完整展示、不截断（标题去两侧灰杠）
  const memoryHead = (t: string) => JSX("div", {
    style: { display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", width: "100%", marginBottom: is3to4 ? "8px" : "14px" },
    children: [
      JSX("span", { style: { color: GOLD, fontSize: is3to4 ? "20px" : "20px", letterSpacing: "0.24em", whiteSpace: "nowrap" }, children: t }),
    ],
  });
  const memoryEl = d.memoryScene ? JSX("div", {
    style: { display: "flex", flexDirection: "column", alignItems: "center", width: "100%", marginTop: is3to4 ? "6px" : "18px", marginBottom: is3to4 ? "0px" : "4px", paddingLeft: "200px", paddingRight: "200px" },
    children: [
      memoryHead("令人心动的瞬间"),
      JSX("span", { style: { color: "#4A3C2E", fontSize: is3to4 ? "17px" : "17px", lineHeight: is3to4 ? 1.65 : 1.7, textAlign: "center", letterSpacing: "0.02em" }, children: d.memoryScene }),
    ],
  }) : null;

  // 页脚
  const bottomRow = JSX("div", {
    style: { display: "flex", flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", width: "100%", marginTop: "auto", paddingTop: is3to4 ? "6px" : "14px", borderTop: `1px solid ${HAIR}` },
    children: [
      JSX("div", {
        style: { display: "flex", flexDirection: "column", alignItems: "flex-start" },
        children: [
          JSX("span", { style: { color: INK, fontSize: "24px", fontWeight: 600, letterSpacing: "0.06em" }, children: "Crush 香鉴" }),
          JSX("span", { style: { color: MUTED, fontSize: "16px", fontStyle: "italic", marginTop: "8px" }, children: "你身上，藏着哪种香气？" }),
        ],
      }),
      JSX("img", { src: qrBase64, width: qrSize, height: qrSize, style: { borderRadius: "8px", border: `1px solid ${HAIR}`, background: C.WHITE } }),
    ],
  });

  // 用香哲学（编辑式金句）：1:1 / 3:4 均展示，替换原「气味底稿 / 人物小传」深度块
  // 引号内联成对包裹正文，避免单独浮置的前引号显得像多余字符
  const philosophyEl = (d.scentPhilosophy) ? JSX("div", {
    style: { display: "flex", flexDirection: "column", alignItems: "center", width: "100%", paddingLeft: "26px", paddingRight: "26px", marginTop: is3to4 ? "2px" : "0px", marginBottom: is3to4 ? "0px" : "16px" },
    children: [
      JSX("span", { style: { color: INK, fontSize: is3to4 ? "19px" : "18px", lineHeight: 1.7, textAlign: "center", letterSpacing: "0.02em" }, children: `“${d.scentPhilosophy}”` }),
    ],
  }) : null;

  // 3:4 专属：香调偏好 top 3
  const radarTop3El = (is3to4 && d.radarTop3 && d.radarTop3.length > 0) ? JSX("div", {
    style: { display: "flex", flexDirection: "row", justifyContent: "center" },
    children: [JSX("span", { style: { color: INK, fontSize: is3to4 ? "20px" : "22px", letterSpacing: "0.12em" }, children: d.radarTop3.join(" · ") })],
  }) : null;

  // 裂变钩：底部话题标签（拉新传播）
  const hashtag = JSX("div", {
    style: { display: "flex", flexDirection: "row", justifyContent: "center", width: "100%", marginTop: is3to4 ? "4px" : "10px", marginBottom: "2px" },
    children: [JSX("span", { style: { color: MUTED, fontSize: is3to4 ? "16px" : "15px", letterSpacing: "0.06em", textAlign: "center" }, children: "#Crush香鉴  #灵魂香气鉴定  #你身上藏着哪种香气" })],
  });

  // 视觉锤：per-personality 线性手绘母题（极淡背景层，强化品牌记忆）
  const motifImg = JSX("img", { src: buildMotifSVG(d.name, W, H), width: W, height: H, style: { position: "absolute", top: "0px", left: "0px", display: "block" } });

  const centerChildren: any[] = [eyebrow, hero, heroRule];
  // 1:1 空间有限，把用香哲学放在顶部人物小传的原位置；3:4 保持「三支香 → 用香哲学 → 香调偏好」深度流
  if (philosophyEl && !is3to4) centerChildren.push(secHead("用香哲学"), philosophyEl);
  centerChildren.push(tagline);
  if (memoryEl) centerChildren.push(memoryEl); // 记忆点 HERO：置于三香之前
  if (radarEl) { centerChildren.push(secHead("香气图谱"), radarEl); }
  centerChildren.push(secHead("为你调的三支香"), ledger);
  if (philosophyEl && is3to4) centerChildren.push(secHead("用香哲学"), philosophyEl);
  if (radarTop3El) centerChildren.push(secHead("香调偏好"), radarTop3El);

  return JSX("div", {
    style: {
      display: "flex", flexDirection: "column", alignItems: "center",
      width: `${W}px`, height: `${H}px`,
      background: C.BG, padding: pad, position: "relative",
      fontFamily: fontData.byteLength > 0 ? '"Noto Serif SC"' : "serif",
    },
    children: [
      motifImg,
      masthead,
      JSX("div", {
        style: { display: "flex", flexDirection: "column", alignItems: "center", flexGrow: 1, justifyContent: "center", width: "100%" },
        children: centerChildren,
      }),
      hashtag,
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
  const INK = C.INK, GOLD = C.GOLD, MUTED = C.MUTED, HAIR = C.HAIR;
  const ringSize = is3to4 ? 240 : 220;
  const ringBase64 = `data:image/svg+xml;base64,${Buffer.from(buildRingSVGFn(d.score, ringSize)).toString("base64")}`;

  // 报头：发丝线 + 品牌小标
  const masthead = JSX("div", {
    style: { display: "flex", flexDirection: "row", alignItems: "center", width: "100%", marginBottom: is3to4 ? "26px" : "30px" },
    children: [
      JSX("span", { style: { flexGrow: 1, height: "1px", background: HAIR }, children: "" }),
      JSX("span", { style: { color: MUTED, fontSize: is3to4 ? "24px" : "22px", letterSpacing: "0.4em", paddingLeft: "22px", paddingRight: "22px", whiteSpace: "nowrap" }, children: "CRUSH XIANGJIAN" }),
      JSX("span", { style: { flexGrow: 1, height: "1px", background: HAIR }, children: "" }),
    ],
  });

  // eyebrow
  const eyebrow = JSX("div", {
    style: { display: "flex", flexDirection: "row", justifyContent: "center", marginBottom: is3to4 ? "22px" : "26px" },
    children: [JSX("span", { style: { color: GOLD, fontSize: is3to4 ? "24px" : "22px", letterSpacing: "0.28em" }, children: "香气默契鉴定 · COMPATIBILITY" })],
  });

  // 区块小标题（带发丝线）
  const secHead = (t: string) => JSX("div", {
    style: { display: "flex", flexDirection: "row", alignItems: "center", width: "100%", marginTop: "0px", marginBottom: "10px" },
    children: [
      JSX("span", { style: { color: INK, fontSize: is3to4 ? "24px" : "22px", letterSpacing: "0.16em", fontWeight: 500, whiteSpace: "nowrap" }, children: t }),
      JSX("span", { style: { flexGrow: 1, height: "1px", background: HAIR, marginLeft: "16px" }, children: "" }),
    ],
  });

  // 双人列（A × B 字标 + 本命香 + 品牌 + 三调）
  const pairCol = (name: string, perfumeName: string, brand: string | undefined, notes: string | undefined, align: "flex-start" | "flex-end") => JSX("div", {
    style: { display: "flex", flexDirection: "column", alignItems: align, flex: "0 0 40%" },
    children: [
      JSX("span", { style: { color: INK, fontSize: is3to4 ? "74px" : "60px", fontWeight: 600, lineHeight: 1, letterSpacing: "0.04em" }, children: name }),
      JSX("div", {
        style: { display: "flex", flexDirection: "column", alignItems: align, marginTop: "14px" },
        children: [
          JSX("span", { style: { color: MUTED, fontSize: is3to4 ? "21px" : "18px", letterSpacing: "0.04em" }, children: `本命香 · ${perfumeName || ""}` }),
          brand ? JSX("span", { style: { color: MUTED, fontSize: is3to4 ? "16px" : "14px", letterSpacing: "0.14em", marginTop: "6px" }, children: brand }) : null,
          notes ? JSX("span", { style: { color: "#7A6A56", fontSize: is3to4 ? "15px" : "13px", letterSpacing: "0.03em", marginTop: "6px" }, children: notes }) : null,
        ].filter(Boolean),
      }),
    ],
  });
  const pair = JSX("div", {
    style: { display: "flex", flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", width: "100%", marginBottom: is3to4 ? "18px" : "20px" },
    children: [
      pairCol(d.nameA, d.perfumeNameA, d.brandA, d.notesA, "flex-start"),
      JSX("span", { style: { color: GOLD, fontSize: is3to4 ? "52px" : "42px", alignSelf: "center" }, children: "×" }),
      pairCol(d.nameB, d.perfumeNameB, d.brandB, d.notesB, "flex-end"),
    ],
  });

  // 共鸣度核心视觉：双细线圆环 + 居中数字 + 上方小标
  const ringContainer = JSX("div", {
    style: { position: "relative", display: "flex", width: `${ringSize}px`, height: `${ringSize}px`, marginBottom: is3to4 ? "14px" : "18px" },
    children: [
      JSX("img", { src: ringBase64, width: ringSize, height: ringSize, style: { position: "absolute", top: "0px", left: "0px" } }),
      JSX("div", {
        style: { position: "absolute", top: "0px", left: "0px", right: "0px", bottom: "0px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" },
        children: [
          JSX("span", { style: { color: GOLD, fontSize: is3to4 ? "17px" : "15px", letterSpacing: "0.28em", marginBottom: is3to4 ? "10px" : "8px" }, children: "共鸣度" }),
          JSX("span", { style: { color: INK, fontSize: is3to4 ? "76px" : "66px", fontWeight: 600, lineHeight: 1, letterSpacing: "0.02em" }, children: String(d.score) }),
        ],
      }),
    ],
  });

  // tier 徽章（描边胶囊）
  const tierBadge = JSX("div", {
    style: { display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${GOLD}`, borderRadius: "999px", padding: is3to4 ? "10px 36px" : "10px 30px", marginTop: is3to4 ? "8px" : "10px", marginBottom: is3to4 ? "18px" : "22px" },
    children: [JSX("span", { style: { color: GOLD, fontSize: is3to4 ? "28px" : "25px", letterSpacing: "0.14em" }, children: d.tier })],
  });

  // 关系解读句
  const story = JSX("div", {
    style: { display: "flex", flexDirection: "row", justifyContent: "center", marginBottom: is3to4 ? "12px" : "14px" },
    children: [JSX("span", { style: { color: "#4A3C2E", fontSize: is3to4 ? "28px" : "24px", textAlign: "center", lineHeight: 1.7 }, children: d.story })],
  });

  // 相处建议句（基于 tier 生成一句克制建议）
  const ADVICE_MAP: Record<string, string> = {
    "灵魂共振": "你们是同一支香的两种写法，留一点距离，香气会更清楚。",
    "灵魂伴侣": "你们是同一支香的两种写法，留一点距离，香气会更清楚。",
    "互补搭档": "他补上你缺的那一味，别急着调成一样。",
    "有趣的碰撞": "不一样才好玩，先闻闻对方世界里没去过的那块。",
    "气味互补": "你们合起来，是一整座调香台。",
    "不同的香气世界": "不必勉强同频，记住这股味道就好。",
  };
  const adviceText = ADVICE_MAP[d.tier] ?? "香气不同没关系，相遇本身就是一次调香。";
  const advice = JSX("div", {
    style: { display: "flex", flexDirection: "row", justifyContent: "center", marginBottom: is3to4 ? "16px" : "20px" },
    children: [JSX("span", { style: { color: GOLD, fontSize: is3to4 ? "23px" : "21px", fontStyle: "italic", textAlign: "center", lineHeight: 1.6 }, children: adviceText })],
  });

  // 双人香气光谱对比（仅 3:4，金=A / 墨=B）
  const dualRadarEl = (is3to4 && d.radarA && d.radarB) ? (() => {
    const rSize = 190;
    const rSvg = `data:image/svg+xml;base64,${Buffer.from(buildDualRadarSVG(d.radarA!, d.radarB!, rSize)).toString("base64")}`;
    return JSX("div", {
      style: { display: "flex", flexDirection: "column", alignItems: "center", width: "100%", marginTop: "12px" },
      children: [
        secHead("香气光谱对比"),
        JSX("img", { src: rSvg, width: rSize, height: rSize, style: { display: "block", marginTop: "6px" } }),
        JSX("div", {
          style: { display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: "10px" },
          children: [
            JSX("span", { style: { display: "flex", width: "12px", height: "12px", borderRadius: "3px", background: "#A8884E", marginRight: "8px" }, children: "" }),
            JSX("span", { style: { color: INK, fontSize: "18px", marginRight: "22px" }, children: d.nameA }),
            JSX("span", { style: { display: "flex", width: "12px", height: "12px", borderRadius: "3px", background: "#2A211B", marginRight: "8px" }, children: "" }),
            JSX("span", { style: { color: INK, fontSize: "18px" }, children: d.nameB }),
          ],
        }),
      ],
    });
  })() : null;

  // 共享香调（发丝线胶囊，1:1 与 3:4 均显示，最多 4 个）
  const sharedEl = d.sharedNotes && d.sharedNotes.length > 0
    ? JSX("div", {
        style: { display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", flexWrap: "wrap" },
        children: [
          JSX("span", { style: { color: MUTED, fontSize: is3to4 ? "22px" : "19px", letterSpacing: "0.2em", marginRight: "14px" }, children: "共享香调" }),
          ...d.sharedNotes.slice(0, 4).map((n, i) =>
            JSX("div", {
              key: i,
              style: { display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${HAIR}`, borderRadius: "999px", padding: is3to4 ? "9px 26px" : "7px 20px", margin: "4px", background: "rgba(255,255,255,0.4)" },
              children: [JSX("span", { style: { color: "#5A4A39", fontSize: is3to4 ? "22px" : "19px" }, children: n })],
            })
          ),
        ],
      })
    : null;

  // 页脚
  const bottomRow = JSX("div", {
    style: { display: "flex", flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", width: "100%", marginTop: "auto", paddingTop: "20px", borderTop: `1px solid ${HAIR}` },
    children: [
      JSX("div", {
        style: { display: "flex", flexDirection: "column", alignItems: "flex-start" },
        children: [
          JSX("span", { style: { color: INK, fontSize: "24px", fontWeight: 600, letterSpacing: "0.06em" }, children: "Crush 香鉴" }),
          JSX("span", { style: { color: MUTED, fontSize: "16px", fontStyle: "italic", marginTop: "8px" }, children: "你身上，藏着哪种香气？" }),
        ],
      }),
      JSX("img", { src: qrBase64, width: qrSize, height: qrSize, style: { borderRadius: "8px", border: `1px solid ${HAIR}`, background: C.WHITE } }),
    ],
  });

  const centerChildren: any[] = [eyebrow, pair, ringContainer, tierBadge, story, advice];
  if (dualRadarEl) centerChildren.push(dualRadarEl);
  if (sharedEl) centerChildren.push(sharedEl);

  return JSX("div", {
    style: {
      display: "flex", flexDirection: "column", alignItems: "center",
      width: `${W}px`, height: `${H}px`,
      background: C.BG, padding: pad,
      fontFamily: fontData.byteLength > 0 ? '"Noto Serif SC"' : "serif",
    },
    children: [
      masthead,
      JSX("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", flexGrow: 1, justifyContent: "center", width: "100%" }, children: centerChildren }),
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
    style: { display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: is3to4 ? "16px" : "14px" },
    children: [
      JSX("span", { style: { color: C.AMBER_MID, fontSize: is3to4 ? "24px" : "22px", textAlign: "center", lineHeight: 1.5 }, children: d.description }),
    ],
  });

  // 用香哲学（编辑式金句）：与 self 卡统一口径
  const philosophyEl = d.scentPhilosophy
    ? JSX("div", {
        style: { display: "flex", flexDirection: "row", justifyContent: "center", width: "100%", paddingLeft: is3to4 ? "48px" : "36px", paddingRight: is3to4 ? "48px" : "36px", marginBottom: is3to4 ? "24px" : "20px" },
        children: [
          JSX("span", {
            style: { color: C.AMBER_DARK, fontSize: is3to4 ? "22px" : "20px", lineHeight: 1.7, textAlign: "center", letterSpacing: "0.02em" },
            children: `“${d.scentPhilosophy}”`,
          }),
        ],
      })
    : null;

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
        children: [brandLine, subtitle, nameBlock, descEl, ...(philosophyEl ? [philosophyEl] : []), perfumeBlock, ctaEl],
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
