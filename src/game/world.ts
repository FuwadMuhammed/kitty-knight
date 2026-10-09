// The Misty Meadow: a deterministic, procedurally generated map rendered in cached chunks.
import { RNG, clamp } from './util';
import { DECOR, ensureSprites } from './sprites';

export const TILE = 16;
export const MW = 150;
export const MH = 100;
export const WORLD_W = MW * TILE;
export const WORLD_H = MH * TILE;
const CHUNK = 256;
const CW = Math.ceil(WORLD_W / CHUNK);
const CH = Math.ceil(WORLD_H / CHUNK);

export interface DecorObj { x: number; y: number; cv: HTMLCanvasElement; shadow: number; tall: boolean }
/** props tall enough that a character should walk behind them (depth-sorted at draw time instead of baked into the ground) */
const TALL = new Set(['tree', 'pine', 'pillar', 'wall', 'grave']);

function hash(x: number, y: number, s: number) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x: number, y: number, s: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

const GRASS = ['#5b9a45', '#52903e', '#64a64c'];

export class World {
  tiles = new Uint8Array(MW * MH); // 0..2 grass, 3 dirt, 4 water
  decor: DecorObj[] = [];
  chestSpots: { x: number; y: number }[] = [];
  chunks: (HTMLCanvasElement | null)[] = new Array(CW * CH).fill(null);
  mist: HTMLCanvasElement;
  seed: number;

  constructor(seed = 1337) {
    ensureSprites();
    this.seed = seed;
    const rng = new RNG(seed);
    this.generateTiles(rng);
    this.generateDecor(rng);
    this.mist = this.buildMist();
  }

