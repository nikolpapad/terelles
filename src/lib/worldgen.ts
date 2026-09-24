/**
 * Procedural pixel-art Marseille, in two levels of detail:
 *  - `base`: 400×250, calm and readable, for the zoomed-out overview;
 *  - `detail`: 1600×1000, buildings in 3/4 view, trees and landmarks, revealed when zooming in.
 * Generated once on the client and cached.
 */
import { JOBS } from "./content";
import { jobPos, MAP_H as H, MAP_W as W } from "./marseille";
import { makeCanvas } from "./pixel";

export const BASE_SCALE = 4;

export type Terrain = {
  detail: HTMLCanvasElement;
  base: HTMLCanvasElement;
  /** 1 where the world pixel is water. */
  water: Uint8Array;
  /** Water pixels touching land: animated foam. */
  shore: Int32Array;
  /** Open-water pixels: animated glints. */
  glints: Int32Array;
};

let terrain: Terrain | null = null;
export function getTerrain() {
  terrain ??= generate();
  return terrain;
}

// ---------------------------------------------------------------- noise

export function rnd(i: number) {
  let t = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  t ^= t >>> 13;
  t = Math.imul(t, 0xc2b2ae35);
  t ^= t >>> 16;
  return (t >>> 0) / 4294967296;
}
const smooth = (f: number) => f * f * (3 - 2 * f);
function n1(x: number, s: number) {
  const i = Math.floor(x);
  const u = smooth(x - i);
  return rnd(i * 7 + s) * (1 - u) + rnd((i + 1) * 7 + s) * u;
}
function n2(x: number, y: number, s = 0) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const u = smooth(x - ix);
  const v = smooth(y - iy);
  const h = (a: number, b: number) => rnd(a * 374761 + b * 668265 + s);
  return (h(ix, iy) * (1 - u) + h(ix + 1, iy) * u) * (1 - v) + (h(ix, iy + 1) * (1 - u) + h(ix + 1, iy + 1) * u) * v;
}
function interp(pts: [number, number][], v: number) {
  if (v <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (v <= pts[i][0]) {
      const [a, av] = pts[i - 1];
      const [b, bv] = pts[i];
      return av + ((v - a) / (b - a)) * (bv - av);
    }
  }
  return pts[pts.length - 1][1];
}
function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
const ell = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) =>
  ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;

// ---------------------------------------------------------------- geography

/** x of the western coastline for a given y. */
const COAST: [number, number][] = [
  [0, 300], [320, 305], [420, 318], [520, 345], [600, 350], [680, 375], [760, 360], [840, 380], [920, 420], [1000, 430],
];
/** y of the southern coastline for a given x. */
const SOUTH: [number, number][] = [
  [0, 945], [420, 940], [600, 934], [800, 928], [900, 918], [1000, 908], [1100, 916], [1200, 930], [1300, 950], [1450, 960], [1600, 955],
];
const INLETS = [
  { c: 1250, w: 26, d: 110 },
  { c: 1392, w: 24, d: 95 },
  { c: 1440, w: 12, d: 45 },
  { c: 1548, w: 26, d: 105 },
  { c: 1592, w: 14, d: 50 },
];

const enum T {
  Sea,
  City,
  Port,
  Park,
  Hill,
  Rock,
  Beach,
  Island,
}

function coastAt(y: number) {
  return interp(COAST, y) + (n1(y / 30, 1) - 0.5) * 20;
}

/** 0 = water, 1 = mainland, 2 = island. */
function landAt(x: number, y: number) {
  if (ell(x, y, 150, 560, 70, 20) || ell(x, y, 205, 640, 45, 16) || ell(x, y, 300, 480, 16, 12)) return 2;
  if (x < coastAt(y)) {
    if (y < 320 && x > 232 && y % 60 >= 20 && y % 60 <= 27) return 1; // port piers
    if (x >= 214 && x <= 220 && y < 340) return 1; // digue du large
    return 0;
  }
  let inlet = 0;
  for (const i of INLETS) {
    const k = 1 - Math.abs(x - i.c) / i.w;
    if (k > 0) inlet = Math.max(inlet, i.d * k);
  }
  if (y > interp(SOUTH, x) + (n1(x / 28, 2) - 0.5) * 20 - inlet) return 0;
  // Vieux-Port basin
  if (x >= 345 && x <= 620 && y >= 528 && y <= 598) return 0;
  if (x > 620 && ell(x, y, 620, 563, 32, 35)) return 0;
  return 1;
}

