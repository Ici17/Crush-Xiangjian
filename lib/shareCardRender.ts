/**
 * Crush香鉴 — 服务端分享图渲染
 *
 * 技术栈：satori（JSX→SVG）+ sharp（SVG→PNG）+ qrcode（带参二维码）
 * 字体：Noto Serif SC（public/fonts 静态托管，运行时优先本地读、失败则同源 HTTP 拉取）
 * 输出：1080×1080 (1:1 朋友圈) / 1080×1440 (3:4 小红书)
 *
 * ⚠️ satori 布局规则（v0.29）：
 * 1. 所有 <div> 必须显式 display: flex / contents / none，否则报错
 * 2. inset（CSS shorthand）不支持 → 用 top/left/right/bottom
 * 3. gap 不支持 → 用 margin
 * 4. <p> / <ul> 等默认 display 不是 flex → 用 <div> 代替
 * 5. 分隔线/装饰线：用 <span> + border-top 代替 <div> 背景
 * 6. 绝对定位 overlay：父 div 需 display:flex，overlay 子 div 也需 display:flex
 */

import sharp from "sharp";
import QRCode from "qrcode";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ── 类型定义 ───────────────────────────────────────────────────────────────

export type ShareTemplate = "默契" | "挑战" | "稀有";

export interface ShareCardData {
  nameA: string;
  nameB: string;
  taglineA: string;
  taglineB: string;
  score: number;
  tier: string;
  sharedNotes: string[];
  story: string;
  inviteCode: string;
  template?: ShareTemplate;
}

// ── 模板配置 ───────────────────────────────────────────────────────────────

const TEMPLATE_META: Record<ShareTemplate, { subtitle: string }> = {
  默契: { subtitle: "天生一对" },
  挑战: { subtitle: "不服来战" },
  稀有: { subtitle: "稀有组合" },
};

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

// ── 字体管理（运行时下载 + 进程级缓存）──────────────────────────────────────

let _fontData: Buffer | null = null;

async function getFont(): Promise<Buffer> {
  if (_fontData) return _fontData;
  // 1) 先尝试本地磁盘（本地开发 / 某些部署形态）
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
      if (buf.byteLength > 0) {
        console.log("[shareCard] Font loaded (disk):", buf.byteLength, "bytes from", p);
        _fontData = buf;
        return _fontData;
      }
    } catch {
      // try next candidate
    }
  }
  // 2) 兜底：从同源静态资源拉取（Vercel serverless 不一定挂载 public/）
  try {
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? "https://crushxiangjian.com";
    const url = `${base}/fonts/NotoSerifSC.woff`;
    const res = await fetch(url);
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.byteLength > 0) {
        console.log("[shareCard] Font loaded (http):", buf.byteLength, "bytes from", url);
        _fontData = buf;
        return _fontData;
      }
    }
  } catch (e) {
    console.error("[shareCard] Font HTTP fetch failed:", (e as Error).message);
  }
  console.error("[shareCard] Font NOT available; cwd=", process.cwd());
  _fontData = Buffer.alloc(0);
  return _fontData;
}

// ── 二维码生成 ─────────────────────────────────────────────────────────────

async function generateQR(dataUrl: string): Promise<string> {
  const buf = await QRCode.toBuffer(dataUrl, {
    errorCorrectionLevel: "M",
    type: "png",
    width: 220,
    margin: 2,
    color: { dark: C.AMBER_DARK, light: C.WHITE },
  });
  return `data:image/png;base64,${buf.toString("base64")}`;
}

// ── 渐变圆环 SVG ───────────────────────────────────────────────────────────

