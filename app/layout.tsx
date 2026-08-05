import type { Metadata, Viewport } from "next";
import "./globals.css";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Crush香鉴 | 你的灵魂，藏在哪种香气里",
  description: "10道情境题，测出你的灵魂香气与本命香水。好友匹配、性格解读、香调雷达图——发现独属于你的嗅觉人格。",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Crush香鉴",
  },
  openGraph: {
    title: "Crush香鉴 | 你的灵魂，藏在哪种香气里",
    description: "10道情境题，测出你的灵魂香气与本命香水。好友匹配、性格解读、香调雷达图——发现独属于你的嗅觉人格。",
    type: "website",
    siteName: "Crush香鉴",
    locale: "zh_CN",
  },
  twitter: {
    card: "summary_large_image",
    title: "Crush香鉴 | 你的灵魂，藏在哪种香气里",
    description: "10道情境题，测出你的灵魂香气与本命香水。",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#FAF3EA",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600;700&family=Noto+Sans+SC:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        {/* Service Worker 注册 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function(err) {
                    console.warn('SW registration failed:', err);
                  });
                });
              }
            `,
          }}
        />
      </head>
      <body className="antialiased flex flex-col min-h-screen">
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
