/**
 * POST /api/order
 *
 * 验证订单状态，返回是否已完成支付。
 * 前端支付完成后调用此接口解锁内容。
 *
 * Request body:
 * {
 *   orderId: string;  // 订单 ID（ORD_xxx）
 *   expectedLevel: number;  // 期望的付费档位（1=完整版, 2=订阅盒）
 * }
 *
 * Response:
 * {
 *   valid: boolean;
 *   orderStatus: string;
 *   productId: string;
 *   productName: string;
 *   amount: string;
 *   currency: string;
 *   paidLevel: number;  // 映射后的本地付费档位（由 metadata.orderLevel 决定）
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { getWaffoClient } from "@/lib/waffo";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, expectedLevel } = body;

    if (!orderId) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 });
    }

    const client = getWaffoClient();

    // 通过 GraphQL 查询订单详情
    const result = await client.graphql.query<{
      order: {
        id: string;
        status: string;
        product: { id: string; name: string };
        payments: Array<{
          status: string;
          amount: string;
          currency: string;
        }>;
        metadata: Record<string, string>;
      } | null;
    }>({
      query: `
        query GetOrder($id: ID!) {
          order(id: $id) {
            id
            status
            product { id name }
            payments { status amount currency }
            metadata
          }
        }
      `,
      variables: { id: orderId },
    });

    if (result.errors?.length) {
      console.error("[Waffo] GraphQL errors:", result.errors);
    }

    const order = result.data?.order;

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // 判断是否支付成功：订单 completed 且存在 succeeded 付款记录
    const isPaid =
      order.status === "completed" &&
      order.payments.some((p) => p.status === "succeeded");

    if (!isPaid) {
      return NextResponse.json({
        valid: false,
        orderStatus: order.status,
        productId: order.product.id,
        productName: order.product.name,
        paidLevel: 0,
      });
    }

    // 从 metadata 读取本地付费档位映射
    // 约定 metadata.orderLevel = "1" (完整版) | "2" (订阅盒)
    const paidLevel = parseInt(order.metadata?.orderLevel ?? "0", 10);

    return NextResponse.json({
      valid: true,
      orderStatus: order.status,
      productId: order.product.id,
      productName: order.product.name,
      amount: order.payments[0]?.amount ?? "",
      currency: order.payments[0]?.currency ?? "",
      paidLevel,
    });
  } catch (err: unknown) {
    console.error("[Waffo] Order verification failed:", err);
    const e = err as { data?: { errors?: Array<{ message: string }> }; message?: string };
    const msg =
      e?.data?.errors?.[0]?.message ?? e?.message ?? "Verification failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