function typeAt(x: number, y: number, land: number, seaDist: number): T {
  if (!land) return T.Sea;
  if (land === 2) return T.Island;
  if ((x > 1235 && y > 740) || (x > 1180 && y > 870)) return T.Rock;
  if (Math.hypot(x - 580, y - 770) < 78 + n1(Math.atan2(y - 770, x - 580) * 3, 5) * 20) return T.Hill;
  if ((x > 1180 && y < 330 && n2(x / 90, y / 90, 9) > 0.36) || (x > 1430 && y < 580 && n2(x / 80, y / 80, 4) > 0.42)) return T.Hill;
  if ((x >= 700 && x <= 868 && y >= 858 && y <= 900) || (x >= 1180 && x <= 1300 && y >= 340 && y <= 392)) return T.Park;
  if (seaDist <= 16 && y > 840 && x < 1180) return T.Beach;
  if (y < 330 && x < 760) return T.Port;
  return T.City;
}

const hex = (h: string) => {
  const n = parseInt(h.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
};
const mul = (c: number[], k: number) => c.map((v) => Math.max(0, Math.min(255, Math.round(v * k))));

const SEA = ["#B8F0E4", "#7FDDD0", "#4CC8CE", "#2FAFCB", "#2493C0", "#1F7DB2"].map(hex);
const SEA_STEPS = [2, 10, 26, 60, 120];
const COL = {
  street: hex("#ECE3D1"),
  sidewalk: hex("#E0D4BE"),
  streetShadow: hex("#D6CAB3"),
  boulevard: hex("#F3EBDC"),
  square: hex("#E7DCC7"),
  grass: hex("#7CC46A"),
  grassDark: hex("#6DB45D"),
  rock: hex("#F0EBDF"),
  rockShade: hex("#DDD5C4"),
  cliff: hex("#C9BFAB"),
  port: hex("#CFC9BC"),
  portLine: hex("#BDB6A7"),
  quay: hex("#A9A294"),
  sand: hex("#F3DB9E"),
  sandDark: hex("#EACB86"),
  wetSand: hex("#E0C07A"),
  window: hex("#5B7896"),
  windowLight: hex("#86A3BE"),
  door: hex("#8A5A3B"),
};
const ROOFS = ["#D98A63", "#E29B74", "#CF7B57", "#E6AC88", "#E8DCC8", "#D98A63"].map(hex);
const FACADES = ["#F3E3C3", "#F1D2B0", "#EFE6D6", "#E9C9A3", "#F5EBDD"].map(hex);

const BW = 64;
const BH = 48;
const ST = 8;

function seaColor(d: number, x: number, y: number) {
  let k = SEA_STEPS.findIndex((s) => d <= s);
  if (k < 0) k = SEA.length - 1;
  // 16-bit dithering on band edges
  if (k < SEA.length - 1 && d >= SEA_STEPS[k] - 1 && (x + y) % 2 === 0) k += 1;
  return SEA[k];
}

function cityColor(x: number, y: number, seaDist: number): number[] {
  // big roads first
  if (y >= 598 && y <= 612 && x >= 650 && x <= 1320) return COL.boulevard; // La Canebière
  if (segDist(x, y, 650, 525, 830, 330) < 7) return COL.boulevard; // Rue de la République
  if (segDist(x, y, 790, 640, 720, 905) < 7) return COL.boulevard; // Avenue du Prado
  if (seaDist >= 14 && seaDist <= 22 && y > 600 && x < 920) return COL.boulevard; // Corniche
  if (seaDist < 14) return COL.sidewalk; // quays

  const gx = x % BW;
  const gy = y % BH;
  if (gx < ST || gy < ST) return gy < 2 && gx >= ST ? COL.streetShadow : COL.street;

  const bx = Math.floor(x / BW);
  const by = Math.floor(y / BH);
  const r = rnd(bx * 131 + by * 977);
  const lx = gx - ST;
  const ly = gy - ST;
  const bw = BW - ST;
  const bh = BH - ST;
  if (r < 0.12) return COL.square;
  if (r < 0.2) return (lx + ly) % 7 === 0 ? COL.grassDark : COL.grass;
  if (lx < 2 || ly < 2 || lx >= bw - 2 || ly >= bh - 2) return COL.sidewalk;

  // one or two buildings per block
  const split = rnd(bx * 17 + by * 3) < 0.45 ? bw : 20 + Math.floor(rnd(bx * 5 + by * 29) * 16);
  const second = lx >= split;
  const b0 = second ? split : 2;
  const b1 = second ? bw - 2 : Math.min(split, bw - 2);
  const k = rnd(bx * 71 + by * 13 + (second ? 7 : 0));
  if (second && lx === split) return COL.sidewalk;

  const facadeTop = bh - 10;
  if (ly >= facadeTop) {
    const wall = FACADES[Math.floor(k * 97) % FACADES.length];
    const local = lx - b0;
    const mid = Math.floor((b0 + b1) / 2);
    if (ly >= bh - 7 && Math.abs(lx - mid) <= 1) return COL.door;
    if (ly >= facadeTop + 2 && ly <= facadeTop + 4 && local % 6 >= 2 && local % 6 <= 3) {
      return ly === facadeTop + 2 ? COL.windowLight : COL.window;
    }
    if (ly === bh - 3) return mul(wall, 0.9);
    return wall;
  }
  const roof = ROOFS[Math.floor(k * 101) % ROOFS.length];
  let f = 1;
  if (ly === 2) f = 1.06;
  else if (ly === Math.floor(facadeTop / 2) + 1) f = 0.86;
  else if ((ly - 2) % 3 === 0) f = 0.94;
  if (lx === b0 || lx === b1 - 1) f *= 0.92;
  return mul(roof, f);
}

function landColor(t: T, x: number, y: number, seaDist: number): number[] {
  const tex = n2(x / 3, y / 3, 3);
  switch (t) {
    case T.Rock:
    case T.Island:
      if (seaDist <= 3) return COL.cliff;
      if (n2(x / 14, y / 10, 6) > 0.62) return COL.rockShade;
      return tex > 0.7 ? COL.rockShade : COL.rock;
    case T.Hill:
    case T.Park:
      return tex > 0.6 ? COL.grassDark : COL.grass;
    case T.Beach:
      if (seaDist <= 3) return COL.wetSand;
      return tex > 0.65 ? COL.sandDark : COL.sand;
    case T.Port:
      if (seaDist <= 2) return COL.quay;
      return x % 40 === 0 || y % 40 === 0 ? COL.portLine : COL.port;
    default:
      return cityColor(x, y, seaDist);
  }
}

// ---------------------------------------------------------------- generation

function generate(): Terrain {
  const N = W * H;
  const land = new Uint8Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) land[y * W + x] = landAt(x, y);

  // distance to the other medium (multi-source BFS)
  const dist = new Uint16Array(N).fill(65535);
  const queue = new Int32Array(N);
  let qn = 0;
  const isLand = (i: number) => land[i] !== 0;
  for (let i = 0; i < N; i++) {
    const x = i % W;
    const m = isLand(i);
    if (
      (x > 0 && isLand(i - 1) !== m) ||
      (x < W - 1 && isLand(i + 1) !== m) ||
      (i >= W && isLand(i - W) !== m) ||
      (i < N - W && isLand(i + W) !== m)
    ) {
      dist[i] = 1;
      queue[qn++] = i;
    }
  }
  for (let q = 0; q < qn; q++) {
    const i = queue[q];
    const x = i % W;
    const m = isLand(i);
    const nd = dist[i] + 1;
    if (nd > 200) continue;
    const ns = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W];
    for (const j of ns) {
      if (j < 0 || j >= N || isLand(j) !== m || dist[j] <= nd) continue;
      dist[j] = nd;
      queue[qn++] = j;
    }
  }

  const types = new Uint8Array(N);
  const detail = makeCanvas(W, H);
  const dctx = detail.getContext("2d")!;
  const img = dctx.createImageData(W, H);
  const shore: number[] = [];
  const glints: number[] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const d = dist[i];
      const t = typeAt(x, y, land[i], land[i] ? d : 0);
      types[i] = t;
      let col: number[];
      if (t === T.Sea) {
        col = seaColor(d, x, y);
        if (d <= 2) shore.push(i);
        else if (d > 8 && rnd(i * 3 + 11) < 0.004) glints.push(i);
      } else {
        col = landColor(t, x, y, d);
      }
      img.data[i * 4] = col[0];
      img.data[i * 4 + 1] = col[1];
      img.data[i * 4 + 2] = col[2];
      img.data[i * 4 + 3] = 255;
    }
  }
  dctx.putImageData(img, 0, 0);

  const avoid = JOBS.map(jobPos);
  const free = (x: number, y: number, r = 34) => avoid.every((p) => Math.abs(p.x - x) > r || p.y - y > 70 || y - p.y > 16);
  drawVegetation(dctx, types, dist, free);
  drawLandmarks(dctx, free);

  const base = makeBase(types, dist);
  return {
    detail,
    base,
    water: land.map((v) => (v ? 0 : 1)),
    shore: Int32Array.from(shore),
    glints: Int32Array.from(glints),
  };
}

