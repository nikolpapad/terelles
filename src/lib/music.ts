/**
 * Original chiptune exploration theme, synthesised live with Web Audio
 * (no audio files). 16 bars in D Mixolydian → B minor, looping, ~108 BPM:
 * square-wave melody, shimmering arpeggios, triangle bass, soft hi-hats, echo.
 */

const BPM = 108;
const EIGHTH = 60 / BPM / 2;
const STORAGE_KEY = "terrelles-music";

// 8 eighth-notes per bar. "-" holds the previous note, "." is a rest.
const MELODY = [
  "D5 - - A4 D5 E5 F#5 -",
  "G5 - E5 - C5 - D5 E5",
  "D5 - B4 - G4 - A4 B4",
  "A4 - - - F#4 - A4 -",
  "D5 - - A4 D5 E5 F#5 A5",
  "G5 - F#5 E5 E5 - C5 -",
  "D5 - E5 - F#5 - G5 -",
  "A5 - - - E5 - C#5 -",
  "B4 - D5 - F#5 - - E5",
  "D5 - B4 - G4 - - -",
  "A4 - D5 - F#5 - A5 -",
  "G5 - F#5 - E5 - - -",
  "B5 - A5 - F#5 - D5 -",
  "E5 - D5 - B4 - G4 -",
  "G4 - B4 - E5 - G5 -",
  "F#5 - E5 - C#5 - A4 -",
].map((bar) => bar.split(" "));

const CHORDS: Record<string, string[]> = {
  D: ["D4", "F#4", "A4", "D5"],
  C: ["C4", "E4", "G4", "C5"],
  G: ["G3", "B3", "D4", "G4"],
  A: ["A3", "C#4", "E4", "A4"],
  Bm: ["B3", "D4", "F#4", "B4"],
  Em: ["E3", "G3", "B3", "E4"],
};
const PROGRESSION = ["D", "C", "G", "D", "D", "C", "G", "A", "Bm", "G", "D", "A", "Bm", "G", "Em", "A"];
const BASS_ROOT: Record<string, string> = { D: "D2", C: "C2", G: "G2", A: "A2", Bm: "B2", Em: "E2" };
const ARP = [0, 1, 2, 3, 2, 1, 0, 1];

const NOTE_INDEX: Record<string, number> = { C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11 };
function freq(note: string) {
  const m = note.match(/^([A-G]#?)(\d)$/)!;
  const midi = (Number(m[2]) + 1) * 12 + NOTE_INDEX[m[1]];
  return 440 * 2 ** ((midi - 69) / 12);
}

class Music {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private noise!: AudioBuffer;
  private timer: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  private next = 0;
  private listeners = new Set<(on: boolean) => void>();
  enabled = true;
  private volume = 0.14;

  constructor() {
    if (typeof window === "undefined") return;
    try {
      this.enabled = localStorage.getItem(STORAGE_KEY) !== "off";
    } catch {
      /* private mode: keep default */
    }
  }

  get playing() {
    return this.timer !== null;
  }

  subscribe(fn: (on: boolean) => void) {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }

  /** Must be called from a user gesture the first time (autoplay rules). */
  start() {
    if (!this.enabled || this.playing || typeof window === "undefined") return;
    if (!this.ctx) this.setup();
    const ctx = this.ctx!;
    void ctx.resume();
    this.master.gain.cancelScheduledValues(ctx.currentTime);
    this.master.gain.setValueAtTime(0, ctx.currentTime);
    this.master.gain.linearRampToValueAtTime(this.volume, ctx.currentTime + 1.5);
    this.next = ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 25);
  }

  stop() {
    if (!this.ctx || !this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(0, t + 0.4);
  }

  toggle() {
    // first press while enabled but not yet started (autoplay blocked): just start
    if (this.enabled && !this.playing) return this.start();
    this.enabled = !this.enabled;
    try {
      localStorage.setItem(STORAGE_KEY, this.enabled ? "on" : "off");
    } catch {
      /* ignore */
    }
    if (this.enabled) this.start();
    else this.stop();
    this.listeners.forEach((fn) => fn(this.enabled));
  }

  /** Lowers the music while the read-aloud voice speaks. */
  duck(on: boolean) {
    if (!this.ctx || !this.playing) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(on ? this.volume * 0.25 : this.volume, t + 0.3);
  }

  private setup() {
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;

    // soften the square waves and add a little echo, like old consoles' reverb
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 3200;
    const delay = ctx.createDelay();
    delay.delayTime.value = EIGHTH * 3;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.28;
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    this.master.connect(lowpass);
    lowpass.connect(ctx.destination);
    lowpass.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wet);
    wet.connect(ctx.destination);

    this.noise = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }

  private schedule() {
    const ctx = this.ctx!;
    while (this.next < ctx.currentTime + 0.15) {
      this.playStep(this.step, this.next);
      this.next += EIGHTH;
      this.step = (this.step + 1) % (MELODY.length * 8);
    }
  }

  private tone(type: OscillatorType, f: number, t: number, dur: number, vol: number, vibrato = false) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = f;
    if (vibrato && dur > EIGHTH * 2) {
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = 5.5;
      depth.gain.setValueAtTime(0, t);
      depth.gain.linearRampToValueAtTime(f * 0.008, t + dur * 0.6);
      lfo.connect(depth);
      depth.connect(osc.frequency);
      lfo.start(t);
      lfo.stop(t + dur);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.linearRampToValueAtTime(vol * 0.65, t + 0.08);
    g.gain.setValueAtTime(vol * 0.65, t + Math.max(0.09, dur - 0.04));
    g.gain.linearRampToValueAtTime(0, t + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private hat(t: number, vol: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    src.connect(hp);
    hp.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + 0.06);
  }

  private playStep(step: number, t: number) {
    const bar = Math.floor(step / 8);
    const i = step % 8;
    const chord = PROGRESSION[bar];

    // melody: count held slots for the note length
    const tok = MELODY[bar][i];
    if (tok !== "-" && tok !== ".") {
      let len = 1;
      while (i + len < 8 && MELODY[bar][i + len] === "-") len++;
      this.tone("square", freq(tok), t, len * EIGHTH * 0.95, 0.32, true);
    }

    // shimmering arpeggio
    this.tone("square", freq(CHORDS[chord][ARP[i]]), t, EIGHTH * 0.5, 0.07);

    // bass: root, fifth-ish bounce on the beats
    if (i % 2 === 0) {
      const root = freq(BASS_ROOT[chord]);
      const f = i === 2 || i === 6 ? root * 1.5 : i === 4 ? root * 2 : root;
      this.tone("triangle", f, t, EIGHTH * 1.8, 0.5);
    }

    // soft hi-hats, accent on the off-beats
    this.hat(t, i % 2 ? 0.12 : 0.05);
  }
}

export const music = new Music();
