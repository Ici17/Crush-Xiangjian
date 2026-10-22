'use client';

import { useState } from 'react';
import type { Perfume } from '@/lib/data';
import type { ScentVector } from '@/lib/matchPerfumes';
import { pickLongTail, pickBySeason, pickByBudget } from '@/lib/longTailPick';
import { track } from '@/lib/analytics';

/**
 * 结果页「想问点别的」—— **在上 L2 在线顾问之前的提问率探针**
 *
 * 背景：要不要上真正的在线 AI 顾问，取决于「有多少人真的会追问」，而这件事目前零数据。
 * 建一套 L2（意图白名单 / 缓存 / 四道锁 / 降级 / 成本埋点）不便宜，还卡在合规登记上；
 * 所以先用零成本的方式把需求测出来：
 *
 *   - **结构化问题卡，不是输入框** —— 首页/结果页的主 CTA 是测试与解锁，
 *     一个并列的自由输入框只会分流量，而且自由输入还意味着隐私与滥用风险。
 *   - **全程不调模型** —— 三张卡的结果都是规则算的，零延迟、零在线成本、可复现。
 *   - **点击即埋点** `ai_advisor_intent`：拿到提问率之后，再决定要不要建 L2。
 *
 * 顺带解决一件早就该解决的事：头三张卡的「来点少见的」专门曝光**长尾 / 死库存** ——
 * 推荐路径头部集中很严重（琥珀松林 768 次 / 木质玫瑰 524 次），
 * 而确定性路径推不到的香占了近一半。这里给它们一个不影响主链路的曝光位。
 */

const INTENTS = [
  { id: 'rare', icon: '✦', label: '来点少见的', hint: '平时轮不到它们的那几支' },
  { id: 'season', icon: '❍', label: '这个季节的呢', hint: '按眼下的节气重挑' },
  { id: 'budget', icon: '◈', label: '预算内还有吗', hint: '800 以内也能拿下' },
] as const;

type IntentId = (typeof INTENTS)[number]['id'];

const DEFAULT_BUDGET = 800;

export default function AdvisorIntent({
  userVector,
  excludeNames,
  vid,
  personalityName,
}: {
  userVector: ScentVector;
  /** 已展示的三香，必须排除（不能把同一支再推一次） */
  excludeNames: readonly string[];
  vid: string;
  personalityName: string;
}) {
  const [active, setActive] = useState<IntentId | null>(null);
  const [list, setList] = useState<Perfume[]>([]);

  const handle = (id: IntentId) => {
    if (active === id) {
      setActive(null);
      return;
    }
    let picked: Perfume[] = [];
    if (id === 'rare') {
      picked = pickLongTail(userVector, excludeNames, vid, 3);
    } else if (id === 'season') {
      picked = pickBySeason(
        userVector,
        excludeNames,
        vid,
        new Date().getMonth() + 1,
        3,
      );
    } else {
      picked = pickByBudget(userVector, excludeNames, vid, DEFAULT_BUDGET, 3);
    }
    setActive(id);
    setList(picked);
    try {
      track('ai_advisor_intent', { intent: id, personality: personalityName });
    } catch {
      /* 埋点失败不影响体验 */
    }
  };

  return (
    <section className="px-6 mb-10" aria-label="想问点别的">
      <div className="flex items-center justify-center gap-3 mb-5">
        <span className="h-px w-6 bg-amber-400" />
        <h2 className="font-serif text-lg font-medium text-amber-950">想问点别的</h2>
        <span className="h-px w-6 bg-amber-400" />
      </div>

      <div className="space-y-2">
        {INTENTS.map((it) => {
          const on = active === it.id;
          return (
            <button
              key={it.id}
              onClick={() => handle(it.id)}
              className="w-full text-left rounded-xl border px-4 py-3 transition-all active:scale-[0.98]"
              style={{
                borderColor: on ? 'rgba(168,136,78,0.6)' : 'rgba(168,136,78,0.28)',
                background: on ? '#FFF9F2' : 'rgba(255,255,255,0.6)',
              }}
            >
              <div className="flex items-center gap-3">
                <span style={{ fontSize: '14px', color: '#A8884E' }}>{it.icon}</span>
                <div className="flex-1">
                  <p style={{ fontSize: '14.5px', color: '#2C1810' }}>{it.label}</p>
                  <p style={{ fontSize: '11.5px', color: '#8B7C68', marginTop: 2 }}>
                    {it.hint}
                  </p>
                </div>
                <span
                  style={{
                    fontSize: '16px',
                    color: '#A8884E',
                    transform: on ? 'rotate(90deg)' : 'none',
                    transition: 'transform 0.2s',
                  }}
                >
                  ›
                </span>
              </div>

              {on && (
                <div className="mt-3 pt-3" style={{ borderTop: '1px dashed rgba(168,136,78,0.35)' }}>
                  {list.length === 0 ? (
                    <p style={{ fontSize: '12.5px', color: '#8B7C68' }}>
                      这个条件下暂时没有别的了。
                    </p>
                  ) : (
                    list.map((p) => (
                      <div key={p.id} className="flex items-baseline gap-2 py-1">
                        <span
                          className="font-serif"
                          style={{ fontSize: '14px', color: '#2C1810' }}
                        >
                          {p.name}
                        </span>
                        <span style={{ fontSize: '11px', color: '#8B7C68' }}>
                          {p.brandCn || p.brand} · {p.notes.top.slice(0, 2).join('、')}
                        </span>
                      </div>
                    ))
                  )}
                  <p style={{ fontSize: '11px', color: '#A8884E', marginTop: 8 }}>
                    按你的气息档案挑的，没有动那三支推荐
                  </p>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
