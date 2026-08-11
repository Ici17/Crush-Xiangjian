"use client";
import { getMemoryScene } from "@/lib/memoryScenes";

interface Props {
  personalityName: string;
}

const DIM_LABELS: Record<string, string> = {
  top: "前调",
  heart: "中调",
  base: "后调",
};

export default function MemorySceneSection({ personalityName }: Props) {
  const scene = getMemoryScene(personalityName);

  const notes = [
    { label: DIM_LABELS.top, note: scene.top },
    { label: DIM_LABELS.heart, note: scene.heart },
    { label: DIM_LABELS.base, note: scene.base },
  ];

  return (
    <section
      aria-label="专属记忆"
      className="px-6 py-10"
      style={{ background: "#FAF3EA" }}
    >
      {/* 专属记忆描述 */}
      <p
        className="text-center mb-8"
        style={{
          fontFamily: '"Noto Serif SC", serif',
          fontSize: "15px",
          lineHeight: 2,
          color: "#2C1810",
          letterSpacing: "0.02em",
        }}
      >
        {scene.description}
      </p>

      {/* 分隔线 */}
      <div
        className="mx-auto mb-6"
        style={{ width: "1px", height: "20px", background: "#D4A57460" }}
      />

      {/* 三调：纵向带标签 */}
      <div className="flex flex-col gap-2.5 mb-6">
        {notes.map(({ label, note }) => (
          <div key={label} className="flex items-start gap-3">
            <span
              className="shrink-0"
              style={{
                fontFamily: '"Noto Sans SC", sans-serif',
                fontSize: "11px",
                color: "#C4956A",
                letterSpacing: "0.1em",
                paddingTop: "2px",
                minWidth: "32px",
              }}
            >
              {label}
            </span>
            <span
              style={{
                fontFamily: '"Noto Serif SC", serif',
                fontSize: "14px",
                color: "#5C3826",
                lineHeight: 1.7,
              }}
            >
              {note}
            </span>
          </div>
        ))}
      </div>

      {/* 分隔线 */}
      <div
        className="mx-auto mb-6"
        style={{ width: "1px", height: "16px", background: "#D4A57450" }}
      />

      {/* 心动短句 */}
      <p
        className="text-center"
        style={{
          fontFamily: '"Noto Serif SC", serif',
          fontSize: "13px",
          fontStyle: "italic",
          lineHeight: 1.9,
          color: "#8B6F5C",
          letterSpacing: "0.02em",
        }}
      >
        {scene.insight}
      </p>
    </section>
  );
}
