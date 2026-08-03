import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 部署到 Vercel / Node 服务端（支持 API 路由 + Stripe Webhook）
  // 已移除 output: 'export'（静态导出不支持 API 路由）
  // 已移除 trailingSlash: true（仅为静态导出 python 服务器 workaround，
  // 在 Node 服务端会令 /api/pay 被 308 重定向而破坏 POST）
  images: {
    unoptimized: true,
  },
};

export default nextConfig;