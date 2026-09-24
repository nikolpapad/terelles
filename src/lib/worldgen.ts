/**
 * Procedural pixel-art map of Marseille (600×300 art pixels, north up).
 * Generated once on the client and cached.
 */
import { JOBS } from "./content";
import { jobPos, MAP_H as H, MAP_W as W } from "./marseille";
import { C, makeCanvas } from "./pixel";

export type Terrain = {
  canvas: HTMLCanvasElement;
  water: Uint8Array;
  /** Water pixels touching land: animated foam. */
  shore: Int32Array;
  /** Random open-water pixels: animated glints. */
  glints: Int32Array;
};

let terrain: Terrain | null = null;
export function getTerrain() {
  terrain ??= generate();
  return terrain;
}

// ---------- noise ----------
function rnd(i: number) {
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
  const top = h(ix, iy) * (1 - u) + h(ix + 1, iy) * u;
  const bot = h(ix, iy + 1) * (1 - u) + h(ix + 1, iy + 1) * u;
  return top * (1 - v) + bot * v;
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

// ---------- geography ----------
/** x of the western coastline for a given y. */
const COAST: [number, number][] = [
  [0, 96], [72, 96], [95, 104], [118, 110], [150, 104], [180, 98], [215, 102], [240, 112], [300, 112],
];
/** y of the southern coastline for a given x. */
const SOUTH: [number, number][] = [
  [0, 238], [110, 238], [200, 242], [250, 238], [300, 248], [340, 262], [380, 272], [420, 282], [480, 288], [540, 290], [600, 286],
];
const INLETS = [
  { c: 345, w: 5, d: 20 },
  { c: 380, w: 6, d: 24 },
  { c: 440, w: 6, d: 22 },
  { c: 470, w: 5, d: 18 },
  { c: 508, w: 6, d: 22 },
  { c: 560, w: 7, d: 26 },
];
const ell = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) =>
  ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;

function landAt(x: number, y: number) {
  if (ell(x, y, 40, 132, 20, 6) || ell(x, y, 58, 148, 13, 5) || ell(x, y, 80, 116, 5, 4)) return true;
  const coast = interp(COAST, y) + (n1(y / 6, 1) - 0.5) * 6;
  if (x < coast) {
    if (y < 76 && x > 66 && y % 18 >= 8 && y % 18 <= 10) return true; // port piers
    if (x >= 62 && x <= 63 && y < 94) return true; // digue du large
    return false;
  }
  let inlet = 0;
  for (const i of INLETS) {
    const k = 1 - Math.abs(x - i.c) / i.w;
    if (k > 0) inlet = Math.max(inlet, i.d * k);
  }
  const south = interp(SOUTH, x) + (n1(x / 5, 2) - 0.5) * 6 - inlet;
  if (y > south) return false;
  if (x >= 104 && x <= 176 && y >= 126 && y <= 139) return false; // Vieux-Port
  return true;
}

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

