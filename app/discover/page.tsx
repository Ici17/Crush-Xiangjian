"use client";

/**
 * 香气探索页 —— A 组卖点（2026-09-16 新增）
 *
 * 一次承载三个「几乎零成本」的能力，全部复用已有确定性算法：
 *   1. 场景选香 —— 绕开「必须先做完 10 道题」的门槛，成为独立拉新入口
 *   2. 以香搜人 —— 香水反查人格，盘活推荐路径永远推不到的长尾库存
 *   3. 同源图谱 —— 让人格从「一个结果」变成「可浏览的内容」
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PERSONALITIES, getSimilarPersonalities, getUsageGuide, getPersonalityNameFromStorage, getShareQuote } from "@/lib/personalities";
import { getCalibratedRecommendations } from "@/lib/matchPerfumes";
import { PERSONALITY_TYPES } from "@/lib/data";
import {
  SCENE_OPTIONS,
  pickPerfumeForScene,
  findPersonalitiesByPerfume,
  searchPerfumes,
  type SceneKey,
} from "@/lib/discover";
import SiteFooter from "@/components/SiteFooter";
import { saveShareCard } from "@/lib/saveShareImage";
import { track } from "@/lib/analytics";

type Tab = "scene" | "reverse" | "kinship";

const TABS: { key: Tab; label: string; desc: string }[] = [
  { key: "scene", label: "场景选香", desc: "不测也能用，先挑一支今天要穿的香" },
  { key: "reverse", label: "以香搜人", desc: "手上有支香，看看它是哪一类人" },
  { key: "kinship", label: "同源图谱", desc: "和你气味最近的几个灵魂" },
];

// Personality 类型不带 id（id 只存在于 PERSONALITY_TYPES），这里一并取出来
function archOf(name: string) {
  const t = (
    PERSONALITY_TYPES as unknown as { id: string; name: string; radarScores: Record<string, number> }[]
  ).find((x) => x.name === name);
  const raw = t?.radarScores ?? {};
  return {
    id: t?.id ?? "",
    radar: {
      floral: (raw.floral ?? 50) / 100,
      woody: (raw.woody ?? 50) / 100,
      fresh: (raw.fresh ?? 50) / 100,
      oriental: (raw.oriental ?? 50) / 100,
      citrus: (raw.citrus ?? 50) / 100,
      gourmand: (raw.gourmand ?? 50) / 100,
    },
  };
}

export default function DiscoverPage() {
  const [tab, setTab] = useState<Tab>("scene");
  const [personality, setPersonality] = useState<string>("暗流");
  const [mine, setMine] = useState<string | null>(null);
  const [scene, setScene] = useState<SceneKey>("date");
  const [keyword, setKeyword] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // 已测用户默认落在自己的人格上
  useEffect(() => {
    const my = getPersonalityNameFromStorage();
    if (my && PERSONALITIES.some((p) => p.name === my)) {
      setMine(my);
      setPersonality(my);
    }
  }, []);

  // 探索页 tab 曝光（含首次挂载）：scene / reverse / kinship 三个能力的入口分布
  useEffect(() => {
    track("discover_tab_view", { tab });
  }, [tab]);

  const current = PERSONALITIES.find((p) => p.name === personality) ?? PERSONALITIES[0];

  // 该人格的三档推荐（场景选香的候选池）
  const arch = useMemo(() => archOf(personality), [personality]);
  const recs = useMemo(
    () => getCalibratedRecommendations(arch.radar, ["cal1b", "cal2b", "cal3b"], [], arch.id, true),
    [arch]
  );

  const scenePick = useMemo(() => pickPerfumeForScene(recs, scene), [recs, scene]);

  /** 导出人格档案卡：复用结果页那套服务端渲染管线，无需新增模板 */
  async function saveProfileCard() {
    setSaving(true);
    try {
      const order: Record<string, number> = { signature: 0, advanced: 1, budget: 2 };
      const ordered = [...recs].sort((a, b) => (order[a.role] ?? 9) - (order[b.role] ?? 9));
      const [a, b, c] = ordered;
      const notesOf = (r?: { notesStructured?: { top: string[]; heart: string[]; base: string[] } }) =>
        r?.notesStructured
          ? [...r.notesStructured.top, ...r.notesStructured.heart, ...r.notesStructured.base]
              .slice(0, 6)
              .join("·")
          : "";

      const q = new URLSearchParams({
        scene: "self",
        name: personality,
        tagline: getShareQuote(personality),
        perfumeA: a?.name ?? "",
        matchA: String(a?.match ?? 92),
        perfumeB: b?.name ?? "",
        matchB: String(b?.match ?? 85),
        perfumeC: c?.name ?? "",
        matchC: String(c?.match ?? 78),
        desc: current.tagline,
        brandA: a?.brandCn || a?.brand || "",
        brandB: b?.brandCn || b?.brand || "",
        brandC: c?.brandCn || c?.brand || "",
        notesA: notesOf(a),
        notesB: notesOf(b),
        notesC: notesOf(c),
      });

      // 口径统一（2026-09-16）：探索页此前零埋点。context 用来把「档案卡导出」
      // 与结果页的 self 分享区分开（两者复用同一个 self 模板）。
      track("share_card_generate", { scene: "self", format: "3to4", context: "discover_profile" });
      const r = await saveShareCard(q, `Crush香鉴-${personality}-档案卡.png`);
      if (!r.ok) {
        setPreviewUrl(null);
        return;
      }
      track("download_card", { scene: "self", format: "3to4", context: "discover_profile" });
      if (r.method === "preview" && r.url) setPreviewUrl(r.url);
    } finally {
      setSaving(false);
    }
  }

  const usageTips = useMemo(() => getUsageGuide(personality), [personality]);
  const kinships = useMemo(() => getSimilarPersonalities(personality), [personality]);

  const searchResults = useMemo(() => searchPerfumes(keyword, 20), [keyword]);
  const reverseMatches = useMemo(
    () => (picked ? findPersonalitiesByPerfume(picked, 3) : []),
    [picked]
  );

  return (
    <main className="min-h-screen bg-[#FAF3EA] pb-8">
      <div className="mx-auto max-w-[430px] px-5">
        {/* 顶栏 */}
        <div className="pt-6 pb-4 flex items-center justify-between">
          <Link href="/" className="text-[13px] text-amber-700/80 active:opacity-60">
            ← 首页
          </Link>
          <Link href="/question" className="text-[13px] text-amber-700/80 active:opacity-60">
            去做测试 →
          </Link>
        </div>

        <h1 className="font-serif text-[26px] text-[#2C1810] leading-tight">香气探索</h1>
        <p className="mt-1.5 text-[13px] text-amber-700/70 leading-relaxed">
          不占答案，也不会改写你的测试结果。挑一支香，或者看看哪支香像你。
        </p>

        {/* 人格选择器 */}
        <div className="mt-5">
          <div className="text-[11px] tracking-[0.2em] text-[#A8884E] mb-2">当 前 人 格</div>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
            {PERSONALITIES.map((p) => {
              const on = p.name === personality;
              return (
                <button
                  key={p.name}
                  onClick={() => setPersonality(p.name)}
                  className="shrink-0 rounded-full px-3.5 py-1.5 text-[12px] transition-colors"
                  style={{
                    background: on ? "#A8884E" : "#FFFFFF",
                    color: on ? "#FAF3EA" : "#2C1810",
                    border: on ? "1px solid #A8884E" : "1px solid rgba(168,136,78,.35)",
                  }}
                >
                  {p.name}
                  {mine === p.name ? " ·" : ""}
                </button>
              );
            })}
          </div>
        </div>

        {/* 人格档案卡导出（A 组卖点之四） */}
        <button
          onClick={saveProfileCard}
          disabled={saving}
          className="mt-3 w-full rounded-xl py-3 text-[13px] transition-opacity active:opacity-80 disabled:opacity-50"
          style={{ background: "#A8884E", color: "#FAF3EA" }}
        >
          {saving ? "正在生成…" : "保存我的档案卡 →"}
        </button>
        <p className="mt-1.5 text-[11px] text-amber-700/55 leading-relaxed">
          生成一张长图，含人格名、扎心短句与三支本命香的匹配度，可存相册或直接发出去。
        </p>

        {previewUrl && (
          <div
            className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-6"
            onClick={() => {
              URL.revokeObjectURL(previewUrl);
              setPreviewUrl(null);
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="人格档案卡" className="max-h-[72vh] rounded-lg" />
            <p className="mt-4 text-[13px] text-white/80">长按图片保存到相册</p>
          </div>
        )}

        {/* Tab */}
        <div className="mt-5 flex gap-1.5 bg-white/60 rounded-xl p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex-1 rounded-lg py-2 text-[12px] transition-colors"
              style={{
                background: tab === t.key ? "#FFFFFF" : "transparent",
                color: tab === t.key ? "#2C1810" : "#A8884E",
                boxShadow: tab === t.key ? "0 1px 2px rgba(44,24,16,.08)" : "none",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-amber-700/60 px-1">{TABS.find((t) => t.key === tab)?.desc}</p>

        {/* ── 场景选香 ── */}
        {tab === "scene" && (
          <section className="mt-4">
            <div className="grid grid-cols-3 gap-2">
              {SCENE_OPTIONS.map((s) => {
                const on = s.key === scene;
                return (
                  <button
                    key={s.key}
                    onClick={() => {
                      setScene(s.key);
                      // 场景选香动作：perfume 用该场景推荐的展示名（统一 name，规避 key≠name 陷阱）
                      track("discover_action", {
                        tab: "scene",
                        action: "scene_pick",
                        perfume: pickPerfumeForScene(recs, s.key)?.name ?? "",
                      });
                    }}
                    className="rounded-xl py-3 px-1 text-center transition-colors"
                    style={{
                      background: on ? "#FFFFFF" : "rgba(255,255,255,.5)",
                      border: on ? "1px solid #A8884E" : "1px solid rgba(168,136,78,.25)",
                    }}
                  >
                    <div className="text-[18px] leading-none">{s.icon}</div>
                    <div className="mt-1.5 text-[12px] text-[#2C1810]">{s.label}</div>
                  </button>
                );
              })}
            </div>

            {scenePick && (
              <div className="mt-4 rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(44,24,16,.06)]">
                <div className="text-[10px] tracking-[0.24em] text-[#A8884E]">今 天 穿 这 支</div>
                <div className="mt-2.5 font-serif text-[19px] text-[#2C1810] leading-snug">
                  {scenePick.name}
                </div>
                <div className="mt-1 text-[12px] text-amber-700/75">
                  {scenePick.brandCn || scenePick.brand || ""}
                </div>
                <div className="mt-3 inline-flex rounded-full bg-[#F5EDE1] px-3 py-1 text-[11px] text-[#8A6332]">
                  {scenePick.reason}
                </div>
              </div>
            )}

            <div className="mt-4 space-y-2">
              <div className="text-[11px] tracking-[0.2em] text-[#A8884E]">其 他 候 选</div>
              {recs
                .filter((r) => r.name !== scenePick?.name)
                .map((r) => (
                  <div
                    key={r.name}
                    className="rounded-xl bg-white/70 px-4 py-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-[13px] text-[#2C1810] truncate">{r.name}</div>
                      <div className="text-[11px] text-amber-700/60 truncate">{r.brandCn || r.brand}</div>
                    </div>
                    <div className="shrink-0 text-[11px] text-[#A8884E]">
                      {r.role === "signature" ? "本命香" : r.role === "advanced" ? "进阶香" : "尝试香"}
                    </div>
                  </div>
                ))}
            </div>

            <div className="mt-4 rounded-xl bg-white/70 p-4">
              <div className="text-[11px] tracking-[0.2em] text-[#A8884E] mb-2">用 香 建 议</div>
              <div className="space-y-2">
                {usageTips.map((tip) => (
                  <div key={tip.scene} className="flex gap-2.5">
                    <span className="text-[14px] leading-none mt-0.5">{tip.icon}</span>
                    <div>
                      <span className="text-[12px] text-[#2C1810]">{tip.scene}　</span>
                      <span className="text-[12px] text-amber-700/75 leading-relaxed">{tip.text}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── 以香搜人 ── */}
        {tab === "reverse" && (
          <section className="mt-4">
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="输入香名或品牌，例如「雪松」「檀道」"
              className="w-full rounded-xl border border-amber-200/70 bg-white px-4 py-3 text-[13px] text-[#2C1810] placeholder:text-amber-700/40 outline-none focus:border-[#A8884E]"
            />

            {picked ? (
              <div className="mt-4 rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(44,24,16,.06)]">
                <div className="text-[10px] tracking-[0.24em] text-[#A8884E]">这 支 香 属 于</div>
                <div className="mt-2 font-serif text-[18px] text-[#2C1810]">{picked}</div>
                <div className="mt-3 space-y-2">
                  {reverseMatches.map((m, i) => (
                    <div key={m.name} className="flex items-center gap-3">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] shrink-0"
                        style={{ background: "#F5EDE1", color: "#A8884E" }}
                      >
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] text-[#2C1810]">
                          {m.name}
                          <span className="ml-1.5 text-[11px] text-amber-700/55">{m.mbti}</span>
                        </div>
                        <div className="text-[11px] text-amber-700/60 truncate">
                          {(PERSONALITIES.find((p) => p.name === m.name)?.tagline) || m.tagline}
                        </div>
                      </div>
                      <div className="shrink-0 text-[13px] text-[#A8884E] tabular-nums">{m.match}%</div>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[10px] text-amber-700/45 leading-relaxed">
                  契合度由香调向量与人格偏好求余弦相似度得出，仅作选香参考。
                </p>
                <button
                  onClick={() => setPicked(null)}
                  className="mt-3 text-[12px] text-[#A8884E] active:opacity-60"
                >
                  换一支香 →
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-1.5">
                {searchResults.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => {
                      setPicked(p.name);
                      // 以香搜人动作：perfume 用被选中的香名（展示名 name）
                      track("discover_action", {
                        tab: "reverse",
                        action: "reverse_pick",
                        perfume: p.name,
                      });
                    }}
                    className="w-full text-left rounded-xl bg-white/70 px-4 py-2.5 hover:bg-white transition-colors"
                  >
                    <div className="text-[13px] text-[#2C1810]">{p.name}</div>
                    <div className="text-[11px] text-amber-700/60">
                      {p.brandCn || p.brand}　{p.priceRange}
                    </div>
                  </button>
                ))}
                {keyword && searchResults.length === 0 && (
                  <div className="text-[12px] text-amber-700/50 text-center py-6">
                    香库里还没有这支，换个关键词试试
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* ── 同源图谱 ── */}
        {tab === "kinship" && (
          <section className="mt-4">
            <div className="rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(44,24,16,.06)]">
              <div className="text-[10px] tracking-[0.24em] text-[#A8884E]">你 是</div>
              <div className="mt-2 font-serif text-[20px] text-[#2C1810]">{current.name}</div>
              <div className="mt-1 text-[12px] text-amber-700/70">{current.mbti} · {current.direction}</div>
              <p className="mt-2.5 text-[12px] text-[#5A4636] leading-relaxed">{current.tagline}</p>
            </div>

            <div className="mt-4 text-[11px] tracking-[0.2em] text-[#A8884E]">气 味 相 近</div>
            <div className="mt-2 space-y-2">
              {kinships.map((name) => {
                const k = PERSONALITIES.find((p) => p.name === name);
                if (!k) return null;
                return (
                  <button
                    key={name}
                    onClick={() => {
                      setPersonality(name);
                      // 同源图谱动作：对象是「人格」不是香水，故不传 perfume（靠 action 区分）
                      track("discover_action", { tab: "kinship", action: "kinship_pick" });
                    }}
                    className="w-full text-left rounded-xl bg-white/70 p-4 hover:bg-white transition-colors"
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="font-serif text-[16px] text-[#2C1810]">{k.name}</span>
                      <span className="text-[11px] text-amber-700/55">{k.mbti}</span>
                    </div>
                    <div className="mt-1 text-[12px] text-amber-700/70 leading-relaxed">{k.tagline}</div>
                    <div className="mt-1.5 text-[11px] text-[#A8884E]">{k.direction}</div>
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-[11px] text-amber-700/50 leading-relaxed px-1">
              点任意一个人格即可切换过去，看看它推荐的香是否更合你口味。
            </p>
          </section>
        )}

        <div className="mt-6 rounded-xl bg-white/60 px-4 py-3">
          <p className="text-[11px] text-amber-700/60 leading-relaxed">
            本页内容为娱乐性参考，不构成医学 / 心理 / 婚恋 / 投资建议。
          </p>
        </div>
      </div>

      <SiteFooter />
    </main>
  );
}
