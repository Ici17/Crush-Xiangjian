'use client';

import { useEffect } from 'react';

interface ShareImagePreviewModalProps {
  /** 分享图 blob URL；为 null 时不渲染 */
  previewUrl: string | null;
  /** 关闭回调（调用方负责 revokeObjectURL） */
  onClose: () => void;
  /** 是否微信环境（影响文案：保存到相册 vs 保存到本地） */
  isInWeChat?: boolean;
  /** 保留接口兼容 —— 当前仅支持 3to4，长按图保存即可，无需切换 */
  onSaveImage?: (format: '3to4') => void;
  /** 当前比例（默认 3to4，仅作为占位，UI 已不再呈现切换） */
  currentFormat?: '3to4';
  /** 提供则展示「复制链接」按钮 */
  onCopyLink?: () => void;
}

/**
 * 分享图预览弹层（极简版）。
 * 微信 / iOS 中 a.download 不生效，改为内联展示图片让用户长按保存。
 * 2026-08-26 收敛：删除 coach mark 虚线框、步骤引导、「竖版长图」说明等提示词，
 * 仅保留图片 + 底部操作按钮，避免用户截图/保存时把 UI 提示也截进去。
 */
export default function ShareImagePreviewModal({
  previewUrl,
  onClose,
  isInWeChat = false,
  onCopyLink,
}: ShareImagePreviewModalProps) {
  // 预览态禁止页面滚动
  useEffect(() => {
    if (!previewUrl) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [previewUrl]);

  if (!previewUrl) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(44,24,16,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
      role="dialog"
      aria-modal
      aria-label="保存分享图"
    >
      <div
        className="bg-[#FAF3EA] rounded-3xl w-[340px] max-h-[92vh] overflow-hidden flex flex-col"
        style={{ boxShadow: '0 20px 60px rgba(44,24,16,0.3)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶部：极简保存提示 */}
        <div className="px-6 pt-5 pb-2 text-center">
          <p className="text-amber-800/70 font-sans text-xs">
            {isInWeChat ? '长按图片保存到相册' : '长按图片保存到本地'}
          </p>
        </div>

        {/* 图片：干净展示，无任何装饰框/引导层 */}
        <div className="px-5 overflow-y-auto">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="分享图"
            className="mx-auto rounded-xl block"
            style={{ maxHeight: 520, maxWidth: '100%', objectFit: 'contain' }}
          />
        </div>

        {/* 底部操作区 */}
        <div className="px-6 py-4 flex flex-col gap-2">
          {onCopyLink && (
            <button
              onClick={onCopyLink}
              className="w-full py-3 bg-white border border-amber-200 text-amber-700 rounded-full font-sans font-medium text-sm"
            >
              复制分享链接
            </button>
          )}

          <button
            onClick={onClose}
            className="w-full py-3 bg-amber-800 text-amber-50 rounded-full font-sans font-semibold text-sm"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
