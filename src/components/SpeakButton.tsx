"use client";

import { speak } from "@/lib/speech";
import { PixelIcon } from "./Pixel";

export default function SpeakButton({
  text,
  className = "",
  dark,
}: {
  text: string;
  className?: string;
  dark?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        speak(text);
      }}
      className={`px-btn ${dark ? "px-btn-navy" : "px-btn-light"} h-12 w-12 shrink-0 !p-0 ${className}`}
      aria-label="Écouter"
      title="Écouter"
    >
      <PixelIcon name="speaker" scale={3} tint={dark ? "#FFFFFF" : undefined} />
    </button>
  );
}
