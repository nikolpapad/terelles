"use client";

import { useEffect, useRef } from "react";
import { characterSprite, CHAR_H, CHAR_W, jobLook } from "@/lib/characters";
import { JOB_BY_ID } from "@/lib/content";
import { icon, propOf } from "@/lib/icons";
import { jobPos } from "@/lib/marseille";
import { C, spriteCanvas } from "@/lib/pixel";
import { getTerrain } from "@/lib/worldgen";

const SW = 96;
const SH = 52;

/**
 * Card header: the real map spot where she works, with her holding up her
 * signature prop, 16-bit "item get" style.
 */
export default function JobScene({ jobId, className = "" }: { jobId: string; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current!;
    c.width = SW;
    c.height = SH;
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    const p = jobPos(JOB_BY_ID[jobId]);
    ctx.drawImage(getTerrain().detail, Math.round(p.x - SW / 2), Math.round(p.y - SH + 6), SW, SH, 0, 0, SW, SH);
    ctx.fillStyle = "rgba(255,240,200,0.18)";
    ctx.fillRect(0, 0, SW, SH);

    let raf = 0;
    const base = ctx.getImageData(0, 0, SW, SH);
    const draw = (t: number) => {
      ctx.putImageData(base, 0, 0);
      const bob = Math.floor(t / 400) % 2;
      const cx = SW / 2;
      const feet = SH - 3;
      ctx.fillStyle = "rgba(20,20,40,0.3)";
      ctx.fillRect(cx - 5, feet - 1, 10, 2);
      ctx.drawImage(characterSprite(jobLook(jobId), "down", 0), cx - CHAR_W / 2, feet - CHAR_H);
      const prop = spriteCanvas(propOf(jobId), icon(propOf(jobId)));
      ctx.drawImage(prop, cx - 5, feet - CHAR_H - 12 - bob);
      // sparkles
      ctx.fillStyle = C.sun;
      const s = Math.floor(t / 250) % 4;
      const spots = [
        [cx - 10, feet - CHAR_H - 10],
        [cx + 8, feet - CHAR_H - 6],
        [cx - 9, feet - CHAR_H + 1],
        [cx + 9, feet - CHAR_H - 13],
      ];
      const [sx, sy] = spots[s];
      ctx.fillRect(sx, sy - 1, 1, 3);
      ctx.fillRect(sx - 1, sy, 3, 1);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [jobId]);

  return <canvas ref={ref} className={`h-full w-full [image-rendering:pixelated] ${className}`} aria-hidden />;
}