// ---------------------------------------------------------------- overview layer

function makeBase(types: Uint8Array, dist: Uint16Array) {
  const bw = W / BASE_SCALE;
  const bh = H / BASE_SCALE;
  const c = makeCanvas(bw, bh);
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(bw, bh);
  const CITY = hex("#EBD8B8");
  const BLVD = hex("#F6EEDD");
  const GRID = hex("#E3CDA8");
  const PORT = hex("#D3CDBF");
  const GREEN = hex("#8CC878");
  const PINE = hex("#5E9E5A");
  const ROCK = hex("#F0EBDF");
  const SCRUB = hex("#A9C98E");
  const SAND = hex("#F3DB9E");
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const wx = x * BASE_SCALE + 2;
      const wy = y * BASE_SCALE + 2;
      const i = wy * W + wx;
      const t = types[i] as T;
      const d = dist[i];
      let col: number[];
      const r = rnd(x * 31 + y * 1777);
      switch (t) {
        case T.Sea: {
          let k = SEA_STEPS.findIndex((s) => d <= s * 1.2 + 2);
          if (k < 0) k = SEA.length - 1;
          col = SEA[k];
          break;
        }
        case T.Port:
          col = PORT;
          break;
        case T.Hill:
        case T.Park:
          col = r < 0.18 ? PINE : GREEN;
          break;
        case T.Rock:
        case T.Island:
          col = r < 0.1 ? SCRUB : ROCK;
          break;
        case T.Beach:
          col = SAND;
          break;
        default: {
          const blvd =
            (wy >= 596 && wy <= 614 && wx >= 650 && wx <= 1320) ||
            segDist(wx, wy, 650, 525, 830, 330) < 5 ||
            segDist(wx, wy, 790, 640, 720, 905) < 5;
          // faint street grid so the overview reads as a city, not a desert
          const grid = wx % 64 < BASE_SCALE * 2 || wy % 48 < BASE_SCALE;
          col = blvd ? BLVD : grid ? GRID : CITY;
        }
      }
      const j = (y * bw + x) * 4;
      img.data[j] = col[0];
      img.data[j + 1] = col[1];
      img.data[j + 2] = col[2];
      img.data[j + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // landmarks as tiny readable icons (in base pixels)
  const r = (x: number, y: number, w: number, h: number, col: string) => {
    ctx.fillStyle = col;
    ctx.fillRect(x, y, w, h);
  };
  for (const y of [8, 28, 48, 66]) {
    r(75, y, 1, 10, "#E8743B");
    r(66, y, 16, 1, "#E8743B");
  }
  const boxes = ["#D9643A", "#3E7DD6", "#F7C548", "#58B368"];
  for (let i = 0; i < 26; i++) r(96 + (i % 13) * 7, 16 + Math.floor(i / 13) * 14, 5, 2, boxes[i % 4]);
  r(12, 88, 42, 7, "#FFFFFF");
  r(12, 93, 42, 2, "#1B3B6F");
  r(197, 24, 8, 38, "#7FB2E0");
  r(197, 24, 8, 2, "#B5D3EE");
  r(225, 38, 50, 11, "#E4CFA6");
  r(89, 95, 15, 15, "#4A4A56");
  for (let i = 0; i < 9; i++) r(110, 86 + i, 25, 1, Math.floor(i / 2) % 2 ? "#8A9A78" : "#EFE6D2");
  r(139, 183, 16, 6, "#F6F1E6");
  r(143, 172, 4, 12, "#F6F1E6");
  r(144, 168, 2, 4, "#F7C548");
  for (let i = 0; i < 18; i++) r(200 + (i % 9) * 7, 118 + Math.floor(i / 9) * 7, 5, 3, ["#D9643A", "#F7C548", "#58B368"][i % 3]);
  r(300, 99, 22, 6, "#F6F1E6");
  for (let y = -12; y <= 12; y++)
    for (let x = -20; x <= 20; x++) {
      if ((x / 20) ** 2 + (y / 12) ** 2 > 1) continue;
      r(277 + x, 188 + y, 1, 1, (x / 13) ** 2 + (y / 6.5) ** 2 <= 1 ? "#6CC766" : "#F4F4F4");
    }
  r(72, 117, 6, 5, "#D9C9A3");
  return c;
}

// ---------------------------------------------------------------- trees & landmarks

type Ctx = CanvasRenderingContext2D;

function shadowBlob(ctx: Ctx, x: number, y: number, w: number) {
  ctx.fillStyle = "rgba(40,50,40,0.22)";
  ctx.fillRect(x - w / 2 + 2, y - 1, w, 3);
}

/** Round plane tree (platane). */
function planeTree(ctx: Ctx, x: number, y: number, s: number) {
  shadowBlob(ctx, x, y, 12);
  ctx.fillStyle = "#7A5230";
  ctx.fillRect(x - 1, y - 5, 2, 5);
  const rows = [
    [4, 4], [2, 8], [1, 10], [0, 12], [0, 12], [0, 12], [1, 10], [2, 8],
  ];
  rows.forEach(([o, w], i) => {
    ctx.fillStyle = i < 3 ? "#8CCB6B" : i < 6 ? "#6DAE5A" : "#4E8F45";
    ctx.fillRect(x - 6 + o, y - 14 + i, w, 1);
  });
  if (s > 0.5) {
    ctx.fillStyle = "#A6DA84";
    ctx.fillRect(x - 3, y - 12, 3, 1);
  }
}

/** Umbrella pine (pin parasol), the Provence classic. */
function umbrellaPine(ctx: Ctx, x: number, y: number) {
  shadowBlob(ctx, x, y, 14);
  ctx.fillStyle = "#6B4A2E";
  ctx.fillRect(x - 1, y - 8, 2, 8);
  ctx.fillRect(x - 3, y - 9, 2, 1);
  const rows = [
    [4, 8], [1, 14], [0, 16], [0, 16], [2, 12],
  ];
  rows.forEach(([o, w], i) => {
    ctx.fillStyle = i === 0 ? "#4F8F4A" : i < 3 ? "#3F7A3E" : "#2F6135";
    ctx.fillRect(x - 8 + o, y - 14 + i, w, 1);
  });
}

function bush(ctx: Ctx, x: number, y: number) {
  ctx.fillStyle = "#8FAF6A";
  ctx.fillRect(x - 2, y - 2, 5, 2);
  ctx.fillStyle = "#7A9A58";
  ctx.fillRect(x - 1, y, 4, 1);
}

function drawVegetation(ctx: Ctx, types: Uint8Array, dist: Uint16Array, free: (x: number, y: number, r?: number) => boolean) {
  const trees: { x: number; y: number; kind: number; s: number }[] = [];
  const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < W && y < H ? types[y * W + x] : T.Sea);

  // plane trees along the Canebière
  for (let x = 660; x < 1310; x += 22) {
    trees.push({ x, y: 600, kind: 0, s: rnd(x) });
    trees.push({ x: x + 11, y: 616, kind: 0, s: rnd(x + 1) });
  }
  // jittered grid for parks, hills, squares, calanques
  for (let gy = 8; gy < H; gy += 16) {
    for (let gx = 8; gx < W; gx += 16) {
      const r = rnd(gx * 13 + gy * 7919);
      const x = Math.round(gx + (rnd(gx + gy * 3) - 0.5) * 10);
      const y = Math.round(gy + (rnd(gx * 5 + gy) - 0.5) * 10);
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const t = at(x, y);
      const d = dist[y * W + x];
      if (t === T.Hill && r < 0.62) trees.push({ x, y, kind: 1, s: r });
      else if (t === T.Park && r < 0.55) trees.push({ x, y, kind: 0, s: r });
      else if ((t === T.Rock || t === T.Island) && d > 8) {
        if (r < 0.2) trees.push({ x, y, kind: 1, s: r });
        else if (r < 0.55) trees.push({ x, y, kind: 2, s: r });
      } else if (t === T.City) {
        const bx = Math.floor(x / BW);
        const by = Math.floor(y / BH);
        const br = rnd(bx * 131 + by * 977);
        const lx = (x % BW) - ST;
        const ly = (y % BH) - ST;
        if (br < 0.2 && lx > 6 && ly > 14 && lx < 50 && ly < 38 && r < 0.6) trees.push({ x, y, kind: 0, s: r });
      }
    }
  }
  trees
    .filter((t) => free(t.x, t.y, 30))
    .sort((a, b) => a.y - b.y)
    .forEach((t) => (t.kind === 0 ? planeTree(ctx, t.x, t.y, t.s) : t.kind === 1 ? umbrellaPine(ctx, t.x, t.y) : bush(ctx, t.x, t.y)));

  // beach umbrellas and towels on the Prado
  const cols = ["#D9643A", "#F7C548", "#3E7DD6", "#2EC4C6", "#F28BA8"];
  for (let x = 430; x < 1170; x += 26) {
    for (let y = 850; y < 960; y++) {
      if (at(x, y) !== T.Beach || dist[y * W + x] < 7 || dist[y * W + x] > 12) continue;
      if (rnd(x * 3) < 0.35) break;
      const c = cols[Math.floor(rnd(x) * cols.length)];
      ctx.fillStyle = "rgba(40,50,40,0.2)";
      ctx.fillRect(x - 3, y + 2, 9, 2);
      ctx.fillStyle = c;
      ctx.fillRect(x - 4, y - 6, 9, 2);
      ctx.fillRect(x - 2, y - 7, 5, 1);
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(x - 1, y - 6, 2, 2);
      ctx.fillStyle = "#8A5A3B";
      ctx.fillRect(x, y - 4, 1, 6);
      ctx.fillStyle = cols[(Math.floor(rnd(x) * 5) + 2) % 5];
      ctx.fillRect(x + 4, y + 1, 4, 6);
      break;
    }
  }
}

