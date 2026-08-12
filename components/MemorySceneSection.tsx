"use client";
import { getMemoryScene, type PerfumeSnapshot } from "@/lib/memoryScenes";

interface PerfumeData {
  name: string;
  brand: string;
  notesStructured?: { top: string[]; heart: string[]; base: string[] };
  top?: string[];
  heart?: string[];
  base?: string[];
}

interface Props {
  personalityName: string;
  perfume?: PerfumeData;
}

export default function MemorySceneSection({ personalityName, perfume }: Props) {
  const scene = perfume
    ? getMemoryScene(personalityName, toSnapshot(perfume))
    : { description: "你身上有种说不清的特别。像一阵路过却让人记住的风。" };

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

function toSnapshot(p: PerfumeData): PerfumeSnapshot {
  if (p.notesStructured) return p as PerfumeSnapshot;
  return {
    name: p.name,
    brand: p.brand,
    notesStructured: {
      top: p.top || [],
      heart: p.heart || [],
      base: p.base || [],
    },
  };
}
