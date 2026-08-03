'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * 完整版预览页 — 重定向到 result 页面（demo 模式 + 强制 paidLevel=2）
 *
 * 单一数据源：使用真实 /result 页面的 UnlockedContent 组件 + demo 数据
 * 旧 /preview 页面的 4 Tab 营销演示已废弃
 */

export default function PreviewPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/result?demo=1&previewPaid=1');
  }, [router]);

  return (
    <main className="bg-cream min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-amber-700" style={{ fontSize: '14px' }}>
          正在加载完整版预览…
        </p>
      </div>
    </main>
  );
}
