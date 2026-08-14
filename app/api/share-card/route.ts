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
 *   format    1to1|3to4（默认 1to1）
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
 *   tier          tier 标签（默认"灵魂伴侣"）
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
import { renderShareCardCached, type ShareCardData, type SelfShareData, type FriendShareData, type SharedShareData } from "@/lib/shareCardRender";
import { PERSONALITY_NAME_MAP } from "@/lib/personalities";

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
  const sp = req.nextUrl.searchParams;
  const scene = sp.get("scene") ?? "";
  const format = (sp.get("format") as "1to1" | "3to4") ?? "1to1";

  if (!["1to1", "3to4"].includes(format)) {
    return NextResponse.json({ error: "format must be 1to1|3to4" }, { status: 400 });
  }
  if (!["self", "friend", "shared"].includes(scene)) {
    return NextResponse.json({ error: "scene must be self|friend|shared" }, { status: 400 });
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
    };
    data = d;

  } else if (scene === "friend") {
    const nameA = normalizeName(sp.get("nameA") ?? "");
    const nameB = normalizeName(sp.get("nameB") ?? "");
    const scoreRaw = sp.get("score");
    const perfumeNameA = sp.get("perfumeNameA") ?? "";
    const perfumeNameB = sp.get("perfumeNameB") ?? "";
    const tier = sp.get("tier") ?? "灵魂伴侣";
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
    data = d;

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

    const d: SharedShareData = {
      scene: "shared",
      sharerName, name, description, perfumeName,
      inviteCode: inv,
    };
    data = d;
  }

  try {
    const pngBuffer = await renderShareCardCached(data, format);
    const headers = new Headers({
      "Content-Type": "image/png",
      "Content-Length": String(pngBuffer.byteLength),
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "Vary": "Accept-Encoding",
    });
    return new NextResponse(new Uint8Array(pngBuffer), { status: 200, headers });
  } catch (err) {
    console.error("[/api/share-card] Render error:", err);
    return NextResponse.json({ error: "Render failed", detail: String(err) }, { status: 500 });
  }
}
