/**
 * 后台鉴权（服务端共用）。
 *
 * - 口令来自环境变量 ADMIN_PASSWORD。
 * - 未配置时：本地 dev 允许默认口令 crush2026；线上（Vercel）直接禁用后台，避免裸奔。
 * - 登录态是一个 HMAC 派生的 httpOnly cookie，不存明文口令。
 */

import { createHmac } from 'node:crypto';

export const ADMIN_COOKIE = 'cx_admin';
const DEV_PASSWORD = 'crush2026';

export function adminPassword(): string {
  return (process.env.ADMIN_PASSWORD || '').trim();
}

export function isProduction(): boolean {
  return process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
}

/** 后台是否可用：线上必须显式配置 ADMIN_PASSWORD */
export function adminEnabled(): boolean {
  if (adminPassword()) return true;
  return !isProduction();
}

export function adminToken(): string {
  return createHmac('sha256', adminPassword() || DEV_PASSWORD)
    .update('cx_admin_session_v1')
    .digest('hex');
}

export function isValidAdminCookie(value: string | undefined): boolean {
  if (!value || !adminEnabled()) return false;
  return value === adminToken();
}

export function checkPassword(input: string): boolean {
  if (!adminEnabled()) return false;
  const expected = adminPassword() || DEV_PASSWORD;
  return input === expected;
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
    secure: isProduction(),
  };
}
