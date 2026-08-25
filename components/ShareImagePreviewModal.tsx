'use client';

import { useEffect, useState } from 'react';

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

const COACH_KEY = 'crush_preview_coach_seen';

/**
 * 分享图预览弹层（琥珀主题）—— 竖版单一长图版。
 * 微信 / iOS 中 a.download 不生效，改为内联展示图片让用户长按保存。
 */
export default function ShareImagePreviewModal({
  previewUrl,
  onClose,
  isInWeChat = false,
  onCopyLink,
}: ShareImagePreviewModalProps) {
  const [showCoach, setShowCoach] = useState(false);

  // 预览态禁止页面滚动；微信首次进入展示一次性 coach mark
  useEffect(() => {
    if (!previewUrl) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (isInWeChat) {
      try {
        if (!sessionStorage.getItem(COACH_KEY)) setShowCoach(true);
      } catch { /* ignore */ }
    }
    return () => {
      document.body.style.overflow = prev;
    };
  }, [previewUrl, isInWeChat]);

  if (!previewUrl) return null;

  const dismissCoach = () => {
    setShowCoach(false);
    try {
      sessionStorage.setItem(COACH_KEY, '1');
    } catch { /* ignore */ }
  };

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
        {/* 顶部：操作提示徽标 */}
        <div className="px-6 pt-5 pb-3 text-center">
          <div className="inline-flex items-center gap-2 bg-amber-100 rounded-full px-4 py-1.5 mb-2">
            <span className="text-amber-400 text-xs">◆</span>
            <span className="text-amber-700 font-sans text-xs font-medium">
              {isInWeChat ? '长按图片保存到相册' : '长按图片保存到本地'}
            </span>
          </div>
          <p className="text-amber-950/80 font-sans text-[11px]">
            竖版长图 · 适配小红书 / 朋友圈 / 微信对话
          </p>
        </div>

        {/* 图片 + coach mark */}
        <div className="px-5 overflow-y-auto relative">
          <div className="relative">
            {showCoach && (
              <div
                className="absolute inset-1 rounded-xl border-2 border-dashed border-amber-400 pointer-events-none animate-pulse"
              />
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="分享图"
              className="mx-auto rounded-xl block"
              style={{ maxHeight: 480, maxWidth: '100%', objectFit: 'contain' }}
            />
            {showCoach && (
              <button
                onClick={dismissCoach}
                className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap bg-amber-800 text-amber-50 text-xs font-sans rounded-full px-3 py-1.5 shadow-lg"
              >
                👆 长按这里保存到相册
              </button>
            )}
          </div>
        </div>

        {/* 微信分步引导 */}
        {isInWeChat && (
          <div className="px-6 pt-3 pb-1">
            <div className="flex items-center justify-center gap-2 text-amber-700 font-sans text-[11px]">
              <span className="bg-amber-100 rounded-full w-5 h-5 inline-flex items-center justify-center">1</span>
              <span>长按图片「保存到相册」</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-amber-600/80 font-sans text-[11px] mt-1">
              <span className="bg-amber-100 rounded-full w-5 h-5 inline-flex items-center justify-center">2</span>
              <span>去微信发送给好友 / 朋友圈</span>
            </div>
          </div>
        )}

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
            onClick={() => { dismissCoach(); onClose(); }}
            className="w-full py-3 bg-amber-800 text-amber-50 rounded-full font-sans font-semibold text-sm"
          >
            知道了
          </button>
        </div>
      </div>
    </div>
  );
}