const hex = (h: string) => {
  const n = parseInt(h.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
};

const ROOFS = ["#C8553D", "#D9643A", "#E07A4F", "#B84A32", "#CF6A45"].map(hex);
const COL = {
  street: hex("#EFE6D2"),
  boulevard: hex("#F6EFDF"),
  quay: hex("#BDB9AE"),
  quayLine: hex("#A7A398"),
  grass: hex("#6DBE5A"),
  grassDark: hex("#5AA84B"),
  pine: hex("#2F6B3E"),
  pineLight: hex("#3E8A4F"),
  lime: hex("#EFEADF"),
  limeDark: hex("#D6CEBD"),
  limeShadow: hex("#BDB3A0"),
  sand: hex("#F1D493"),
  sandDark: hex("#E4C27A"),
  roofLight: hex("#EDE3CF"),
  courtyard: hex("#7BB36B"),
  facade: hex("#F2D6A2"),
  window: hex("#4F6E8C"),
};
const FACADES = ["#F2D6A2", "#F4E4C1", "#EFC9A8", "#F6EBD9", "#E9D3B0"].map(hex);
const WATER = ["#A6EEDD", "#63D8CC", "#3BC2CC", "#2BA2C6", "#2388BB", "#1E77AE"].map(hex);

function generate(): Terrain {
  const land = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) land[y * W + x] = landAt(x, y) ? 1 : 0;

  // distance to the other medium (BFS), used for water depth and beaches
  const dist = new Uint16Array(W * H).fill(999);
  const queue: number[] = [];
  for (let i = 0; i < W * H; i++) {
    const x = i % W;
    const m = land[i];
    const n = [i - 1, i + 1, i - W, i + W].some(
      (j, k) =>
        j >= 0 && j < W * H && !((k === 0 && x === 0) || (k === 1 && x === W - 1)) && land[j] !== m,
    );
    if (n) {
      dist[i] = 1;
      queue.push(i);
    }
  }
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q];
    const x = i % W;
    for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
      if (j < 0 || j >= W * H || land[j] !== land[i] || dist[j] <= dist[i] + 1) continue;
      dist[j] = dist[i] + 1;
      queue.push(j);
    }
  }

  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(W, H);
  const shore: number[] = [];
  const glints: number[] = [];

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const d = dist[i];
      let col: number[];

      if (!land[i]) {
        const k = d <= 1 ? 0 : d <= 4 ? 1 : d <= 10 ? 2 : d <= 22 ? 3 : d <= 40 ? 4 : 5;
        col = WATER[k];
        if (d === 1) shore.push(i);
        else if (d > 4 && rnd(i * 3 + 11) < 0.012) glints.push(i);
      } else {
        col = landColor(x, y, d);
      }
      img.data[i * 4] = col[0];
      img.data[i * 4 + 1] = col[1];
      img.data[i * 4 + 2] = col[2];
      img.data[i * 4 + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  drawLandmarks(ctx, land);

  return { canvas, water: land.map((v) => 1 - v), shore: Int32Array.from(shore), glints: Int32Array.from(glints) };
}

function landColor(x: number, y: number, seaDist: number): number[] {
  const islands = x < 96 && y > 100;
  const port = y < 72 && x < 205;
  const calanques = (x > 400 && y > 200) || (x > 356 && y > 224) || (x > 300 && y > 248);
  const ndHill = Math.hypot(x - 190, y - 190) < 19 + n1(Math.atan2(y - 190, x - 190) * 3, 5) * 5;
  const hills = (x > 395 && y < 175 && n2(x / 28, y / 28, 9) > 0.42) || (y < 24 && x > 330);
  const park =
    (x >= 160 && x <= 202 && y >= 222 && y <= 232) || // Parc Borély
    (x >= 332 && x <= 354 && y >= 94 && y <= 101); // Palais Longchamp gardens
  const tex = n2(x / 2.5, y / 2.5, 3);

  if (islands || calanques) {
    if (seaDist > 3 && n2(x / 3, y / 3, 7) > (calanques ? 0.6 : 0.75)) return tex > 0.5 ? COL.pineLight : COL.pine;
    return tex > 0.62 ? COL.limeDark : seaDist <= 1 ? COL.limeShadow : COL.lime;
  }
  if (ndHill || hills || park) {
    if (n2(x / 3, y / 3, 8) > 0.7) return tex > 0.5 ? COL.pineLight : COL.pine;
    return tex > 0.55 ? COL.grassDark : COL.grass;
  }
  if (seaDist <= 4 && y > 200 && x < 310) return tex > 0.6 ? COL.sandDark : COL.sand; // Prado beaches
  if (port) return x % 12 === 0 || y % 10 === 0 ? COL.quayLine : COL.quay;
  if (seaDist <= 2) return COL.boulevard; // corniche & quays

  // boulevards
  if (y >= 132 && y <= 133 && x >= 176 && x <= 390) return COL.boulevard; // La Canebière
  if (segDist(x, y, 250, 140, 214, 236) < 1.2) return COL.boulevard; // Avenue du Prado
  if (segDist(x, y, 178, 125, 222, 72) < 1.2) return COL.boulevard; // Rue de la République

  return cityColor(x, y);
}

