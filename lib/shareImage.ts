/**
 * Crush香鉴 — 分享图生成
 *
 * 使用 html2canvas 将 DOM 元素截图，生成可分享的图片。
 * 支持多尺寸：小红书（3:4）、朋友圈（1:1）、微信封面（9:16）
 */

export interface ShareImageOptions {
  title?: string;
  subtitle?: string;
  score?: number;
  grade?: string;
  personalityName?: string;
  perfumeName?: string;
  format?: "png" | "jpeg";
  quality?: number; // jpeg quality 0-1
}

const DEFAULT_OPTIONS: Required<ShareImageOptions> = {
  title: "Crush香鉴",
  subtitle: "你的灵魂，藏在哪种香气里",
  score: 0,
  grade: "",
  personalityName: "",
  perfumeName: "",
  format: "png",
  quality: 0.92,
};

/**
 * 动态导入 html2canvas（避免 SSR 问题）
 */
async function getHtml2Canvas() {
  const { default: html2canvas } = await import("html2canvas");
  return html2canvas;
}

/**
 * 生成单张分享图
 *
 * @param elementId 要截图的 DOM 元素 ID
 * @param options   分享图元信息（会在截图后嵌入文件名等）
 * @returns Base64 DataURL
 */
export async function generatePerfumeShareImage(
  elementId: string,
  options: ShareImageOptions = {}
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const el = document.getElementById(elementId);

  if (!el) {
    throw new Error(`Element #${elementId} not found`);
  }

  const html2canvas = await getHtml2Canvas();
  const canvas = await html2canvas(el, {
    scale: 2,                    // 2x 分辨率
    useCORS: true,               // 允许跨域图片
    allowTaint: false,
    backgroundColor: "#FAF3EA", // 品牌背景色
    logging: false,
    // 忽略某些动态元素
    ignoreElements: (el) => {
      return el.classList.contains("no-export") || el.tagName === "BUTTON";
    },
  });

  if (opts.format === "jpeg") {
    return canvas.toDataURL("image/jpeg", opts.quality);
  }
  return canvas.toDataURL("image/png");
}

/**
 * 生成小红书尺寸分享图（3:4, 1080×1440）
 *
 * @param contentElementId  内容DOM元素ID
 * @param options           元信息
 * @param watermark         额外水印文字
 */
export async function generateXiaohongshuImage(
  contentElementId: string,
  options: ShareImageOptions = {},
  watermark = "Crush香鉴"
): Promise<string> {
  const html2canvas = await getHtml2Canvas();
  const source = document.getElementById(contentElementId);
  if (!source) throw new Error(`Element #${contentElementId} not found`);

  // 创建小红书比例画布
  const TARGET_WIDTH = 1080;
  const TARGET_HEIGHT = 1440;
  const canvas = document.createElement("canvas");
  canvas.width = TARGET_WIDTH;
  canvas.height = TARGET_HEIGHT;
  const ctx = canvas.getContext("2d")!;

  // 填充背景
  ctx.fillStyle = "#FAF3EA";
  ctx.fillRect(0, 0, TARGET_WIDTH, TARGET_HEIGHT);

  // 截取内容区域
  const contentCanvas = await html2canvas(source, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#FAF3EA",
    logging: false,
    ignoreElements: (el) => el.classList.contains("no-export"),
  });

  // 将内容居中绘制到画布
  const maxW = TARGET_WIDTH - 80;
  const scale = Math.min(maxW / contentCanvas.width, (TARGET_HEIGHT - 200) / contentCanvas.height);
  const w = contentCanvas.width * scale;
  const h = contentCanvas.height * scale;
  const x = (TARGET_WIDTH - w) / 2;
  const y = 80;
  ctx.drawImage(contentCanvas, x, y, w, h);

  // 底部水印
  ctx.fillStyle = "rgba(196,149,106,0.5)";
  ctx.font = "36px Noto Serif SC, serif";
  ctx.textAlign = "center";
  ctx.fillText(watermark, TARGET_WIDTH / 2, TARGET_HEIGHT - 60);

  return canvas.toDataURL("image/png");
}

/**
 * 生成分享图 Blob（用于直接上传）
 */
export async function generateShareImageBlob(
  elementId: string,
  options: ShareImageOptions = {}
): Promise<Blob> {
  const dataUrl = await generatePerfumeShareImage(elementId, options);
  const res = await fetch(dataUrl);
  return res.blob();
}

/**
 * 下载分享图（触发浏览器下载）
 */
export function downloadShareImage(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * 复制分享图到剪贴板（现代浏览器支持）
 */
export async function copyShareImageToClipboard(dataUrl: string): Promise<boolean> {
  try {
    const blob = await (await fetch(dataUrl)).blob();
    await navigator.clipboard.write([
      new ClipboardItem({ [blob.type]: blob }),
    ]);
    return true;
  } catch {
    return false;
  }
}
