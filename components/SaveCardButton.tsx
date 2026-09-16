'use client';

import { useEffect, useState } from 'react';
import { saveShareCard } from '@/lib/saveShareImage';
import { track } from '@/lib/analytics';

/**
 * 分享图保存按钮（A 组通用组件）
 *
 * 统一「调 /api/share-card 渲染 → 按环境保存」的交互，避免每个入口各写一套
 * （历史上漏改一处就会导致微信 / iOS 存不了图）：
 *   - 微信 webview / iOS Safari：a.download 不生效 → 改为内联预览 + 长按保存
 *   - 桌面浏览器：直接触发下载
 *
 * 埋点复用既有事件：share_card_generate（带 scene，参与分维度聚合）+ download_card。
 */
export default function SaveCardButton({
  params,
  filename,
  label,
  hint,
  variant = 'solid',
}: {
  params: URLSearchParams;
  filename: string;
  label: string;
  hint?: string;
  variant?: 'solid' | 'outline';
}) {
  const [saving, setSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const scene = params.get('scene') ?? '';

  // 卸载时释放 blob URL，避免内存泄漏（预览弹层关闭时也会立即释放）
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function onSave() {
    if (saving) return;
    setSaving(true);
    setFailed(false);
    try {
      const r = await saveShareCard(params, filename);
      if (!r.ok) {
        setFailed(true);
        return;
      }
      track('share_card_generate', { scene, format: '3to4' });
      // 口径统一（2026-09-16）：只要用户成功拿到图就算「获取」——
      // 下载完成 或 已展示出可长按保存的预览（微信 / iOS 路径）。
      // 此前 preview 分支不报，导致移动端（主要流量）的下载转化被整体漏掉。
      track('download_card', { scene, format: '3to4' });
      if (r.method === 'preview' && r.url) {
        setPreviewUrl(r.url);
      }
    } finally {
      setSaving(false);
    }
  }

  const solid = variant === 'solid';

  return (
    <>
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="w-full rounded-xl py-2.5 text-[13px] transition-opacity active:opacity-80 disabled:opacity-50"
        style={
          solid
            ? { background: '#A8884E', color: '#FAF3EA' }
            : { background: 'transparent', color: '#A8884E', border: '1px solid rgba(168,136,78,0.45)' }
        }
      >
        {saving ? '正在生成…' : label}
      </button>
      {hint && (
        <p className="mt-1.5 text-[11px] leading-relaxed" style={{ color: 'rgba(139,111,92,0.75)' }}>
          {hint}
        </p>
      )}
      {failed && (
        <p className="mt-1 text-[11px]" style={{ color: '#B45309' }}>
          生成失败，请稍后重试
        </p>
      )}

      {previewUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-6"
          onClick={() => {
            URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="分享卡预览" className="max-h-[72vh] rounded-lg" />
          <p className="mt-4 text-[13px] text-white/80">长按图片保存到相册</p>
        </div>
      )}
    </>
  );
}
