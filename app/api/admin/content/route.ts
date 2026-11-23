/**
 * 后台内容配置 API：读全部（含未发布）/ 保存一条配置。
 * 复用现有 ADMIN_PASSWORD + HMAC cookie 鉴权，不另造登录体系。
 */
import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, adminEnabled, isValidAdminCookie } from "@/lib/admin/auth";
import {
  readConfig,
  upsertConfig,
  configStoreReady,
  probeConfigTable,
  type ContentScope,
} from "@/lib/content/config";
import { validateConfigValue } from "@/lib/content/validate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authed(req: NextRequest): boolean {
  return adminEnabled() && isValidAdminCookie(req.cookies.get(ADMIN_COOKIE)?.value);
}

export async function GET(req: NextRequest) {
  if (!authed(req)) {
    return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
  }
  const [copy, config] = await Promise.all([
    readConfig("copy", false),
    readConfig("config", false),
  ]);
  return NextResponse.json({
    ok: true,
    storeReady: configStoreReady(),
    tableReady: await probeConfigTable(),
    copy,
    config,
  });
}

export async function POST(req: NextRequest) {
  if (!authed(req)) {
    return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
  }
  if (!configStoreReady()) {
    return NextResponse.json(
      { ok: false, error: "未配置 Supabase 凭据，写入不会生效" },
      { status: 503 },
    );
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, error: "请求格式错误" }, { status: 400 });
  }
  const b = body as {
    key?: unknown; scope?: unknown; value?: unknown;
    version?: unknown; published?: unknown; note?: unknown;
  };

  const key = typeof b.key === "string" ? b.key.trim() : "";
  const scope = b.scope as ContentScope;
  if (!/^(copy|config)\.[a-zA-Z0-9_.-]+$/.test(key) || !key.startsWith(`${scope}.`)) {
    return NextResponse.json({ ok: false, error: "key 格式非法（需 scope.前缀）" }, { status: 400 });
  }
  if (scope !== "copy" && scope !== "config") {
    return NextResponse.json({ ok: false, error: "scope 非法" }, { status: 400 });
  }
  if (scope === "copy" && typeof b.value !== "string") {
    return NextResponse.json({ ok: false, error: "展示文案的 value 必须是字符串" }, { status: 400 });
  }
  if (scope === "config" && (typeof b.value !== "object" || b.value === null)) {
    return NextResponse.json(
      { ok: false, error: "算法配置的 value 必须是对象（含 version 校验信息）" },
      { status: 400 },
    );
  }
  const version = Number(b.version);
  if (!Number.isInteger(version) || version < 1) {
    return NextResponse.json({ ok: false, error: "version 必须是正整数" }, { status: 400 });
  }

  // 算法配置一旦发布就会影响推荐，发布前必须过结构校验；草稿允许先存后改
  if (scope === "config" && b.published === true) {
    const check = validateConfigValue(key, b.value);
    if (!check.ok) {
      return NextResponse.json({ ok: false, error: check.error }, { status: 400 });
    }
  }

  const ok = await upsertConfig({
    key,
    scope,
    value: b.value,
    version,
    published: b.published === true,
    note: typeof b.note === "string" ? b.note.slice(0, 200) : undefined,
  });
  if (!ok) {
    return NextResponse.json({ ok: false, error: "写入失败（检查表是否已建、service_role 权限）" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, key });
}
