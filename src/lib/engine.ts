/**
 * Canvas engine for the pixel-art Marseille map.
 *
 * Levels of detail, driven by the camera zoom:
 *  L1 overview  — calm low-res map, district banners, clouds;
 *  L2 district  — detailed city (buildings, trees, landmarks), zone signposts, passers-by;
 *  L3 up close  — job people with their item bubble, little scenes of city life.
 */
import { useGame, highlightedDistrict } from "@/state/gameStore";
import { characterSprite, CHAR_H, CHAR_W, HERO_LOOK, jobLook, passerbyLook, type Dir } from "./characters";
import { ISLAND_BY_ID, JOBS, type JobRef } from "./content";
import { icon, propOf } from "./icons";
import { DISTRICTS, LANDMARKS, MAP_H, MAP_W, START, ZONES, inRect, jobPos, type District, type Rect } from "./marseille";
import { C, cached, shade, spriteCanvas } from "./pixel";
import { getTerrain, type Terrain } from "./worldgen";

type Hit =
  | { kind: "district"; id: string }
  | { kind: "zone"; id: string }
  | { kind: "npc"; id: string }
  | { kind: "minimap"; x: number; y: number }
  | { kind: "ground"; x: number; y: number };

type Cam = { x: number; y: number; z: number };

const TOP_PAD = 92;
const TALK_RANGE = 30;
const MINI_W = 208;
const MINI_H = 130;

