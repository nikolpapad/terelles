/**
 * Canvas engine for the pixel-art Marseille map: camera with semantic zoom,
 * the hero, job NPCs, ambient life, and pointer/keyboard input.
 */
import { useGame, highlightedDistrict } from "@/state/gameStore";
import { characterSprite, CHAR_H, CHAR_W, HERO_LOOK, jobLook, walkerSprite, type Dir } from "./characters";
import { ISLAND_BY_ID, JOBS, type JobRef } from "./content";
import { propOf, icon } from "./icons";
import {
  DISTRICTS,
  LANDMARKS,
  MAP_H,
  MAP_W,
  START,
  ZONES,
  inDistrict,
  inRect,
  jobPos,
  type District,
  type Rect,
} from "./marseille";
import { C, cached, spriteCanvas, shade } from "./pixel";
import { getTerrain, type Terrain } from "./worldgen";

type Hit =
  | { kind: "district"; id: string }
  | { kind: "zone"; id: string }
  | { kind: "npc"; id: string }
  | { kind: "ground"; x: number; y: number };

type Cam = { x: number; y: number; z: number };

const TOP_PAD = 92;
const TALK_RANGE = 18;

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

export class MapEngine {
  private ctx: CanvasRenderingContext2D;
  private terrain: Terrain;
  private dpr = 1;
  private W = 0;
  private H = 0;
  private fitZ = 1;
  private L2 = 4;
  private L3 = 7;
  private cam: Cam = { x: MAP_W / 2, y: MAP_H / 2, z: 1 };
  private target: Cam | null = null;
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
  private walkers: { ax: number; ay: number; bx: number; by: number; p: number; v: number; col: string }[] = [];
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
    this.cam = { x: MAP_W / 2, y: MAP_H / 2, z: this.fitZ };
    this.bindInput();
    mapBus.zoomIn = () => this.flyTo(this.cam.x, this.cam.y, this.cam.z * 1.6);
    mapBus.zoomOut = () => this.flyTo(this.cam.x, this.cam.y, this.cam.z / 1.6);
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

  // ---------------------------------------------------------------- camera

  private get cardOpen() {
    return useGame.getState().selectedJobId !== null && this.W >= 768;
  }
  /** Screen point the camera centre maps to (room for the HUD and the job card). */
  private get vc() {
    const cardW = this.cardOpen ? Math.min(Math.max(this.W * 0.36, 400), 560) + 12 : 0;
    return { x: (this.W - cardW) / 2, y: TOP_PAD + (this.H - TOP_PAD) / 2 };
  }

