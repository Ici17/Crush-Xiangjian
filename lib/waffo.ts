/**
 * Waffo Pancake 客户端初始化
 *
 * Merchant ID: MER_6Rd0Agu7N1fIVgagqflrn1
 * Environment: test
 *
 * API Base URL: https://api.waffo.ai  (默认)
 *
 * 私钥通过 WAFFO_PRIVATE_KEY 环境变量传入（.env.local）
 */

import { WaffoPancake } from "@waffo/pancake-ts";

let _client: WaffoPancake | null = null;

function parsePrivateKey(raw: string): string {
  // 去掉注释行，保留 PEM 块
  return raw
    .split('\n')
    .filter((l) => !l.trim().startsWith('#') && !l.includes('替换为'))
    .join('\n')
    .trim();
}

export function getWaffoClient(): WaffoPancake {
  if (_client) return _client;
  const raw = process.env.WAFFO_PRIVATE_KEY ?? '';
  const privateKey = parsePrivateKey(raw);
  // 构建时若密钥为空或仍是占位提示，跳过初始化（部署阶段不报错）
  if (!privateKey || privateKey.includes('替换为你的')) {
    throw new Error(
      "WAFFO_PRIVATE_KEY is not configured. Add your real Waffo private key to Vercel Environment Variables."
    );
  }
  _client = new WaffoPancake({
    merchantId: "MER_6Rd0Agu7N1fIVgagqflrn1",
    privateKey,
  });
  return _client;
}
