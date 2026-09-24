"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { content } from "@/lib/content";
import { useShortScreen } from "@/lib/useShortScreen";
import { useGame } from "@/state/gameStore";
import Logo from "./Logo";
import MusicButton from "./MusicButton";
import { Character, PixelIcon, TerraSprite } from "./Pixel";
import SpeakButton from "./SpeakButton";

const PITCH = "Explore Marseille et découvre des métiers qui protègent la planète !";

const STEPS = [
  { icon: "scroll", text: "Lis la quête : un problème à Marseille." },
  { icon: "map", text: "Zoome sur un lieu, puis sur un coin du quartier." },
  { icon: "star", text: "Parle aux gens pour trouver la bonne personne !" },
] as const;

function toggleFullscreen() {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen?.();
}

export default function StartScreen() {
  const startAdventure = useGame((s) => s.startAdventure);
  const hasProgress = useGame((s) => s.carnet.length > 0 || s.questIndex > 0);
  const reset = useGame((s) => s.reset);
  const [help, setHelp] = useState(false);
  const short = useShortScreen();

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-navy-deep/25 p-4">
      <div className="absolute top-4 left-4">
        <Logo />
      </div>
      <div className="absolute top-4 right-4 flex gap-4">
        <MusicButton />
        <button type="button" onClick={toggleFullscreen} className="px-btn px-btn-light text-base">
          <PixelIcon name="expand" scale={2} />
          Plein écran
        </button>
      </div>

      <motion.div
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "tween", duration: 0.4 }}
        className="px-window flex max-h-full max-w-2xl flex-col items-center overflow-y-auto overscroll-contain px-8 pt-6 pb-8 text-center short:pt-4 short:pb-5"
      >
        <div className="mb-2 flex shrink-0 items-end gap-4 short:mb-1">
          <Character hero scale={short ? 3 : 5} />
          <TerraSprite scale={short ? 3 : 4} className="anim-bounce" />
        </div>
        <h1 className="text-6xl font-bold tracking-wide text-sun [text-shadow:4px_4px_0_#A8432A] md:text-7xl short:text-5xl">
          {content.meta.title}
        </h1>
        <div className="mt-1 mb-4 text-xl text-sea-light short:mb-3">Les métiers verts de Marseille</div>
        <div className="mb-6 flex items-center gap-3 short:mb-4">
          <p className="text-2xl leading-snug short:text-xl">{PITCH}</p>
          <SpeakButton text={PITCH} dark />
        </div>
        <button type="button" onClick={startAdventure} className="px-btn px-btn-sun px-8 text-2xl">
          {hasProgress ? "Continuer" : "Commencer l'aventure"}
          <PixelIcon name="arrow" flip scale={3} />
        </button>
        <div className="mt-6 flex gap-5 short:mt-3">
          <button type="button" onClick={() => setHelp(true)} className="min-h-12 text-lg text-sun underline underline-offset-4">
            Comment jouer ?
          </button>
          {hasProgress && (
            <button type="button" onClick={reset} className="min-h-12 text-lg text-white/60 underline underline-offset-4">
              Recommencer à zéro
            </button>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {help && (
          <motion.div
            className="absolute inset-0 z-50 flex items-center justify-center bg-navy-deep/50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setHelp(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="px-box max-h-full w-full max-w-xl overflow-y-auto overscroll-contain p-6 short:p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="mb-4 text-center text-3xl font-bold text-terracotta">Comment jouer ?</h2>
              <ol className="space-y-3">
                {STEPS.map((step, i) => (
                  <li key={step.text} className="flex items-center gap-3 bg-white/70 p-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-sun text-xl font-bold">
                      {i + 1}
                    </span>
                    <PixelIcon name={step.icon} scale={3} />
                    <span className="flex-1 text-lg">{step.text}</span>
                    <SpeakButton text={step.text} />
                  </li>
                ))}
              </ol>
              <p className="mt-4 text-center text-base text-ink/70">
                Souris : molette pour zoomer, glisser pour bouger. Clavier : flèches ou ZQSD pour marcher,
                Espace pour parler.
              </p>
              <div className="mt-5 text-center">
                <button type="button" className="px-btn" onClick={() => setHelp(false)}>
                  J&apos;ai compris !
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
