'use client';

import { useState } from 'react';

interface ShareGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCopyLink?: () => void;
  onSaveImage?: (format: '1to1' | '3to4') => void;
  isInWeChat?: boolean;
}

/**
 * 分享引导弹层（琥珀主题）
 * - 微信内：提示用户长按发图 + 链接已复制
 * - 非微信：提供「保存图片」「复制链接」两个按钮
 * - 支持 1:1 和 3:4 比例选择
 */
export default function ShareGuideModal({
  isOpen,
  onClose,
  onCopyLink,
  onSaveImage,
  isInWeChat = false,
}: ShareGuideModalProps) {
  const [step, setStep] = useState<'menu' | 'format'>('menu');
  const [selectedFormat, setSelectedFormat] = useState<'1to1' | '3to4'>('1to1');

  if (!isOpen) {
    // 关闭时重置状态
    if (step !== 'menu') setStep('menu');
    return null;
  }

  const handleSaveClick = () => {
    if (step === 'menu') {
      setStep('format');
    } else {
      onSaveImage?.(selectedFormat);
      onClose();
    }
  };

  const formatLabels: Record<'1to1' | '3to4', { name: string; desc: string; icon: string }> = {
    '1to1': { name: '朋友圈', desc: '1:1 正方形', icon: '□' },
    '3to4': { name: '小红书', desc: '3:4 竖版', icon: '▯' },
  };

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
              {step === 'menu' ? '分享你的灵魂香气' : '选择图片比例'}
            </span>
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
          ) : step === 'menu' ? (
            <p className="text-amber-950 font-sans text-sm leading-relaxed">
              选择分享方式
            </p>
          ) : (
            <p className="text-amber-600/80 font-sans text-xs leading-relaxed">
              不同平台推荐不同比例
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
          ) : step === 'menu' ? (
            <>
              {onSaveImage && (
                <button
                  onClick={handleSaveClick}
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
          ) : (
            <>
              {/* 比例选择 */}
              <div className="flex gap-2 mb-2">
                {(['1to1', '3to4'] as const).map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => setSelectedFormat(fmt)}
                    className={`flex-1 py-3 rounded-xl border transition-all ${
                      selectedFormat === fmt
                        ? 'bg-amber-800 border-amber-800 text-amber-50'
                        : 'bg-white border-amber-200 text-amber-700'
                    }`}
                  >
                    <div className="text-xl mb-1">{formatLabels[fmt].icon}</div>
                    <div className="font-sans font-semibold text-sm">{formatLabels[fmt].name}</div>
                    <div className="font-sans text-xs opacity-70">{formatLabels[fmt].desc}</div>
                  </button>
                ))}
              </div>
              
              <button
                onClick={handleSaveClick}
                className="w-full py-3 bg-amber-800 text-amber-50 rounded-full font-sans font-semibold text-sm"
              >
                生成 {formatLabels[selectedFormat].name} 分享图
              </button>
              
              <button
                onClick={() => setStep('menu')}
                className="w-full py-2 text-amber-600 font-sans text-xs underline-offset-4 hover:underline"
              >
                返回
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
