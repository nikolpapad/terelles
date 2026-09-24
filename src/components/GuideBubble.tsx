"use client";

import { noEmoji } from "@/lib/pixel";
import { useGame } from "@/state/gameStore";
import { TerraSprite } from "./Pixel";
import SpeakButton from "./SpeakButton";
import Typewriter from "./Typewriter";

/** Terra's RPG dialogue box. */
export default function GuideBubble() {
  const guide = useGame((s) => s.guide);
  if (guide.status === "idle") return null;
  const text = guide.status === "done" ? noEmoji(guide.text) : null;

  return (
    <div className="px-window mb-5 flex items-start gap-3 p-3 short:mb-3 short:p-2">
      <div className="flex shrink-0 flex-col items-center">
        <div className="bg-sea-light/30 p-1">
          <TerraSprite scale={4} />
        </div>
        <span className="mt-1 text-sm font-bold text-sun">TERRA</span>
      </div>
      <div className="min-h-20 flex-1 pt-1 text-lg leading-snug short:min-h-14 short:text-base" aria-live="polite">
        {text ? <Typewriter text={text} /> : <span className="anim-caret">. . .</span>}
      </div>
      {text && <SpeakButton text={text} dark />}
    </div>
  );
}
