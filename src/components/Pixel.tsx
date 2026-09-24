"use client";

import { useEffect, useRef } from "react";
import { characterSprite, HERO_LOOK, jobLook, type Dir } from "@/lib/characters";
import { icon, type IconName, TERRA } from "@/lib/icons";
import { spriteCanvas } from "@/lib/pixel";

/** Draws any cached pixel canvas scaled up with crisp pixels. */
function PixelCanvas({
  source,
  scale,
  className = "",
  label,
}: {
  source: () => HTMLCanvasElement;
  scale: number;
  className?: string;
  label?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const src = source();
    c.width = src.width;
    c.height = src.height;
    c.style.width = `${src.width * scale}px`;
    c.style.height = `${src.height * scale}px`;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(src, 0, 0);
  });
  return (
    <canvas
      ref={ref}
      className={`[image-rendering:pixelated] ${className}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}

export function PixelIcon({
  name,
  scale = 3,
  tint,
  flip,
  className,
}: {
  name: IconName;
  scale?: number;
  tint?: string;
  flip?: boolean;
  className?: string;
}) {
  return (
    <PixelCanvas
      source={() => spriteCanvas(name, icon(name), { tint, flip })}
      scale={scale}
      className={className}
    />
  );
}

export function TerraSprite({ scale = 4, className }: { scale?: number; className?: string }) {
  return <PixelCanvas source={() => spriteCanvas("terra", TERRA)} scale={scale} className={className} />;
}

export function Character({
  jobId,
  hero,
  dir = "down",
  scale = 6,
  className,
}: {
  jobId?: string;
  hero?: boolean;
  dir?: Dir;
  scale?: number;
  className?: string;
}) {
  return (
    <PixelCanvas
      source={() => characterSprite(hero || !jobId ? HERO_LOOK : jobLook(jobId), dir, 0)}
      scale={scale}
      className={className}
    />
  );
}
