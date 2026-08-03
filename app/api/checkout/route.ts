/**
 * POST /api/checkout
 *
 * 创建 Waffo Checkout Session，返回重定向 URL。
 *
 * Request body:
 * {
 *   productId: string;       // Waffo 产品 ID（PROD_xxx）
 *   currency: string;        // 币种，CNY/USD 等
 *   buyerEmail?: string;    // 可选：预填邮箱
 *   metadata?: Record<string, string>;  // 自定义数据（最多50键）
 * }
 *
 * Response:
 * { checkoutUrl: string; sessionId: string; expiresAt: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { getWaffoClient } from "@/lib/waffo";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, currency = "CNY", buyerEmail, metadata } = body;

    if (!productId) {
      return NextResponse.json(
        { error: "productId is required" },
        { status: 400 }
      );
    }

    const client = getWaffoClient();

    const result = await client.checkout.anonymous.create({
      productId,
      currency,
      ...(buyerEmail ? { buyerEmail } : {}),
      ...(metadata ? { metadata } : {}),
    });

    // result: { sessionId, checkoutUrl, expiresAt, warnings? }
    return NextResponse.json({
      sessionId: result.sessionId,
      checkoutUrl: result.checkoutUrl,
      expiresAt: result.expiresAt,
    });
  } catch (err: unknown) {
    console.error("[Waffo] Checkout session creation failed:", err);

    // 尝试从 SDK envelope 提取错误信息
    const e = err as { data?: { errors?: Array<{ message: string }> }; message?: string };
    const msg =
      e?.data?.errors?.[0]?.message ??
      e?.message ??
      "Failed to create checkout session";

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
