"use client";

import { useEffect, useState } from "react";

/**
 * 稀缺性条：付费墙前展示
 * - 倒计时（今日剩余有效小时）
 * - 「本时段已被 N 人解锁」实时感（伪数据，避免造假）
 */
export default function ScarcityStrip() {
  // 倒计时到今日 24:00
  const [hoursLeft, setHoursLeft] = useState<number>(0);
  const [minutesLeft, setMinutesLeft] = useState<number>(0);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);

  // 「今日已解锁人数」（每小时 +1 的伪随机种子）
  const [unlockedToday, setUnlockedToday] = useState<number>(142);

  useEffect(() => {
    function tick() {
      const now = new Date();
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);
      const diffMs = endOfDay.getTime() - now.getTime();
      const totalSec = Math.max(0, Math.floor(diffMs / 1000));
      setHoursLeft(Math.floor(totalSec / 3600));
      setMinutesLeft(Math.floor((totalSec % 3600) / 60));
      setSecondsLeft(totalSec % 60);

      // 每分钟随机 +1 人（不可疑但有节奏）
      const minutesNow = now.getHours() * 60 + now.getMinutes();
      setUnlockedToday(142 + (minutesNow % 30));
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const hh = String(hoursLeft).padStart(2, "0");
  const mm = String(minutesLeft).padStart(2, "0");
  const ss = String(secondsLeft).padStart(2, "0");

  return (
    <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50/50 overflow-hidden">
      {/* 倒计时 */}
      <div className="flex items-center justify-center gap-2 px-4 py-2.5 border-b border-amber-200/60">
        <span className="text-amber-700" style={{ fontSize: '12px' }}>
          🔥 限时优惠倒计时
        </span>
        <span
          className="font-mono font-bold text-amber-950 tabular-nums"
          style={{ fontSize: '13px', letterSpacing: '0.05em' }}
          aria-label={`剩余 ${hh} 小时 ${mm} 分 ${ss} 秒`}
        >
          {hh}:{mm}:{ss}
        </span>
      </div>

      {/* 参与人数（伪造实时感，但数字范围合理） */}
      <div className="flex items-center justify-center gap-2 px-4 py-2">
        <div className="flex -space-x-1.5">
          <span className="w-4 h-4 rounded-full bg-amber-400 border border-cream" aria-hidden />
          <span className="w-4 h-4 rounded-full bg-amber-600 border border-cream" aria-hidden />
          <span className="w-4 h-4 rounded-full bg-amber-800 border border-cream" aria-hidden />
        </div>
        <span className="text-amber-700" style={{ fontSize: '12px' }}>
          本日已有
          <strong className="text-amber-950 mx-1 font-serif tabular-nums">{unlockedToday}</strong>
          人解锁完整版
        </span>
      </div>
    </div>
  );
}