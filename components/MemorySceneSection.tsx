"use client";
import { getMemoryScene } from "@/lib/memoryScenes";

interface Props {
  personalityName: string;
}

export default function MemorySceneSection({ personalityName }: Props) {
  const scene = getMemoryScene(personalityName);

  return (
    <section
      aria-label="专属记忆"
      className="px-6 py-10"
      style={{ background: "#FAF3EA" }}
    >
      <p
        className="text-center"
        style={{
          fontFamily: '"Noto Serif SC", serif',
          fontSize: "15px",
          lineHeight: 2.1,
          color: "#2C1810",
          letterSpacing: "0.02em",
        }}
      >
        {scene.description}
      </p>
    </section>
  );
}