  private resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = r.width;
    this.H = r.height;
    this.canvas.width = Math.round(r.width * this.dpr);
    this.canvas.height = Math.round(r.height * this.dpr);
    this.fitZ = Math.min(this.W / MAP_W, (this.H - TOP_PAD - 8) / MAP_H);
    this.L2 = Math.max(this.fitZ * 1.6, 3.6);
    this.L3 = Math.max(this.fitZ * 2.6, 6);
    this.cam.z = clamp(this.cam.z, this.fitZ, this.maxZ);
  }

  private get maxZ() {
    return Math.max(this.L3 * 1.7, 11);
  }

  private clampCam(c: Cam) {
    const vc = this.vc;
    // When the map is smaller than the screen, pin it east/top: the leftover
    // margin is then open sea (west/south), which blends into the background.
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
    const lvl = this.level;
    if (lvl === 3) {
      const d = this.districtAt(this.cam.x, this.cam.y);
      if (d) return this.flyToDistrict(d);
    }
    this.flyTo(MAP_W / 2, MAP_H / 2, this.fitZ);
  }

  private get level(): 1 | 2 | 3 {
    const z = this.cam.z;
    return z >= this.L3 * 0.95 ? 3 : z >= this.L2 * 0.95 ? 2 : 1;
  }

  private districtBounds(d: District): Rect {
    if (!d.landmark) return d.box;
    const x = Math.min(d.box.x, d.landmark.x);
    const y = Math.min(d.box.y, d.landmark.y);
    return {
      x,
      y,
      w: Math.max(d.box.x + d.box.w, d.landmark.x + d.landmark.w) - x,
      h: Math.max(d.box.y + d.box.h, d.landmark.y + d.landmark.h) - y,
    };
  }

  private flyToDistrict(d: District) {
    const b = this.districtBounds(d);
    const z = clamp(Math.min((this.W * 0.75) / b.w, ((this.H - TOP_PAD) * 0.75) / b.h), this.L2 * 1.05, this.L3 * 0.76);
    this.flyTo(b.x + b.w / 2, b.y + b.h / 2, z);
  }

  private districtAt(x: number, y: number) {
    return DISTRICTS.find((d) => inDistrict(d, x, y)) ?? null;
  }

  private toScreen(wx: number, wy: number) {
    const vc = this.vc;
    return { x: (wx - this.cam.x) * this.cam.z + vc.x, y: (wy - this.cam.y) * this.cam.z + vc.y };
  }
  private toWorld(sx: number, sy: number) {
    const vc = this.vc;
    return { x: (sx - vc.x) / this.cam.z + this.cam.x, y: (sy - vc.y) / this.cam.z + this.cam.y };
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
        if (Math.hypot(p.offsetX - this.pointer.startX, p.offsetY - this.pointer.startY) > 5) this.pointer.dragged = true;
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
        if (!this.keys.size && useGame.getState().selectedJobId) useGame.getState().closeCard();
        this.keys.add(key);
      } else if ((key === " " || key === "Enter") && (k.target === document.body || k.target === this.canvas)) {
        const npc = this.nearestNpc();
        if (npc) {
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
    const { x, y } = this.toWorld(sx, sy);
    const z = this.cam.z;
    if (z < this.L3 * 0.85) {
      const label = [...this.labelRects]
        .reverse()
        .find((r) => sx >= r.x && sx <= r.x + r.w && sy >= r.y && sy <= r.y + r.h);
      if (label) return { kind: label.kind, id: label.id };
    }
    if (z >= this.L3 * 0.85) {
      for (const job of JOBS) {
        const p = jobPos(job);
        if (Math.abs(x - p.x) < 8 && y > p.y - 34 && y < p.y + 3) return { kind: "npc", id: job.id };
      }
      return { kind: "ground", x, y };
    }
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
    if (hit.kind === "district") {
      this.flyToDistrict(DISTRICTS.find((d) => d.id === hit.id)!);
    } else if (hit.kind === "zone") {
      const zn = ZONES.find((z) => z.id === hit.id)!;
      const z = clamp((this.W * 0.45) / zn.box.w, this.L3 * 1.05, this.L3 * 1.3);
      this.flyTo(zn.box.x + zn.box.w / 2, zn.box.y + zn.box.h / 2, z);
    } else if (hit.kind === "npc") {
      const p = jobPos(JOBS.find((j) => j.id === hit.id)!);
      this.walkTo(p.x, p.y + 9, hit.id);
    } else {
      if (useGame.getState().selectedJobId) useGame.getState().closeCard();
      this.walkTo(hit.x, hit.y);
    }
  }

  private walkTo(x: number, y: number, jobId?: string) {
    const d = Math.hypot(x - this.hero.x, y - this.hero.y);
    this.dest = { x: clamp(x, 2, MAP_W - 2), y: clamp(y, 10, MAP_H - 2), jobId, speed: Math.max(60, d / 1.6) };
  }

  private nearestNpc(): JobRef | null {
    let best: JobRef | null = null;
    let bd = TALK_RANGE;
    for (const job of JOBS) {
      const p = jobPos(job);
      const d = Math.hypot(p.x - this.hero.x, p.y + 6 - this.hero.y);
      if (d < bd) {
        bd = d;
        best = job;
      }
    }
    return best;
  }

  private talkTo(job: JobRef) {
    const p = jobPos(job);
    this.hero.dir = Math.abs(p.x - this.hero.x) > Math.abs(p.y - this.hero.y)
      ? p.x > this.hero.x ? "right" : "left"
      : p.y > this.hero.y ? "down" : "up";
    this.keys.clear();
    void useGame.getState().land(job.id);
    // keep the NPC visible next to the card
    requestAnimationFrame(() => this.flyTo(p.x, p.y - 8, Math.max(this.cam.z, this.L3)));
  }

  // ---------------------------------------------------------------- update

  /** Advances the simulation by `seconds` without waiting for the browser (dev/testing). */
  step(seconds: number) {
    for (let i = 0; i < seconds * 60; i++) {
      this.t += 1 / 60;
      this.update(1 / 60);
    }
    this.draw();
  }

  private frame = (now: number) => {
    const dt = Math.min(0.05, (now - (this.last || now)) / 1000);
    this.last = now;
    this.t += dt;
    this.update(dt);
    this.draw();
    this.raf = requestAnimationFrame(this.frame);
  };

  private update(dt: number) {
    const s = useGame.getState();

    if (s.questIndex !== this.questIndex) {
      if (this.questIndex !== -1) this.flyTo(MAP_W / 2, MAP_H / 2, this.fitZ);
      this.questIndex = s.questIndex;
    }

    // attract mode behind menus: slow drift over the city
    if (!this.interactive) {
      const z = this.fitZ * (1.15 + 0.12 * Math.sin(this.t / 9));
      this.target = {
        x: MAP_W / 2 + Math.sin(this.t / 13) * 40,
        y: MAP_H / 2 + Math.cos(this.t / 11) * 20,
        z,
      };
    }

    // hero: keyboard
    let kx = 0;
    let ky = 0;
    for (const k of this.keys) {
      if (k === "ArrowLeft" || k === "a" || k === "q") kx -= 1;
      if (k === "ArrowRight" || k === "d") kx += 1;
      if (k === "ArrowUp" || k === "w" || k === "z") ky -= 1;
      if (k === "ArrowDown" || k === "s") ky += 1;
    }
    const h = this.hero;
    h.moving = false;
    if (kx || ky) {
      this.dest = null;
      const n = Math.hypot(kx, ky);
      h.x = clamp(h.x + (kx / n) * 55 * dt, 3, MAP_W - 3);
      h.y = clamp(h.y + (ky / n) * 55 * dt, 12, MAP_H - 2);
      h.dir = Math.abs(kx) > Math.abs(ky) ? (kx > 0 ? "right" : "left") : ky > 0 ? "down" : "up";
      h.moving = true;
      this.target = { x: h.x, y: h.y, z: Math.max(this.cam.z, this.L3 * 1.05) };
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
      const k = 1 - Math.exp(-dt * 5);
      const tz = clamp(this.target.z, this.fitZ, this.maxZ);
      this.cam.z = Math.exp(Math.log(this.cam.z) + (Math.log(tz) - Math.log(this.cam.z)) * k);
      const tgt = this.clampCam({ ...this.target, z: this.cam.z });
      this.cam.x += (tgt.x - this.cam.x) * k;
      this.cam.y += (tgt.y - this.cam.y) * k;
      if (Math.abs(tz - this.cam.z) < 0.005 && Math.hypot(tgt.x - this.cam.x, tgt.y - this.cam.y) < 0.05 && !kx && !ky) {
        if (this.interactive) this.target = null;
      }
    }
    this.clampCam(this.cam);

    // ambient
    for (const w of this.walkers) {
      w.p += w.v * dt;
      if (w.p > 1 || w.p < 0) {
        w.v = -w.v;
        w.p = clamp(w.p, 0, 1);
      }
    }
    for (const g of this.gulls) {
      g.x += g.vx * dt;
      g.y += g.vy * dt + Math.sin(this.t + g.ph) * 0.1;
      if (g.x > MAP_W + 20) g.x = -20;
      if (g.x < -20) g.x = MAP_W + 20;
      if (g.y > MAP_H + 20) g.y = -20;
      if (g.y < -20) g.y = MAP_H + 20;
    }
    for (const c of this.clouds) {
      c.x += c.v * dt;
      if (c.x > MAP_W + 60) c.x = -60;
    }
    if (this.t > this.gust.at) {
      this.gust.at = this.t + 14 + rand(this.t) * 8;
      this.gust.lines = Array.from({ length: 7 }, (_, i) => ({
        x: -60 - rand(i + this.t) * 120,
        y: rand(i * 3 + this.t) * MAP_H * 0.8 - 40,
      }));
    }
    for (const l of this.gust.lines) {
      l.x += 190 * dt;
      l.y += 95 * dt;
    }

    // HUD breadcrumb
    if (this.t - this.lastFocus > 0.2) {
      this.lastFocus = this.t;
      const lvl = this.level;
      const d = lvl >= 2 ? this.districtAt(this.cam.x, this.cam.y) : null;
      const zn = lvl === 3 ? ZONES.find((z) => inRect(z.box, this.cam.x, this.cam.y)) : null;
      s.setFocus({ level: lvl, districtId: d?.id ?? null, zoneId: zn?.id ?? null });
    }
  }

  private initAmbient() {
    const routes: [number, number, number, number][] = [
      [180, 133, 385, 133], // Canebière
      [250, 141, 215, 234], // Prado
      [178, 125, 222, 72], // République
      [150, 144, 176, 144], // quai de Rive Neuve
      [112, 120, 176, 120], // quai du Port
      [120, 160, 112, 228], // Corniche
      [260, 170, 330, 170],
      [300, 60, 300, 180],
    ];
    const cols = [C.terracotta, C.blue, C.sun, C.leaf, C.violet, C.limestone, C.pink];
    for (let i = 0; i < 46; i++) {
      const [ax, ay, bx, by] = routes[i % routes.length];
      this.walkers.push({ ax, ay, bx, by, p: rand(i), v: (0.02 + rand(i + 9) * 0.03) * (i % 2 ? 1 : -1), col: cols[i % cols.length] });
    }
    for (let i = 0; i < 8; i++) {
      this.gulls.push({ x: rand(i * 5) * MAP_W, y: rand(i * 7) * MAP_H, vx: 10 + rand(i) * 12, vy: 3 - rand(i * 2) * 6, ph: i });
    }
    for (let i = 0; i < 5; i++) {
      this.clouds.push({ x: rand(i * 11) * MAP_W, y: 20 + rand(i * 13) * 220, v: 3 + rand(i) * 3, s: i % 3 });
    }
  }

  // ---------------------------------------------------------------- draw

  private draw() {
    const { ctx, dpr, cam } = this;
    const vc = this.vc;
    const z = cam.z;
    const a1 = 1 - ss(this.L2 * 0.8, this.L2 * 1.02, z);
    const a2 = ss(this.L2 * 0.8, this.L2 * 1.02, z);
    const a3 = ss(this.L3 * 0.8, this.L3 * 0.97, z);
    const s = useGame.getState();

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#1E77AE";
    ctx.fillRect(0, 0, this.W, this.H);

    const ox = vc.x - cam.x * z;
    const oy = vc.y - cam.y * z;
    ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * ox, dpr * oy);
    ctx.drawImage(this.terrain.canvas, 0, 0);

    const view = {
      x0: cam.x - vc.x / z - 4,
      y0: cam.y - vc.y / z - 4,
      x1: cam.x + (this.W - vc.x) / z + 4,
      y1: cam.y + (this.H - vc.y) / z + 4,
    };
    const inView = (x: number, y: number) => x > view.x0 && x < view.x1 && y > view.y0 && y < view.y1;

    this.drawWater(inView);
    this.drawSeaLife();

    // city walkers
    for (const w of this.walkers) {
      const x = w.ax + (w.bx - w.ax) * w.p;
      const y = w.ay + (w.by - w.ay) * w.p;
      if (!inView(x, y)) continue;
      ctx.drawImage(walkerSprite(w.col, Math.floor(this.t * 4 + w.ax) % 2 ? 1 : 0), Math.round(x) - 1, Math.round(y) - 5);
    }

    // statue glint on Notre-Dame
    if (this.t % 3 < 0.35) {
      ctx.fillStyle = "#FFF6C8";
      ctx.fillRect(188, 160, 3, 1);
      ctx.fillRect(189, 159, 1, 3);
    }

    // district & zone highlights
    const hl = highlightedDistrict(s);
    for (const d of DISTRICTS) {
      const hovered = this.hover?.kind === "district" && this.hover.id === d.id;
      const pulse = hl === d.id ? 0.5 + 0.5 * Math.sin(this.t * 6) : 0;
      if ((hovered && a1 > 0.2) || pulse) {
        const col = pulse ? C.sun : ISLAND_BY_ID[d.id].color;
        ctx.globalAlpha = pulse ? 0.25 + pulse * 0.35 : 0.22 * a1;
        ctx.fillStyle = col;
        this.fillDistrict(d);
        ctx.globalAlpha = pulse ? 1 : a1;
        this.dashRect(this.districtBounds(d), pulse ? C.sun : C.white);
        ctx.globalAlpha = 1;
      }
    }
    if (a2 > 0.05) {
      for (const zn of ZONES) {
        const hovered = this.hover?.kind === "zone" && this.hover.id === zn.id;
        ctx.globalAlpha = a2 * (hovered ? 0.9 : 0.35) * (1 - a3 * 0.7);
        this.dashRect(zn.box, hovered ? C.sun : C.white);
      }
      ctx.globalAlpha = 1;
    }

    // characters, depth sorted
    const actors: { y: number; draw: () => void }[] = [];
    if (a3 > 0.02) {
      for (const job of JOBS) {
        const p = jobPos(job);
        if (inView(p.x, p.y)) actors.push({ y: p.y, draw: () => this.drawNpc(job, p.x, p.y, a3) });
      }
    }
    actors.push({ y: this.hero.y, draw: () => this.drawHero() });
    actors.sort((a, b) => a.y - b.y).forEach((a) => a.draw());

    this.drawSky(inView, 1 - ss(this.fitZ * 1.1, this.L2, z));

    // ---- screen-space labels
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.labelRects = [];
    if (a1 > 0.02) this.drawDistrictLabels(a1, hl);
    if (a2 > 0.02) this.drawZoneLabels(a2 * (1 - a3 * 0.4));
    if (a3 > 0.5) this.drawNpcLabels();
  }

  private fillDistrict(d: District) {
    const { ctx } = this;
    ctx.fillRect(d.box.x, d.box.y, d.box.w, d.box.h);
    if (d.landmark) ctx.fillRect(d.landmark.x, d.landmark.y, d.landmark.w, d.landmark.h);
  }

  /** Marching-ants pixel frame in world space. */
  private dashRect(r: Rect, col: string) {
    const { ctx } = this;
    ctx.fillStyle = col;
    const off = Math.floor(this.t * 6) % 4;
    for (let x = r.x; x < r.x + r.w; x++) {
      if ((Math.floor(x) + off) % 4 < 2) {
        ctx.fillRect(x, r.y, 1, 1);
        ctx.fillRect(x, r.y + r.h, 1, 1);
      }
    }
    for (let y = r.y; y < r.y + r.h; y++) {
      if ((Math.floor(y) + off) % 4 < 2) {
        ctx.fillRect(r.x, y, 1, 1);
        ctx.fillRect(r.x + r.w, y, 1, 1);
      }
    }
  }

  private drawWater(inView: (x: number, y: number) => boolean) {
    const { ctx, t } = this;
    const { shore, glints } = this.terrain;
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    for (let n = 0; n < shore.length; n++) {
      const i = shore[n];
      const x = i % MAP_W;
      const y = (i / MAP_W) | 0;
      if (!inView(x, y)) continue;
      if (Math.sin(t * 2.2 + x * 0.35 + y * 0.25) > 0.45) ctx.fillRect(x, y, 1, 1);
    }
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    for (let n = 0; n < glints.length; n++) {
      const i = glints[n];
      const x = i % MAP_W;
      const y = (i / MAP_W) | 0;
      if (!inView(x, y)) continue;
      const v = Math.sin(t * 1.6 + n * 1.7);
      if (v > 0.6) ctx.fillRect(x, y, v > 0.9 ? 2 : 1, 1);
    }
  }

  private drawSeaLife() {
    const { ctx, t } = this;
    const px = (x: number, y: number, w: number, h: number, c: string) => {
      ctx.fillStyle = c;
      ctx.fillRect(Math.round(x), Math.round(y), w, h);
    };
    const sailboat = (x: number, y: number, c: string, bob: number) => {
      const b = Math.sin(t * 2 + bob) > 0 ? 0 : 1;
      px(x, y + 3 + b, 6, 2, C.white);
      px(x + 1, y + 5 + b, 4, 1, "rgba(0,0,0,0.25)");
      px(x + 2, y - 2 + b, 1, 5, C.brown);
      px(x + 3, y - 2 + b, 2, 4, c);
    };

    // Vieux-Port moorings
    for (let i = 0; i < 9; i++) {
      sailboat(116 + i * 7, 126, [C.white, C.terracotta, C.sun, C.blue][i % 4], i);
      sailboat(119 + i * 7, 133, [C.sun, C.white, C.blue, C.terracotta][i % 4], i + 3);
    }
    // sailboats on loops
    const loops = [
      [70, 200, 30, 10, 0.08],
      [30, 80, 18, 20, -0.06],
      [140, 262, 40, 8, 0.05],
      [260, 280, 40, 6, -0.07],
      [30, 250, 20, 15, 0.09],
    ];
    loops.forEach(([cx, cy, rx, ry, v], i) => {
      const a = t * v + i * 2;
      sailboat(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, [C.white, C.sun, C.terracotta][i % 3], i);
    });
    // Frioul shuttle
    const f = (Math.sin(t * 0.12) + 1) / 2;
    const fx = 100 - f * 42;
    const fy = 131 + f * 8;
    px(fx, fy, 8, 3, C.white);
    px(fx, fy + 2, 8, 1, C.navy);
    px(fx + 2, fy - 2, 4, 2, "#EDEDED");
    // calanques boats
    for (const [x, y] of [[372, 256], [438, 270], [466, 276]]) sailboat(x, y + Math.sin(t + x) * 0.5, C.white, x);

    // floating offshore wind turbines
    for (const [x, y] of [[26, 22], [46, 40], [26, 58], [46, 76]]) {
      px(x - 2, y + 9, 5, 2, C.sun);
      px(x, y, 1, 9, "#F4F4F4");
      const a0 = t * 2.4 + x;
      ctx.fillStyle = "#FFFFFF";
      for (let b = 0; b < 3; b++) {
        const a = a0 + (b * Math.PI * 2) / 3;
        for (let s = 1; s <= 6; s++) ctx.fillRect(Math.round(x + Math.cos(a) * s), Math.round(y + Math.sin(a) * s), 1, 1);
      }
      px(x - 1, y - 1, 2, 2, C.darkGrey);
    }
  }

  private drawSky(inView: (x: number, y: number) => boolean, cloudAlpha: number) {
    const { ctx, t } = this;
    // mistral gusts
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    for (const l of this.gust.lines) {
      for (let s = 0; s < 34; s += 1) if (s % 9 < 6) ctx.fillRect(Math.round(l.x + s), Math.round(l.y + s / 2), 1, 1);
    }
    // gulls
    for (const g of this.gulls) {
      if (!inView(g.x, g.y)) continue;
      const up = Math.sin(t * 9 + g.ph) > 0;
      const x = Math.round(g.x);
      const y = Math.round(g.y);
      ctx.fillStyle = "rgba(43,33,64,0.18)";
      ctx.fillRect(x + 4, y + 10, 4, 1);
      ctx.fillStyle = C.white;
      if (up) {
        ctx.fillRect(x, y, 1, 1);
        ctx.fillRect(x + 4, y, 1, 1);
        ctx.fillRect(x + 1, y + 1, 1, 1);
        ctx.fillRect(x + 3, y + 1, 1, 1);
      } else {
        ctx.fillRect(x, y + 1, 2, 1);
        ctx.fillRect(x + 3, y + 1, 2, 1);
      }
      ctx.fillStyle = C.darkGrey;
      ctx.fillRect(x + 2, y + 2, 1, 1);
    }
    // clouds (only when zoomed out)
    if (cloudAlpha > 0.02) {
      for (const c of this.clouds) {
        const spr = this.cloudSprite(c.s);
        ctx.globalAlpha = cloudAlpha * 0.16;
        ctx.drawImage(this.cloudShadow(c.s), Math.round(c.x + 10), Math.round(c.y + 18));
        ctx.globalAlpha = cloudAlpha * 0.85;
        ctx.drawImage(spr, Math.round(c.x), Math.round(c.y));
      }
      ctx.globalAlpha = 1;
    }
  }

  private cloudBlobs(s: number) {
    return [
      [8, 8, 7], [16, 6, 8], [25, 8, 6], [13, 11, 6], [21, 11, 6],
    ].map(([x, y, r], i) => [x + ((s * 3 + i) % 3), y, r - (s === 2 ? 1 : 0)]);
  }
  private cloudSprite(s: number) {
    return cached(`cloud${s}`, 34, 18, (ctx) => {
      for (const [x, y, r] of this.cloudBlobs(s)) {
        for (let yy = -r; yy <= r; yy++)
          for (let xx = -r; xx <= r; xx++)
            if (xx * xx + yy * yy * 2 <= r * r) {
              ctx.fillStyle = yy > r * 0.3 ? "#E4EEF6" : "#FFFFFF";
              ctx.fillRect(x + xx, y + yy, 1, 1);
            }
      }
    });
  }
  private cloudShadow(s: number) {
    return cached(`cloudShadow${s}`, 34, 18, (ctx) => {
      ctx.fillStyle = "#1B2A40";
      for (const [x, y, r] of this.cloudBlobs(s))
        for (let yy = -r; yy <= r; yy++)
          for (let xx = -r; xx <= r; xx++) if (xx * xx + yy * yy * 2 <= r * r) ctx.fillRect(x + xx, y + yy, 1, 1);
    });
  }

  private drawNpc(job: JobRef, x: number, y: number, alpha: number) {
    const { ctx, t, hero } = this;
    const s = useGame.getState();
    ctx.globalAlpha = alpha;
    const near = Math.hypot(hero.x - x, hero.y - y) < 34;
    const dir: Dir = near
      ? Math.abs(hero.x - x) > Math.abs(hero.y - y)
        ? hero.x > x ? "right" : "left"
        : hero.y > y ? "down" : "up"
      : "down";
    const bob = Math.sin(t * 2 + x) > 0.6 ? -1 : 0;
    ctx.fillStyle = "rgba(20,20,40,0.25)";
    ctx.fillRect(Math.round(x) - 5, Math.round(y) - 1, 10, 2);
    ctx.drawImage(characterSprite(jobLook(job.id), dir, 0), Math.round(x - CHAR_W / 2), Math.round(y - CHAR_H) + bob);

    // item bubble: the job's signature prop floats above her
    const selected = s.selectedJobId === job.id;
    const hovered = this.hover?.kind === "npc" && this.hover.id === job.id;
    const by = Math.round(y - CHAR_H - 15 + (selected || hovered ? -1 : Math.sin(t * 3 + x) > 0 ? 0 : 1));
    const bx = Math.round(x - 7);
    ctx.fillStyle = C.outline;
    ctx.fillRect(bx + 1, by, 12, 14);
    ctx.fillRect(bx, by + 1, 14, 12);
    ctx.fillRect(bx + 6, by + 14, 2, 1);
    ctx.fillStyle = selected ? C.sun : hovered ? "#FFF6D8" : C.white;
    ctx.fillRect(bx + 1, by + 1, 12, 12);
    ctx.drawImage(spriteCanvas(propOf(job.id), icon(propOf(job.id))), bx + 2, by + 2);
    if (s.carnet.includes(job.id)) {
      ctx.fillStyle = C.leaf;
      ctx.fillRect(bx + 10, by - 2, 5, 5);
      ctx.fillStyle = C.white;
      ctx.fillRect(bx + 11, by + 1, 1, 1);
      ctx.fillRect(bx + 12, by + 2, 1, 1);
      ctx.fillRect(bx + 13, by, 1, 2);
    }
    ctx.globalAlpha = 1;
  }

  private drawHero() {
    const { ctx, hero } = this;
    const onWater = this.terrain.water[Math.round(hero.y) * MAP_W + Math.round(hero.x)] === 1;
    const frame = hero.moving ? ((Math.floor(hero.step * 8) % 2) + 1) as 1 | 2 : 0;
    const x = Math.round(hero.x);
    const y = Math.round(hero.y);
    if (onWater) {
      // she hops in a little "pointu" boat on the water
      const b = Math.sin(this.t * 3) > 0 ? 0 : 1;
      ctx.fillStyle = C.terracotta;
      ctx.fillRect(x - 8, y - 4 + b, 16, 4);
      ctx.fillStyle = C.limestone;
      ctx.fillRect(x - 8, y - 4 + b, 16, 1);
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fillRect(x - 10, y + b, 3, 1);
      ctx.fillRect(x + 7, y + b, 3, 1);
      ctx.drawImage(characterSprite(HERO_LOOK, hero.dir, 0), x - CHAR_W / 2, y - CHAR_H - 2 + b);
      return;
    }
    ctx.fillStyle = "rgba(20,20,40,0.28)";
    ctx.fillRect(x - 5, y - 1, 10, 2);
    ctx.drawImage(characterSprite(HERO_LOOK, hero.dir, frame), x - CHAR_W / 2, y - CHAR_H + (frame ? -1 : 0));
    // a gold star marks the player on the zoomed-out map
    if (this.cam.z < this.L2) {
      const b = Math.sin(this.t * 4) > 0 ? 0 : 1;
      ctx.drawImage(spriteCanvas("star", icon("star")), x - 5, y - CHAR_H - 12 - b);
    }
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

  private text(str: string, x: number, y: number, size: number, col: string, weight = 700, align: CanvasTextAlign = "center") {
    const { ctx } = this;
    ctx.font = `${weight} ${size}px ${this.font}`;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.fillStyle = col;
    ctx.fillText(str, Math.round(x), Math.round(y));
  }

  private drawDistrictLabels(alpha: number, highlight: string | null) {
    const { ctx } = this;
    ctx.globalAlpha = alpha * 0.9;
    for (const l of LANDMARKS) {
      const p = this.toScreen(l.x, l.y);
      this.text(l.name, p.x + 1, p.y + 1, 13, C.outline, 600);
      this.text(l.name, p.x, p.y, 13, C.white, 600);
    }
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
      const lift = hovered ? -4 : 0;
      const x = p.x - w / 2;
      const y = p.y - h / 2 + lift;
      ctx.globalAlpha = alpha;
      if (alpha > 0.5) this.labelRects.push({ kind: "district", id: d.id, x, y, w, h });
      const hl = highlight === d.id && Math.sin(this.t * 6) > 0;
      this.panel(x, y, w, h, hovered ? "#FFFBEF" : C.limestone, hl ? C.sun : C.outline);
      ctx.fillStyle = island.color;
      ctx.fillRect(Math.round(x) + 3, Math.round(y) + 3, 8, h - 6);
      ctx.fillStyle = shade(island.color, -0.25);
      ctx.fillRect(Math.round(x) + 9, Math.round(y) + 3, 2, h - 6);
      this.text(d.place, x + w / 2 + 5, y + 19, 20, C.outline);
      this.text(island.name, x + w / 2 + 5, y + 38, 14, shade(island.color, -0.55), 600);
      if (highlight === d.id) {
        ctx.drawImage(spriteCanvas("star", icon("star")), Math.round(x + w - 14), Math.round(y - 14), 20, 20);
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawZoneLabels(alpha: number) {
    const { ctx } = this;
    ctx.globalAlpha = alpha;
    ZONES.forEach((zn, i) => {
      const hovered = this.hover?.kind === "zone" && this.hover.id === zn.id;
      const p = this.toScreen(zn.box.x + zn.box.w / 2, zn.box.y);
      ctx.font = `700 17px ${this.font}`;
      const w = ctx.measureText(zn.name).width + 28;
      const h = 34;
      const post = i % 2 ? 50 : 10; // staggered so neighbouring signs never collide
      const x = p.x - w / 2;
      const y = p.y - h - post + (hovered ? -3 : 0);
      if (alpha > 0.5) this.labelRects.push({ kind: "zone", id: zn.id, x, y, w, h });
      // wooden signpost
      ctx.fillStyle = "#5A3A22";
      ctx.fillRect(Math.round(p.x) - 3, Math.round(y + h), 6, post + 2);
      this.panel(x, y, w, h, hovered ? "#C98A55" : "#B07845", "#4A2C18");
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.fillRect(Math.round(x) + 3, Math.round(y) + 3, w - 6, 3);
      this.text(zn.name, p.x, y + h / 2 + 1, 17, "#FFF4DC");
    });
    ctx.globalAlpha = 1;
  }

  private drawNpcLabels() {
    const hv = this.hover;
    const hovered = hv?.kind === "npc" ? JOBS.find((j) => j.id === hv.id) : null;
    const near = this.nearestNpc();
    const s = useGame.getState();
    for (const job of [hovered, near]) {
      if (!job || s.selectedJobId === job.id) continue;
      const p = jobPos(job);
      const sp = this.toScreen(p.x, p.y - CHAR_H - 17);
      const isNear = job === near && job !== hovered;
      const label = isNear ? "Espace : parler" : job.title;
      this.ctx.font = `700 16px ${this.font}`;
      const w = this.ctx.measureText(label).width + 24;
      this.panel(sp.x - w / 2, sp.y - 40, w, 32, C.navy, C.limestone);
      this.text(label, sp.x, sp.y - 24, 16, isNear ? C.sun : C.white);
      if (job === near && job === hovered) break;
    }
  }
}