function drawLandmarks(ctx: Ctx, free: (x: number, y: number, r?: number) => boolean) {
  const r = (x: number, y: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  };
  const shadow = (x: number, y: number, w: number, h = 3) => r(x + 2, y, w, h, "rgba(40,40,60,0.22)");

  // ---- Grand Port: container yard, cranes, ferry
  const boxes = ["#D9643A", "#3E7DD6", "#F7C548", "#58B368", "#1B3B6F", "#E9E9E9", "#E07A4F"];
  for (let y = 56; y < 190; y += 14) {
    for (let x = 380; x < 730; x += 22) {
      if (!free(x + 9, y + 5, 44) || rnd(x * 17 + y * 3) < 0.25) continue;
      const stack = 1 + Math.floor(rnd(x + y * 9) * 2);
      for (let s = 0; s < stack; s++) {
        const c = boxes[Math.floor(rnd(x * 5 + y * 11 + s) * boxes.length)];
        const yy = y - s * 4;
        r(x, yy, 19, 9, c);
        r(x, yy, 19, 1, "rgba(255,255,255,0.4)");
        for (let i = 2; i < 19; i += 3) r(x + i, yy + 2, 1, 6, "rgba(0,0,0,0.12)");
      }
      shadow(x, y + 9, 19);
    }
  }
  for (const cy of [70, 150, 230, 300]) {
    // gantry crane reaching over the water
    r(300, cy - 40, 3, 40, "#E8743B");
    r(318, cy - 40, 3, 40, "#E8743B");
    r(262, cy - 44, 64, 4, "#E8743B");
    r(262, cy - 44, 64, 1, "#F6A36B");
    r(306, cy - 50, 10, 6, "#B9562A");
    r(280, cy - 40, 1, 14, "#4B4B55");
    r(277, cy - 26, 7, 3, "#4B4B55");
    shadow(300, cy, 21);
  }
  r(40, 352, 170, 26, "#FFFFFF");
  r(40, 370, 170, 5, "#1B3B6F");
  r(40, 352, 170, 2, "#EDEDED");
  r(70, 340, 110, 12, "#F4F4F4");
  for (let x = 74; x < 176; x += 6) r(x, 344, 3, 3, "#6FA8DC");
  r(150, 330, 10, 10, "#D9643A");
  r(40, 378, 170, 3, "rgba(0,0,0,0.18)");

  // ---- La Joliette: Tour CMA CGM and Les Docks
  for (let x = 0; x < 30; x++) r(790 + x, 100, 1, 150, x % 3 === 0 ? "#5E97CC" : x % 3 === 1 ? "#8BBBE6" : "#A9CDEE");
  r(790, 92, 13, 8, "#8BBBE6");
  r(806, 84, 14, 16, "#5E97CC");
  r(806, 84, 14, 2, "#CFE4F5");
  r(790, 100, 30, 2, "#CFE4F5");
  shadow(790, 250, 30, 4);
  r(900, 150, 200, 44, "#E4CFA6");
  r(900, 150, 200, 3, "#F0DFBE");
  for (let x = 906; x < 1096; x += 10) {
    r(x, 164, 5, 8, "#8C6F4E");
    r(x, 164, 5, 2, "#A58763");
    r(x, 180, 5, 8, "#8C6F4E");
  }
  shadow(900, 194, 200, 4);

  // ---- MuCEM, Fort Saint-Jean, La Major
  for (let y = 0; y < 60; y++) {
    for (let x = 0; x < 60; x++) {
      const roof = y < 44;
      const lattice = roof ? (x + y) % 6 === 0 || (x - y + 60) % 6 === 0 : (x * 2 + y) % 5 === 0;
      r(355 + x, 380 + y, 1, 1, lattice ? (roof ? "#9A9AA6" : "#7B7B88") : roof ? "#43434F" : "#35353F");
    }
  }
  r(355, 380, 60, 2, "#6A6A78");
  shadow(355, 440, 60, 4);
  r(310, 424, 44, 70, "#D8C08E");
  for (let x = 310; x < 354; x += 4) r(x, 420, 2, 4, "#D8C08E");
  r(310, 470, 44, 24, "#CDB27D");
  for (let y = 0; y < 26; y++)
    for (let x = 0; x < 26; x++) if ((x - 13) ** 2 + (y - 13) ** 2 < 170) r(328 + x, 402 + y, 1, 1, y < 8 ? "#E8D5A8" : "#CDB27D");
  shadow(310, 494, 44, 4);
  r(354, 412, 12, 3, "#6B6F80"); // passerelle
  for (let i = 0; i < 36; i++) r(440, 350 + i, 100, 1, Math.floor(i / 3) % 2 ? "#8A9A78" : "#EFE6D2");
  for (const [cx, rr] of [
    [470, 14],
    [515, 10],
  ] as const) {
    for (let y = 0; y < rr; y++) {
      const w = Math.round(Math.sqrt(rr * rr - (rr - y) ** 2) * 2);
      r(cx - w / 2, 350 - rr + y, w, 1, y < 3 ? "#7E9E78" : "#5E7D5A");
    }
  }
  r(438, 344, 6, 42, "#EFE6D2");
  r(536, 344, 6, 42, "#EFE6D2");
  shadow(440, 386, 100, 4);

  // ---- Vieux-Port: ombrière, Fort Saint-Nicolas, Palais du Pharo
  r(600, 505, 60, 16, "#D5E7F0");
  r(600, 505, 60, 2, "#F2F9FC");
  for (const x of [604, 628, 652]) r(x, 521, 2, 6, "#9AA4AE");
  r(330, 612, 50, 36, "#D8C08E");
  for (let x = 330; x < 380; x += 4) r(x, 608, 2, 4, "#D8C08E");
  shadow(330, 648, 50, 4);
  r(392, 640, 56, 22, "#F2E6CF");
  r(392, 634, 56, 6, "#B9C3CC");
  for (let x = 396; x < 446; x += 6) r(x, 646, 3, 6, "#5B7896");
  shadow(392, 662, 56, 3);

  // ---- Notre-Dame de la Garde on its hill
  r(548, 752, 64, 22, "#E5DCC8");
  r(548, 752, 64, 2, "#F2EBDD");
  for (let i = 0; i < 20; i++) r(556, 732 + i, 48, 1, Math.floor(i / 2) % 2 ? "#A9BBA3" : "#F6F1E6");
  r(572, 690, 16, 44, "#F6F1E6");
  r(584, 690, 4, 44, "#DDD3BF");
  r(576, 698, 8, 12, "#8C7B63");
  r(576, 698, 8, 3, "#A8987D");
  r(574, 686, 12, 4, "#DDD3BF");
  r(578, 672, 4, 14, "#F7C548");
  r(575, 676, 10, 3, "#F7C548");
  r(578, 670, 4, 3, "#FFE59A");
  r(579, 673, 1, 12, "#FFE59A");
  shadow(548, 774, 64, 4);

  // ---- Noailles market and Palais Longchamp
  const awnings = ["#D9643A", "#F7C548", "#58B368", "#3E7DD6"];
  const produce = ["#F29A38", "#58B368", "#D9643A", "#F7C548", "#8E6CD1"];
  for (let y = 470; y < 570; y += 28) {
    for (let x = 796; x < 1080; x += 30) {
      if (!free(x + 11, y + 10, 40) || rnd(x * 13 + y) < 0.22) continue;
      const a = awnings[Math.floor(rnd(x + y * 7) * awnings.length)];
      for (let i = 0; i < 24; i++) r(x + i, y, 1, 8, Math.floor(i / 3) % 2 ? "#FFFFFF" : a);
      r(x, y + 8, 24, 1, "rgba(0,0,0,0.25)");
      r(x + 1, y + 9, 22, 7, "#A87447");
      r(x + 1, y + 9, 22, 1, "#C08A58");
      for (let i = 0; i < 7; i++) r(x + 2 + i * 3, y + 10, 2, 2, produce[(i + x) % produce.length]);
      shadow(x, y + 16, 24);
    }
  }
  r(1200, 398, 90, 24, "#EFE6D2");
  r(1200, 398, 90, 3, "#FBF6EC");
  for (let x = 1204; x < 1288; x += 6) r(x, 404, 2, 14, "#CBBE9F");
  r(1232, 386, 26, 14, "#EFE6D2");
  r(1238, 422, 16, 8, "#63D8CC");
  r(1238, 422, 16, 2, "#B8F0E4");
  shadow(1200, 422, 90, 3);

  // ---- Vélodrome (no logos)
  const cx = 1110;
  const cy = 752;
  for (let y = -46; y <= 46; y++) {
    for (let x = -78; x <= 78; x++) {
      const o = (x / 78) ** 2 + (y / 46) ** 2;
      if (o > 1) continue;
      const p = (x / 52) ** 2 + (y / 26) ** 2;
      let c: string;
      if (p <= 1) c = Math.floor((x + 80) / 8) % 2 ? "#5DB85A" : "#6CC766";
      else if (o > 0.8) c = Math.floor(Math.atan2(y, x) * 20) % 2 === 0 ? "#E6EAF0" : "#F8F8F4";
      else c = (x + y) % 3 === 0 ? "#A9B6CA" : "#B7C3D6";
      if (p <= 1 && (x === 0 || Math.abs(Math.hypot(x, y * 2) - 10) < 0.8 || Math.abs(p - 0.97) < 0.03)) c = "#FFFFFF";
      r(cx + x, cy + y, 1, 1, c);
    }
  }
  shadow(cx - 70, cy + 46, 140, 4);

  // ---- Château d'If and Frioul harbour
  r(290, 470, 22, 16, "#D9C9A3");
  r(288, 468, 6, 6, "#C4B287");
  r(308, 468, 6, 6, "#C4B287");
  r(297, 464, 8, 8, "#E8DAB7");
  shadow(290, 486, 22);
  for (const [x, y] of [
    [140, 552],
    [150, 552],
    [160, 553],
    [196, 634],
  ]) {
    r(x, y, 8, 6, "#F2E6CF");
    r(x, y - 2, 8, 2, "#D98A63");
  }

  // ---- Parc Borély château
  r(760, 868, 36, 14, "#F2E6CF");
  r(760, 864, 36, 4, "#B9C3CC");
  for (let x = 764; x < 794; x += 5) r(x, 872, 2, 5, "#5B7896");
}
