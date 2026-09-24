"use client";

import { motion } from "framer-motion";
import { useEffect } from "react";
import { ISLAND_BY_ID, JOBS, QUESTS } from "@/lib/content";
import { DISTRICT_BY_ID } from "@/lib/marseille";
import { useGame } from "@/state/gameStore";
import { pixelConfetti } from "./JobCard";
import { Character, PixelIcon, TerraSprite } from "./Pixel";
import SpeakButton from "./SpeakButton";

export default function EndScreen() {
  const solved = useGame((s) => s.solved.length);
  const found = useGame((s) => s.carnet.length);
  const visits = useGame((s) => s.islandVisits);
  const reset = useGame((s) => s.reset);
  const setCarnetOpen = useGame((s) => s.setCarnetOpen);

  const top = Object.entries(visits)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([id]) => ISLAND_BY_ID[id])
    .filter(Boolean);

  const summary = `Bravo ! Tu as résolu ${solved} quêtes et découvert ${found} métiers. Chaque métier peut aider la planète !`;

  useEffect(() => pixelConfetti(0.5, 0.35), []);

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-navy-deep/30 p-4">
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "tween", duration: 0.3 }}
        className="px-window w-full max-w-xl px-8 py-7 text-center"
      >
        <div className="mb-2 flex items-end justify-center gap-4">
          <Character hero scale={5} />
          <TerraSprite scale={4} className="anim-bounce" />
        </div>
        <h1 className="text-6xl font-bold text-sun [text-shadow:4px_4px_0_#A8432A]">Bravo !</h1>
        <div className="my-5 flex justify-center gap-5">
          <Stat icon="star" value={`${solved}/${QUESTS.length}`} label="quêtes" />
          <Stat icon="book" value={`${found}/${JOBS.length}`} label="métiers" />
        </div>
        <div className="mb-3 flex items-center justify-center gap-3">
          <p className="text-xl">Chaque métier peut aider la planète !</p>
          <SpeakButton text={summary} dark />
        </div>
        {top.length > 0 && (
          <div className="mb-6">
            <div className="mb-2 text-base text-sea-light">Les lieux que tu as le plus explorés</div>
            <div className="flex flex-wrap justify-center gap-4">
              {top.map((island) => (
                <div key={island.id} className="px-box flex items-center gap-2 px-4 py-2 text-lg font-bold text-ink">
                  <span className="inline-block h-4 w-4" style={{ background: island.color }} />
                  {DISTRICT_BY_ID[island.id].place}
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-wrap justify-center gap-5">
          <button type="button" className="px-btn px-btn-sun px-8 text-xl" onClick={reset}>
            Rejouer
          </button>
          <button type="button" className="px-btn px-btn-wood" onClick={() => setCarnetOpen(true)}>
            <PixelIcon name="book" scale={3} />
            Mon carnet
          </button>
        </div>
        <a
          href="https://www.terrelles.com/"
          target="_blank"
          rel="noreferrer"
          className="mt-6 inline-block min-h-12 text-lg text-sun underline underline-offset-4"
        >
          Découvrir TERR&apos;ELLES
        </a>
      </motion.div>
    </div>
  );
}

function Stat({ icon, value, label }: { icon: "star" | "book"; value: string; label: string }) {
  return (
    <div className="px-box flex min-w-32 flex-col items-center px-5 py-3 text-ink">
      <PixelIcon name={icon} scale={4} />
      <span className="mt-1 text-3xl font-bold">{value}</span>
      <span className="text-base text-ink/60">{label}</span>
    </div>
  );
}