const ss = (a: number, b: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const rand = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Commands the HUD can send to the map. */
export const mapBus: {
  zoomIn?: () => void;
  zoomOut?: () => void;
  back?: () => void;
  overview?: () => void;
} = {};

/** Walking routes for passers-by (world coordinates). */
const ROUTES: [number, number, number, number][] = [
  [660, 606, 1300, 606], // La Canebière
  [650, 525, 830, 330], // Rue de la République
  [790, 640, 720, 905], // Avenue du Prado
  [360, 516, 600, 516], // quai du Port
  [360, 612, 600, 612], // quai de Rive Neuve
  [440, 860, 1100, 850], // plages
  [790, 700, 1180, 700],
  [780, 420, 1150, 420],
  [1140, 240, 1140, 690],
  [900, 350, 900, 700],
];

type Decor = { x: number; y: number; kind: "petanque" | "fisher" | "cafe" | "cat" | "bench" | "swimmer" | "diver" };

/** Little scenes of Marseille life, only visible up close. */
const DECOR: Decor[] = [
  { x: 470, y: 646, kind: "petanque" },
  { x: 700, y: 690, kind: "petanque" },
  { x: 380, y: 606, kind: "fisher" },
  { x: 560, y: 606, kind: "fisher" },
  { x: 1240, y: 850, kind: "fisher" },
  { x: 440, y: 512, kind: "cafe" },
  { x: 480, y: 512, kind: "cafe" },
  { x: 520, y: 512, kind: "cafe" },
  { x: 900, y: 596, kind: "cafe" },
  { x: 940, y: 596, kind: "cafe" },
  { x: 620, y: 640, kind: "cat" },
  { x: 980, y: 575, kind: "cat" },
  { x: 1330, y: 800, kind: "cat" },
  { x: 760, y: 610, kind: "bench" },
  { x: 1180, y: 610, kind: "bench" },
  { x: 800, y: 880, kind: "bench" },
  { x: 600, y: 948, kind: "swimmer" },
  { x: 860, y: 940, kind: "swimmer" },
  { x: 1392, y: 900, kind: "diver" },
];

export class MapEngine {
  private ctx: CanvasRenderingContext2D;
  private terrain: Terrain;
  private dpr = 1;
  private W = 0;
  private H = 0;
  private fitZ = 1;
  private L2 = 1.5;
  private L3 = 2.6;
  private cam: Cam = { x: MAP_W / 2, y: MAP_H / 2, z: 1 };
  private target: Cam | null = null;
  /** Smoothed horizontal offset that keeps the map clear of the job panel. */
  private shift = 0;
  private hero = { x: START.x, y: START.y, dir: "down" as Dir, step: 0, moving: false };
  private dest: { x: number; y: number; jobId?: string; speed: number } | null = null;
  private keys = new Set<string>();
  private hover: Hit | null = null;
  private pointer = { down: false, x: 0, y: 0, startX: 0, startY: 0, dragged: false };
  private t = 0;
  private last = 0;
  private raf = 0;
  private font = "monospace";
  private interactive = false;
  private questIndex = -1;
  private lastFocus = 0;
  private walkers: { r: number; p: number; v: number; seed: number }[] = [];
  private gulls: { x: number; y: number; vx: number; vy: number; ph: number }[] = [];
  private clouds: { x: number; y: number; v: number; s: number }[] = [];
  private gust = { at: 8, lines: [] as { x: number; y: number }[] };
  /** Screen rects of the labels drawn last frame, so labels are clickable too. */
  private labelRects: { kind: "district" | "zone"; id: string; x: number; y: number; w: number; h: number }[] = [];
  private ro: ResizeObserver;
  private listeners: [EventTarget, string, EventListener, AddEventListenerOptions?][] = [];

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
    this.terrain = getTerrain();
    this.font = getComputedStyle(document.body).getPropertyValue("--font-pixelify").trim() || "monospace";
    this.initAmbient();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    this.resize();
    this.cam = this.clampCam({ x: MAP_W / 2, y: MAP_H / 2, z: this.fitZ });
    this.bindInput();
    mapBus.zoomIn = () => this.flyTo(this.cam.x, this.cam.y, this.cam.z * 1.5);
    mapBus.zoomOut = () => this.flyTo(this.cam.x, this.cam.y, this.cam.z / 1.5);
    mapBus.overview = () => this.flyTo(MAP_W / 2, MAP_H / 2, this.fitZ);
    mapBus.back = () => this.back();
    this.raf = requestAnimationFrame(this.frame);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    for (const [t, n, f, o] of this.listeners) t.removeEventListener(n, f, o);
    for (const k of Object.keys(mapBus) as (keyof typeof mapBus)[]) delete mapBus[k];
  }

  setInteractive(on: boolean) {
    if (on === this.interactive) return;
    this.interactive = on;
    this.hover = null;
    this.canvas.style.cursor = on ? "grab" : "default";
    this.flyTo(MAP_W / 2, MAP_H / 2, this.fitZ);
  }

  /** Advances the simulation by `seconds` without waiting for the browser (dev/testing). */
  step(seconds: number) {
    for (let i = 0; i < seconds * 60; i++) {
      this.t += 1 / 60;
      this.update(1 / 60);
    }
    this.draw();
  }

  // ---------------------------------------------------------------- camera

  private get panelShiftTarget() {
    if (this.W < 768 || useGame.getState().selectedJobId === null) return 0;
    return (Math.min(Math.max(this.W * 0.36, 400), 560) + 12) / 2;
  }
  /** Screen point the camera centre maps to. */
  private get vc() {
    return { x: this.W / 2 - this.shift, y: TOP_PAD + (this.H - TOP_PAD) / 2 };
  }

  private resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = r.width;
    this.H = r.height;
    this.canvas.width = Math.round(r.width * this.dpr);
    this.canvas.height = Math.round(r.height * this.dpr);
    this.fitZ = Math.min(this.W / MAP_W, (this.H - TOP_PAD - 8) / MAP_H);
    this.L2 = Math.max(1.5, this.fitZ * 1.9);
    this.L3 = Math.max(2.6, this.fitZ * 3.4);
    this.cam.z = clamp(this.cam.z, this.fitZ, this.maxZ);
  }

  private get maxZ() {
    return this.L3 * 2;
  }

  private clampCam(c: Cam) {
    // When the map is smaller than the screen, pin it east/top: the leftover
    // margin is then open sea (west/south), which blends into the background.
    const vc = this.vc;
    const minX = vc.x / c.z;
    const maxX = MAP_W - (this.W - vc.x) / c.z;
    c.x = minX > maxX ? maxX : clamp(c.x, minX, maxX);
    const minY = (vc.y - TOP_PAD) / c.z;
    const maxY = MAP_H - (this.H - vc.y) / c.z;
    c.y = minY > maxY ? minY : clamp(c.y, minY, maxY);
    return c;
  }

  flyTo(x: number, y: number, z: number) {
    this.target = { x, y, z: clamp(z, this.fitZ, this.maxZ) };
  }

  private back() {
    if (this.level === 3) {
      const d = this.districtAt(this.cam.x, this.cam.y);
      if (d) return this.flyToDistrict(d);
    }
    this.flyTo(MAP_W / 2, MAP_H / 2, this.fitZ);
  }

  private get level(): 1 | 2 | 3 {
    const z = this.cam.z;
    return z >= this.L3 * 0.95 ? 3 : z >= this.L2 * 0.95 ? 2 : 1;
  }

  private flyToDistrict(d: District) {
    const b = d.box;
    const z = clamp(Math.min((this.W * 0.8) / b.w, ((this.H - TOP_PAD) * 0.8) / b.h), this.L2 * 1.02, this.L3 * 0.74);
    this.flyTo(b.x + b.w / 2, b.y + b.h / 2, z);
  }

  private districtAt(x: number, y: number) {
    return DISTRICTS.find((d) => inRect(d.box, x, y)) ?? null;
  }

  private toScreen(wx: number, wy: number) {
    const vc = this.vc;
    return { x: (wx - this.cam.x) * this.cam.z + vc.x, y: (wy - this.cam.y) * this.cam.z + vc.y };
  }
  private toWorld(sx: number, sy: number) {
    const vc = this.vc;
    return { x: (sx - vc.x) / this.cam.z + this.cam.x, y: (sy - vc.y) / this.cam.z + this.cam.y };
  }

  private get miniRect() {
    return { x: 88, y: this.H - 16 - MINI_H, w: MINI_W, h: MINI_H };
  }

  // ---------------------------------------------------------------- input

  private on(t: EventTarget, n: string, f: EventListener, o?: AddEventListenerOptions) {
    t.addEventListener(n, f, o);
    this.listeners.push([t, n, f, o]);
  }

  private bindInput() {
    const c = this.canvas;
    this.on(c, "pointerdown", (e) => {
      const p = e as PointerEvent;
      if (!this.interactive) return;
      this.pointer = { down: true, x: p.offsetX, y: p.offsetY, startX: p.offsetX, startY: p.offsetY, dragged: false };
      c.setPointerCapture(p.pointerId);
    });
    this.on(c, "pointermove", (e) => {
      const p = e as PointerEvent;
      if (!this.interactive) return;
      if (this.pointer.down) {
        const dx = p.offsetX - this.pointer.x;
        const dy = p.offsetY - this.pointer.y;
        if (Math.hypot(p.offsetX - this.pointer.startX, p.offsetY - this.pointer.startY) > 6) this.pointer.dragged = true;
        if (this.pointer.dragged) {
          this.target = null;
          this.cam.x -= dx / this.cam.z;
          this.cam.y -= dy / this.cam.z;
          this.clampCam(this.cam);
          c.style.cursor = "grabbing";
        }
        this.pointer.x = p.offsetX;
        this.pointer.y = p.offsetY;
        return;
      }
      this.hover = this.hitTest(p.offsetX, p.offsetY);
      c.style.cursor = this.hover && this.hover.kind !== "ground" ? "pointer" : "grab";
    });
    this.on(c, "pointerup", (e) => {
      const p = e as PointerEvent;
      if (!this.interactive || !this.pointer.down) return;
      this.pointer.down = false;
      c.style.cursor = "grab";
      if (!this.pointer.dragged) this.click(p.offsetX, p.offsetY);
    });
    this.on(c, "pointerleave", () => (this.hover = null));
    this.on(
      c,
      "wheel",
      (e) => {
        const w = e as WheelEvent;
        if (!this.interactive) return;
        w.preventDefault();
        this.target = null;
        const before = this.toWorld(w.offsetX, w.offsetY);
        this.cam.z = clamp(this.cam.z * Math.exp(-w.deltaY * 0.0015), this.fitZ, this.maxZ);
        const vc = this.vc;
        this.cam.x = before.x - (w.offsetX - vc.x) / this.cam.z;
        this.cam.y = before.y - (w.offsetY - vc.y) / this.cam.z;
        this.clampCam(this.cam);
      },
      { passive: false },
    );

    const MOVE = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d", "z", "q"];
    this.on(window, "keydown", (e) => {
      const k = e as KeyboardEvent;
      if (!this.canPlay()) return;
      const key = k.key.length === 1 ? k.key.toLowerCase() : k.key;
      if (MOVE.includes(key)) {
        k.preventDefault();
        this.keys.add(key);
      } else if ((key === " " || key === "Enter") && (k.target === document.body || k.target === this.canvas)) {
        const npc = this.nearestNpc();
        if (npc && useGame.getState().selectedJobId === null) {
          k.preventDefault();
          this.talkTo(npc);
        }
      } else if (key === "+" || key === "=") mapBus.zoomIn?.();
      else if (key === "-") mapBus.zoomOut?.();
    });
    this.on(window, "keyup", (e) => {
      const k = (e as KeyboardEvent).key;
      this.keys.delete(k.length === 1 ? k.toLowerCase() : k);
    });
    this.on(window, "blur", () => this.keys.clear());
  }

  private canPlay() {
    const s = useGame.getState();
    return this.interactive && !s.carnetOpen && !s.questOpen;
  }

  private hitTest(sx: number, sy: number): Hit | null {
    const m = this.miniRect;
    if (sx >= m.x && sx <= m.x + m.w && sy >= m.y && sy <= m.y + m.h) {
      return { kind: "minimap", x: ((sx - m.x) / m.w) * MAP_W, y: ((sy - m.y) / m.h) * MAP_H };
    }
    const { x, y } = this.toWorld(sx, sy);
    const z = this.cam.z;
    if (z >= this.L3 * 0.82) {
      // people first (with a generous hit box that includes the item bubble)
      let best: JobRef | null = null;
      let bd = Infinity;
      for (const job of JOBS) {
        const p = jobPos(job);
        if (Math.abs(x - p.x) < 14 && y > p.y - CHAR_H - 24 && y < p.y + 5) {
          const d = Math.abs(x - p.x) + Math.abs(y - (p.y - 16));
          if (d < bd) {
            bd = d;
            best = job;
          }
        }
      }
      if (best) return { kind: "npc", id: best.id };
      return { kind: "ground", x, y };
    }
    const label = [...this.labelRects].reverse().find((r) => sx >= r.x && sx <= r.x + r.w && sy >= r.y && sy <= r.y + r.h);
    if (label) return { kind: label.kind, id: label.id };
    if (z >= this.L2 * 0.9) {
      const zone = ZONES.find((zn) => inRect(zn.box, x, y));
      if (zone) return { kind: "zone", id: zone.id };
    }
    const d = this.districtAt(x, y);
    return d ? { kind: "district", id: d.id } : null;
  }

  private click(sx: number, sy: number) {
    const hit = this.hitTest(sx, sy);
    if (!hit) return;
    switch (hit.kind) {
      case "minimap":
        this.flyTo(hit.x, hit.y, Math.max(this.cam.z, this.L2 * 1.02));
        break;
      case "district":
        this.flyToDistrict(DISTRICTS.find((d) => d.id === hit.id)!);
        break;
      case "zone": {
        const zn = ZONES.find((z) => z.id === hit.id)!;
        this.flyTo(zn.box.x + zn.box.w / 2, zn.box.y + zn.box.h / 2, this.L3 * 1.2);
        break;
      }
      case "npc": {
        const job = JOBS.find((j) => j.id === hit.id)!;
        if (useGame.getState().selectedJobId === job.id) return; // already talking to her
        const p = jobPos(job);
        this.walkTo(p.x, p.y + 12, job.id);
        break;
      }
      case "ground":
        if (useGame.getState().selectedJobId) useGame.getState().closeCard();
        this.walkTo(hit.x, hit.y);
        break;
    }
  }

  private walkTo(x: number, y: number, jobId?: string) {
    const d = Math.hypot(x - this.hero.x, y - this.hero.y);
    // long trips are quick so the player never waits more than ~1.2 s
    this.dest = { x: clamp(x, 4, MAP_W - 4), y: clamp(y, 36, MAP_H - 2), jobId, speed: Math.max(110, d / 1.2) };
  }

  private nearestNpc(): JobRef | null {
    let best: JobRef | null = null;
    let bd = TALK_RANGE;
    for (const job of JOBS) {
      const p = jobPos(job);
      const d = Math.hypot(p.x - this.hero.x, p.y + 10 - this.hero.y);
      if (d < bd) {
        bd = d;
        best = job;
      }
    }
    return best;
  }

  private talkTo(job: JobRef) {
    const p = jobPos(job);
    this.hero.dir = Math.abs(p.x - this.hero.x) > Math.abs(p.y - this.hero.y) ? (p.x > this.hero.x ? "right" : "left") : p.y > this.hero.y ? "down" : "up";
    this.keys.clear();
    if (useGame.getState().selectedJobId === job.id) return;
    void useGame.getState().land(job.id);
    this.flyTo(p.x, p.y - 20, Math.max(this.cam.z, this.L3));
  }

  // ---------------------------------------------------------------- update

  private frame = (now: number) => {
    const dt = Math.min(0.05, (now - (this.last || now)) / 1000);
    this.last = now;
    this.t += dt;
    // schedule first: a drawing error must never freeze the map
    this.raf = requestAnimationFrame(this.frame);
    try {
      this.update(dt);
      this.draw();
    } catch (err) {
      console.error("[map]", err);
    }
  };

  private update(dt: number) {
    const s = useGame.getState();
    const k = 1 - Math.exp(-dt * 5);

    if (s.questIndex !== this.questIndex) {
      if (this.questIndex !== -1) this.flyTo(MAP_W / 2, MAP_H / 2, this.fitZ);
      this.questIndex = s.questIndex;
    }

    // attract mode behind menus: slow drift over the city
    if (!this.interactive) {
      this.target = {
        x: MAP_W * 0.55 + Math.sin(this.t / 13) * 200,
        y: MAP_H * 0.55 + Math.cos(this.t / 11) * 120,
        z: this.fitZ * (1.5 + 0.2 * Math.sin(this.t / 9)),
      };
    }

    // panel offset eases instead of jumping
    const shiftBefore = this.shift;
    this.shift += (this.panelShiftTarget - this.shift) * k;
    // keep the world still under the shift, unless the camera is flying anyway
    if (!this.target) this.cam.x -= (this.shift - shiftBefore) / this.cam.z;

    // hero: keyboard
    let kx = 0;
    let ky = 0;
    for (const key of this.keys) {
      if (key === "ArrowLeft" || key === "a" || key === "q") kx -= 1;
      if (key === "ArrowRight" || key === "d") kx += 1;
      if (key === "ArrowUp" || key === "w" || key === "z") ky -= 1;
      if (key === "ArrowDown" || key === "s") ky += 1;
    }
    const h = this.hero;
    h.moving = false;
    if (kx || ky) {
      if (s.selectedJobId) s.closeCard();
      this.dest = null;
      const n = Math.hypot(kx, ky);
      h.x = clamp(h.x + (kx / n) * 95 * dt, 4, MAP_W - 4);
      h.y = clamp(h.y + (ky / n) * 95 * dt, 36, MAP_H - 2);
      h.dir = Math.abs(kx) > Math.abs(ky) ? (kx > 0 ? "right" : "left") : ky > 0 ? "down" : "up";
      h.moving = true;
      this.target = { x: h.x, y: h.y, z: Math.max(this.cam.z, this.L3) };
    } else if (this.dest) {
      const dx = this.dest.x - h.x;
      const dy = this.dest.y - h.y;
      const d = Math.hypot(dx, dy);
      const step = this.dest.speed * dt;
      if (d <= step) {
        h.x = this.dest.x;
        h.y = this.dest.y;
        const jobId = this.dest.jobId;
        this.dest = null;
        if (jobId) this.talkTo(JOBS.find((j) => j.id === jobId)!);
      } else {
        h.x += (dx / d) * step;
        h.y += (dy / d) * step;
        h.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
        h.moving = true;
      }
    }
    h.step = h.moving ? h.step + dt : 0;

    // camera easing
    if (this.target) {
      const tz = clamp(this.target.z, this.fitZ, this.maxZ);
      this.cam.z = Math.exp(Math.log(this.cam.z) + (Math.log(tz) - Math.log(this.cam.z)) * k);
      const tgt = this.clampCam({ ...this.target, z: this.cam.z });
      this.cam.x += (tgt.x - this.cam.x) * k;
      this.cam.y += (tgt.y - this.cam.y) * k;
      const done = Math.abs(tz - this.cam.z) < 0.004 && Math.hypot(tgt.x - this.cam.x, tgt.y - this.cam.y) < 0.2;
      if (done && this.interactive && !kx && !ky) this.target = null;
    }
    this.clampCam(this.cam);

    // ambient life
    for (const w of this.walkers) {
      w.p += w.v * dt;
      if (w.p > 1 || w.p < 0) {
        w.v = -w.v;
        w.p = clamp(w.p, 0, 1);
      }
    }
    for (const g of this.gulls) {
      g.x += g.vx * dt;
      g.y += g.vy * dt + Math.sin(this.t + g.ph) * 0.2;
      if (g.x > MAP_W + 40) g.x = -40;
      if (g.y > MAP_H + 40) g.y = -40;
      if (g.y < -40) g.y = MAP_H + 40;
    }
    for (const c of this.clouds) {
      c.x += c.v * dt;
      if (c.x > MAP_W + 200) c.x = -200;
    }
    if (this.t > this.gust.at) {
      this.gust.at = this.t + 14 + rand(this.t) * 8;
      this.gust.lines = Array.from({ length: 9 }, (_, i) => ({
        x: -160 - rand(i + this.t) * 400,
        y: rand(i * 3 + this.t) * MAP_H * 0.9 - 100,
      }));
    }
    for (const l of this.gust.lines) {
      l.x += 520 * dt;
      l.y += 260 * dt;
    }

    // HUD breadcrumb
    if (this.t - this.lastFocus > 0.2) {
      this.lastFocus = this.t;
      const lvl = this.level;
      const d = lvl >= 2 ? this.districtAt(this.cam.x, this.cam.y) : null;
      const zn = lvl === 3 ? ZONES.find((z) => inRect({ ...z.box, x: z.box.x - 60, w: z.box.w + 120, h: z.box.h + 60 }, this.cam.x, this.cam.y)) : null;
      s.setFocus({ level: lvl, districtId: d?.id ?? null, zoneId: zn?.id ?? null });
    }
  }

  private initAmbient() {
    // a few people per route, spread out, each at their own pace
    for (let i = 0; i < 32; i++) {
      const r = i % ROUTES.length;
      const [ax, ay, bx, by] = ROUTES[r];
      const len = Math.hypot(bx - ax, by - ay);
      const speed = (14 + rand(i + 9) * 12) / len; // 14–26 px/s whatever the route length
      this.walkers.push({ r, p: (Math.floor(i / ROUTES.length) + rand(i)) / 4, v: speed * (i % 2 ? 1 : -1), seed: i });
    }
    for (let i = 0; i < 10; i++) {
      this.gulls.push({ x: rand(i * 5) * MAP_W, y: rand(i * 7) * MAP_H, vx: 26 + rand(i) * 30, vy: 8 - rand(i * 2) * 16, ph: i });
    }
    for (let i = 0; i < 6; i++) {
      this.clouds.push({ x: rand(i * 11) * MAP_W, y: 60 + rand(i * 13) * 760, v: 8 + rand(i) * 8, s: i % 3 });
    }
  }

  // ---------------------------------------------------------------- draw

  private draw() {
    const { ctx, dpr, cam } = this;
    const vc = this.vc;
    const z = cam.z;
    const a1 = 1 - ss(this.L2 * 0.8, this.L2, z);
    const a2 = ss(this.L2 * 0.8, this.L2, z);
    const a3 = ss(this.L3 * 0.82, this.L3 * 0.95, z);
    const aDetail = ss(1.0, 1.35, z);
    const s = useGame.getState();

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#1F7DB2";
    ctx.fillRect(0, 0, this.W, this.H);

    const ox = vc.x - cam.x * z;
    const oy = vc.y - cam.y * z;
    ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * ox, dpr * oy);

    // terrain, calm overview fading into the detailed city
    if (aDetail < 1) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.terrain.base, 0, 0, MAP_W, MAP_H);
    }
    if (aDetail > 0) {
      ctx.imageSmoothingEnabled = z < 1.6;
      ctx.globalAlpha = aDetail;
      ctx.drawImage(this.terrain.detail, 0, 0);
      ctx.globalAlpha = 1;
    }
    ctx.imageSmoothingEnabled = false;

    const view = {
      x0: cam.x - vc.x / z - 40,
      y0: cam.y - vc.y / z - 40,
      x1: cam.x + (this.W - vc.x) / z + 40,
      y1: cam.y + (this.H - vc.y) / z + 40,
    };
    const inView = (x: number, y: number) => x > view.x0 && x < view.x1 && y > view.y0 && y < view.y1;

    if (aDetail > 0.3) this.drawWater(inView);
    this.drawSeaLife(inView);

    // statue glint on Notre-Dame
    if (this.t % 3 < 0.35) {
      ctx.fillStyle = "#FFF6C8";
      ctx.fillRect(576, 672, 8, 2);
      ctx.fillRect(579, 668, 2, 9);
    }

    // district highlights
    const hl = highlightedDistrict(s);
    for (const d of DISTRICTS) {
      const hovered = this.hover?.kind === "district" && this.hover.id === d.id;
      const pulse = hl === d.id ? 0.5 + 0.5 * Math.sin(this.t * 6) : 0;
      if ((hovered && a1 > 0.2) || pulse) {
        ctx.globalAlpha = pulse ? 0.18 + pulse * 0.25 : 0.2 * a1;
        ctx.fillStyle = pulse ? C.sun : ISLAND_BY_ID[d.id].color;
        ctx.fillRect(d.box.x, d.box.y, d.box.w, d.box.h);
        ctx.globalAlpha = pulse ? 1 : a1;
        this.dashRect(d.box, pulse ? C.sun : C.white, 3);
        ctx.globalAlpha = 1;
      }
    }
    if (a2 > 0.05 && a3 < 0.95) {
      for (const zn of ZONES) {
        const hovered = this.hover?.kind === "zone" && this.hover.id === zn.id;
        if (!hovered) continue;
        ctx.globalAlpha = a2 * (1 - a3);
        ctx.fillStyle = "rgba(255,255,255,0.18)";
        ctx.fillRect(zn.box.x, zn.box.y, zn.box.w, zn.box.h);
        this.dashRect(zn.box, C.sun, 2);
        ctx.globalAlpha = 1;
      }
    }

    // characters and life, depth sorted
    const actors: { y: number; draw: () => void }[] = [];
    if (a2 > 0.3) {
      ctx.globalAlpha = 1;
      for (const w of this.walkers) {
        const [ax, ay, bx, by] = ROUTES[w.r];
        const x = ax + (bx - ax) * w.p;
        const y = ay + (by - ay) * w.p;
        if (!inView(x, y)) continue;
        const dx = (bx - ax) * Math.sign(w.v);
        const dy = (by - ay) * Math.sign(w.v);
        const dir: Dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
        const frame = (Math.floor(this.t * 5 + w.seed) % 2) + 1;
        actors.push({ y, draw: () => this.drawPerson(passerbyLook(w.seed), x, y, dir, frame as 1 | 2, a2) });
      }
    }
    if (a3 > 0.02) {
      for (const job of JOBS) {
        const p = jobPos(job);
        if (inView(p.x, p.y)) actors.push({ y: p.y, draw: () => this.drawNpc(job, p.x, p.y, a3) });
      }
      for (const d of DECOR) if (inView(d.x, d.y)) actors.push({ y: d.y, draw: () => this.drawDecor(d, a3) });
    }
    actors.push({ y: this.hero.y, draw: () => this.drawHero() });
    actors.sort((a, b) => a.y - b.y).forEach((a) => a.draw());

    this.drawSky(inView, 1 - ss(this.fitZ * 1.2, this.L2, z));

    // ---- screen-space UI
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.labelRects = [];
    if (a1 > 0.02 || a2 > 0.02) this.drawLandmarkLabels(Math.max(a1, a2 * 0.8) * (1 - a3));
    if (a1 > 0.02) this.drawDistrictLabels(a1, hl);
    if (a2 > 0.02) this.drawZoneLabels(a2 * (1 - a3 * 0.5));
    if (a3 > 0.5) this.drawNpcLabels();
    if (this.interactive) this.drawMinimap();
  }

  /** Marching-ants pixel frame in world space. */
  private dashRect(r: Rect, col: string, w: number) {
    const { ctx } = this;
    ctx.fillStyle = col;
    const off = Math.floor(this.t * 10) % 16;
    for (let x = r.x; x < r.x + r.w; x += 16) {
      ctx.fillRect(x + off, r.y, 8, w);
      ctx.fillRect(x + off, r.y + r.h - w, 8, w);
    }
    for (let y = r.y; y < r.y + r.h; y += 16) {
      ctx.fillRect(r.x, y + off, w, 8);
      ctx.fillRect(r.x + r.w - w, y + off, w, 8);
    }
  }

  private drawWater(inView: (x: number, y: number) => boolean) {
    const { ctx, t } = this;
    const { shore, glints } = this.terrain;
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    for (let n = 0; n < shore.length; n++) {
      const i = shore[n];
      const x = i % MAP_W;
      const y = (i / MAP_W) | 0;
      if (!inView(x, y)) continue;
      if (Math.sin(t * 2.2 + x * 0.12 + y * 0.09) > 0.55) ctx.fillRect(x, y, 1, 1);
    }
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    for (let n = 0; n < glints.length; n++) {
      const i = glints[n];
      const x = i % MAP_W;
      const y = (i / MAP_W) | 0;
      if (!inView(x, y)) continue;
      const v = Math.sin(t * 1.6 + n * 1.7);
      if (v > 0.55) ctx.fillRect(x, y, v > 0.85 ? 4 : 2, 1);
    }
  }

  private sailboat(x: number, y: number, c: string, ph: number, scale = 1) {
    const { ctx } = this;
    const spr = cached(`sail|${c}`, 14, 16, (g) => {
      g.fillStyle = "#8A5A3B";
      g.fillRect(6, 1, 1, 10);
      g.fillStyle = c;
      g.fillRect(7, 1, 5, 8);
      g.fillStyle = "#FFFFFF";
      g.fillRect(2, 4, 4, 6);
      g.fillStyle = "#FFFFFF";
      g.fillRect(1, 11, 12, 3);
      g.fillStyle = "#1B3B6F";
      g.fillRect(2, 13, 10, 1);
      g.fillStyle = "rgba(255,255,255,0.6)";
      g.fillRect(0, 15, 14, 1);
    });
    const b = Math.sin(this.t * 2 + ph) > 0 ? 0 : 1;
    ctx.drawImage(spr, Math.round(x - 7 * scale), Math.round(y - 14 * scale + b), 14 * scale, 16 * scale);
  }

  private drawSeaLife(inView: (x: number, y: number) => boolean) {
    const { ctx, t } = this;
    const small = this.cam.z < 1.2 ? 2 : 1;

    // Vieux-Port moorings
    const cols = [C.white, C.terracotta, C.sun, C.blue];
    for (let i = 0; i < 14; i++) {
      this.sailboat(372 + i * 17, 540, cols[i % 4], i);
      this.sailboat(380 + i * 17, 590, cols[(i + 2) % 4], i + 3);
    }
    // sailboats cruising
    const loops = [
      [150, 760, 90, 40, 0.05],
      [120, 200, 60, 90, -0.04],
      [420, 975, 160, 12, 0.03],
      [900, 975, 160, 10, -0.04],
      [80, 880, 60, 50, 0.06],
    ];
    loops.forEach(([cx, cy, rx, ry, v], i) => {
      const a = t * v + i * 2;
      const x = cx + Math.cos(a) * rx;
      const y = cy + Math.sin(a) * ry;
      if (inView(x, y)) this.sailboat(x, y, [C.white, C.sun, C.terracotta][i % 3], i, small);
    });
    // Frioul shuttle
    const f = (Math.sin(t * 0.08) + 1) / 2;
    const fx = 360 - f * 150;
    const fy = 560 + f * 30;
    ctx.fillStyle = C.white;
    ctx.fillRect(fx - 14, fy - 6, 28, 8);
    ctx.fillStyle = C.navy;
    ctx.fillRect(fx - 14, fy, 28, 2);
    ctx.fillStyle = "#EDEDED";
    ctx.fillRect(fx - 6, fy - 10, 14, 4);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillRect(fx + 14, fy + 1, 8, 1);
    // Calanques boats
    for (const [x, y] of [
      [1250, 902],
      [1392, 912],
      [1548, 902],
    ]) {
      if (inView(x, y)) this.sailboat(x, y + Math.sin(t + x) * 0.8, C.white, x);
    }
    // floating offshore wind turbines
    for (const [x, y] of [
      [70, 80],
      [150, 120],
      [70, 180],
      [150, 230],
      [80, 290],
    ]) {
      if (!inView(x, y)) continue;
      ctx.fillStyle = C.sun;
      ctx.fillRect(x - 6, y + 22, 13, 5);
      ctx.fillStyle = "#F4F4F4";
      ctx.fillRect(x - 1, y, 3, 22);
      const a0 = t * 2.2 + x;
      ctx.fillStyle = "#FFFFFF";
      for (let b = 0; b < 3; b++) {
        const a = a0 + (b * Math.PI * 2) / 3;
        for (let s = 2; s <= 16; s++) ctx.fillRect(Math.round(x + Math.cos(a) * s), Math.round(y + Math.sin(a) * s), 2, 2);
      }
      ctx.fillStyle = C.darkGrey;
      ctx.fillRect(x - 2, y - 2, 4, 4);
    }
  }

  private drawSky(inView: (x: number, y: number) => boolean, cloudAlpha: number) {
    const { ctx, t } = this;
    // mistral gusts
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    for (const l of this.gust.lines) {
      for (let s = 0; s < 90; s += 3) if (s % 24 < 16) ctx.fillRect(Math.round(l.x + s), Math.round(l.y + s / 2), 3, 2);
    }
    // gulls
    for (const g of this.gulls) {
      if (!inView(g.x, g.y)) continue;
      const up = Math.sin(t * 9 + g.ph) > 0;
      const x = Math.round(g.x);
      const y = Math.round(g.y);
      ctx.fillStyle = "rgba(43,33,64,0.18)";
      ctx.fillRect(x + 6, y + 22, 8, 2);
      ctx.fillStyle = C.white;
      if (up) {
        ctx.fillRect(x, y, 2, 2);
        ctx.fillRect(x + 2, y + 2, 2, 2);
        ctx.fillRect(x + 8, y + 2, 2, 2);
        ctx.fillRect(x + 10, y, 2, 2);
      } else {
        ctx.fillRect(x, y + 3, 4, 2);
        ctx.fillRect(x + 8, y + 3, 4, 2);
      }
      ctx.fillRect(x + 4, y + 3, 4, 2);
      ctx.fillStyle = C.darkGrey;
      ctx.fillRect(x + 5, y + 5, 2, 1);
    }
    // clouds, only when zoomed out
    if (cloudAlpha > 0.02) {
      for (const c of this.clouds) {
        ctx.globalAlpha = cloudAlpha * 0.07;
        ctx.drawImage(this.cloudShadow(c.s), Math.round(c.x + 40), Math.round(c.y + 70), 136, 72);
        ctx.globalAlpha = cloudAlpha * 0.9;
        ctx.drawImage(this.cloudSprite(c.s), Math.round(c.x), Math.round(c.y), 136, 72);
      }
      ctx.globalAlpha = 1;
    }
  }

  private cloudBlobs(s: number) {
    return [
      [8, 8, 7],
      [16, 6, 8],
      [25, 8, 6],
      [13, 11, 6],
      [21, 11, 6],
    ].map(([x, y, r], i) => [x + ((s * 3 + i) % 3), y, r - (s === 2 ? 1 : 0)]);
  }
  private cloudSprite(s: number) {
    return cached(`cloud${s}`, 34, 18, (g) => {
      for (const [x, y, r] of this.cloudBlobs(s)) {
        for (let yy = -r; yy <= r; yy++)
          for (let xx = -r; xx <= r; xx++)
            if (xx * xx + yy * yy * 2 <= r * r) {
              g.fillStyle = yy > r * 0.3 ? "#E4EEF6" : "#FFFFFF";
              g.fillRect(x + xx, y + yy, 1, 1);
            }
      }
    });
  }
  private cloudShadow(s: number) {
    return cached(`cloudShadow${s}`, 34, 18, (g) => {
      g.fillStyle = "#1B2A40";
      for (const [x, y, r] of this.cloudBlobs(s))
        for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) if (xx * xx + yy * yy * 2 <= r * r) g.fillRect(x + xx, y + yy, 1, 1);
    });
  }

  private drawPerson(look: ReturnType<typeof jobLook>, x: number, y: number, dir: Dir, frame: 0 | 1 | 2, alpha = 1, bob = 0) {
    const { ctx } = this;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "rgba(20,20,40,0.25)";
    ctx.fillRect(Math.round(x) - 7, Math.round(y) - 1, 14, 3);
    ctx.drawImage(characterSprite(look, dir, frame), Math.round(x - CHAR_W / 2), Math.round(y - CHAR_H) + bob);
    ctx.globalAlpha = 1;
  }

  private drawNpc(job: JobRef, x: number, y: number, alpha: number) {
    const { ctx, t, hero } = this;
    const s = useGame.getState();
    const near = Math.hypot(hero.x - x, hero.y - y) < 60;
    const dir: Dir = near
      ? Math.abs(hero.x - x) > Math.abs(hero.y - y)
        ? hero.x > x
          ? "right"
          : "left"
        : hero.y > y
          ? "down"
          : "up"
      : "down";
    const bob = Math.sin(t * 2 + x) > 0.7 ? -1 : 0;
    this.drawPerson(jobLook(job.id), x, y, dir, 0, alpha, bob);

    // item bubble: her signature prop floats above her head
    ctx.globalAlpha = alpha;
    const selected = s.selectedJobId === job.id;
    const hovered = this.hover?.kind === "npc" && this.hover.id === job.id;
    const lift = selected || hovered ? -2 : Math.sin(t * 3 + x) > 0 ? 0 : 1;
    const bx = Math.round(x - 8);
    const by = Math.round(y - CHAR_H - 21 + lift);
    ctx.fillStyle = C.outline;
    ctx.fillRect(bx + 1, by, 14, 16);
    ctx.fillRect(bx, by + 1, 16, 14);
    ctx.fillRect(bx + 7, by + 16, 2, 2);
    ctx.fillStyle = selected ? C.sun : hovered ? "#FFF6D8" : C.white;
    ctx.fillRect(bx + 1, by + 1, 14, 14);
    ctx.drawImage(spriteCanvas(propOf(job.id), icon(propOf(job.id))), bx + 3, by + 3);
    if (s.carnet.includes(job.id)) {
      ctx.fillStyle = C.leaf;
      ctx.fillRect(bx + 11, by - 3, 7, 7);
      ctx.fillStyle = C.white;
      ctx.fillRect(bx + 12, by + 1, 1, 1);
      ctx.fillRect(bx + 13, by + 2, 1, 1);
      ctx.fillRect(bx + 14, by + 1, 1, 1);
      ctx.fillRect(bx + 15, by - 1, 1, 2);
    }
    ctx.globalAlpha = 1;
  }

  private drawDecor(d: Decor, alpha: number) {
    const { ctx, t } = this;
    ctx.globalAlpha = alpha;
    const r = (x: number, y: number, w: number, h: number, c: string) => {
      ctx.fillStyle = c;
      ctx.fillRect(Math.round(x), Math.round(y), w, h);
    };
    switch (d.kind) {
      case "petanque": {
        this.drawPerson(passerbyLook(d.x), d.x - 26, d.y, "right", 0, alpha);
        const throwing = Math.floor(t / 1.5) % 2 === 0;
        this.drawPerson(passerbyLook(d.y), d.x + 26, d.y + 2, "left", throwing ? 1 : 0, alpha);
        r(d.x - 6, d.y - 2, 3, 3, "#9AA4AE");
        r(d.x + 2, d.y + 1, 3, 3, "#9AA4AE");
        r(d.x - 1, d.y - 4, 2, 2, "#F7C548"); // le cochonnet
        const bx = throwing ? d.x + 14 - ((t * 20) % 20) : d.x + 5;
        r(bx, d.y - 1 - Math.abs(Math.sin(t * 3)) * 4, 3, 3, "#9AA4AE");
        break;
      }
      case "fisher": {
        this.drawPerson(passerbyLook(d.x + 3), d.x, d.y, "up", 0, alpha);
        r(d.x + 4, d.y - 40, 1, 14, "#6B4A2E");
        r(d.x + 4, d.y - 40, 10, 1, "#6B4A2E");
        r(d.x + 13, d.y - 40, 1, 18 + Math.sin(t * 2) * 2, "rgba(255,255,255,0.8)");
        break;
      }
      case "cafe":
        r(d.x - 10, d.y - 22, 22, 4, C.terracotta);
        r(d.x - 8, d.y - 23, 18, 1, "#F29A6A");
        r(d.x, d.y - 18, 1, 12, "#8A5A3B");
        r(d.x - 5, d.y - 8, 11, 3, C.white);
        r(d.x - 4, d.y - 5, 1, 4, "#9AA4AE");
        r(d.x + 4, d.y - 5, 1, 4, "#9AA4AE");
        r(d.x - 9, d.y - 6, 3, 5, "#6B4A2E");
        r(d.x + 7, d.y - 6, 3, 5, "#6B4A2E");
        break;
      case "cat": {
        const wag = Math.floor(t * 3) % 2;
        r(d.x - 5, d.y - 5, 8, 4, "#F29A38");
        r(d.x + 2, d.y - 8, 4, 4, "#F29A38");
        r(d.x + 2, d.y - 9, 1, 1, "#F29A38");
        r(d.x + 5, d.y - 9, 1, 1, "#F29A38");
        r(d.x + 3, d.y - 7, 1, 1, C.outline);
        r(d.x - 8, d.y - 6 - wag, 3, 1, "#F29A38");
        r(d.x - 5, d.y - 1, 8, 1, "rgba(20,20,40,0.2)");
        break;
      }
      case "bench":
        r(d.x - 12, d.y - 8, 24, 3, "#8A5A3B");
        r(d.x - 12, d.y - 5, 24, 2, "#A87447");
        r(d.x - 11, d.y - 3, 2, 3, "#4B4B55");
        r(d.x + 9, d.y - 3, 2, 3, "#4B4B55");
        break;
      case "swimmer": {
        const x = d.x + Math.sin(t * 0.5 + d.x) * 20;
        r(x - 3, d.y - 3, 6, 5, passerbyLook(d.x).skin);
        r(x - 3, d.y - 4, 6, 2, passerbyLook(d.x).hair);
        r(x - 8, d.y + 2, 16, 1, "rgba(255,255,255,0.7)");
        break;
      }
      case "diver": {
        const up = Math.sin(t * 0.7) > 0.3;
        if (up) {
          r(d.x - 3, d.y - 3, 6, 5, "#1F2A38");
          r(d.x - 2, d.y - 2, 4, 2, "#BFEFF0");
        }
        r(d.x - 10, d.y + 2, 20, 1, "rgba(255,255,255,0.7)");
        r(d.x + 12, d.y - 8, 2, 10, "#D9643A");
        r(d.x + 12, d.y - 8, 8, 5, "#FFFFFF");
        r(d.x + 14, d.y - 7, 6, 1, "#D9643A");
        break;
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawHero() {
    const { ctx, hero } = this;
    const onWater = this.terrain.water[Math.round(hero.y) * MAP_W + Math.round(hero.x)] === 1;
    const frame = hero.moving ? (((Math.floor(hero.step * 8) % 2) + 1) as 1 | 2) : 0;
    const x = Math.round(hero.x);
    const y = Math.round(hero.y);
    const zoomedOut = this.cam.z < this.L2;
    if (zoomedOut) {
      // on the overview she is shown as a big bouncing marker
      const b = Math.sin(this.t * 4) > 0 ? 0 : 3;
      ctx.drawImage(spriteCanvas("star", icon("star")), x - 15, y - 44 - b, 30, 30);
    }
    if (onWater) {
      const b = Math.sin(this.t * 3) > 0 ? 0 : 1;
      ctx.fillStyle = C.terracotta;
      ctx.fillRect(x - 13, y - 6 + b, 26, 7);
      ctx.fillStyle = C.limestone;
      ctx.fillRect(x - 13, y - 6 + b, 26, 2);
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fillRect(x - 17, y + 1 + b, 4, 1);
      ctx.fillRect(x + 13, y + 1 + b, 4, 1);
      ctx.drawImage(characterSprite(HERO_LOOK, hero.dir, 0), x - CHAR_W / 2, y - CHAR_H - 2 + b);
      return;
    }
    ctx.fillStyle = "rgba(20,20,40,0.28)";
    ctx.fillRect(x - 7, y - 1, 14, 3);
    ctx.drawImage(characterSprite(HERO_LOOK, hero.dir, frame), x - CHAR_W / 2, y - CHAR_H + (frame ? -1 : 0));
  }

  // ---------------------------------------------------------------- screen-space UI

  private panel(x: number, y: number, w: number, h: number, fill: string, border: string, shadow = true) {
    const { ctx } = this;
    x = Math.round(x);
    y = Math.round(y);
    if (shadow) {
      ctx.fillStyle = "rgba(20,20,40,0.35)";
      ctx.fillRect(x + 4, y + 4, w, h);
    }
    ctx.fillStyle = border;
    ctx.fillRect(x + 3, y, w - 6, h);
    ctx.fillRect(x, y + 3, w, h - 6);
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = fill;
    ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
  }

  private text(str: string, x: number, y: number, size: number, col: string, weight = 700) {
    const { ctx } = this;
    ctx.font = `${weight} ${size}px ${this.font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = col;
    ctx.fillText(str, Math.round(x), Math.round(y));
  }

  private drawLandmarkLabels(alpha: number) {
    if (alpha < 0.02) return;
    this.ctx.globalAlpha = alpha;
    for (const l of LANDMARKS) {
      const p = this.toScreen(l.x, l.y);
      this.text(l.name, p.x + 1, p.y + 1, 14, "rgba(43,33,64,0.8)", 600);
      this.text(l.name, p.x, p.y, 14, C.white, 600);
    }
    this.ctx.globalAlpha = 1;
  }

  private drawDistrictLabels(alpha: number, highlight: string | null) {
    const { ctx } = this;
    for (const d of DISTRICTS) {
      const island = ISLAND_BY_ID[d.id];
      const hovered = this.hover?.kind === "district" && this.hover.id === d.id;
      const p = this.toScreen(d.box.x + d.box.w / 2, d.box.y + d.box.h / 2);
      ctx.font = `700 20px ${this.font}`;
      const w1 = ctx.measureText(d.place).width;
      ctx.font = `600 14px ${this.font}`;
      const w2 = ctx.measureText(island.name).width;
      const w = Math.max(w1, w2) + 40;
      const h = 54;
      const x = p.x - w / 2;
      const y = p.y - h / 2 + (hovered ? -4 : 0);
      if (alpha > 0.5) this.labelRects.push({ kind: "district", id: d.id, x, y, w, h });
      ctx.globalAlpha = alpha;
      const blink = highlight === d.id && Math.sin(this.t * 6) > 0;
      this.panel(x, y, w, h, hovered ? "#FFFBEF" : C.limestone, blink ? C.sun : C.outline);
      ctx.fillStyle = island.color;
      ctx.fillRect(Math.round(x) + 3, Math.round(y) + 3, 8, h - 6);
      ctx.fillStyle = shade(island.color, -0.25);
      ctx.fillRect(Math.round(x) + 9, Math.round(y) + 3, 2, h - 6);
      this.text(d.place, x + w / 2 + 5, y + 19, 20, C.outline);
      this.text(island.name, x + w / 2 + 5, y + 38, 14, shade(island.color, -0.55), 600);
      if (highlight === d.id) ctx.drawImage(spriteCanvas("star", icon("star")), Math.round(x + w - 14), Math.round(y - 14), 20, 20);
    }
    ctx.globalAlpha = 1;
  }

  private drawZoneLabels(alpha: number) {
    const { ctx } = this;
    ctx.globalAlpha = alpha;
    for (const zn of ZONES) {
      const hovered = this.hover?.kind === "zone" && this.hover.id === zn.id;
      const p = this.toScreen(zn.box.x + zn.box.w / 2, zn.box.y);
      ctx.font = `700 17px ${this.font}`;
      const w = ctx.measureText(zn.name).width + 28;
      const h = 34;
      const post = 14;
      const x = p.x - w / 2;
      const y = p.y - h - post + (hovered ? -3 : 0);
      if (alpha > 0.5) this.labelRects.push({ kind: "zone", id: zn.id, x, y, w, h });
      ctx.fillStyle = "#5A3A22";
      ctx.fillRect(Math.round(p.x) - 3, Math.round(y + h), 6, post + 2);
      this.panel(x, y, w, h, hovered ? "#C98A55" : "#B07845", "#4A2C18");
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.fillRect(Math.round(x) + 3, Math.round(y) + 3, w - 6, 3);
      this.text(zn.name, p.x, y + h / 2 + 1, 17, "#FFF4DC");
    }
    ctx.globalAlpha = 1;
  }

  private drawNpcLabels() {
    const hv = this.hover;
    const hovered = hv?.kind === "npc" ? JOBS.find((j) => j.id === hv.id) : null;
    const near = this.nearestNpc();
    const s = useGame.getState();
    const shown = new Set<JobRef>();
    for (const job of [hovered, near]) {
      if (!job || shown.has(job) || s.selectedJobId === job.id) continue;
      shown.add(job);
      const p = jobPos(job);
      const sp = this.toScreen(p.x, p.y - CHAR_H - 22);
      const label = job === hovered ? job.title : "Espace : parler";
      this.ctx.font = `700 16px ${this.font}`;
      const w = this.ctx.measureText(label).width + 24;
      this.panel(sp.x - w / 2, sp.y - 42, w, 32, C.navy, C.limestone);
      this.text(label, sp.x, sp.y - 26, 16, job === hovered ? C.white : C.sun);
    }
  }

  private drawMinimap() {
    const { ctx } = this;
    const m = this.miniRect;
    this.panel(m.x - 4, m.y - 4, m.w + 8, m.h + 8, C.navy, C.limestone);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.terrain.base, m.x, m.y, m.w, m.h);
    const k = m.w / MAP_W;
    for (const d of DISTRICTS) {
      ctx.fillStyle = shade(ISLAND_BY_ID[d.id].color, -0.2);
      const cx = m.x + (d.box.x + d.box.w / 2) * k;
      const cy = m.y + (d.box.y + d.box.h / 2) * k;
      ctx.fillRect(Math.round(cx) - 3, Math.round(cy) - 3, 6, 6);
    }
    // what the camera sees
    const tl = this.toWorld(0, TOP_PAD);
    const br = this.toWorld(this.W, this.H);
    const vx = m.x + clamp(tl.x, 0, MAP_W) * k;
    const vy = m.y + clamp(tl.y, 0, MAP_H) * k;
    const vw = (clamp(br.x, 0, MAP_W) - clamp(tl.x, 0, MAP_W)) * k;
    const vh = (clamp(br.y, 0, MAP_H) - clamp(tl.y, 0, MAP_H)) * k;
    ctx.strokeStyle = C.sun;
    ctx.lineWidth = 2;
    ctx.strokeRect(Math.round(vx) + 1, Math.round(vy) + 1, Math.max(4, vw - 2), Math.max(4, vh - 2));
    // the hero
    const hx = m.x + this.hero.x * k;
    const hy = m.y + this.hero.y * k;
    ctx.fillStyle = Math.sin(this.t * 6) > 0 ? C.white : "#2EC4C6";
    ctx.fillRect(Math.round(hx) - 2, Math.round(hy) - 2, 5, 5);
  }
}

