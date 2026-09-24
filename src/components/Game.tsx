"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useSyncExternalStore } from "react";
import { ISLAND_BY_ID } from "@/lib/content";
import { mapBus } from "@/lib/engine";
import { DISTRICT_BY_ID, ZONES } from "@/lib/marseille";
import { useGame } from "@/state/gameStore";
import Carnet, { CarnetButton } from "./Carnet";
import EndScreen from "./EndScreen";
import IdleGuard from "./IdleGuard";
import JobCard from "./JobCard";
import MarseilleMap from "./MarseilleMap";
import { PixelIcon } from "./Pixel";
import QuestBanner from "./QuestBanner";
import QuestModal from "./QuestModal";
import StartScreen from "./StartScreen";

export default function Game() {
  // Progress lives in localStorage and the map is a canvas: render on the client only.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const screen = useGame((s) => s.screen);
  useKeyboard();

  return (
    <main className="relative h-dvh w-full overflow-hidden select-none">
      {mounted && (
        <>
          <MarseilleMap />
          {screen === "map" && <Hud />}
          {screen === "map" && <JobCard />}
          {screen === "start" && <StartScreen />}
          {screen === "end" && <EndScreen />}
          <QuestModal />
          <Carnet />
          <IdleGuard />
        </>
      )}
    </main>
  );
}

function Hud() {
  const focus = useGame((s) => s.focus);
  const district = focus.districtId ? DISTRICT_BY_ID[focus.districtId] : null;
  const zone = focus.zoneId ? ZONES.find((z) => z.id === focus.zoneId) : null;
  const color = district ? ISLAND_BY_ID[district.id].color : null;

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start gap-4 p-4">
        <div className="flex shrink-0 flex-col items-start gap-3 md:w-[240px]">
          <AnimatePresence>
            {focus.level > 1 && (
              <motion.div
                initial={{ x: -30, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -30, opacity: 0 }}
                className="flex flex-col items-start gap-3"
              >
                <button type="button" className="px-btn px-btn-light pointer-events-auto" onClick={() => mapBus.back?.()}>
                  <PixelIcon name="arrow" scale={2} />
                  Retour
                </button>
                {district && (
                  <div className="px-box hidden px-3 py-1.5 text-base leading-tight font-bold md:block">
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-3 w-3" style={{ background: color! }} />
                      {district.place}
                    </div>
                    {zone && <div className="mt-0.5 pl-5 text-sm text-ink/60">› {zone.name}</div>}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="flex flex-1 justify-center">
          <QuestBanner />
        </div>
        <div className="flex shrink-0 justify-end md:w-[240px]">
          <CarnetButton />
        </div>
      </div>

      <div className="absolute bottom-4 left-4 z-20 flex flex-col gap-4">
        <button type="button" className="px-btn px-btn-light h-14 w-14 !p-0" onClick={() => mapBus.zoomIn?.()} aria-label="Zoomer">
          <PixelIcon name="plus" scale={3} />
        </button>
        <button type="button" className="px-btn px-btn-light h-14 w-14 !p-0" onClick={() => mapBus.zoomOut?.()} aria-label="Dézoomer">
          <PixelIcon name="minus" scale={3} />
        </button>
        <button type="button" className="px-btn px-btn-light h-14 w-14 !p-0" onClick={() => mapBus.overview?.()} aria-label="Voir toute la carte">
          <PixelIcon name="map" scale={3} />
        </button>
      </div>
    </>
  );
}

/** Esc closes whatever is on top; Backspace zooms back out. */
function useKeyboard() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useGame.getState();
      if (e.key === "Escape") {
        if (s.carnetOpen) s.setCarnetOpen(false);
        else if (s.questOpen) s.setQuestOpen(false);
        else if (s.selectedJobId) s.closeCard();
      } else if (e.key === "Backspace" && s.screen === "map" && !s.carnetOpen && !s.questOpen) {
        e.preventDefault();
        mapBus.back?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
