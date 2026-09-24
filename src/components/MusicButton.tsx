"use client";

import { useEffect, useState } from "react";
import { music } from "@/lib/music";
import { PixelIcon } from "./Pixel";

/** Starts the music on the first click/key (browsers block autoplay). */
export function useMusicAutostart() {
  useEffect(() => {
    const start = () => music.start();
    window.addEventListener("pointerdown", start, { once: true });
    window.addEventListener("keydown", start, { once: true });
    return () => {
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("keydown", start);
    };
  }, []);
}

export default function MusicButton({ className = "" }: { className?: string }) {
  const [on, setOn] = useState(music.enabled);
  useEffect(() => music.subscribe(setOn), []);

  return (
    <button
      type="button"
      onPointerDown={(e) => e.stopPropagation()} // don't let the autostart listener fire first
      onClick={() => music.toggle()}
      className={`px-btn px-btn-light relative h-14 w-14 !p-0 ${className}`}
      aria-label={on ? "Couper la musique" : "Mettre la musique"}
      aria-pressed={on}
      title={on ? "Couper la musique" : "Mettre la musique"}
    >
      <PixelIcon name="note" scale={3} className={on ? "" : "opacity-40"} />
      {!on && <span className="absolute h-1.5 w-10 rotate-45 bg-terracotta" aria-hidden />}
    </button>
  );
}
