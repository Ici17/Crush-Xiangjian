'use client';

/**
 * 完整版报告页（2026-11-24 两页拆分）
 *
 * /result        = 免费页：人格揭晓 + 光谱 + 本命香 + 短解读 + 缺口感钩子
 * /result/full   = 本页：UnlockedContent 的全部深度内容
 *
 * 复用 ResultInner（app/result/page.tsx 导出）而非复制 1400 行：
 * 状态、分享链接、支付判定、埋点全部单一来源，避免两页逻辑分叉。
 *
 * 守卫：未付费（且不在限免期）不允许看完整内容 —— 不是在 URL 上写
 * previewPaid=1 就能绕过的明文开关。未付费统一回免费页，由免费页的 CTA
 * 走 PaymentModal。限免期 isPromoFree() 为真时直接放行（与既有行为一致）。
 */

import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getPaidLevel, isPromoFree } from '@/lib/payment';
import { track } from '@/lib/analytics';
import { ResultInner, ResultSkeleton } from '../page';

export default function FullReportPage() {
  const router = useRouter();
  // null = 判定中，不渲染内容（避免未付费内容闪现）
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ok = isPromoFree() || getPaidLevel() >= 2;
    setAllowed(ok);
    if (ok) {
      try { track('full_report_view', { source: 'full_page' }); } catch { /* ignore */ }
    } else {
      router.replace('/result');
    }
  }, [router]);

  if (allowed === null) return <ResultSkeleton />;
  if (!allowed) return null;

  return (
    <Suspense fallback={<ResultSkeleton />}>
      <ResultInner mode="full" />
    </Suspense>
  );
}
