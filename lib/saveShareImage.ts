/**
 * Crush 香鉴 — 分享图保存（环境感知）
 *
 * 统一封装「调用 /api/share-card 渲染 PNG → 按运行环境保存」的逻辑，
 * 避免各分享入口（结果页 / 好友匹配 / 分享卡）各写一套、漏改导致微信/iOS 存不了图。
 *
 * 关键点：
 * - 微信 webview / iOS Safari 不触发 a.download，唯一可靠路径是「内联预览 + 长按保存」。
 * - 桌面端浏览器可直接 a.download 下载。
 * 调用方根据返回的 method 决定：preview → 弹层内联展示并把 blob URL 交给用户长按；
 * download → 浏览器已触发下载，仅提示成功。
 */

export type SaveShareMethod = 'download' | 'preview';

export interface SaveShareResult {
  ok: boolean;
  method: SaveShareMethod;
  /** preview 模式下的 blob URL，需由调用方在弹层关闭时 URL.revokeObjectURL 释放 */
  url?: string;
  error?: string;
}

/** 是否处于微信 webview */
export function isWeChat(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /MicroMessenger/i.test(navigator.userAgent.toLowerCase());
}

/**
 * 是否处于「a.download 不生效」的环境（微信 webview / iOS Safari / iPad）。
 * 这类环境必须改用内联预览 + 长按保存。
 */
export function isSaveByPreview(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  return /micromessenger/i.test(ua) || /ipad|iphone|ipod/i.test(ua);
}

/**
 * 统一的分享图保存。
 *
 * @param query   已拼好的查询参数（URLSearchParams 或 query string，不含前导 ?）
 * @param filename 桌面端下载文件名（preview 模式不使用）
 * @returns SaveShareResult
 */
export async function saveShareCard(
  query: URLSearchParams | string,
  filename: string
): Promise<SaveShareResult> {
  const qs = typeof query === 'string' ? query : query.toString();

  let res: Response;
  try {
    res = await fetch(`/api/share-card?${qs}`);
  } catch (e) {
    console.error('[saveShareCard] fetch failed', e);
    return { ok: false, method: 'download', error: 'network' };
  }
  if (!res.ok) {
    console.error('[saveShareCard] API', res.status);
    return { ok: false, method: 'download', error: `API ${res.status}` };
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);

  // 微信 / iOS：浏览器不触发 a.download，改为返回 blob URL 由上层内联预览 + 长按保存
  if (isSaveByPreview()) {
    return { ok: true, method: 'preview', url };
  }

  // 桌面端：直接触发下载（延迟释放 blob URL，确保下载已开始）
  const link = document.createElement('a');
  link.download = filename;
  link.href = url;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return { ok: true, method: 'download' };
}
