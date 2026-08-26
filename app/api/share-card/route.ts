/**
 * GET /api/share-card
 *
 * 服务端渲染分享图（三场景）
 *   scene=self   结果页本人（人格名 + 三香横排 + tagline）
 *   scene=friend 朋友匹配（双人 + 圆环契合度）
 *   scene=shared /shared 分享卡（拉新为主）
 *
 * Query params（按 scene 分组）：
 *   scene     self|friend|shared（必填）
 *   format    3to4（默认 3to4）— 1:1 已下线，全部统一为 3:4 长图
 *
 * scene=self:
 *   name          人格名（必填）
 *   tagline       扎心短句（必填）
 *   perfumeA      本命香名（必填）
 *   matchA        本命香匹配%（必填）
 *   perfumeB      进阶香名（必填）
 *   matchB        进阶香匹配%（必填）
 *   perfumeC      尝试香名（必填）
 *   matchC        尝试香匹配%（必填）
 *   desc          人格一句话简介（可选）
 *   notesA/B/C    三香三调关键词，点分隔（可选）
 *   brandA/B/C    三香品牌名（可选，提升高级感）
 *   shared        共享香调，逗号分隔（可选，3:4 时显示）
 *
 * scene=friend:
 *   nameA         人格 A 名（必填）
 *   nameB         人格 B 名（必填）
 *   perfumeNameA  A 的本命香名（必填）
 *   perfumeNameB  B 的本命香名（必填）
 *   score         契合度 0-100（必填）
 *   tier          tier 标签（默认"气息同频"）
 *   story         关系解读句（默认"两种香气的碰撞，让彼此独一无二的共鸣悄然发生。"）
 *   notesA/B      双方签名香三调关键词，点分隔（可选）
 *   brandA/B      双方签名香品牌名（可选）
 *   radarA/B      双方六维雷达 JSON（0~1，可选，3:4 时绘制双人对比雷达）
 *   shared        共享香调，逗号分隔（可选）
 *   inv           邀请码（嵌入二维码）
 *
 * scene=shared:
 *   sharerName    分享者人格名（必填）
 *   name          人格名（必填）
 *   description   人格 description（必填）
 *   perfumeName   本命香名（必填）
 *   inv           邀请码（嵌入二维码）
 *
 * Returns: image/png
 */

import { NextRequest, NextResponse } from "next/server";
import { renderShareCardCached, type ShareCardData, type SelfShareData, type FriendShareData, type SharedShareData, type DailyShareData } from "@/lib/shareCardRender";
import { PERSONALITY_NAME_MAP, getScentPhilosophy, getRadarScores, RADAR_DIMS, RADAR_DIM_LABELS } from "@/lib/personalities";
import { getCpResonance } from "@/lib/cpResonance";
import { drawDaily, getTodayStr, RARITY_LABEL, type DrawnPerfume } from "@/lib/daily/draw";
import { drawAlmanac } from "@/lib/daily/almanac";

export const runtime = "nodejs";

function normalizeName(raw: string): string {
  return PERSONALITY_NAME_MAP[raw] ?? raw;
}

// 解析雷达 JSON（0~1，六维中文键），失败返回 undefined
function parseRadarParam(raw: string | null): Record<string, number> | undefined {
  if (!raw) return undefined;
  try {
    const obj = JSON.parse(raw);
    if (obj && typeof obj === "object" && !Array.isArray(obj)) return obj as Record<string, number>;
  } catch { /* ignore */ }
  return undefined;
}

