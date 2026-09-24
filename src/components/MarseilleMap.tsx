"use client";

import { useEffect, useRef } from "react";
import { characterSprite, HERO_LOOK, jobLook, passerbyLook } from "@/lib/characters";
import { MapEngine } from "@/lib/engine";
import { useGame } from "@/state/gameStore";

export default function MarseilleMap() {
  const ref = useRef<HTMLCanvasElement>(null);
  const engine = useRef<MapEngine | null>(null);
  const interactive = useGame((s) => s.screen === "map");

  useEffect(() => {
    const e = new MapEngine(ref.current!);
    engine.current = e;
    // dev-only handle for debugging from the browser console
    if (process.env.NODE_ENV !== "production") {
      Object.assign(window, { __map: e, __sprites: { characterSprite, jobLook, HERO_LOOK, passerbyLook } });
    }
    return () => e.destroy();
  }, []);

  useEffect(() => {
    engine.current?.setInteractive(interactive);
  }, [interactive]);

  return (
    <canvas
      ref={ref}
      className="absolute inset-0 h-full w-full touch-none"
      aria-label="Carte de Marseille : clique sur un lieu pour zoomer, puis sur une personne pour découvrir son métier."
    />
  );
}
