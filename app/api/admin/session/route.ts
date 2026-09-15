import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_COOKIE,
  adminEnabled,
  adminToken,
  checkPassword,
  cookieOptions,
  isValidAdminCookie,
} from '@/lib/admin/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** 登录：POST { password } */
export async function POST(req: NextRequest) {
  if (!adminEnabled()) {
    return NextResponse.json(
      { ok: false, error: '未配置 ADMIN_PASSWORD，线上后台已禁用' },
      { status: 503 },
    );
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: '请求格式错误' }, { status: 400 });
  }
  const password = (body as { password?: unknown })?.password;
  if (typeof password !== 'string' || !checkPassword(password)) {
    return NextResponse.json({ ok: false, error: '口令不正确' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, adminToken(), cookieOptions());
  return res;
}

/** 登录态检查：GET */
export async function GET(req: NextRequest) {
  const cookie = req.cookies.get(ADMIN_COOKIE)?.value;
  return NextResponse.json({
    ok: isValidAdminCookie(cookie),
    enabled: adminEnabled(),
  });
}

/** 登出：DELETE */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, '', { ...cookieOptions(), maxAge: 0 });
  return res;
}