export async function GET(req: NextRequest) {
 try {
  const sp = req.nextUrl.searchParams;
  const scene = sp.get("scene") ?? "";
  // 入参容错：早期请求可能带 format=1to1，自动归一为 3to4（1:1 已下线）
  const rawFormat = (sp.get("format") ?? "3to4") as string;
  const format: "3to4" = rawFormat === "1to1" ? "3to4" : "3to4";
  if (!["self", "friend", "shared", "daily"].includes(scene)) {
    return NextResponse.json({ error: "scene must be self|friend|shared|daily" }, { status: 400 });
  }

  let data: ShareCardData;

  if (scene === "self") {
    const name = normalizeName(sp.get("name") ?? "");
    const tagline = sp.get("tagline") ?? "";
    const perfumeA = sp.get("perfumeA") ?? "";
    const matchA = parseInt(sp.get("matchA") ?? "", 10);
    const perfumeB = sp.get("perfumeB") ?? "";
    const matchB = parseInt(sp.get("matchB") ?? "", 10);
    const perfumeC = sp.get("perfumeC") ?? "";
    const matchC = parseInt(sp.get("matchC") ?? "", 10);
    // 锁定版内容（2026-08-13 改：分享图=锁定版，不含解锁内容）
    const radarRaw = sp.get("radar"); // JSON: {"木质":0.8,...} 或 逗号分隔 6 值
    const memoryScene = sp.get("memoryScene");

    if (!name || !tagline || !perfumeA || !perfumeB || !perfumeC) {
      return NextResponse.json({ error: "self: name, tagline, perfumeA/B/C are required" }, { status: 400 });
    }
    if (isNaN(matchA) || isNaN(matchB) || isNaN(matchC)) {
      return NextResponse.json({ error: "self: matchA/B/C must be numbers 0-100" }, { status: 400 });
    }

    // 解析雷达数据
    let radar: Record<string, number> | undefined;
    if (radarRaw) {
      try {
        radar = JSON.parse(radarRaw);
      } catch {
        // 兜底：逗号分隔 6 值
        const vals = radarRaw.split(",").map(Number).filter((v) => !isNaN(v));
        if (vals.length === 6) {
          const dims = ["木质", "清新", "东方", "美食", "柑橘", "花香"];
          radar = {};
          dims.forEach((dim, i) => { radar![dim] = vals[i]; });
        }
      }
    }

    // 3:4 专属深度内容：由人格名程序化派生用香哲学 + 香调偏好 top 3
    const scentPhilosophy = getScentPhilosophy(name);
    const radarScores = getRadarScores(name);
    const radarTop3 = [...RADAR_DIMS]
      .sort((a, b) => (radarScores[b] ?? 0) - (radarScores[a] ?? 0))
      .slice(0, 3)
      .map((dim) => RADAR_DIM_LABELS[dim] ?? dim);

    const d: SelfShareData = {
      scene: "self",
      name,
      tagline,
      perfumeA: { name: perfumeA, tier: "本命香", match: matchA },
      perfumeB: { name: perfumeB, tier: "进阶香", match: matchB },
      perfumeC: { name: perfumeC, tier: "尝试香", match: matchC },
      radar,
      memoryScene: memoryScene || undefined,
      desc: sp.get("desc") || undefined,
      notesA: sp.get("notesA") || undefined,
      notesB: sp.get("notesB") || undefined,
      notesC: sp.get("notesC") || undefined,
      brandA: sp.get("brandA") || undefined,
      brandB: sp.get("brandB") || undefined,
      brandC: sp.get("brandC") || undefined,
      scentPhilosophy,
      radarTop3,
    };
    data = d;

  } else if (scene === "friend") {
    const nameA = normalizeName(sp.get("nameA") ?? "");
    const nameB = normalizeName(sp.get("nameB") ?? "");
    const scoreRaw = sp.get("score");
    const perfumeNameA = sp.get("perfumeNameA") ?? "";
    const perfumeNameB = sp.get("perfumeNameB") ?? "";
    const tier = sp.get("tier") ?? "气息同频";
    const story = sp.get("story") ?? "两种香气的碰撞，让彼此独一无二的共鸣悄然发生。";
    const shared = sp.get("shared") ? sp.get("shared")!.split(",").filter(Boolean) : undefined;
    const inv = sp.get("inv") ?? "";
    const radarA = parseRadarParam(sp.get("radarA"));
    const radarB = parseRadarParam(sp.get("radarB"));

    if (!nameA || !nameB || !scoreRaw || !perfumeNameA || !perfumeNameB) {
      return NextResponse.json({ error: "friend: nameA, nameB, score, perfumeNameA, perfumeNameB are required" }, { status: 400 });
    }
    const score = parseInt(scoreRaw, 10);
    if (isNaN(score) || score < 0 || score > 100) {
      return NextResponse.json({ error: "score must be 0-100" }, { status: 400 });
    }

    const d: FriendShareData = {
      scene: "friend",
      nameA, nameB, perfumeNameA, perfumeNameB,
      score, tier, story,
      sharedNotes: shared,
      perfumeTierA: sp.get("perfumeTierA") || undefined,
      perfumeTierB: sp.get("perfumeTierB") || undefined,
      notesA: sp.get("notesA") || undefined,
      notesB: sp.get("notesB") || undefined,
      brandA: sp.get("brandA") || undefined,
      brandB: sp.get("brandB") || undefined,
      radarA,
      radarB,
      inviteCode: inv,
    };
    // 合香卡（CP 共振）：服务端确定性计算，与页面 CpBlendCard 同源一致
    const cp = getCpResonance(nameA, nameB);
    if (cp) {
      d.cpBlendName = cp.blendName;
      d.cpDiffTones = cp.diffTones;
      d.cpToneA = cp.toneA;
      d.cpToneB = cp.toneB;
      d.cpSeal = cp.seal;
      d.cpLine = cp.line;
      d.cpNotes = `前 ${cp.top.join("·")} ｜ 中 ${cp.heart.join("·")} ｜ 后 ${cp.base.join("·")}`;
    }
    data = d;

  } else if (scene === "daily") {
    const date = sp.get("date") ?? getTodayStr();
    const draw = drawDaily(date);
    const fmt = (p: DrawnPerfume) => ({
      name: p.name,
      brandCn: p.brandCn,
      description: p.description,
      notes: `前 ${p.notes.top.join("·")} ｜ 中 ${p.notes.heart.join("·")} ｜ 后 ${p.notes.base.join("·")}`,
      rarity: RARITY_LABEL[p.rarity],
    });
    const alm = drawAlmanac(date);
    const dd: DailyShareData = {
      scene: "daily",
      date,
      main: fmt(draw.main),
      inspirationA: fmt(draw.inspirations[0]),
      inspirationB: fmt(draw.inspirations[1]),
      almanac: { yi: alm.yi, ji: alm.ji, note: alm.note },
    };
    data = dd;

  } else {
    // scene === "shared"
    const sharerName = normalizeName(sp.get("sharerName") ?? "");
    const name = normalizeName(sp.get("name") ?? "");
    const description = sp.get("description") ?? "";
    const perfumeName = sp.get("perfumeName") ?? "";
    const inv = sp.get("inv") ?? "";

    if (!sharerName || !name || !description || !perfumeName) {
      return NextResponse.json({ error: "shared: sharerName, name, description, perfumeName are required" }, { status: 400 });
    }

    const scentPhilosophy = getScentPhilosophy(name);

    const d: SharedShareData = {
      scene: "shared",
      sharerName, name, description, perfumeName,
      scentPhilosophy,
      inviteCode: inv,
    };
    data = d;
  }

  const pngBuffer = await renderShareCardCached(data, format);
  const headers = new Headers({
    "Content-Type": "image/png",
    "Content-Length": String(pngBuffer.byteLength),
    // 分享图禁用浏览器/CDN 缓存：样式迭代快，避免用户保存到旧版图片。
    // 服务端仍有 5 分钟内存缓存（renderShareCardCached）保证并发性能。
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Vary": "Accept-Encoding",
  });
  return new NextResponse(new Uint8Array(pngBuffer), { status: 200, headers });
 } catch (err) {
  console.error("[/api/share-card] Unhandled error:", err);
  const detail = err instanceof Error ? (err.stack || err.message) : String(err);
  return NextResponse.json({ error: "share-card failed", detail }, { status: 500 });
 }
}
