import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 部署到 Vercel / Node 服务端（支持 API 路由 + Stripe Webhook）
  // 已移除 output: 'export'（静态导出不支持 API 路由）
  // 已移除 trailingSlash: true（仅为静态导出 python 服务器 workaround，
  // 在 Node 服务端会令 /api/pay 被 308 重定向而破坏 POST）
  images: {
    unoptimized: true,
  },
  // sharp 是原生二进制模块：标记为 serverExternalPackages，避免被 Turbopack 打包进
  // serverless function 后运行时加载失败（导致 /api/share-card 整条路由 500）。
  // 改为运行时从 node_modules 直接 require，Vercel 提供对应原生二进制。
  serverExternalPackages: ["sharp"],
};

export default nextConfig;