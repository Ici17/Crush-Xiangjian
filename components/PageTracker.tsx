'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { track } from '@/lib/analytics';

/**
 * 路由级 PV 上报。挂载到根布局，每次 pathname 变化上报一次 page_view。
 * 匿名、无 PII。
 */
export default function PageTracker() {
  const pathname = usePathname();
  useEffect(() => {
    track('page_view');
  }, [pathname]);
  return null;
}
