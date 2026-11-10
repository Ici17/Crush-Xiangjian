// Crush香鉴 — Service Worker
// PWA 离线缓存策略：Network First, fallback to Cache

// ⚠️ 2026-11-10 隐私修复：旧版对**所有**同源 GET 无差别 cache.put，会把
// /api/admin/overview（含最近 100 条事件明细与匿名访客 ID）、/api/share-card?...
// （含人格 / 雷达 / 邀请码）等响应写进浏览器 Cache Storage；离线时 caches.match
// 直接返回缓存、不再校验登录态，共享设备上可能越权读到管理数据。
// 服务端即使返回 Cache-Control: no-store 也挡不住 Cache API 的手动 put。
// 现在显式旁路所有 API / 后台路由；版本号升到 v2，activate 会整体清掉 v1 历史缓存。
const CACHE_NAME = "crushxiangjian-v2";

/** 带鉴权或用户数据的路由一律不进离线缓存 */
function shouldBypassCache(url) {
  const p = url.pathname;
  return p.startsWith("/api/") || p === "/admin" || p.startsWith("/admin/");
}

const STATIC_ASSETS = [
  "/",
  "/question",
  "/result",
  "/manifest.json",
];

// 安装：预缓存静态资源
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// 激活：清理旧缓存
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// 请求拦截：Network First → Cache Fallback
self.addEventListener("fetch", (event) => {
  // 跳过跨域、非 GET，以及所有 API / 后台响应（含鉴权与用户数据）
  let url;
  try {
    url = new URL(event.request.url);
  } catch {
    return;
  }
  if (
    url.origin !== self.location.origin ||
    event.request.method !== "GET" ||
    shouldBypassCache(url)
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 成功响应：更新缓存
        const cloned = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
        return response;
      })
      .catch(() => {
        // 网络失败：从缓存读取
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // 兜底：返回离线页面
          return caches.match("/");
        });
      })
  );
});

// 推送通知支持（可选）
self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title ?? "Crush香鉴", {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: data.url,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.notification.data) {
    event.waitUntil(clients.openWindow(event.notification.data));
  }
});
