'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import FriendView from './FriendView';

function FriendFallback() {
  return (
    <main className="min-h-dvh bg-cream flex items-center justify-center">
      <div className="text-amber-400 text-sm font-sans animate-pulse">加载中...</div>
    </main>
  );
}

function FriendInner() {
  const searchParams = useSearchParams();
  const inv = searchParams.get('inv');
  const [inviterName, setInviterName] = useState('');

  useEffect(() => {
    setInviterName(inv ? decodeURIComponent(inv) : '');
  }, [inv]);

  useEffect(() => {
    document.title = '朋友匹配 | Crush香鉴';
  }, []);

  return <FriendView inviterName={inviterName} />;
}

export default function FriendPage() {
  return (
    <Suspense fallback={<FriendFallback />}>
      <FriendInner />
    </Suspense>
  );
}