function buildRingSVG(score: number, size: number): string {
  const cx = size / 2;
  const cy = size / 2;
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

// ── 核心渲染函数 ───────────────────────────────────────────────────────────

export async function renderShareCard(
  data: ShareCardData,
  format: "1to1" | "3to4" = "1to1"
): Promise<Buffer> {
  // 加载字体和 QR（并行）
  const fontData = await getFont();
  const qrBase64 = await generateQR(
    `${process.env.NEXT_PUBLIC_BASE_URL ?? "https://crushxiangjian.com"}/friend?inv=${data.inviteCode}`
  );

  const template = data.template ?? "默契";
  const tmpl = TEMPLATE_META[template];
  const W = 1080;
  const H = format === "1to1" ? 1080 : 1440;
  const pad = format === "3to4" ? "80px 64px" : "64px";
  const ringSize = format === "1to1" ? 220 : 240;
  const qrSize = format === "1to1" ? 130 : 150;

  // satori 动态导入（与 serve.mjs 验证过的写法一致）
  // @ts-ignore - satori 无类型声明
  const satoriMod: any = await import("satori");
  const satori = satoriMod.default;
  // @ts-ignore - satori/jsx/jsx-runtime 无类型声明
  const jsxMod: any = await import("satori/jsx/jsx-runtime");
  const JSX = jsxMod.jsx;

  const ringBase64 = `data:image/svg+xml;base64,${Buffer.from(buildRingSVG(data.score, ringSize)).toString("base64")}`;

  const scoreLabel = template === "挑战" ? "共鸣度" : template === "稀有" ? "稀有度" : "共鸣度";
  const storyText = `「${data.story.slice(0, 40)}…」`;
  const notesText = data.sharedNotes.length > 0 ? `共同偏爱：${data.sharedNotes.join(" · ")}` : null;

  // ── JSX DSL（遵循 satori 规则）──────────────────────────────────────────

  // 规则：所有 div 显式 display:flex；gap 用 margin 代替；inset 展开为 top/left/right/bottom
  // 品牌线分隔：用 span + border-top 代替 gradient div

  const brandLine = JSX("div", {
    style: { display: "flex", flexDirection: "row", alignItems: "center", width: "100%", marginBottom: "20px" },
    children: [
      JSX("span", { style: { flexGrow: 1, borderTop: `1px solid ${C.AMBER_LIGHT}` }, children: "" }),
      JSX("span", {
        style: { color: C.TEXT_MUTED, fontSize: "22px", letterSpacing: "0.2em", fontWeight: 400, whiteSpace: "nowrap", marginLeft: "8px", marginRight: "8px" },
        children: "Crush 香鉴",
      }),
      JSX("span", { style: { flexGrow: 1, borderTop: `1px solid ${C.AMBER_LIGHT}` }, children: "" }),
    ],
  });

  const templateTag = JSX("div", {
    style: { display: "flex", flexDirection: "row", alignItems: "center", background: C.AMBER_PALE, borderRadius: "999px", padding: "10px 28px", marginBottom: "20px", border: `1px solid ${C.AMBER_ACCENT}40` },
    children: [
      JSX("span", { style: { color: C.AMBER_MID, fontSize: "26px", fontWeight: 700 }, children: tmpl.subtitle }),
    ],
  });

  const nameRow = JSX("div", {
    style: { display: "flex", flexDirection: "row", alignItems: "center", marginBottom: "24px" },
    children: [
      JSX("span", { style: { color: C.AMBER_DARK, fontSize: "62px", fontWeight: 700, lineHeight: 1.1 }, children: data.nameA }),
      JSX("span", { style: { color: C.AMBER_ACCENT, fontSize: "48px", fontWeight: 400, marginLeft: "12px", marginRight: "12px" }, children: "×" }),
      JSX("span", { style: { color: C.AMBER_DARK, fontSize: "62px", fontWeight: 700, lineHeight: 1.1 }, children: data.nameB }),
    ],
  });

  // 圆环 overlay：父 div 需 display:flex（多子节点），overlay div 也需 display:flex
  const ringOverlay = JSX("div", {
    style: {
      position: "absolute",
      top: "0px",
      left: "0px",
      right: "0px",
      bottom: "0px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
    },
    children: [
      JSX("span", { style: { color: C.AMBER_DARK, fontSize: "72px", fontWeight: 700, lineHeight: 1 }, children: String(data.score) }),
    ],
  });

  // 百分比标签移出圆环，独立显示在圆环下方（避免被圆环描边遮挡）
  const scoreLabelEl = JSX("div", {
    style: { display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: "20px" },
    children: [JSX("span", { style: { color: C.AMBER_MID, fontSize: "24px", fontWeight: 600 }, children: `% ${scoreLabel}` })],
  });

  const ringContainer = JSX("div", {
    style: { position: "relative", display: "flex", width: `${ringSize}px`, height: `${ringSize}px`, marginBottom: "20px" },
    children: [
      JSX("img", { src: ringBase64, width: ringSize, height: ringSize, style: { position: "absolute", top: "0px", left: "0px" } }),
      ringOverlay,
    ],
  });

  const tierBadge = JSX("div", {
    style: { display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", background: C.AMBER_PALE, borderRadius: "999px", padding: "10px 28px", marginBottom: "20px", border: `1px solid ${C.AMBER_ACCENT}30` },
    children: [JSX("span", { style: { color: C.AMBER_MID, fontSize: "26px", fontWeight: 600 }, children: data.tier })],
  });

  // notes + story：用 div 代替 p（satori 中 div 默认 display:flex/column 无需显式）
  const notesEl = notesText
    ? JSX("div", {
        key: "notes",
        style: { display: "flex", flexDirection: "column", alignItems: "center" },
        children: [
          JSX("span", { style: { color: C.TEXT_MUTED, fontSize: "22px", textAlign: "center" }, children: notesText }),
          JSX("span", { style: { color: C.TEXT_MUTED, fontSize: "20px", fontStyle: "italic", textAlign: "center", marginTop: "6px" }, children: storyText }),
        ],
      })
    : null;

  const centerChildren = [templateTag, nameRow, ringContainer, scoreLabelEl, tierBadge];
  if (notesEl) centerChildren.push(notesEl);

  const center = JSX("div", {
    style: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexGrow: 1 },
    children: centerChildren,
  });

  const bottom = JSX("div", {
    style: { display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", paddingTop: "20px", borderTop: `1px solid ${C.AMBER_LIGHT}40` },
    children: [
      JSX("span", { style: { color: C.TEXT_MUTED, fontSize: "20px" }, children: "crushxiangjian.com" }),
      JSX("img", {
        src: qrBase64,
        width: qrSize,
        height: qrSize,
        style: { borderRadius: "12px", border: `1px solid ${C.AMBER_LIGHT}60`, background: C.WHITE },
      }),
    ],
  });

  const root = JSX("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "space-between",
      width: `${W}px`,
      height: `${H}px`,
      background: C.BG,
      padding: pad,
      fontFamily: fontData.byteLength > 0 ? '"Noto Serif SC"' : "serif",
    },
    children: [brandLine, center, bottom],
  });

  // ── satori → SVG → PNG ──────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svgRaw = await (satori as any)(root, {
    width: W,
    height: H,
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

// ── 内存缓存（LRU，50 条 / 5 分钟 TTL）────────────────────────────────────

const _cache = new Map<string, { buffer: Buffer; ts: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX = 50;

function _cacheKey(data: ShareCardData, format: string) {
  return `${data.nameA}|${data.nameB}|${data.score}|${data.template ?? "默契"}|${format}`;
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
