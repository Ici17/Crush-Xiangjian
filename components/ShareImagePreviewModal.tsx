'use client';

import { useEffect } from 'react';

interface ShareImagePreviewModalProps {
  /** 分享图 blob URL；为 null 时不渲染 */
  previewUrl: string | null;
  /** 关闭回调（调用方负责 revokeObjectURL） */
  onClose: () => void;
  /** 是否微信环境（影响文案：保存到相册 vs 保存到本地） */
  isInWeChat?: boolean;
}

/**
 * 分享图预览弹层（琥珀主题）
 * 微信 / iOS 中 a.download 不生效，改为内联展示图片让用户长按保存。
 * 复用于好友匹配页、分享卡页；结果页的等价逻辑位于 ShareGuideModal 内。
 */
export default function ShareImagePreviewModal({
  previewUrl,
  onClose,
  isInWeChat = false,
}: ShareImagePreviewModalProps) {
  // 预览态禁止页面滚动，关闭后恢复
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
        className="bg-[#FAF3EA] rounded-3xl w-[340px] max-h-[90vh] overflow-hidden flex flex-col"
        style={{ boxShadow: '0 20px 60px rgba(44,24,16,0.3)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-5 pb-3 text-center">
          <div className="inline-flex items-center gap-2 bg-amber-100 rounded-full px-4 py-1.5 mb-3">
            <span className="text-amber-400 text-xs">◆</span>
            <span className="text-amber-700 font-sans text-xs font-medium">长按图片保存</span>
          </div>
          <p className="text-amber-950 font-sans text-sm leading-relaxed mb-3">
            {isInWeChat ? '长按下方图片，保存到相册' : '长按图片即可保存到本地'}
          </p>
        </div>
        <div className="px-5 overflow-y-auto">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="分享图"
            className="mx-auto rounded-xl block"
            style={{ maxHeight: 360, maxWidth: '100%', objectFit: 'contain' }}
          />
        </div>
        <div className="px-6 py-3 text-center">
          <p className="text-amber-600/70 font-sans text-xs leading-relaxed mb-3">
            {isInWeChat
              ? '① 长按图片「保存到相册」 ② 发送给好友或朋友圈'
              : '长按图片 → 保存图片到相册'}
          </p>
          <button
            onClick={onClose}
            className="w-full py-3 bg-amber-800 text-amber-50 rounded-full font-sans font-semibold text-sm"
          >
            知道了
          </button>
        </div>
      </div>
    </div>
  );
}