/** 3/4-view city blocks: 2px streets, terracotta roofs, pastel façades with windows. */
function cityColor(x: number, y: number): number[] {
  const BW = 12;
  const BH = 10;
  const bx = Math.floor(x / BW);
  const by = Math.floor(y / BH);
  const lx = x % BW;
  const ly = y % BH;
  const streetV = lx < 2 && rnd(bx * 17 + by * 31) > 0.2;
  const streetH = ly < 2 && rnd(bx * 23 + by * 41) > 0.1;
  if (streetV || streetH) return (lx + ly) % 7 === 0 && rnd(x * 3 + y) < 0.3 ? COL.courtyard : COL.street;
  if (lx < 2 || ly < 2) return COL.street;

  const r = rnd(bx * 131 + by * 977);
  if (r > 0.93) {
    // little square with plane trees
    return n2(x / 2, y / 2, 4) > 0.55 ? COL.pineLight : COL.courtyard;
  }
  if (ly >= 8) {
    // façade seen from the south: wall + windows
    const wall = FACADES[Math.floor(r * 97) % FACADES.length];
    if (ly === 8 && lx % 2 === 1 && lx < BW - 1) return COL.window;
    return wall;
  }
  const roof = r < 0.8 ? ROOFS[Math.floor(r * 7) % ROOFS.length] : COL.roofLight;
  const k = ly === 4 ? 0.82 : (lx + ly) % 2 === 0 ? 0.94 : 1;
  return roof.map((c) => Math.round(c * k));
}

