'use client';

import { useState } from 'react';

interface ShareGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCopyLink?: () => void;
  onSaveImage?: (format: '1to1' | '3to4') => void;
  previewUrl?: string | null;
  isInWeChat?: boolean;
}

/**
 * 分享引导弹层（琥珀主题）
 * - 微信 / iOS：a.download 不生效，改为内联预览 + 长按保存（previewUrl 存在时展示）
 * - 桌面端：triggerSave 已触发下载，弹层仅做引导 / 链接复制
 * - 支持 1:1 和 3:4 比例选择
 */
export default function ShareGuideModal({
  isOpen,
  onClose,
  onCopyLink,
  onSaveImage,
  previewUrl,
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
      // 保存结果由父组件处理：下载（桌面）或内联预览（微信/iOS，previewUrl 将被设置）
      onSaveImage?.(selectedFormat);
      // 注意：此处不主动关闭——预览模式下需保留弹层展示图片；
      // 下载模式下父组件已 setShowShareGuide(false)
    }
  };

  const formatLabels = {
    '1to1': { name: '朋友圈', desc: '1:1 正方形', icon: '□' },
    '3to4': { name: '小红书', desc: '3:4 竖版', icon: '▯' },
  } as const;

  // 预览模式：微信/iOS 长按保存
  if (previewUrl) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
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

          {step === 'menu' ? (
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
          {step === 'menu' ? (
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
