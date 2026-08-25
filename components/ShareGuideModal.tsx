'use client';

import { useState } from 'react';
import ShareImagePreviewModal from '@/components/ShareImagePreviewModal';

interface ShareGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCopyLink?: () => void;
  /** 竖版单一长图（保留接口稳定以便回退） */
  onSaveImage?: (format: '3to4') => void;
  previewUrl?: string | null;
  isInWeChat?: boolean;
}

/**
 * 分享引导弹层（琥珀主题）
 * - 仅支持竖版长图：a.download 不生效（微信/iOS）→ 内联预览 + 长按保存
 * - 桌面端：triggerSave 已触发下载
 */
export default function ShareGuideModal({
  isOpen,
  onClose,
  onCopyLink,
  onSaveImage,
  previewUrl,
  isInWeChat = false,
}: ShareGuideModalProps) {
  if (!isOpen) return null;

  // 预览模式：微信/iOS 长按保存 —— 委派给通用预览弹层
  if (previewUrl) {
    return (
      <ShareImagePreviewModal
        previewUrl={previewUrl}
        onClose={onClose}
        isInWeChat={isInWeChat}
        onSaveImage={onSaveImage}
        currentFormat={'3to4'}
        onCopyLink={onCopyLink}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(44,24,16,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
      role="dialog"
      aria-modal
      aria-label="分享引导"
    >
      <div
        className="bg-[#FAF3EA] rounded-3xl w-[340px] overflow-hidden"
        style={{ boxShadow: '0 20px 60px rgba(44,24,16,0.3)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-4 text-center">
          <div className="inline-flex items-center gap-2 bg-amber-100 rounded-full px-4 py-1.5 mb-3">
            <span className="text-amber-400 text-xs">◆</span>
            <span className="text-amber-700 font-sans text-xs font-medium">
              分享你的灵魂香气
            </span>
          </div>
          <p className="text-amber-950 font-sans text-sm leading-relaxed">
            一键生成竖版长图，适配小红书和朋友圈
          </p>
        </div>

        <div className="px-5 pb-5 flex flex-col gap-2">
          {onSaveImage && (
            <button
              onClick={() => onSaveImage('3to4')}
              className="w-full py-3 bg-amber-800 text-amber-50 rounded-full font-sans font-semibold text-sm"
            >
              保存分享图（竖版长图）
            </button>
          )}
          {onCopyLink && (
            <button
              onClick={() => {
                onCopyLink();
                onClose();
              }}
              className="w-full py-3 bg-white border border-amber-200 text-amber-700 rounded-full font-sans font-medium text-sm"
            >
              复制分享链接
            </button>
          )}
          <button
            onClick={onClose}
            className="w-full py-2 text-amber-600 font-sans text-xs underline-offset-4 hover:underline"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