  private generateTiles(rng: RNG) {
    for (let ty = 0; ty < MH; ty++)
      for (let tx = 0; tx < MW; tx++) {
        const n = vnoise(tx * 0.09, ty * 0.09, this.seed) * 0.7 + vnoise(tx * 0.3, ty * 0.3, this.seed + 7) * 0.3;
        this.tiles[ty * MW + tx] = n < 0.4 ? 0 : n < 0.62 ? 1 : 2;
      }
    // dirt paths: wandering random walks crossing the map
    for (let p = 0; p < 4; p++) {
      let x = p % 2 ? rng.range(10, MW - 10) : 2;
      let y = p % 2 ? 2 : rng.range(10, MH - 10);
      let a = p % 2 ? Math.PI / 2 : 0;
      a += rng.range(-0.4, 0.4);
      for (let i = 0; i < 260; i++) {
        a += rng.range(-0.22, 0.22);
        x += Math.cos(a);
        y += Math.sin(a);
        if (x < 1 || y < 1 || x > MW - 2 || y > MH - 2) break;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx * dx + dy * dy <= 2) this.tiles[Math.floor(y + dy) * MW + Math.floor(x + dx)] = 3;
      }
    }
    // puddles / ponds
    for (let i = 0; i < 9; i++) {
      const cx = rng.int(8, MW - 8), cy = rng.int(8, MH - 8);
      if (Math.abs(cx - MW / 2) < 8 && Math.abs(cy - MH / 2) < 6) continue;
      const rx = rng.range(1.5, 4), ry = rng.range(1, 2.8);
      for (let dy = -4; dy <= 4; dy++) for (let dx = -5; dx <= 5; dx++) if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1) this.tiles[(cy + dy) * MW + cx + dx] = 4;
    }
  }

  private tileAt(px: number, py: number) {
    const tx = clamp(Math.floor(px / TILE), 0, MW - 1), ty = clamp(Math.floor(py / TILE), 0, MH - 1);
    return this.tiles[ty * MW + tx];
  }

  private generateDecor(rng: RNG) {
    const D = DECOR;
    const cx0 = WORLD_W / 2, cy0 = WORLD_H / 2;
    const add = (kind: string, x: number, y: number, shadow = 0, idx = -1) => {
      const arr = D[kind];
      const cv = arr[idx >= 0 ? idx : Math.floor(rng.next() * arr.length)];
      this.decor.push({ x, y, cv, shadow: shadow ? Math.max(8, Math.round(cv.width * 0.6)) : 0, tall: TALL.has(kind) });
    };
    const nearCenter = (x: number, y: number, r: number) => (x - cx0) ** 2 + (y - cy0) ** 2 < r * r;
    for (let ty = 0; ty < MH; ty++)
      for (let tx = 0; tx < MW; tx++) {
        const t = this.tiles[ty * MW + tx];
        const x = tx * TILE + rng.range(2, 14), y = ty * TILE + rng.range(4, 15);
        const border = tx < 2 || ty < 2 || tx >= MW - 2 || ty >= MH - 2;
        const r = rng.next();
        if (border) {
          if (r < 0.75) add(rng.next() < 0.5 ? 'pine' : 'tree', x, y, 12);
          continue;
        }
        if (t >= 3) continue;
        if (nearCenter(x, y, 90)) {
          if (r < 0.05) add('flower', x, y);
          continue;
        }
        const fn = vnoise(tx * 0.06 + 50, ty * 0.06 + 50, this.seed + 3);
        if (fn > 0.64 && r < 0.2) add(rng.next() < 0.25 ? 'pine' : 'tree', x, y, 12);
        else if (r < 0.006) add('tree', x, y, 12);
        else if (r < 0.016) add('bush', x, y, 9);
        else if (r < 0.025) add('rock', x, y, 8);
        else if (r < 0.029 && fn > 0.5) add('mush', x, y, 3);
        else if (r < 0.0325) add('branch', x, y, 0);
        else if (r < 0.0345) add('stump', x, y, 8);
        else if (r < 0.11 && vnoise(tx * 0.12, ty * 0.12, this.seed + 9) > 0.55) add('flower', x, y);
        else if (r < 0.17) add('tuft', x, y);
      }
    // ruins with gravestones
    for (let i = 0; i < 7; i++) {
      const bx = rng.range(200, WORLD_W - 200), by = rng.range(200, WORLD_H - 200);
      if (nearCenter(bx, by, 200) || this.tileAt(bx, by) === 4) continue;
      const n = rng.int(3, 6);
      for (let k = 0; k < n; k++) {
        const a = rng.range(0, Math.PI * 2), d = rng.range(10, 46);
        const x = bx + Math.cos(a) * d, y = by + Math.sin(a) * d * 0.7;
        if (this.tileAt(x, y) === 4) continue;
        add(rng.next() < 0.5 ? 'pillar' : 'wall', x, y, 14);
      }
      if (rng.next() < 0.7)
        for (let k = 0; k < rng.int(3, 7); k++) {
          const x = bx + rng.range(-70, 70), y = by + rng.range(40, 90);
          if (this.tileAt(x, y) < 3) add('grave', x, y, 8);
        }
    }
    this.decor.sort((a, b) => a.y - b.y);
    // chest spots
    for (let tries = 0; tries < 200 && this.chestSpots.length < 8; tries++) {
      const x = rng.range(120, WORLD_W - 120), y = rng.range(120, WORLD_H - 120);
      if (nearCenter(x, y, 260) || this.tileAt(x, y) >= 3) continue;
      if (this.chestSpots.some((c) => (c.x - x) ** 2 + (c.y - y) ** 2 < 300 * 300)) continue;
      this.chestSpots.push({ x, y });
    }
  }

  private buildMist() {
    const cv = document.createElement('canvas');
    cv.width = 320;
    cv.height = 180;
    const c = cv.getContext('2d')!;
    c.fillStyle = '#ffffff';
    const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    for (let y = 0; y < 180; y++)
      for (let x = 0; x < 320; x++) {
        const n = vnoise(x * 0.025, y * 0.04, 99) * 0.7 + vnoise(x * 0.07, y * 0.09, 100) * 0.3;
        // wrap horizontally: blend with shifted sample for seamless loop
        const nw = vnoise((x - 320) * 0.025, y * 0.04, 99) * 0.7 + vnoise((x - 320) * 0.07, y * 0.09, 100) * 0.3;
        const m = n * (1 - x / 320) + nw * (x / 320);
        const d = clamp((m - 0.5) * 3.2, 0, 1);
        if ((bayer[(y & 3) * 4 + (x & 3)] + 0.5) / 16 < d) c.fillRect(x, y, 1, 1);
      }
    return cv;
  }

  private bake(ci: number) {
    const cxi = ci % CW, cyi = Math.floor(ci / CW);
    const ox = cxi * CHUNK, oy = cyi * CHUNK;
    const cv = document.createElement('canvas');
    cv.width = CHUNK;
    cv.height = CHUNK;
    const c = cv.getContext('2d')!;
    const t0x = cxi * (CHUNK / TILE), t0y = cyi * (CHUNK / TILE);
    for (let ty = t0y; ty < t0y + CHUNK / TILE && ty < MH; ty++)
      for (let tx = t0x; tx < t0x + CHUNK / TILE && tx < MW; tx++) this.drawTile(c, tx, ty, tx * TILE - ox, ty * TILE - oy);
    // shadows
    c.fillStyle = 'rgba(20,40,30,0.28)';
    for (const d of this.decor) {
      if (!d.shadow || d.x + 20 < ox || d.x - 20 > ox + CHUNK || d.y + 6 < oy || d.y - 6 > oy + CHUNK) continue;
      const w = d.shadow;
      c.fillRect(Math.round(d.x - w / 2 - ox), Math.round(d.y - 2 - oy), w, 1);
      c.fillRect(Math.round(d.x - w / 2 + 1 - ox), Math.round(d.y - 3 - oy), w - 2, 1);
      c.fillRect(Math.round(d.x - w / 2 + 1 - ox), Math.round(d.y - 1 - oy), w - 2, 1);
    }
    for (const d of this.decor) {
      if (d.tall) continue;
      const w = d.cv.width, h = d.cv.height;
      const x = Math.round(d.x - w / 2), y = Math.round(d.y - h + 3);
      if (x + w < ox || x > ox + CHUNK || y + h < oy || y > oy + CHUNK) continue;
      c.drawImage(d.cv, x - ox, y - oy);
    }
    this.chunks[ci] = cv;
    return cv;
  }

  private drawTile(c: CanvasRenderingContext2D, tx: number, ty: number, x: number, y: number) {
    const t = this.tiles[ty * MW + tx];
    const s = this.seed;
    if (t <= 2) {
      c.fillStyle = GRASS[t];
      c.fillRect(x, y, TILE, TILE);
      for (let i = 0; i < 7; i++) {
        const hx = Math.floor(hash(tx, ty, i + s) * 15), hy = Math.floor(hash(tx, ty, i + 40 + s) * 14);
        c.fillStyle = i % 3 === 0 ? '#79bb5c' : '#477f35';
        c.fillRect(x + hx, y + hy, 1, i % 3 === 0 ? 1 : 2);
      }
      // dither seam between grass shades
      const right = tx < MW - 1 ? this.tiles[ty * MW + tx + 1] : t;
      if (right <= 2 && right !== t) {
        c.fillStyle = GRASS[right];
        for (let i = 0; i < TILE; i += 2) c.fillRect(x + TILE - 1, y + i + (tx & 1), 1, 1);
      }
    } else if (t === 3) {
      c.fillStyle = '#a98558';
      c.fillRect(x, y, TILE, TILE);
      for (let i = 0; i < 6; i++) {
        const hx = Math.floor(hash(tx, ty, i + s) * 14), hy = Math.floor(hash(tx, ty, i + 60 + s) * 14);
        c.fillStyle = i % 2 ? '#8a6a42' : '#c29a68';
        c.fillRect(x + hx, y + hy, i % 3 === 0 ? 2 : 1, 1);
      }
      const edge = (nx: number, ny: number) => (nx < 0 || ny < 0 || nx >= MW || ny >= MH ? 3 : this.tiles[ny * MW + nx]);
      c.fillStyle = '#7e6040';
      if (edge(tx, ty - 1) !== 3) for (let i = 0; i < TILE; i += 2) c.fillRect(x + i + 1, y, 1, 1);
      if (edge(tx, ty + 1) !== 3) for (let i = 0; i < TILE; i += 2) c.fillRect(x + i, y + TILE - 1, 1, 1);
      if (edge(tx - 1, ty) !== 3) for (let i = 0; i < TILE; i += 2) c.fillRect(x, y + i, 1, 1);
      if (edge(tx + 1, ty) !== 3) for (let i = 0; i < TILE; i += 2) c.fillRect(x + TILE - 1, y + i + 1, 1, 1);
    } else {
      c.fillStyle = '#4a8fc7';
      c.fillRect(x, y, TILE, TILE);
      const edge = (nx: number, ny: number) => (nx < 0 || ny < 0 || nx >= MW || ny >= MH ? 4 : this.tiles[ny * MW + nx]);
      c.fillStyle = '#3a6fa0';
      if (edge(tx, ty - 1) !== 4) c.fillRect(x, y, TILE, 2);
      if (edge(tx - 1, ty) !== 4) c.fillRect(x, y, 2, TILE);
      if (edge(tx + 1, ty) !== 4) c.fillRect(x + TILE - 2, y, 2, TILE);
      if (edge(tx, ty + 1) !== 4) c.fillRect(x, y + TILE - 2, TILE, 2);
      c.fillStyle = '#7bb8e8';
      for (let i = 0; i < 3; i++) c.fillRect(x + Math.floor(hash(tx, ty, i + s) * 11) + 2, y + Math.floor(hash(tx, ty, i + 9 + s) * 12) + 2, 3, 1);
    }
  }

  private tallBuckets: DecorObj[][] | null = null;
  /** Tall props whose sprite overlaps the view, appended to `out`. */
  collectTall(camX: number, camY: number, vw: number, vh: number, out: DecorObj[]) {
    if (!this.tallBuckets) {
      this.tallBuckets = Array.from({ length: CW * CH }, () => []);
      for (const d of this.decor) if (d.tall) this.tallBuckets[Math.min(CH - 1, Math.floor(d.y / CHUNK)) * CW + Math.min(CW - 1, Math.floor(d.x / CHUNK))].push(d);
    }
    const c0 = Math.max(0, Math.floor((camX - 24) / CHUNK)), c1 = Math.min(CW - 1, Math.floor((camX + vw + 24) / CHUNK));
    const r0 = Math.max(0, Math.floor(camY / CHUNK)), r1 = Math.min(CH - 1, Math.floor((camY + vh + 60) / CHUNK));
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++)
        for (const d of this.tallBuckets[r * CW + c]) {
          const sx = d.x - camX, sy = d.y - camY;
          if (sx < -d.cv.width || sx > vw + d.cv.width || sy < 0 || sy > vh + d.cv.height) continue;
          out.push(d);
        }
  }
  drawTallProp(ctx: CanvasRenderingContext2D, d: DecorObj, camX: number, camY: number) {
    ctx.drawImage(d.cv, Math.round(d.x - d.cv.width / 2 - camX), Math.round(d.y - d.cv.height + 3 - camY));
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, camY: number, vw: number, vh: number, withTall = true) {
    const c0 = Math.max(0, Math.floor(camX / CHUNK)), c1 = Math.min(CW - 1, Math.floor((camX + vw) / CHUNK));
    const r0 = Math.max(0, Math.floor(camY / CHUNK)), r1 = Math.min(CH - 1, Math.floor((camY + vh) / CHUNK));
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++) {
        const i = r * CW + c;
        const cv = this.chunks[i] || this.bake(i);
        ctx.drawImage(cv, c * CHUNK - camX, r * CHUNK - camY);
      }
    if (withTall) {
      const list: DecorObj[] = [];
      this.collectTall(camX, camY, vw, vh, list);
      list.sort((a, b) => a.y - b.y);
      for (const d of list) this.drawTallProp(ctx, d, camX, camY);
    }
  }
}
