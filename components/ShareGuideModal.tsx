'use client';

interface ShareGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCopyLink?: () => void;
  onSaveImage?: () => void;
  isInWeChat?: boolean;
}

/**
 * 分享引导弹层（琥珀主题）
 * - 微信内：提示用户长按发图 + 链接已复制
 * - 非微信：提供「保存图片」「复制链接」两个按钮
 */
export default function ShareGuideModal({
  isOpen,
  onClose,
  onCopyLink,
  onSaveImage,
  isInWeChat = false,
}: ShareGuideModalProps) {
  if (!isOpen) return null;

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
            <span className="text-amber-700 font-sans text-xs font-medium">分享你的灵魂香气</span>
          </div>
          
          {isInWeChat ? (
            <>
              <p className="text-amber-950 font-sans text-sm leading-relaxed mb-2">
                分享图已保存到相册<br />
                链接已复制到剪贴板
              </p>
              <p className="text-amber-600/70 font-sans text-xs leading-relaxed">
                ① 长按相册图片发送给好友<br />
                ② 粘贴链接发到聊天
              </p>
            </>
          ) : (
            <p className="text-amber-950 font-sans text-sm leading-relaxed">
              选择分享方式
            </p>
          )}
        </div>

        <div className="px-5 pb-5 flex flex-col gap-2">
          {isInWeChat ? (
            <button
              onClick={onClose}
              className="w-full py-3 bg-amber-800 text-amber-50 rounded-full font-sans font-semibold text-sm"
            >
              知道了
            </button>
          ) : (
            <>
              {onSaveImage && (
                <button
                  onClick={() => {
                    onSaveImage();
                    onClose();
                  }}
                  className="w-full py-3 bg-amber-800 text-amber-50 rounded-full font-sans font-semibold text-sm"
                >
                  保存分享图
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
