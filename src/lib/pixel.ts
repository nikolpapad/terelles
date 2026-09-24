/** Pixel-art primitives: string sprites, palette, and a cached sprite renderer. */

export const C = {
  outline: "#2B2140",
  white: "#FFFFFF",
  limestone: "#F4EFE3",
  stone: "#D8CDB6",
  grey: "#C9CED6",
  darkGrey: "#6B6F80",
  terracotta: "#D9643A",
  terracottaDark: "#A8432A",
  orange: "#F29A38",
  sun: "#F7C548",
  sunDark: "#C9962A",
  blue: "#3E7DD6",
  turquoise: "#3CC7C9",
  navy: "#1B3B6F",
  navyDeep: "#132a50",
  leaf: "#58B368",
  pine: "#2F6B3E",
  brown: "#8A5A3B",
  sand: "#E8C170",
  pink: "#F28BA8",
  violet: "#8E6CD1",
} as const;

export const ICON_PAL: Record<string, string> = {
  k: C.outline,
  w: C.white,
  g: C.grey,
  d: C.darkGrey,
  r: C.terracotta,
  o: C.orange,
  y: C.sun,
  b: C.blue,
  c: C.turquoise,
  n: C.navy,
  l: C.leaf,
  p: C.pine,
  m: C.brown,
  s: C.sand,
  i: C.pink,
  v: C.violet,
};

export type Sprite = { rows: string[]; pal?: Record<string, string> };

const cache = new Map<string, HTMLCanvasElement>();

export function makeCanvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

/** Renders a string sprite once and caches the canvas. `tint` recolours the outline char. */
export function spriteCanvas(
  key: string,
  sprite: Sprite,
  opts: { tint?: string; flip?: boolean } = {},
): HTMLCanvasElement {
  const id = `${key}|${opts.tint ?? ""}|${opts.flip ? 1 : 0}`;
  const hit = cache.get(id);
  if (hit) return hit;
  const pal: Record<string, string> = { ...ICON_PAL, ...sprite.pal, ...(opts.tint ? { k: opts.tint } : {}) };
  const h = sprite.rows.length;
  const w = Math.max(...sprite.rows.map((r) => r.length));
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d")!;
  sprite.rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const col = pal[ch];
      if (!col) return;
      ctx.fillStyle = col;
      ctx.fillRect(opts.flip ? w - 1 - x : x, y, 1, 1);
    });
  });
  cache.set(id, c);
  return c;
}

/** Cache helper for procedurally drawn sprites. */
export function cached(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const hit = cache.get(key);
  if (hit) return hit;
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d")!;
  draw(ctx);
  cache.set(key, c);
  return c;
}

/** Adds a 1px dark outline around every opaque pixel (classic 16-bit look). */
export function outline(src: HTMLCanvasElement, color: string = C.outline) {
  const w = src.width + 2;
  const h = src.height + 2;
  const out = makeCanvas(w, h);
  const ctx = out.getContext("2d")!;
  const data = src.getContext("2d")!.getImageData(0, 0, src.width, src.height).data;
  const solid = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < src.width && y < src.height && data[(y * src.width + x) * 4 + 3] > 0;
  ctx.fillStyle = color;
  for (let y = -1; y <= src.height; y++) {
    for (let x = -1; x <= src.width; x++) {
      if (solid(x, y)) continue;
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) {
        ctx.fillRect(x + 1, y + 1, 1, 1);
      }
    }
  }
  ctx.drawImage(src, 1, 1);
  return out;
}

export function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255] as const;
}

export function shade(hex: string, amount: number) {
  const [r, g, b] = hexToRgb(hex);
  const f = (c: number) =>
    Math.max(0, Math.min(255, Math.round(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount))));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

/** Strips emoji from content text: the game uses pixel icons instead. */
export function noEmoji(text: string) {
  return text
    .replace(/\p{Extended_Pictographic}|️|‍/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
