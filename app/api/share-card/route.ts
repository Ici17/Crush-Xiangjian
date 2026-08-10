/**
 * GET /api/share-card
 * 
 * 服务端渲染双人契合度分享图
 * 
 * Query params:
 *   nameA      人格 A 名称（必填）
 *   nameB      人格 B 名称（必填）
 *   taglineA   A 的 tagline（可选）
 *   taglineB   B 的 tagline（可选）
 *   score      契合度 0-100（必填）
 *   tier       tier 标签文字（默认"灵魂伴侣"）
 *   shared     共同偏爱香调，逗号分隔（可选）
 *   story      场景故事（可选）
 *   inv        邀请码（嵌入二维码）
 *   template   默契|挑战|稀有（默认"默契"）
 *   format     1to1|3to4（默认"1to1"）
 * 
 * Returns: image/png
 */

import { NextRequest, NextResponse } from "next/server";
import { renderShareCardCached, type ShareCardData } from "@/lib/shareCardRender";
import { PERSONALITY_NAME_MAP } from "@/lib/personalities";

export const runtime = "nodejs";

function normalizeName(raw: string): string {
  return PERSONALITY_NAME_MAP[raw] ?? raw;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  const nameA = normalizeName(sp.get("nameA") ?? "");
  const nameB = normalizeName(sp.get("nameB") ?? "");
  const scoreRaw = sp.get("score");
  const inv = sp.get("inv") ?? "";
  const template = (sp.get("template") as ShareCardData["template"]) ?? "默契";
  const format = (sp.get("format") as "1to1" | "3to4") ?? "1to1";
  const tier = sp.get("tier") ?? "灵魂伴侣";
  const shared = sp.get("shared") ? sp.get("shared")!.split(",").filter(Boolean) : [];
  const story = sp.get("story") ?? "两种香气的碰撞，让彼此独一无二的共鸣悄然发生。";
  const taglineA = sp.get("taglineA") ?? "";
  const taglineB = sp.get("taglineB") ?? "";

  if (!nameA || !nameB || !scoreRaw) {
    return NextResponse.json(
      { error: "nameA, nameB, score are required" },
      { status: 400 }
    );
  }

  const score = parseInt(scoreRaw, 10);
  if (isNaN(score) || score < 0 || score > 100) {
    return NextResponse.json({ error: "score must be 0-100" }, { status: 400 });
  }

  if (!["默契", "挑战", "稀有"].includes(template)) {
    return NextResponse.json({ error: "template must be 默契|挑战|稀有" }, { status: 400 });
  }

  if (!["1to1", "3to4"].includes(format)) {
    return NextResponse.json({ error: "format must be 1to1|3to4" }, { status: 400 });
  }

  const data: ShareCardData = {
    nameA,
    nameB,
    taglineA,
    taglineB,
    score,
    tier,
    sharedNotes: shared,
    story,
    inviteCode: inv,
    template,
  };

  try {
    const pngBuffer = await renderShareCardCached(data, format);

    // 设置缓存 Header（5 分钟）
    const headers = new Headers({
      "Content-Type": "image/png",
      "Content-Length": String(pngBuffer.byteLength),
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "Vary": "Accept-Encoding",
    });

    return new NextResponse(new Uint8Array(pngBuffer), { status: 200, headers });
  } catch (err) {
    console.error("[/api/share-card] Render error:", err);
    return NextResponse.json(
      { error: "Render failed", detail: String(err) },
      { status: 500 }
    );
  }
}
