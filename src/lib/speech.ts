import { music } from "./music";

/** Read text aloud in French with the browser voice (no API needed). */
export function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  // Emojis are read out loud as their names, which is confusing for kids.
  const clean = text.replace(/\p{Extended_Pictographic}|️/gu, "").trim();
  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.lang = "fr-FR";
  utterance.rate = 0.9;
  utterance.pitch = 1.1;
  const voice = synth.getVoices().find((v) => v.lang.startsWith("fr"));
  if (voice) utterance.voice = voice;
  utterance.onstart = () => music.duck(true);
  utterance.onend = () => music.duck(false);
  utterance.onerror = () => music.duck(false);
  synth.speak(utterance);
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    music.duck(false);
  }
}
