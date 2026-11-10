"use client";

/**
 * MotionProvider —— 让 framer-motion 尊重系统「减少动态效果」偏好。
 *
 * 为什么需要它：app/page.tsx 与 app/result/page.tsx 的入场动画由 JS 驱动，
 * globals.css 里的 @media (prefers-reduced-motion: reduce) 只能压掉 CSS 动画，
 * 覆盖不到 framer-motion 的 transform / layout 动画。MotionConfig 必须显式声明。
 *
 * reducedMotion="user"：保留 opacity 淡入（不闪现），禁用位移 / 缩放 / 布局动画。
 * 该组件只提供 context、不渲染 DOM，因此不会改变 body 的 flex 布局。
 */

import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

export default function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
