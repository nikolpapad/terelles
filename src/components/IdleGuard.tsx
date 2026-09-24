"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useGame } from "@/state/gameStore";
import { TerraSprite } from "./Pixel";

const IDLE_MS = 90_000;
const COUNTDOWN_S = 10;

/** Kiosk mode: after 90 s idle, ask "Tu es toujours là ?" then reset for the next player. */
export default function IdleGuard() {
  const screen = useGame((s) => s.screen);
  const reset = useGame((s) => s.reset);
  const [countdown, setCountdown] = useState<number | null>(null);
  const timers = useRef<{ idle?: ReturnType<typeof setTimeout>; tick?: ReturnType<typeof setInterval> }>({});

  useEffect(() => {
    if (screen === "start") return;
    const t = timers.current;

    const startCountdown = () => {
      let left = COUNTDOWN_S;
      setCountdown(left);
      t.tick = setInterval(() => {
        left -= 1;
        if (left > 0) return setCountdown(left);
        clearInterval(t.tick);
        setCountdown(null);
        reset();
      }, 1000);
    };
    const onActivity = () => {
      clearTimeout(t.idle);
      clearInterval(t.tick);
      setCountdown(null);
      t.idle = setTimeout(startCountdown, IDLE_MS);
    };

    const events = ["pointermove", "pointerdown", "keydown", "wheel", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    t.idle = setTimeout(startCountdown, IDLE_MS);
    return () => {
      clearTimeout(t.idle);
      clearInterval(t.tick);
      events.forEach((e) => window.removeEventListener(e, onActivity));
    };
  }, [screen, reset]);

  return (
    <AnimatePresence>
      {countdown !== null && screen !== "start" && (
        <motion.div
          className="absolute inset-0 z-[60] flex items-center justify-center bg-navy-deep/50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="px-window flex flex-col items-center px-10 py-8 text-center"
          >
            <TerraSprite scale={5} className="anim-bounce" />
            <h2 className="mt-2 text-4xl font-bold">Tu es toujours là ?</h2>
            <div className="my-3 text-7xl font-bold text-sun">{countdown}</div>
            <button type="button" className="px-btn px-btn-sun px-8 text-2xl" onClick={() => setCountdown(null)}>
              Oui, je joue !
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
