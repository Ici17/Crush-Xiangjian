/**
 * 公开只读：已发布的展示文案覆盖。
 * 不含 scope='config' 的算法配置（那是服务端内部数据，不走公开接口）。
 */
import { NextResponse } from "next/server";
import { readPublishedCopy } from "@/lib/content/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const copy = await readPublishedCopy();
  return NextResponse.json(
    { copy },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
}
