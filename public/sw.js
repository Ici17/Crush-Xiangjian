// Crush香鉴 — Service Worker
// PWA 离线缓存策略：Network First, fallback to Cache

const CACHE_NAME = "crushxiangjian-v1";
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
  // 跳过跨域请求和非 GET 请求
  if (
    !event.request.url.startsWith(self.location.origin) ||
    event.request.method !== "GET"
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