// ---------- hand-placed landmarks ----------
function drawLandmarks(ctx: CanvasRenderingContext2D, land: Uint8Array) {
  const r = (x: number, y: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  };
  const jobs = JOBS.map(jobPos);
  const nearJob = (x: number, y: number, d = 9) => jobs.some((p) => Math.abs(p.x - x) < d && Math.abs(p.y - y) < d);
  const isLand = (x: number, y: number) => land[Math.round(y) * W + Math.round(x)] === 1;

  // Grand Port: container stacks and cranes
  const boxes = [C.terracotta, C.blue, C.sun, C.leaf, C.navy, "#E5E5E5", "#E07A4F"];
  for (let y = 8; y < 66; y += 5) {
    for (let x = 104; x < 198; x += 6) {
      if (!isLand(x, y) || !isLand(x + 5, y + 3) || nearJob(x + 2, y + 1, 10) || rnd(x * 17 + y * 3) < 0.35) continue;
      const c = boxes[Math.floor(rnd(x * 5 + y * 11) * boxes.length)];
      r(x, y, 5, 3, c);
      r(x, y, 5, 1, "rgba(255,255,255,0.35)");
      r(x, y + 3, 5, 1, "rgba(0,0,0,0.25)");
    }
  }
  for (const cy of [14, 32, 50, 68]) {
    r(98, cy - 12, 1, 12, C.orange);
    r(90, cy - 12, 16, 1, C.orange);
    r(97, cy - 13, 3, 2, C.terracottaDark);
    r(91, cy - 11, 1, 5, C.darkGrey);
  }
  // ferry in the outer harbour
  r(70, 80, 24, 5, "#FFFFFF");
  r(70, 83, 24, 2, C.navy);
  r(76, 77, 12, 3, "#F4F4F4");
  r(84, 75, 2, 2, C.terracotta);
  r(70, 85, 24, 1, "rgba(0,0,0,0.2)");

  // Cathédrale La Major
  for (let i = 0; i < 8; i++) r(124, 80 + i, 18, 1, i % 2 ? "#8A9A78" : "#EFE6D2");
  r(126, 77, 4, 3, "#5E7D5A");
  r(135, 76, 5, 4, "#5E7D5A");
  r(124, 88, 18, 1, "rgba(0,0,0,0.25)");

  // Fort Saint-Jean, MuCEM, footbridge, Fort Saint-Nicolas
  r(102, 113, 13, 12, "#D8C08E");
  for (let x = 102; x < 115; x += 2) r(x, 112, 1, 1, "#D8C08E");
  r(109, 108, 5, 6, "#CDB27D");
  r(109, 108, 5, 1, "#E8D5A8");
  r(102, 124, 13, 1, "rgba(0,0,0,0.25)");
  r(115, 104, 4, 1, C.darkGrey); // passerelle
  for (let y = 0; y < 12; y++) {
    for (let x = 0; x < 14; x++) {
      r(118 + x, 96 + y, 1, 1, (x + y) % 3 === 0 ? "#9A9AA6" : (x * 2 + y) % 5 === 0 ? "#6B6B78" : "#3E3E4A");
    }
  }
  r(118, 96, 14, 2, "#5A5A66");
  r(118, 108, 14, 1, "rgba(0,0,0,0.3)");
  r(104, 141, 13, 8, "#D8C08E");
  for (let x = 104; x < 117; x += 2) r(x, 140, 1, 1, "#D8C08E");
  // Ombrière on the Vieux-Port
  r(170, 120, 7, 4, "#CFE6F2");
  r(170, 124, 7, 1, "rgba(0,0,0,0.2)");

  // Notre-Dame de la Garde
  r(181, 187, 18, 7, "#E5DCC8");
  for (let i = 0; i < 7; i++) r(184, 180 + i, 12, 1, i % 2 ? "#9FB29A" : "#F6F1E6");
  r(187, 167, 5, 14, "#F6F1E6");
  r(191, 167, 1, 14, "#D8CDB6");
  r(188, 171, 3, 4, "#8C7B63");
  r(188, 166, 3, 1, "#D8CDB6");
  r(189, 161, 1, 5, C.sun);
  r(188, 163, 3, 1, C.sun);
  r(189, 160, 1, 1, "#FFE9A0");
  r(181, 194, 18, 1, "rgba(0,0,0,0.2)");

  // La Joliette: Tour CMA CGM and Les Docks
  const tx = 293;
  for (let x = 0; x < 8; x++) r(tx + x, 40, 1, 26, x % 2 ? "#6FA8DC" : "#9CC5E8");
  r(tx, 38, 3, 2, "#9CC5E8");
  r(tx + 4, 36, 4, 4, "#6FA8DC");
  r(tx, 66, 8, 1, "rgba(0,0,0,0.3)");
  r(tx + 8, 42, 2, 24, "rgba(0,0,0,0.15)");
  r(214, 86, 34, 8, "#E4CFA6");
  for (let x = 216; x < 246; x += 3) r(x, 88, 1, 2, "#8C6F4E");
  r(214, 94, 34, 1, "rgba(0,0,0,0.25)");

  // Noailles market stalls
  const awnings = [C.terracotta, C.sun, C.leaf, C.blue];
  for (let y = 142; y < 176; y += 8) {
    for (let x = 258; x < 326; x += 9) {
      if (nearJob(x + 3, y + 2, 12) || rnd(x * 13 + y) < 0.3) continue;
      const a = awnings[Math.floor(rnd(x + y * 7) * awnings.length)];
      for (let i = 0; i < 7; i++) r(x + i, y, 1, 3, i % 2 ? "#FFFFFF" : a);
      r(x, y + 3, 7, 2, "#A87447");
      for (let i = 0; i < 3; i++) r(x + 1 + i * 2, y + 3, 1, 1, [C.orange, C.leaf, C.terracotta][i]);
      r(x, y + 5, 7, 1, "rgba(0,0,0,0.25)");
    }
  }
  // Palais Longchamp
  r(334, 101, 20, 5, "#EFE6D2");
  for (let x = 335; x < 354; x += 2) r(x, 102, 1, 3, "#CBBE9F");
  r(341, 98, 6, 3, "#EFE6D2");
  r(340, 106, 8, 3, "#5FD6CB");
  r(334, 109, 20, 1, "rgba(0,0,0,0.2)");

  // Orange Vélodrome (no logos)
  const cx = 376;
  const cy = 206;
  for (let y = -13; y <= 13; y++) {
    for (let x = -20; x <= 20; x++) {
      const o = (x / 20) ** 2 + (y / 13) ** 2;
      if (o > 1) continue;
      const p = (x / 13) ** 2 + (y / 7) ** 2;
      let c = "#F7F7F2";
      if (p <= 1) c = x % 4 === 0 ? "#5DB85A" : "#6CC766";
      else if (o > 0.82) c = (x + 40) % 4 < 2 ? "#E3E7EE" : "#F7F7F2";
      else c = "#B7C3D6";
      if (p <= 1 && (x === 0 || (Math.abs(p - 0.25) < 0.08 && Math.abs(x) < 4))) c = "#FFFFFF";
      r(cx + x, cy + y, 1, 1, c);
    }
  }
  r(cx - 16, cy + 13, 32, 1, "rgba(0,0,0,0.25)");

  // Château d'If
  r(77, 113, 7, 5, "#D9C9A3");
  r(76, 112, 2, 2, "#C4B287");
  r(83, 112, 2, 2, "#C4B287");
  r(79, 111, 3, 2, "#E8DAB7");

  // beach umbrellas on the Prado
  for (let x = 112; x < 300; x += 7) {
    for (let y = 225; y < 250; y++) {
      const i = y * W + x;
      if (!land[i] || land[i + W * 2]) continue;
      if (rnd(x * 7 + y) < 0.5) break;
      r(x, y - 1, 3, 1, [C.terracotta, C.sun, C.blue][x % 3]);
      r(x + 1, y, 1, 1, C.brown);
      break;
    }
  }
}
