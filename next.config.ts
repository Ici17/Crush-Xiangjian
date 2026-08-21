import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 部署到 Vercel / Node 服务端（支持 API 路由 + Stripe Webhook）
  // 已移除 output: 'export'（静态导出不支持 API 路由）
  // 已移除 trailingSlash: true（仅为静态导出 python 服务器 workaround，
  // 在 Node 服务端会令 /api/pay 被 308 重定向而破坏 POST）
  images: {
    unoptimized: true,
  },
  // sharp 是原生二进制模块：标记为 serverExternalPackages，避免 Turbopack 尝试把它
  // 打进 bundle（原生 .node 绑定 + 平台探测在打包后极易运行期崩溃）。
  // 保留 external 后，Vercel 会从 node_modules 直接 require sharp。
  serverExternalPackages: ["sharp"],
  // 关键修复：sharp 通过「动态 require」按平台加载嵌套的 libvips 原生库
  // @img/sharp-libvips-linux-x64（libvips-cpp.so.8.18.3）。Next 的文件追踪（NFT）
  // 是静态分析，无法捕获这种动态 require，导致部署到 Vercel 的函数产物里缺了 .so，
  // 运行期 ERR_DLOPEN_FAILED → /api/share-card 整条路由 500。
  // 用 outputFileTracingIncludes 显式把 @img 下所有平台包（含 libvips 的 .so）
  // 一并打进函数产物，确保线上 sharp 能 dlopen 到 libvips。
  // 配套：package.json 已声明 @img/sharp-* 与 @img/sharp-libvips-* 为 optionalDependencies，
  // 且 CI 用 `npm ci --include=optional` 安装（否则 linux-x64 的 .so 不会出现在 node_modules）。
  outputFileTracingIncludes: {
    "/api/share-card": ["./node_modules/@img/**/*"],
  },
};

export default nextConfig;
