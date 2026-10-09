// Procedural pixel-art sprite factory. Every visual in the game is drawn from code, no image files.
type Cv = HTMLCanvasElement;
type C = CanvasRenderingContext2D;

export interface Spr {
  f: Cv[]; // frames, facing left
  fl: Cv[]; // flipped (facing right)
  w: Cv[]; // white hit-flash
  wl: Cv[];
  W: number;
  H: number;
}

export const PAL = {
  out: '#1b1424',
  fur: '#f6deb0', furT: '#dba76b', furB: '#a96d3f', pink: '#f08fa6', pinkD: '#c8607c', eye: '#1c1226',
  silver: '#d9e0ec', gray: '#8f9bb0', dgray: '#4f5a73', leather: '#8b5a33', gold: '#f5c84a', goldD: '#c08a1e',
  cape: '#f6efdc', capeD: '#cdbd9a',
};

const mk = (w: number, h: number): Cv => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};
const ctxOf = (c: Cv) => c.getContext('2d', { willReadFrequently: true })!;

const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bay = (x: number, y: number) => (BAY[((y & 3) << 2) | (x & 3)] + 0.5) / 16 - 0.5; // -0.5..0.5

function hex(col: string): [number, number, number] {
  let h = col.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const toHex = (r: number, g: number, b: number) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
export function mix(a: string, b: string, t: number) {
  const x = hex(a), y = hex(b);
  return toHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
}
/** 4-tone ramp (light -> dark) derived from one base colour. */
export function rampOf(col: string): string[] {
  const [r, g, b] = hex(col);
  const lum = (r * 0.3 + g * 0.59 + b * 0.11) / 255;
  const hi = 0.1 + 0.36 * lum;
  return [mix(col, '#ffffff', hi), mix(col, '#ffffff', hi * 0.4), col, mix(mix(col, '#000000', 0.18 + 0.2 * lum), '#2a1040', 0.12)];
}

const R = (c: C, x: number, y: number, w: number, h: number, col: string) => {
  if (w >= 5 && h >= 5) {
    // big flat areas get a soft dithered top-left light so they don't read as flat boxes
    const r = rampOf(col);
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const t = 0.5 + ((i / w - 0.5) * 0.7 + (j / h - 0.5) * 0.9) * 0.9 + bay(x + i, y + j) * 0.2;
        c.fillStyle = r[t < 0.3 ? 1 : t < 0.75 ? 2 : 3];
        c.fillRect(x + i, y + j, 1, 1);
      }
    return;
  }
  c.fillStyle = col;
  c.fillRect(x, y, w, h);
};
const Px = (c: C, x: number, y: number, col: string) => {
  c.fillStyle = col;
  c.fillRect(x, y, 1, 1);
};
/** flat ellipse */
function EF(c: C, cx: number, cy: number, rx: number, ry: number, col: string) {
  c.fillStyle = col;
  const a = (rx + 0.5) * (rx + 0.5);
  const b = (ry + 0.5) * (ry + 0.5);
  for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) if ((x * x) / a + (y * y) / b <= 1) c.fillRect(cx + x, cy + y, 1, 1);
}
/** shaded ellipse: light from the top-left, ordered-dither between tones (the "reference" pixel look) */
function ES(c: C, cx: number, cy: number, rx: number, ry: number, ramp: string[], bias = 0) {
  const a = (rx + 0.5) * (rx + 0.5);
  const b = (ry + 0.5) * (ry + 0.5);
  const n = ramp.length;
  for (let y = -ry; y <= ry; y++)
    for (let x = -rx; x <= rx; x++) {
      if ((x * x) / a + (y * y) / b > 1) continue;
      const u = x / (rx + 0.5), v = y / (ry + 0.5);
      let t = 0.42 + (u * 0.5 + v * 0.62) * 0.62 + bias; // 0 = light, 1 = dark
      t += bay(cx + x, cy + y) * 0.1;
      c.fillStyle = ramp[Math.max(0, Math.min(n - 1, Math.floor(t * n)))];
      c.fillRect(cx + x, cy + y, 1, 1);
    }
}
function E(c: C, cx: number, cy: number, rx: number, ry: number, col: string) {
  if (rx >= 2 && ry >= 2) ES(c, cx, cy, rx, ry, rampOf(col));
  else EF(c, cx, cy, rx, ry, col);
}
function L(c: C, x0: number, y0: number, x1: number, y1: number, col: string, th = 1) {
  c.fillStyle = col;
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (let i = 0; i < 2000; i++) {
    c.fillRect(x0, y0, th, th);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
function tri(c: C, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, col: string) {
  const minX = Math.floor(Math.min(x1, x2, x3)), maxX = Math.ceil(Math.max(x1, x2, x3));
  const minY = Math.floor(Math.min(y1, y2, y3)), maxY = Math.ceil(Math.max(y1, y2, y3));
  const d = (y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3);
  const big = (maxX - minX) * (maxY - minY) >= 40;
  const r = big ? rampOf(col) : null;
  for (let y = minY; y <= maxY; y++)
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5, py = y + 0.5;
      const a = ((y2 - y3) * (px - x3) + (x3 - x2) * (py - y3)) / d;
      const b = ((y3 - y1) * (px - x3) + (x1 - x3) * (py - y3)) / d;
      if (a >= 0 && b >= 0 && a + b <= 1) {
        if (r) {
          const t = 0.4 + (((x - minX) / (maxX - minX || 1) - 0.5) * 0.5 + ((y - minY) / (maxY - minY || 1) - 0.5) * 0.6) + bay(x, y) * 0.12;
          c.fillStyle = r[t < 0.3 ? 1 : t < 0.7 ? 2 : 3];
        } else c.fillStyle = col;
        c.fillRect(x, y, 1, 1);
      }
    }
}

/** Reference-style finishing pass: rim light (top-left), shade (bottom-right) and a coloured outline taken from the sprite itself. */
function stylize(cv: Cv, outl = true) {
  const ctx = ctxOf(cv);
  const w = cv.width, h = cv.height;
  const img = ctx.getImageData(0, 0, w, h);
  const a = img.data;
  const src = new Uint8ClampedArray(a);
  const al = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : src[(y * w + x) * 4 + 3]);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (src[i + 3] === 0) continue;
      const lit = al(x, y - 1) === 0 || al(x - 1, y) === 0;
      const dark = al(x, y + 1) === 0 || al(x + 1, y) === 0;
      if (lit && !dark) { a[i] += (255 - a[i]) * 0.2; a[i + 1] += (255 - a[i + 1]) * 0.2; a[i + 2] += (255 - a[i + 2]) * 0.2; }
      else if (dark && !lit) { a[i] *= 0.78; a[i + 1] *= 0.76; a[i + 2] *= 0.82; }
    }
  if (outl) {
    const out: [number, number, number, number][] = [];
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (src[(y * w + x) * 4 + 3] > 0) continue;
        let best = -1, lum = 9999;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (al(nx, ny) === 0) continue;
          const j = (ny * w + nx) * 4;
          const l = src[j] * 0.3 + src[j + 1] * 0.59 + src[j + 2] * 0.11;
          if (l < lum) { lum = l; best = j; }
        }
        if (best >= 0) out.push([y * w + x, src[best], src[best + 1], src[best + 2]]);
      }
    for (const [idx, r, g, b] of out) {
      const k = idx * 4;
      a[k] = r * 0.26 + 14; a[k + 1] = g * 0.22 + 8; a[k + 2] = b * 0.28 + 18; a[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}
/** plain flat outline (used for elite glow) */
function outline(cv: Cv, col: string) {
  const ctx = ctxOf(cv);
  const w = cv.width, h = cv.height;
  const img = ctx.getImageData(0, 0, w, h);
  const a = img.data;
  const [r, g, b] = hex(col);
  const mark: number[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (a[(y * w + x) * 4 + 3] > 0) continue;
      if (
        (x > 0 && a[(y * w + x - 1) * 4 + 3] > 0) || (x < w - 1 && a[(y * w + x + 1) * 4 + 3] > 0) ||
        (y > 0 && a[((y - 1) * w + x) * 4 + 3] > 0) || (y < h - 1 && a[((y + 1) * w + x) * 4 + 3] > 0)
      ) mark.push((y * w + x) * 4);
    }
  for (const i of mark) { a[i] = r; a[i + 1] = g; a[i + 2] = b; a[i + 3] = 255; }
  ctx.putImageData(img, 0, 0);
  return cv;
}
function flipped(cv: Cv): Cv {
  const o = mk(cv.width, cv.height);
  const c = ctxOf(o);
  c.translate(cv.width, 0);
  c.scale(-1, 1);
  c.drawImage(cv, 0, 0);
  return o;
}
function whitened(cv: Cv): Cv {
  const o = mk(cv.width, cv.height);
  const c = ctxOf(o);
  c.drawImage(cv, 0, 0);
  c.globalCompositeOperation = 'source-in';
  c.fillStyle = '#ffffff';
  c.fillRect(0, 0, o.width, o.height);
  return o;
}
function scaleNN(cv: Cv, k: number): Cv {
  const w = Math.round(cv.width * k), h = Math.round(cv.height * k);
  const o = mk(w, h);
  const sc = ctxOf(cv).getImageData(0, 0, cv.width, cv.height);
  const oc = ctxOf(o);
  const od = oc.createImageData(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const sx = Math.min(cv.width - 1, Math.floor(x / k)), sy = Math.min(cv.height - 1, Math.floor(y / k));
      const si = (sy * cv.width + sx) * 4, di = (y * w + x) * 4;
      od.data[di] = sc.data[si]; od.data[di + 1] = sc.data[si + 1]; od.data[di + 2] = sc.data[si + 2]; od.data[di + 3] = sc.data[si + 3];
    }
  oc.putImageData(od, 0, 0);
  return o;
}
function pad(cv: Cv, p: number): Cv {
  const o = mk(cv.width + p * 2, cv.height + p * 2);
  ctxOf(o).drawImage(cv, p, p);
  return o;
}
function derive(frames: Cv[]): Spr {
  return { f: frames, fl: frames.map(flipped), w: frames.map(whitened), wl: frames.map((f) => flipped(whitened(f))), W: frames[0].width, H: frames[0].height };
}
function build(w: number, h: number, n: number, draw: (c: C, f: number) => void, outl: string | null = PAL.out): Spr {
  const frames: Cv[] = [];
  for (let f = 0; f < n; f++) {
    const cv = mk(w, h);
    draw(ctxOf(cv), f);
    if (outl) stylize(cv);
    frames.push(cv);
  }
  return derive(frames);
}
function buildCv(w: number, h: number, draw: (c: C) => void, outl: string | null = PAL.out): Cv {
  const cv = mk(w, h);
  draw(ctxOf(cv));
  if (outl) stylize(cv);
  return cv;
}

// ---------------------------------------------------------------- KITTEN KNIGHT
export const KW = 42, KH = 48; // kitten canvas
/** where the sword grip sits on the (left-facing) kitten sprite: the gauntlet that holds it */
export const KG = { x: 6.5, y: 34 };
const FUR = ['#fff0cc', '#f6d08c', '#e4a85c', '#b97a3c'];
const FURL = ['#fffaf0', '#fff0cc', '#f6dca8', '#e4bd86'];
const SILV = ['#ffffff', '#e4eaf4', '#b9c4da', '#808cae'];
const CAPE = ['#fffdf5', '#fbeed4', '#e6cfa6', '#c0a074'];
const GOLDR = ['#fff4b0', '#f4cc48', '#c8901e', '#8a5a12'];
const LEATH = ['#d09458', '#a46a38', '#704424'];
const PINKR = ['#ffe0e6', '#f8b0c0', '#d4748e', '#a84a68'];

function inPoly(pts: number[][], x: number, y: number) {
  let ins = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
}

function drawKitten(c: C, o: { bob: number; la: number; lb: number; cape: number; eyes: 'open' | 'blink' | 'hit' | 'x' }) {
  const b = o.bob, cp = o.cape;
  c.save();
  c.translate(0, 5); // body sits below the big head
  // ---- cape (behind everything, streaming to the right with folds)
  const cape = [[22, 18], [32, 18], [40 + cp, 26], [41, 34 + cp], [36, 33 - cp], [31, 37], [26, 33], [21, 30]];
  for (let y = 16; y < 38; y++)
    for (let x = 20; x < 42; x++) {
      if (!inPoly(cape, x + 0.5, y + 0.5)) continue;
      const fold = ((x - 21 + Math.floor((y - 17) * 0.45)) % 5 + 5) % 5;
      let t = (x - 21) / 20 * 1.3 + (fold === 0 ? 0.5 : fold === 1 ? 0.2 : 0) + (y - 17) / 50 + bay(x, y) * 0.12;
      c.fillStyle = CAPE[Math.max(0, Math.min(3, Math.floor(t * 2.2)))];
      c.fillRect(x, y, 1, 1);
    }
  // ---- legs: thigh (leather), knee plate, greave and a fluffy white paw boot
  for (const [lx, lift, shade] of [[17, o.la, 0], [26, o.lb, 1]] as const) {
    const y0 = 28 - lift;
    ES(c, lx, y0 + 1, 3, 3, shade ? ['#a46a38', '#8a5a30', '#704424', '#4a2c18'] : LEATH.concat(['#4a2c18']));
    ES(c, lx, y0 + 4, 3, 3, shade ? ['#b9c4da', '#98a4c0', '#808cae', '#5a6488'] : SILV);
    ES(c, lx - 1, 34 - lift, 4, 2, shade ? ['#f0e6d0', '#e0d2b4', '#c8b894', '#a89870'] : ['#ffffff', '#fff6e4', '#efdcb8', '#cbb48c']);
    Px(c, lx - 3, 35 - lift, '#c8b894'); Px(c, lx - 1, 35 - lift, '#c8b894'); Px(c, lx + 1, 35 - lift, '#c8b894');
    R(c, lx - 3, y0 + 6, 6, 1, shade ? '#5a6488' : '#8a96b8');
  }
  // ---- chainmail skirt with a checker dither + plate tassets
  for (let y = 25; y < 30; y++)
    for (let x = 14 - (y - 25) % 2; x < 30 + (y - 25) % 2; x++) {
      const chk = (x + y) % 2 === 0;
      c.fillStyle = y === 25 ? '#6a7494' : chk ? '#c8d0e0' : '#7c88a8';
      c.fillRect(x, y, 1, 1);
    }
  R(c, 13, 26, 2, 3, '#e4eaf4'); R(c, 29, 26, 2, 3, '#98a4c0');
  // ---- torso / breastplate
  ES(c, 21, 21, 8, 5, SILV);
  Px(c, 17, 19, '#ffffff'); Px(c, 18, 19, '#ffffff'); Px(c, 16, 21, '#ffffff');
  L(c, 21, 17, 21, 24, '#98a4c0'); // centre ridge
  // belt + buckle + sword strap
  R(c, 14, 24, 16, 2, '#a46a38'); R(c, 14, 24, 16, 1, '#c88a50');
  R(c, 20, 24, 3, 2, '#f4cc48'); Px(c, 21, 24, '#8a5a12'); Px(c, 21, 25, '#fff4b0');
  L(c, 28, 18, 18, 27, '#704424', 2); L(c, 28, 18, 18, 27, '#a46a38', 1);
  Px(c, 14, 27, '#f4cc48'); Px(c, 14, 28, '#c8901e');
  // ---- collar (cream scarf under the chin)
  ES(c, 21, 18 + b, 6, 2, FURL.map((_, i) => CAPE[i]));
  // ---- off-hand shoulder pauldron (right side, darker) + near arm holding the sword
  ES(c, 28, 20, 4, 3, ['#d0d8e8', '#b0bcd4', '#8a96b8', '#5a6488']);
  L(c, 25, 19, 31, 19, '#e4eaf4');
  ES(c, 15, 22, 3, 3, SILV);
  ES(c, 11, 24, 4, 3, ['#ffffff', '#e4eaf4', '#b9c4da', '#808cae']); // forearm gauntlet
  ES(c, 7, 24, 3, 3, ['#ffffff', '#f0f4fa', '#c4cee0', '#8894b4']); // fist
  Px(c, 6, 23, '#808cae'); Px(c, 6, 25, '#808cae'); Px(c, 8, 24, '#808cae');
  ES(c, 9, 28, 2, 2, ['#e4eaf4', '#c4cee0', '#98a4c0', '#6a7494']); // lower hand
  L(c, 8, 20, 8, 21, '#f4cc48'); // cuff trim
  c.restore();
  // ---- head
  const hy = 11 + b;
  // ears (behind head)
  tri(c, 8, hy - 1, 9, hy - 15, 19, hy - 7, '#e4a85c');
  tri(c, 22, hy - 7, 32, hy - 15, 33, hy - 1, '#d49a50');
  tri(c, 10, hy - 3, 11, hy - 12, 16, hy - 6, '#f4a0b4');
  Px(c, 11, hy - 10, '#ffe0e6'); Px(c, 11, hy - 9, '#ffe0e6');
  tri(c, 27, hy - 7, 31, hy - 12, 31, hy - 3, '#e08a9e');
  L(c, 9, hy - 13, 10, hy - 7, '#b97a3c'); L(c, 31, hy - 13, 30, hy - 7, '#b97a3c');
  // head mass with tabby shading
  ES(c, 20, hy, 12, 9, FUR, 0.03);
  // cheek fluff tufts + top tufts
  for (const [x, y] of [[7, hy + 4], [8, hy + 6], [7, hy + 5], [33, hy + 3], [32, hy + 6], [33, hy + 4]]) Px(c, x, y, '#e4a85c');
  for (const [x, y] of [[15, hy - 9], [16, hy - 9], [21, hy - 10], [22, hy - 9], [18, hy - 9]]) Px(c, x, y, '#f6d08c');
  Px(c, 21, hy - 11, '#e4a85c'); Px(c, 16, hy - 10, '#e4a85c');
  // tabby stripes
  for (const [x, y, h] of [[16, hy - 8, 4], [19, hy - 9, 5], [22, hy - 8, 4], [25, hy - 7, 3], [13, hy - 6, 3]]) R(c, x, y, 1, h, '#b97a3c');
  for (const [x, y, w] of [[8, hy + 1, 3], [9, hy + 3, 3], [30, hy, 3], [29, hy + 2, 3]]) R(c, x, y, w, 1, '#b97a3c');
  // muzzle / lower face
  ES(c, 19, hy + 5, 7, 4, FURL, -0.05);
  // eyes: big glossy ovals with two highlights
  const eyeY = hy + 1;
  const eye = (ex: number) => {
    if (o.eyes === 'open') {
      ES(c, ex, eyeY, 2, 3, ['#4a3c60', '#2a2038', '#140c1c', '#0a0610'], -0.2);
      Px(c, ex - 1, eyeY - 2, '#ffffff'); Px(c, ex - 1, eyeY - 1, '#ffffff'); Px(c, ex, eyeY - 2, '#e8e0ff'); Px(c, ex + 1, eyeY + 2, '#8a7ac0');
    } else if (o.eyes === 'blink') { R(c, ex - 2, eyeY + 1, 5, 1, '#140c1c'); Px(c, ex - 2, eyeY, '#140c1c'); Px(c, ex + 2, eyeY, '#140c1c'); }
    else if (o.eyes === 'hit') { L(c, ex - 2, eyeY - 1, ex, eyeY + 1, '#140c1c'); L(c, ex - 2, eyeY + 2, ex, eyeY + 1, '#140c1c'); L(c, ex, eyeY + 1, ex + 2, eyeY, '#140c1c'); }
    else { L(c, ex - 2, eyeY - 2, ex + 2, eyeY + 2, '#140c1c'); L(c, ex + 2, eyeY - 2, ex - 2, eyeY + 2, '#140c1c'); }
  };
  eye(13); eye(24);
  // brows (determined!)
  if (o.eyes === 'open') { L(c, 11, eyeY - 5, 15, eyeY - 4, '#b97a3c'); L(c, 22, eyeY - 4, 26, eyeY - 5, '#b97a3c'); }
  // nose, mouth, blush
  R(c, 18, hy + 3, 3, 1, '#c8605a'); Px(c, 19, hy + 4, '#a84a48');
  Px(c, 17, hy + 6, '#8a5030'); Px(c, 18, hy + 7, '#8a5030'); Px(c, 19, hy + 6, '#8a5030'); Px(c, 20, hy + 7, '#8a5030'); Px(c, 21, hy + 6, '#8a5030');
  R(c, 9, hy + 5, 3, 1, '#f4a0a0'); R(c, 28, hy + 5, 3, 1, '#f4a0a0');
  // bow on the right ear
  ES(c, 25, hy - 9, 2, 2, PINKR); ES(c, 31, hy - 8, 2, 2, PINKR);
  R(c, 27, hy - 9, 3, 2, '#c8607c'); Px(c, 24, hy - 10, '#ffffff'); Px(c, 30, hy - 9, '#ffffff');
}

function buildKitten(): Spr {
  const frames: Cv[] = [];
  const mkF = (o: Parameters<typeof drawKitten>[1]) => {
    const cv = mk(KW, KH);
    const c = ctxOf(cv);
    c.translate(1, 5);
    drawKitten(c, o);
    stylize(cv);
    return cv;
  };
  frames.push(mkF({ bob: 0, la: 0, lb: 0, cape: 0, eyes: 'open' })); // 0 idle
  frames.push(mkF({ bob: 1, la: 0, lb: 0, cape: 1, eyes: 'open' })); // 1 idle breath
  frames.push(mkF({ bob: 0, la: 2, lb: 0, cape: 1, eyes: 'open' })); // 2 walk a
  frames.push(mkF({ bob: 1, la: 0, lb: 2, cape: 0, eyes: 'open' })); // 3 walk b
  frames.push(mkF({ bob: 0, la: 0, lb: 0, cape: 0, eyes: 'blink' })); // 4 blink
  frames.push(mkF({ bob: 1, la: 0, lb: 0, cape: 1, eyes: 'hit' })); // 5 hit
  const d = mkF({ bob: 0, la: 0, lb: 0, cape: 0, eyes: 'x' });
  const dead = mk(KH, KW);
  const dc = ctxOf(dead);
  dc.translate(0, KW);
  dc.rotate(-Math.PI / 2);
  dc.drawImage(d, 0, 0);
  frames.push(dead); // 6 dead
  return derive(frames);
}

// sword: 12x40. Blade (left light -> right dark with a fuller), gold cross-guard, wrapped grip, round pommel
export const SW = { w: 12, h: 40, gx: 6, gripY: 33, slashY: 38 };
function drawSwordCv(kind: 'steel' | 'holy' | 'rune'): Cv {
  const bl = kind === 'holy' ? ['#ffffff', '#fff6c8', '#ffe27a', '#e0a82e', '#b87a18'] : ['#ffffff', '#eef2fa', '#c8d2e6', '#98a4c4', '#6a7698'];
  return buildCv(SW.w, SW.h, (c) => {
    // tapered tip
    for (let y = 0; y < 28; y++) {
      const half = y < 2 ? 1 : y < 5 ? 2 : 3; // half-width
      const x0 = 6 - half, x1 = 6 + half - 1;
      for (let x = x0; x <= x1; x++) {
        const t = (x - x0) / (x1 - x0 || 1);
        let col = bl[Math.min(4, Math.floor(t * 4.6))];
        if (x === 6 && y > 4) col = bl[3]; // fuller groove
        if (x === 5 && y > 4) col = bl[0];
        c.fillStyle = col;
        c.fillRect(x, y, 1, 1);
      }
    }
    // cross-guard with rounded ends
    ES(c, 1, 29, 1, 1, GOLDR); ES(c, 10, 29, 1, 1, GOLDR);
    R(c, 2, 28, 8, 3, '#f4cc48'); R(c, 2, 28, 8, 1, '#fff4b0'); R(c, 2, 30, 8, 1, '#c8901e');
    R(c, 5, 28, 2, 3, kind === 'holy' ? '#7aeaff' : '#e0304a'); // gem
    // grip with leather wraps
    for (let y = 31; y < 36; y++) { R(c, 5, y, 2, 1, y % 2 ? '#704424' : '#a46a38'); }
    // pommel
    ES(c, 6, 37, 2, 2, GOLDR);
    if (kind === 'rune') for (let y = 6; y < 26; y += 3) Px(c, 5, y, '#ffb347');
  });
}

// ---------------------------------------------------------------- ENEMIES
const RED = '#ff4d4d';
function buildEnemies(S: Record<string, Spr>) {
  S.rat = build(18, 14, 2, (c, f) => {
    E(c, 10, 8, 5, 3, '#8c8896');
    R(c, 7, 10, 7, 1, '#b9b5c4');
    E(c, 5, 8, 3, 2, '#a29eb0');
    Px(c, 2, 8, '#f0a0b4');
    E(c, 6, 5, 1, 1, '#f0a0b4');
    Px(c, 4, 7, RED);
    Px(c, 15, 8, '#f0a0b4'); Px(c, 16, 7, '#f0a0b4'); Px(c, 16, 6, '#f0a0b4'); Px(c, 15, 5 + f, '#f0a0b4');
    R(c, f ? 9 : 8, 11, 1, 2, '#5f5b6b');
    R(c, f ? 12 : 13, 11, 1, 2, '#5f5b6b');
  });
  S.slime = build(18, 16, 2, (c, f) => {
    if (f) { E(c, 9, 10, 8, 4, '#5ed16a'); R(c, 2, 12, 14, 2, '#5ed16a'); } else { E(c, 9, 9, 7, 5, '#5ed16a'); R(c, 3, 12, 12, 2, '#5ed16a'); }
    R(c, 3, 13, 12, 1, '#3da64b');
    R(c, 5, 6 + f, 3, 1, '#c8ffb0');
    R(c, 6, 9 + f, 2, 3, '#ffffff'); R(c, 11, 9 + f, 2, 3, '#ffffff');
    Px(c, 6, 10 + f, '#222'); Px(c, 11, 10 + f, '#222');
    R(c, 8, 13, 3, 1, '#2a6a2a');
  });
  S.bat = build(20, 14, 2, (c, f) => {
    if (f === 0) { tri(c, 8, 6, 1, 1, 2, 9, '#5a4a86'); tri(c, 12, 6, 19, 1, 18, 9, '#5a4a86'); }
    else { tri(c, 8, 6, 1, 11, 3, 3, '#5a4a86'); tri(c, 12, 6, 19, 11, 17, 3, '#5a4a86'); }
    E(c, 10, 7, 2, 3, '#3a2d5c');
    Px(c, 8, 3, '#3a2d5c'); Px(c, 12, 3, '#3a2d5c');
    Px(c, 9, 6, RED); Px(c, 11, 6, RED);
    Px(c, 9, 9, '#fff'); Px(c, 11, 9, '#fff');
  });
  S.spider = build(18, 14, 2, (c, f) => {
    const col = '#4a3556';
    for (const s of [0, 1]) {
      const X = (x: number) => (s ? 17 - x : x);
      L(c, X(6), 6, X(3), 3 + f, col); L(c, X(3), 3 + f, X(1), 6, col);
      L(c, X(6), 7, X(2), 7, col); L(c, X(2), 7, X(1), 9 + f, col);
      L(c, X(6), 8, X(3), 10 - f, col); L(c, X(3), 10 - f, X(2), 12, col);
    }
    E(c, 9, 7, 3, 3, '#3a2a3a');
    Px(c, 8, 5, RED); Px(c, 10, 5, RED);
    Px(c, 9, 8, '#d33'); Px(c, 9, 9, '#d33');
  });
  S.goblin = build(18, 22, 2, (c, f) => {
    const g = '#6fbf4a';
    tri(c, 5, 5, 0, 3, 5, 9, g); tri(c, 13, 5, 18, 3, 13, 9, g);
    E(c, 9, 6, 4, 4, g);
    R(c, 7, 5, 1, 2, '#ffe14a'); R(c, 11, 5, 1, 2, '#ffe14a');
    R(c, 8, 9, 3, 1, '#2a4a1a'); Px(c, 8, 8, '#fff'); Px(c, 10, 8, '#fff');
    R(c, 6, 11, 7, 6, '#8a5a34'); R(c, 6, 14, 7, 1, '#4a2e18');
    R(c, 4, 12, 2, 5, g); R(c, 13, 12, 2, 5, g);
    R(c, 15, 7, 2, 8, '#a0703c'); R(c, 14, 4, 4, 4, '#7a5028'); Px(c, 14, 5, '#cfcfcf');
    R(c, 7, 17, 2, 3 - f, g); R(c, 11, 17, 2, 2 + f, g);
  });
  S.skeleton = build(18, 24, 2, (c, f) => {
    const b = '#ece6d3';
    E(c, 9, 6, 4, 4, b); R(c, 7, 10, 5, 2, b);
    R(c, 6, 5, 2, 2, '#222'); R(c, 11, 5, 2, 2, '#222'); Px(c, 9, 8, '#555');
    Px(c, 7, 6, RED); Px(c, 12, 6, RED);
    R(c, 8, 12, 2, 8, b);
    R(c, 5, 13, 8, 1, b); R(c, 5, 15, 8, 1, b); R(c, 6, 17, 6, 1, b);
    R(c, 3 + f, 13, 1, 5, b); R(c, 14 - f, 13, 1, 5, b);
    R(c, 6, 20, 6, 1, b);
    R(c, 6, 21, 2, 2 - f + 1, b); R(c, 11, 21, 2, 2 + f, b);
  });
  S.wolf = build(26, 18, 2, (c, f) => {
    E(c, 15, 9, 8, 4, '#7c8190');
    E(c, 10, 11, 3, 3, '#a9aebc');
    E(c, 6, 8, 4, 3, '#8c92a2');
    R(c, 1, 8, 4, 2, '#9aa0b0'); Px(c, 1, 8, '#111');
    R(c, 6, 4, 2, 2, '#5f6472'); R(c, 9, 4, 2, 2, '#5f6472');
    Px(c, 5, 7, '#ffd64a'); Px(c, 3, 10, '#fff'); Px(c, 5, 10, '#fff');
    L(c, 22, 7, 25, 4 + f, '#6a6f7e', 2);
    R(c, 10, 12, 2, 4 - f, '#5f6472'); R(c, 13, 12, 2, 3 + f, '#5f6472');
    R(c, 18, 12, 2, 3 + f, '#5f6472'); R(c, 21, 12, 2, 4 - f, '#5f6472');
  });
  S.wizard = build(18, 26, 2, (c, f) => {
    tri(c, 9, 0, 4, 9, 14, 9, '#5b3a9a');
    R(c, 3, 9, 12, 2, '#4a2e80');
    Px(c, 9, 5, '#ffe14a'); Px(c, 8, 7, '#ffe14a');
    E(c, 9, 12, 3, 2, '#f2d0b0');
    Px(c, 8, 12, '#222'); Px(c, 10, 12, '#222');
    R(c, 7, 14, 5, 3, '#e8e8f0');
    for (let y = 13; y < 23; y++) { const w = 6 + Math.floor((y - 13) * 0.6); R(c, 9 - Math.floor(w / 2), y + 1, w, 1, y > 18 ? '#4a2e80' : '#6a44b8'); }
    R(c, 7, 15, 5, 3, '#e8e8f0');
    R(c, 15, 8, 1, 15, '#8a5a34');
    E(c, 15, 7, 2, 2, f ? '#9af0ff' : '#5ad8ff');
    R(c, 6 + f, 24, 2, 1, '#2a1a40'); R(c, 10 - f, 24, 2, 1, '#2a1a40');
  });
  S.orc = build(28, 28, 2, (c, f) => {
    const g = '#6c8f4e';
    R(c, 3, 13, 4, 9, g); R(c, 21, 13, 4, 9, g);
    E(c, 14, 19, 8, 6, '#8a5a34'); R(c, 7, 22, 14, 2, '#4a2e18');
    E(c, 14, 9, 5, 5, g);
    R(c, 11, 8, 2, 1, RED); R(c, 15, 8, 2, 1, RED); R(c, 10, 6, 3, 1, '#334d22'); R(c, 15, 6, 3, 1, '#334d22');
    R(c, 11, 12, 1, 2, '#fff'); R(c, 16, 12, 1, 2, '#fff');
    tri(c, 6, 14, 4, 8, 9, 13, '#555b6e'); tri(c, 22, 14, 24, 8, 19, 13, '#555b6e');
    R(c, 25, 6 + f, 2, 14, '#6b4423'); tri(c, 25, 5 + f, 22, 10 + f, 27, 11 + f, '#b8bfcf');
    R(c, 9, 25, 4, 3 - f, g); R(c, 15, 25, 4, 2 + f, g);
  });
  S.gspider = build(32, 24, 2, (c, f) => {
    const col = '#4a3b66';
    for (const dy of [0, 3, 6, 9]) {
      for (const s of [0, 1]) {
        const X = (x: number) => (s ? 31 - x : x);
        const j = (dy % 2 ? f : 1 - f);
        L(c, X(11), 9 + dy / 2, X(5), 3 + dy / 2 + j, col, 2);
        L(c, X(5), 3 + dy / 2 + j, X(1), 10 + dy, col);
      }
    }
    E(c, 20, 13, 8, 6, '#2f2540');
    R(c, 19, 10, 3, 2, RED); R(c, 20, 12, 1, 3, RED); R(c, 19, 15, 3, 2, RED);
    E(c, 9, 13, 4, 4, '#3b2f50');
    R(c, 6, 11, 2, 2, RED); R(c, 10, 11, 2, 2, RED);
    Px(c, 6, 17, '#fff'); Px(c, 11, 17, '#fff');
  });
  S.goose = build(22, 22, 2, (c, f) => {
    tri(c, 18, 12, 21, 8, 19, 16, '#e6e9f0');
    E(c, 12, 14, 6, 5, '#f7f7f7');
    R(c, 6, 6, 3, 9, '#f7f7f7');
    E(c, 6, 4, 3, 3, '#ffffff');
    R(c, 0, 4, 4, 2, '#ff9a2e'); Px(c, 0, 5, '#d9751a');
    R(c, 5, 2, 3, 1, '#222'); Px(c, 5, 3, '#222'); Px(c, 6, 4, RED);
    E(c, 13, 14 - f, 4, 3, '#d3d8e4');
    R(c, 10, 19, 1, 3, '#ff9a2e'); R(c, 14 - f, 19, 1, 3, '#ff9a2e');
    R(c, 9, 21, 3, 1, '#ff9a2e'); R(c, 13 - f, 21, 3, 1, '#ff9a2e');
  });
  S.vacuum = build(24, 14, 2, (c, f) => {
    E(c, 12, 8, 10, 4, '#8d97ab');
    R(c, 3, 9, 18, 2, '#6c768b');
    E(c, 12, 6, 8, 3, '#c4cbd9');
    R(c, 3, 8, 3, 3, '#2b3042');
    R(c, 10, 4, 4, 2, f ? '#ff8a8a' : RED);
    Px(c, 9, 3, '#2b3042'); Px(c, 14, 3, '#2b3042');
    Px(c, f ? 1 : 2, 12, '#ffd24a'); Px(c, f ? 22 : 21, 12, '#ffd24a');
    R(c, 5, 12, 3, 1, '#2b3042'); R(c, 16, 12, 3, 1, '#2b3042');
  });
}

// ---------------------------------------------------------------- BOSSES
function buildBosses(S: Record<string, Spr>) {
  S.dog = build(58, 50, 2, (c, f) => {
    L(c, 47, 24, 54, 14 + f * 2, '#6e4424', 3);
    R(c, 22, 38, 5, 9 - f, '#6e4424'); R(c, 30, 38, 5, 7 + f, '#8a5a34'); R(c, 40, 38, 5, 7 + f, '#6e4424'); R(c, 47, 38, 5, 9 - f, '#8a5a34');
    E(c, 34, 29, 17, 11, '#8a5a34');
    E(c, 36, 22, 13, 5, '#6e4424');
    R(c, 20, 26, 6, 11, '#b0b0c0'); for (let y = 26; y < 37; y += 3) { Px(c, 19, y, '#e0e0f0'); Px(c, 26, y, '#e0e0f0'); }
    E(c, 14, 22, 12, 10, '#9a6a3c');
    R(c, 2, 24, 11, 7, '#b98a5a'); R(c, 1, 23, 5, 4, '#111');
    R(c, 3, 30, 10, 2, '#2b1010'); R(c, 4, 28, 2, 3, '#fff'); R(c, 10, 28, 2, 3, '#fff'); R(c, 7, 28, 2, 2, '#fff');
    R(c, 12, 17, 4, 4, '#ff3030'); Px(c, 13, 18, '#fff'); R(c, 10, 14, 8, 2, '#3a2010');
    tri(c, 18, 14, 25, 6, 24, 24, '#5c3818'); tri(c, 7, 13, 4, 4, 11, 10, '#5c3818');
  });
  S.roobo = build(74, 50, 2, (c, f) => {
    E(c, 37, 30, 33, 16, '#8d97ab');
    R(c, 6, 36, 62, 4, '#3a4054');
    E(c, 37, 25, 29, 13, '#c4cbd9');
    E(c, 37, 22, 20, 9, '#d9deea');
    for (let x = 12; x < 62; x += 6) R(c, x, 30, 3, 1, '#9aa3b5');
    E(c, 37, 22, 10, 7, '#2a2f40');
    E(c, 37, 22, 7, 5, f ? '#ff6a6a' : '#ff3030');
    Px(c, 34, 20, '#fff'); Px(c, 35, 20, '#fff');
    L(c, 27, 14, 35, 17, '#20243a', 2); L(c, 47, 14, 39, 17, '#20243a', 2);
    R(c, 52, 4, 2, 12, '#6c768b'); E(c, 53, 3, 2, 2, f ? '#ffd24a' : RED);
    for (const s of [0, 1]) { const X = (x: number) => (s ? 73 - x : x); for (let i = 0; i < 4; i++) Px(c, X(3 + ((i + f * 2) % 4) * 2), 41 + (i % 2), '#ffd24a'); }
    R(c, 14, 44, 8, 4, '#2b3042'); R(c, 52, 44, 8, 4, '#2b3042');
  });
  S.dragon = build(98, 74, 2, (c, f) => {
    const wing = '#a23a4a', wingD = '#7a2a3a', gr = '#3c9a4a';
    for (const s of [0, 1]) {
      const X = (x: number) => (s ? 97 - x : x);
      if (f === 0) { tri(c, X(36), 36, X(3), 8, X(12), 52, wing); L(c, X(36), 36, X(3), 8, wingD, 2); L(c, X(36), 38, X(10), 40, wingD); }
      else { tri(c, X(36), 40, X(1), 44, X(14), 20, wing); L(c, X(36), 40, X(1), 44, wingD, 2); L(c, X(34), 36, X(10), 30, wingD); }
    }
    E(c, 49, 46, 16, 19, gr);
    E(c, 49, 52, 10, 13, '#e0c070');
    for (let y = 40; y < 62; y += 4) R(c, 41, y, 16, 1, '#c0a050');
    R(c, 38, 62, 6, 8, gr); R(c, 54, 62, 6, 8, gr); R(c, 37, 69, 8, 2, '#f0e8c0'); R(c, 53, 69, 8, 2, '#f0e8c0');
    L(c, 49, 60, 49, 71, gr, 4);
    E(c, 49, 20, 13, 10, '#44a854');
    E(c, 49, 28, 8, 5, '#58bc66');
    tri(c, 38, 14, 31, 1, 42, 11, '#f0e8c0'); tri(c, 60, 14, 67, 1, 56, 11, '#f0e8c0');
    R(c, 41, 16, 5, 4, '#ffe14a'); R(c, 52, 16, 5, 4, '#ffe14a'); R(c, 43, 16, 2, 4, '#111'); R(c, 53, 16, 2, 4, '#111');
    R(c, 39, 13, 8, 2, '#1f5a2a'); R(c, 51, 13, 8, 2, '#1f5a2a');
    R(c, 45, 25, 2, 2, '#1f5a2a'); R(c, 51, 25, 2, 2, '#1f5a2a');
    R(c, 43, 31, 12, 3 + f, '#2b0f0f'); R(c, 43, 31, 2, 2, '#fff'); R(c, 53, 31, 2, 2, '#fff'); R(c, 46, 33, 6, 1 + f, '#ff6a8a');
  });
  S.knight = build(66, 74, 2, (c, f) => {
    tri(c, 22, 22, 6, 68 + f, 44, 66, '#6a1a2a');
    R(c, 22, 50, 8, 18 - f, '#2c2c40'); R(c, 36, 50, 8, 16 + f, '#2c2c40'); R(c, 20, 66 - f, 11, 4, '#1c1c2c'); R(c, 35, 64 + f, 11, 4, '#1c1c2c');
    R(c, 21, 26, 24, 24, '#3a3a58'); R(c, 23, 28, 6, 14, '#50507a'); R(c, 21, 46, 24, 4, '#262638');
    R(c, 30, 32, 6, 6, '#8a1a2a'); Px(c, 32, 34, '#ff6a6a');
    E(c, 18, 30, 7, 6, '#4a4a6a'); E(c, 48, 30, 7, 6, '#4a4a6a');
    tri(c, 14, 26, 10, 18, 18, 24, '#2c2c40'); tri(c, 52, 26, 56, 18, 48, 24, '#2c2c40');
    R(c, 11, 34, 6, 14, '#34344a'); R(c, 49, 34, 6, 14, '#34344a');
    E(c, 33, 15, 9, 9, '#34344e'); R(c, 24, 14, 18, 3, '#1c1c2c'); R(c, 26, 14, 14, 2, '#ff3b3b');
    R(c, 32, 17, 2, 6, '#1c1c2c');
    tri(c, 33, 4, 24, -2 + 2, 40, 4, '#ff3b3b'); L(c, 33, 7, 33, 2, '#ff3b3b', 3);
    R(c, 57, 6 - f, 4, 44, '#b8bfcf'); R(c, 58, 8 - f, 1, 38, '#fff'); R(c, 53, 50 - f, 12, 3, '#f5c84a'); R(c, 57, 53 - f, 4, 7, '#8b5a33');
    tri(c, 57, 6 - f, 61, 6 - f, 59, 0, '#e8edf6');
    E(c, 6, 42, 6, 10, '#3a3a5a'); R(c, 3, 38, 6, 8, '#8a1a2a'); Px(c, 5, 41, '#ff9a9a');
  });
  S.cateater = build(106, 106, 2, (c, f) => {
    const dk = '#1d1530', md = '#2e2250';
    for (let i = 0; i < 7; i++) {
      const x = 14 + i * 13;
      L(c, x, 84, x + (i % 2 ? 4 : -4) + (f ? 3 : -3), 100, dk, 5);
    }
    tri(c, 14, 40, 12, 4, 42, 24, dk); tri(c, 92, 40, 94, 4, 64, 24, dk);
    tri(c, 19, 34, 18, 12, 34, 26, '#6a2a5a'); tri(c, 87, 34, 88, 12, 72, 26, '#6a2a5a');
    E(c, 53, 56, 42, 34, dk);
    for (let i = 0; i < 90; i++) { const x = 14 + ((i * 37) % 78), y = 28 + ((i * 53) % 56); if (((x - 53) ** 2) / 1600 + ((y - 56) ** 2) / 1000 < 1) Px(c, x, y, md); }
    for (const s of [0, 1]) {
      const X = (x: number) => (s ? 105 - x : x);
      E(c, X(34), 46, 10, 7, '#d8ff3a'); E(c, X(34), 46, 6, 5, '#f4ffa0');
      R(c, X(34) - 1, 40, 3, 13, '#111');
      L(c, X(46), 36, X(22), 40, '#0a0612', 3);
      L(c, X(14), 54, X(-4 < 0 ? 0 : 0), 56, '#555', 1);
    }
    E(c, 53, 72, 27, 15, '#12000a'); E(c, 53, 76 + f, 23, 10 + f, '#8a1030'); E(c, 53, 80, 12, 4, '#c0405a');
    for (let i = 0; i < 6; i++) { const x = 32 + i * 8; tri(c, x, 60, x + 8, 60, x + 4, 70, '#fff'); tri(c, x, 88 + f, x + 8, 88 + f, x + 4, 79, '#fff'); }
    R(c, 49, 60, 8, 2, '#12000a');
    for (const y of [60, 64, 68]) { L(c, 4, y - 4, 22, y, '#bbb'); L(c, 101, y - 4, 83, y, '#bbb'); }
  });
}

// ---------------------------------------------------------------- OBJECTS / PROJECTILES
function buildMisc(S: Record<string, Spr>, X: Record<string, Cv>) {
  X.sword = drawSwordCv('steel');
  X.holysword = drawSwordCv('holy');
  X.runesword = drawSwordCv('rune');
  X.bigsword = scaleNN(X.sword, 1.0);
  S.gemB = build(9, 9, 2, (c, f) => gem(c, '#4aa8ff', '#bfe4ff', f));
  S.gemG = build(9, 9, 2, (c, f) => gem(c, '#42e07a', '#c0ffd8', f));
  S.gemR = build(9, 9, 2, (c, f) => gem(c, '#ff5a7a', '#ffc0cc', f));
  S.gemP = build(9, 9, 2, (c, f) => gem(c, '#c36bff', '#ecd0ff', f));
  S.meat = build(14, 12, 1, (c) => {
    E(c, 6, 6, 4, 3, '#c0392b'); E(c, 5, 5, 2, 1, '#e8665a');
    R(c, 9, 5, 4, 2, '#fff'); R(c, 11, 4, 2, 1, '#fff'); R(c, 11, 7, 2, 1, '#fff');
  });
  S.coin = build(10, 10, 3, (c, f) => {
    const rx = [3, 2, 1][f];
    E(c, 5, 5, rx, 3, '#f5c84a');
    if (f < 2) { R(c, 4, 3, 1, 4, '#c08a1e'); }
  });
  S.magnet = build(14, 14, 1, (c) => {
    R(c, 2, 2, 4, 9, '#d9344a'); R(c, 8, 2, 4, 9, '#d9344a'); R(c, 2, 9, 10, 3, '#d9344a');
    R(c, 2, 2, 4, 3, '#e8edf6'); R(c, 8, 2, 4, 3, '#e8edf6'); R(c, 6, 4, 2, 6, '#2a1a2a');
  });
  S.chest = build(20, 18, 2, (c, f) => {
    if (f === 0) {
      R(c, 2, 8, 16, 8, '#8b5a33'); R(c, 2, 4, 16, 5, '#a8703c'); R(c, 3, 3, 14, 2, '#a8703c');
      R(c, 2, 8, 16, 1, '#5a3a1e'); R(c, 8, 7, 4, 4, '#f5c84a'); Px(c, 10, 9, '#2a1a0a');
      R(c, 5, 4, 1, 12, '#f5c84a'); R(c, 14, 4, 1, 12, '#f5c84a');
    } else {
      R(c, 2, 9, 16, 7, '#8b5a33'); R(c, 3, 10, 14, 2, '#ffe680'); R(c, 4, 9, 12, 1, '#fff6c0');
      R(c, 2, 1, 16, 4, '#a8703c'); R(c, 5, 1, 1, 5, '#f5c84a'); R(c, 14, 1, 1, 5, '#f5c84a');
      R(c, 2, 14, 16, 1, '#5a3a1e');
    }
  });
  S.yarn = build(12, 12, 1, (c) => {
    E(c, 6, 6, 4, 4, '#ff7aa8'); L(c, 3, 4, 8, 9, '#c8487c'); L(c, 3, 7, 8, 3, '#c8487c'); L(c, 5, 3, 9, 7, '#ff9ec0'); Px(c, 4, 4, '#ffd0e0');
    L(c, 9, 9, 11, 10, '#ff7aa8');
  });
  S.chaosyarn = build(14, 14, 1, (c) => {
    E(c, 7, 7, 5, 5, '#b05cff'); L(c, 4, 5, 10, 10, '#7a2ac8'); L(c, 4, 9, 10, 4, '#7a2ac8'); L(c, 6, 3, 11, 8, '#d9a0ff'); Px(c, 5, 5, '#f0d8ff');
  });
  S.fish = build(16, 10, 2, (c, f) => {
    E(c, 7, 5, 5, 2, '#6ac8ff'); R(c, 4, 6, 6, 1, '#d6f0ff');
    tri(c, 11, 5, 15, 1 + f, 15, 9 - f, '#3a9ae0'); Px(c, 3, 4, '#111'); tri(c, 6, 3, 8, 0, 9, 3, '#3a9ae0');
  });
  S.fire = build(10, 10, 2, (c, f) => { E(c, 5, 5, 3 + f, 3, '#ff7a2a'); E(c, 5, 5, 2, 2, '#ffd24a'); Px(c, 5, 5, '#fff'); });
  S.bossfire = build(14, 14, 2, (c, f) => { E(c, 7, 7, 5, 5, '#ff4a1a'); E(c, 7, 7, 3 + f, 3 + f, '#ffb02a'); E(c, 7, 7, 1, 1, '#fff'); });
  S.orb = build(10, 10, 2, (c, f) => { E(c, 5, 5, 3, 3, '#b05cff'); E(c, 5, 5, 1 + f, 1 + f, '#f0d8ff'); });
  S.dust = build(8, 8, 2, (c, f) => { E(c, 4, 4, 2 + f, 2, '#9aa0ae'); Px(c, 3, 3, '#d0d4de'); });
  S.bomb = build(14, 14, 2, (c, f) => {
    E(c, 7, 8, 4, 4, '#2c5a3a'); R(c, 5, 6, 2, 2, '#58c878'); L(c, 7, 4, 9, 2, '#8a8a8a'); Px(c, 10, 1 + f, '#ffd24a'); Px(c, 9, 1, '#ff7a2a');
    R(c, 6, 9, 3, 1, '#9affb0');
  });
  S.paw = build(34, 38, 1, (c) => {
    const p = '#ffc2d8', d = '#ff8fb4';
    E(c, 17, 26, 10, 8, p); E(c, 17, 27, 7, 5, d);
    E(c, 6, 16, 4, 5, p); E(c, 15, 9, 4, 6, p); E(c, 24, 9, 4, 6, p); E(c, 31, 16, 3, 5, p);
    E(c, 6, 17, 2, 3, d); E(c, 15, 10, 2, 4, d); E(c, 24, 10, 2, 4, d); E(c, 30, 17, 1, 3, d);
  }, '#ff6a9a');
  S.dragonP = build(20, 18, 2, (c, f) => {
    if (f) tri(c, 9, 8, 2, 12, 7, 4, '#ff9a4a'); else tri(c, 9, 8, 2, 2, 7, 12, '#ff9a4a');
    E(c, 10, 9, 4, 3, '#ff6a2a'); E(c, 14, 6, 3, 2, '#ff7a3a'); Px(c, 15, 5, '#222'); R(c, 16, 7, 2, 1, '#ffd24a');
    L(c, 6, 10, 2, 13, '#ff6a2a', 2); Px(c, 13, 3, '#ffe0a0');
  });
  S.stormP = build(26, 22, 2, (c, f) => {
    if (f) tri(c, 12, 10, 1, 16, 9, 4, '#5ad8ff'); else tri(c, 12, 10, 1, 2, 9, 15, '#5ad8ff');
    if (f) tri(c, 14, 10, 25, 16, 17, 4, '#5ad8ff'); else tri(c, 14, 10, 25, 2, 17, 15, '#5ad8ff');
    E(c, 13, 11, 5, 4, '#2a6ac8'); E(c, 17, 7, 3, 3, '#3a8af0'); Px(c, 18, 6, '#fff'); R(c, 19, 8, 3, 1, '#ffe14a');
    L(c, 8, 12, 2, 17, '#2a6ac8', 2); Px(c, 15, 4, '#fff7b0');
  });
  S.shield = build(12, 14, 1, (c) => {
    R(c, 1, 1, 10, 7, '#d9e0ec'); tri(c, 1, 8, 11, 8, 6, 13, '#d9e0ec');
    R(c, 5, 2, 2, 9, '#f5c84a'); R(c, 2, 4, 8, 2, '#f5c84a'); R(c, 1, 1, 10, 1, '#fff');
    R(c, 9, 2, 2, 6, '#8f9bb0');
  });
  S.bone = build(10, 10, 2, (c, f) => { L(c, 2, 2 + f, 8, 8 - f, '#ece6d3', 2); Px(c, 1, 1, '#ece6d3'); Px(c, 9, 9, '#ece6d3'); });
  S.hairball = build(12, 12, 2, (c, f) => { E(c, 6, 6, 4, 4, '#a89888'); for (let i = 0; i < 6; i++) Px(c, 3 + ((i * 5 + f * 3) % 7), 3 + ((i * 3 + f) % 7), i % 2 ? '#d8cbb8' : '#7a6a5a'); Px(c, 8, 4, '#4a3a2a'); });
  S.bullet = build(8, 6, 1, (c) => { R(c, 1, 1, 5, 3, '#ffe680'); Px(c, 6, 2, '#fff'); R(c, 0, 2, 2, 1, '#ff9a3a'); });
  S.catarang = build(16, 16, 1, (c) => { L(c, 2, 12, 8, 3, '#ff7aa8', 3); L(c, 8, 3, 14, 12, '#ff7aa8', 3); Px(c, 8, 3, '#fff'); Px(c, 3, 11, '#ffd0e0'); Px(c, 13, 11, '#ffd0e0'); R(c, 7, 6, 2, 2, '#ffe680'); });
  S.marbleA = build(10, 10, 1, (c) => { E(c, 5, 5, 3, 3, '#4aa8ff'); Px(c, 4, 4, '#fff'); Px(c, 6, 6, '#2a68c8'); });
  S.marbleB = build(10, 10, 1, (c) => { E(c, 5, 5, 3, 3, '#ff6aa0'); Px(c, 4, 4, '#fff'); Px(c, 6, 6, '#c8306a'); });
  S.marbleC = build(10, 10, 1, (c) => { E(c, 5, 5, 3, 3, '#58e08a'); Px(c, 4, 4, '#fff'); Px(c, 6, 6, '#2a9a50'); });
  S.mouse = build(14, 10, 2, (c, f) => { E(c, 7, 6, 4, 2, '#b8b4c4'); E(c, 3, 5, 2, 2, '#c8c4d4'); Px(c, 2, 5, '#222'); Px(c, 3, 3, '#f0a0b4'); Px(c, 0, 6, '#f0a0b4'); L(c, 11, 6, 13, 4, '#f0a0b4'); R(c, 5, 8, 1, 1 + f, '#6a6a7a'); R(c, 9, 8, 1, 2 - f, '#6a6a7a'); R(c, 6, 1, 1, 3, '#ffd24a'); R(c, 5 + f, 1, 3, 1, '#ffd24a'); });
  S.pellet = build(6, 6, 1, (c) => { E(c, 3, 3, 1, 1, '#f0ecff'); Px(c, 2, 2, '#fff'); });
  S.twister = build(20, 24, 2, (c, f) => { for (let y = 0; y < 20; y++) { const w = 3 + Math.floor(y * 0.45); const off = Math.round(Math.sin(y * 0.6 + f * 1.7) * 2); R(c, 10 - Math.floor(w / 2) + off, 2 + y, w, 1, y % 3 === f ? '#e8eefc' : '#a8b8d8'); } Px(c, 8, 22, '#d8e0f0'); }, '#4a5a7a');
  S.dice = build(10, 10, 6, (c, f) => { R(c, 1, 1, 8, 8, '#ffffff'); R(c, 1, 8, 8, 1, '#c8c8d8'); const dots: Record<number, number[][]> = { 0: [[4, 4]], 1: [[2, 2], [6, 6]], 2: [[2, 2], [4, 4], [6, 6]], 3: [[2, 2], [6, 2], [2, 6], [6, 6]], 4: [[2, 2], [6, 2], [4, 4], [2, 6], [6, 6]], 5: [[2, 2], [6, 2], [2, 4], [6, 4], [2, 6], [6, 6]] }; for (const [x, y] of dots[f]) R(c, x, y, 2, 2, f === 5 ? '#e0304a' : '#222'); });
  S.flask = build(12, 14, 1, (c) => { R(c, 4, 1, 4, 3, '#c8d8e8'); E(c, 6, 9, 4, 4, '#b8e83a'); R(c, 4, 4, 4, 2, '#c8d8e8'); Px(c, 4, 8, '#f0ffb0'); Px(c, 8, 10, '#6a9a1a'); });
  S.scratcher = build(18, 18, 1, (c) => { R(c, 7, 1, 4, 16, '#d8b078'); R(c, 1, 7, 16, 4, '#d8b078'); R(c, 7, 7, 4, 4, '#a07840'); for (let i = 2; i < 16; i += 3) { Px(c, i, 8, '#8a6030'); Px(c, 8, i, '#8a6030'); } Px(c, 1, 8, '#ff7aa8'); Px(c, 16, 9, '#ff7aa8'); });
  S.leaf = build(8, 8, 1, (c) => { tri(c, 1, 6, 6, 1, 6, 6, '#58c878'); });
}
function gem(c: C, col: string, hi: string, f: number) {
  for (let dy = -3; dy <= 3; dy++) { const w = 4 - Math.abs(dy); R(c, 4 - w + 1, 4 + dy, w * 2 - 1, 1, col); }
  Px(c, 3, 3, hi); Px(c, 4, 2, hi);
  if (f) { Px(c, 4, 0, '#fff'); Px(c, 1, 4, '#fff'); Px(c, 7, 4, '#fff'); }
}

// ---------------------------------------------------------------- WORLD DECOR
export interface Decor { cv: Cv; shadow: number }
function buildDecor(D: Record<string, Cv[]>) {
  const green = '#1c3a26';
  D.tree = [0, 1, 2].map((v) =>
    buildCv(30, 40, (c) => {
      R(c, 13, 24, 5, 13, '#6b4423'); R(c, 13, 24, 2, 13, '#8a5a34'); R(c, 11, 35, 9, 2, '#4a2e18');
      const cols = v === 2 ? ['#b8641e', '#d9822a', '#f0a43a'] : ['#2d6a3a', '#3f8a46', '#5aa855'];
      E(c, 15, 18, 12, 10, cols[0]); E(c, 15, 13, 10, 9, cols[1]); E(c, 14, 8, 7, 6, cols[2]);
      for (let i = 0; i < 14; i++) Px(c, 5 + ((i * 7) % 20), 6 + ((i * 11) % 18), cols[0]);
      Px(c, 11, 6, '#c8f0a0'); Px(c, 12, 5, '#c8f0a0'); Px(c, 17, 9, '#c8f0a0');
    }, green),
  );
  D.pine = [0].map(() =>
    buildCv(22, 40, (c) => {
      R(c, 9, 31, 4, 6, '#6b4423');
      tri(c, 11, 2, 1, 16, 21, 16, '#2a5a3a'); tri(c, 11, 9, 0, 25, 22, 25, '#2f6a40'); tri(c, 11, 17, -1, 33, 23, 33, '#367a48');
      Px(c, 9, 8, '#7fc08a'); Px(c, 7, 17, '#7fc08a'); Px(c, 6, 26, '#7fc08a');
    }, green),
  );
  D.bush = [0, 1].map((v) =>
    buildCv(18, 14, (c) => {
      E(c, 9, 8, 7, 4, '#2d6a3a'); E(c, 7, 6, 4, 3, '#3f8a46'); E(c, 12, 7, 4, 3, '#3f8a46');
      Px(c, 6, 5, '#7fd078');
      if (v) { Px(c, 10, 6, '#ff6a8a'); Px(c, 5, 8, '#ff6a8a'); Px(c, 13, 8, '#ff6a8a'); }
    }, green),
  );
  D.rock = [0, 1, 2].map((v) =>
    buildCv(14, 11, (c) => {
      E(c, 7, 6, 4 + (v === 1 ? 1 : 0), 3, '#8f97a8'); E(c, 6, 5, 2, 1, '#b8c0d0'); R(c, 4, 8, 7, 1, '#6a7184');
      if (v === 2) { Px(c, 9, 4, '#5aa855'); Px(c, 10, 5, '#5aa855'); }
    }, '#2a2f40'),
  );
  D.flower = ['#ff6a8a', '#ffe14a', '#ffffff', '#8ac8ff', '#c36bff'].map((col) =>
    buildCv(7, 8, (c) => {
      Px(c, 3, 5, '#3f8a46'); Px(c, 3, 6, '#3f8a46'); Px(c, 2, 5, '#5aa855');
      Px(c, 3, 2, col); Px(c, 2, 3, col); Px(c, 4, 3, col); Px(c, 3, 4, col); Px(c, 3, 3, '#ffe14a');
    }, null),
  );
  D.mush = [0, 1].map((v) =>
    buildCv(9, 9, (c) => {
      R(c, 3, 5, 2, 3, '#f0e8d0'); E(c, 4, 4, 3, 2, v ? '#d9344a' : '#c8884a'); Px(c, 3, 3, '#fff'); Px(c, 5, 4, '#fff');
    }, '#2a1a1a'),
  );
  D.branch = [0].map(() =>
    buildCv(14, 7, (c) => { L(c, 1, 5, 12, 3, '#6b4423', 2); L(c, 6, 4, 8, 1, '#6b4423'); Px(c, 11, 2, '#5aa855'); }, '#2a1a10'),
  );
  D.tuft = [0, 1].map((v) =>
    buildCv(8, 7, (c) => { L(c, 1, 5, 2, 1, '#4e8a3d'); L(c, 3, 5, 3 + v, 0, '#6aa84f'); L(c, 5, 5, 6, 2, '#4e8a3d'); }, null),
  );
  D.pillar = [0, 1].map((v) =>
    buildCv(14, 30, (c) => {
      const h = v ? 18 : 25;
      R(c, 2, 28 - h, 10, h, '#a8aebf'); R(c, 2, 28 - h, 3, h, '#c8cedc'); R(c, 9, 28 - h, 3, h, '#7a8196');
      R(c, 0, 26, 14, 3, '#8a90a2'); R(c, 0, 28 - h - 2, 14, 3, '#8a90a2');
      for (let y = 28 - h + 3; y < 24; y += 5) R(c, 2, y, 10, 1, '#7a8196');
      if (v) { Px(c, 4, 28 - h - 1, '#5aa855'); }
      Px(c, 6, 18, '#5aa855'); Px(c, 7, 19, '#5aa855');
    }, '#2a2f40'),
  );
  D.wall = [0, 1].map((v) =>
    buildCv(26, 18, (c) => {
      R(c, 1, 5, 24, 11, '#9aa0b4');
      for (let y = 5; y < 16; y += 4) for (let x = 1 + ((y / 4) % 2) * 3; x < 25; x += 6) R(c, x, y, 5, 3, '#b0b6c8');
      if (v) { tri(c, 1, 5, 9, 5, 5, 0, '#9aa0b4'); R(c, 14, 3, 11, 2, '#9aa0b4'); } else { R(c, 1, 2, 8, 3, '#9aa0b4'); }
      Px(c, 12, 6, '#5aa855'); Px(c, 13, 7, '#5aa855'); Px(c, 20, 5, '#5aa855');
    }, '#2a2f40'),
  );
  D.grave = [0, 1].map((v) =>
    buildCv(13, 17, (c) => {
      if (v) { R(c, 5, 2, 3, 12, '#9aa0b4'); R(c, 2, 5, 9, 3, '#9aa0b4'); R(c, 5, 2, 1, 12, '#c0c6d8'); }
      else { E(c, 6, 6, 4, 4, '#9aa0b4'); R(c, 2, 6, 9, 8, '#9aa0b4'); R(c, 3, 5, 2, 3, '#c0c6d8'); R(c, 5, 7, 3, 1, '#6a7184'); R(c, 5, 9, 3, 1, '#6a7184'); }
      R(c, 1, 14, 11, 2, '#5aa855');
    }, '#2a2f40'),
  );
  D.stump = [0].map(() => buildCv(12, 10, (c) => { R(c, 2, 3, 8, 5, '#8a5a34'); E(c, 6, 3, 4, 2, '#c8985a'); Px(c, 5, 3, '#8a5a34'); Px(c, 7, 3, '#8a5a34'); }, '#2a1a10'));
}

// ---------------------------------------------------------------- ICONS (14x14)
function buildIcons(I: Record<string, Cv>) {
  const ic = (id: string, draw: (c: C) => void) => (I[id] = buildCv(14, 14, draw));
  const sword = (c: C, bl = '#dfe6f2', hl = '#fff') => { L(c, 3, 10, 10, 3, bl, 2); L(c, 3, 10, 9, 4, hl); L(c, 2, 8, 5, 11, '#f5c84a', 1); L(c, 1, 12, 3, 10, '#8b5a33', 2); };
  ic('sword', (c) => sword(c));
  ic('yarn', (c) => { E(c, 7, 7, 5, 5, '#ff7aa8'); L(c, 4, 5, 10, 10, '#c8487c'); L(c, 4, 9, 10, 4, '#c8487c'); L(c, 6, 3, 11, 8, '#ff9ec0'); });
  ic('paw', (c) => { E(c, 7, 9, 4, 3, '#ffb6d0'); E(c, 2, 5, 1, 2, '#ffb6d0'); E(c, 5, 3, 1, 2, '#ffb6d0'); E(c, 9, 3, 1, 2, '#ffb6d0'); E(c, 12, 5, 1, 2, '#ffb6d0'); });
  ic('fish', (c) => { E(c, 6, 7, 5, 3, '#6ac8ff'); tri(c, 10, 7, 13, 3, 13, 11, '#3a9ae0'); Px(c, 3, 6, '#111'); R(c, 4, 8, 5, 1, '#d6f0ff'); });
  ic('hiss', (c) => { E(c, 7, 7, 5, 5, '#ffd24a'); E(c, 7, 7, 3, 3, '#1b1424'); L(c, 4, 7, 10, 7, '#ffd24a'); L(c, 7, 4, 7, 10, '#ffd24a'); });
  ic('shield', (c) => { R(c, 3, 2, 8, 6, '#d9e0ec'); tri(c, 3, 8, 11, 8, 7, 13, '#d9e0ec'); R(c, 6, 3, 2, 8, '#f5c84a'); R(c, 4, 5, 6, 2, '#f5c84a'); });
  ic('dash', (c) => { R(c, 6, 4, 6, 5, '#d9e0ec'); R(c, 6, 9, 7, 3, '#8f9bb0'); L(c, 1, 5, 4, 5, '#9ae0ff'); L(c, 0, 8, 4, 8, '#9ae0ff'); L(c, 2, 11, 5, 11, '#9ae0ff'); });
  ic('lightning', (c) => { tri(c, 8, 1, 3, 8, 8, 7, '#ffe14a'); tri(c, 6, 13, 11, 6, 6, 7, '#ffe14a'); Px(c, 8, 3, '#fff'); });
  ic('dragon', (c) => { tri(c, 6, 6, 1, 1, 5, 10, '#ff9a4a'); E(c, 7, 8, 4, 3, '#ff6a2a'); E(c, 10, 5, 2, 2, '#ff7a3a'); Px(c, 11, 4, '#111'); L(c, 3, 10, 1, 12, '#ff6a2a', 2); R(c, 12, 6, 2, 1, '#ffd24a'); });
  ic('bomb', (c) => { E(c, 7, 8, 4, 4, '#2c5a3a'); R(c, 5, 6, 2, 2, '#58c878'); L(c, 8, 4, 10, 2, '#9a9a9a'); Px(c, 11, 1, '#ffd24a'); Px(c, 10, 1, '#ff7a2a'); });
  ic('holyclaws', (c) => { sword(c, '#fff3b8', '#fff'); L(c, 9, 12, 12, 9, '#ffd24a'); Px(c, 11, 2, '#fff'); Px(c, 2, 2, '#fff'); });
  ic('chaosyarn', (c) => { E(c, 7, 7, 5, 5, '#b05cff'); L(c, 4, 5, 10, 10, '#7a2ac8'); L(c, 4, 9, 10, 4, '#7a2ac8'); Px(c, 11, 2, '#ffb6d0'); Px(c, 2, 11, '#ffb6d0'); });
  ic('fishapoc', (c) => { E(c, 5, 5, 3, 2, '#6ac8ff'); tri(c, 8, 5, 10, 3, 10, 7, '#3a9ae0'); E(c, 8, 10, 3, 2, '#ffd24a'); tri(c, 11, 10, 13, 8, 13, 12, '#c08a1e'); Px(c, 3, 4, '#111'); Px(c, 6, 9, '#111'); });
  ic('stormdragon', (c) => { tri(c, 6, 6, 1, 1, 5, 10, '#5ad8ff'); E(c, 7, 8, 4, 3, '#2a6ac8'); E(c, 10, 5, 2, 2, '#3a8af0'); tri(c, 9, 9, 7, 13, 12, 10, '#ffe14a'); Px(c, 11, 4, '#fff'); });
  ic('cataclysm', (c) => { E(c, 7, 8, 4, 4, '#2c5a3a'); L(c, 1, 2, 4, 5, '#ff7a2a'); L(c, 13, 2, 10, 5, '#ff7a2a'); L(c, 7, 0, 7, 3, '#ffd24a'); R(c, 5, 6, 2, 2, '#58c878'); Px(c, 6, 11, '#ffd24a'); });
  // passives
  ic('collar', (c) => { R(c, 2, 6, 10, 3, '#d9344a'); R(c, 2, 6, 10, 1, '#ff7a8a'); E(c, 7, 11, 2, 2, '#f5c84a'); Px(c, 7, 10, '#fff'); });
  ic('boots', (c) => { R(c, 3, 2, 5, 8, '#8b5a33'); R(c, 3, 9, 9, 3, '#8b5a33'); R(c, 3, 2, 5, 2, '#b8803f'); R(c, 3, 11, 9, 1, '#4a2e18'); });
  ic('cape', (c) => { R(c, 3, 2, 8, 2, '#f5c84a'); tri(c, 3, 4, 11, 4, 7, 13, '#f6efdc'); tri(c, 3, 4, 7, 4, 4, 13, '#cdbd9a'); });
  ic('armor', (c) => { R(c, 3, 3, 8, 8, '#d9e0ec'); R(c, 1, 3, 3, 3, '#8f9bb0'); R(c, 10, 3, 3, 3, '#8f9bb0'); R(c, 4, 4, 2, 5, '#fff'); R(c, 3, 9, 8, 1, '#8b5a33'); R(c, 4, 11, 6, 2, '#4f5a73'); });
  ic('snack', (c) => { E(c, 6, 7, 4, 3, '#ffb347'); tri(c, 9, 7, 13, 3, 13, 11, '#ff8a3a'); Px(c, 3, 6, '#111'); R(c, 4, 8, 4, 1, '#ffe0a0'); });
  ic('bell', (c) => { E(c, 7, 7, 4, 4, '#f5c84a'); R(c, 3, 9, 9, 2, '#f5c84a'); R(c, 6, 3, 2, 2, '#c08a1e'); Px(c, 7, 12, '#4a2e18'); Px(c, 5, 5, '#fff7b0'); });
  ic('claws', (c) => { for (let i = 0; i < 3; i++) L(c, 3 + i * 3, 2, 1 + i * 3, 11, '#e8edf6', 2); R(c, 1, 11, 9, 2, '#a8703c'); });
  ic('bigpaws', (c) => { E(c, 7, 9, 5, 4, '#f6deb0'); E(c, 2, 5, 1, 2, '#f6deb0'); E(c, 5, 3, 1, 2, '#f6deb0'); E(c, 9, 3, 1, 2, '#f6deb0'); E(c, 12, 5, 1, 2, '#f6deb0'); E(c, 7, 10, 2, 2, '#f08fa6'); });
  ic('catnip', (c) => { tri(c, 2, 11, 10, 2, 11, 10, '#58c878'); L(c, 2, 12, 9, 5, '#2c7a44'); Px(c, 10, 3, '#9affb0'); });
  ic('heart', (c) => { E(c, 4, 5, 2, 2, '#ff4a6a'); E(c, 9, 5, 2, 2, '#ff4a6a'); tri(c, 1, 6, 12, 6, 7, 12, '#ff4a6a'); Px(c, 4, 4, '#ffb0c0'); });
  ic('feather', (c) => { tri(c, 2, 12, 12, 1, 11, 9, '#8ac8ff'); L(c, 2, 12, 11, 3, '#e8f4ff'); Px(c, 8, 8, '#4a98e8'); });
  ic('bow', (c) => { L(c, 3, 2, 3, 12, '#8b5a33', 2); L(c, 3, 2, 9, 7, '#8b5a33'); L(c, 3, 12, 9, 7, '#8b5a33'); L(c, 3, 7, 12, 7, '#e8edf6'); tri(c, 12, 5, 12, 9, 13, 7, '#e8edf6'); });
  ic('milk', (c) => { R(c, 4, 4, 6, 9, '#f6f0e0'); R(c, 4, 2, 6, 3, '#6ac8ff'); R(c, 4, 7, 6, 2, '#ffd0e0'); Px(c, 5, 5, '#fff'); });
  ic('hairball', (c) => { E(c, 7, 7, 5, 5, '#a89888'); for (let i = 0; i < 9; i++) Px(c, 3 + ((i * 5) % 9), 3 + ((i * 3) % 9), i % 2 ? '#d8cbb8' : '#7a6a5a'); Px(c, 10, 5, '#4a3a2a'); });
  ic('marbles', (c) => { E(c, 4, 4, 2, 2, '#4aa8ff'); E(c, 10, 5, 2, 2, '#ff6aa0'); E(c, 6, 10, 2, 2, '#58e08a'); Px(c, 3, 3, '#fff'); Px(c, 9, 4, '#fff'); Px(c, 5, 9, '#fff'); });
  ic('blaster', (c) => { R(c, 2, 5, 9, 4, '#8f9bb0'); R(c, 4, 9, 3, 4, '#4f5a73'); R(c, 11, 6, 2, 2, '#ffe680'); R(c, 3, 5, 5, 1, '#d9e0ec'); Px(c, 1, 6, '#ff9a3a'); });
  ic('catarang', (c) => { L(c, 2, 11, 7, 3, '#ff7aa8', 3); L(c, 7, 3, 12, 11, '#ff7aa8', 3); Px(c, 7, 3, '#fff'); R(c, 6, 6, 2, 2, '#ffe680'); });
  ic('scratcher', (c) => { R(c, 6, 1, 3, 12, '#d8b078'); R(c, 1, 6, 12, 3, '#d8b078'); R(c, 6, 6, 3, 3, '#a07840'); Px(c, 1, 7, '#ff7aa8'); });
  ic('laser', (c) => { R(c, 2, 8, 6, 4, '#8f9bb0'); R(c, 7, 9, 3, 2, '#e0304a'); L(c, 10, 10, 13, 5, '#ff4d4d'); E(c, 12, 4, 1, 1, '#ff4d4d'); Px(c, 4, 9, '#fff'); });
  ic('mouse', (c) => { E(c, 7, 8, 4, 3, '#b8b4c4'); E(c, 3, 7, 2, 2, '#c8c4d4'); Px(c, 2, 7, '#222'); Px(c, 4, 4, '#f0a0b4'); L(c, 11, 8, 13, 5, '#f0a0b4'); R(c, 6, 1, 2, 4, '#ffd24a'); R(c, 4, 2, 6, 1, '#ffd24a'); });
  ic('shotgun', (c) => { R(c, 1, 6, 11, 3, '#8a5a34'); R(c, 1, 5, 7, 1, '#d9e0ec'); R(c, 9, 9, 3, 3, '#4f5a73'); for (let i = 0; i < 3; i++) Px(c, 12, 4 + i * 3, '#f0ecff'); });
  ic('milk2', (c) => { R(c, 4, 4, 6, 9, '#bfe8ff'); R(c, 4, 2, 6, 3, '#6ac8ff'); R(c, 5, 6, 4, 5, '#fff'); Px(c, 2, 3, '#e8faff'); Px(c, 11, 8, '#e8faff'); Px(c, 7, 1, '#e8faff'); });
  ic('twister', (c) => { for (let y = 0; y < 11; y++) { const w = 3 + Math.floor(y * 0.7); R(c, 7 - Math.floor(w / 2) + Math.round(Math.sin(y) * 1), 1 + y, w, 1, y % 2 ? '#e8eefc' : '#a8b8d8'); } });
  ic('voidbox', (c) => { R(c, 2, 4, 10, 8, '#a8782e'); R(c, 2, 4, 10, 2, '#c8984e'); E(c, 7, 8, 3, 2, '#120a1e'); Px(c, 6, 7, '#9a6aff'); Px(c, 8, 9, '#9a6aff'); });
  ic('flask', (c) => { R(c, 5, 1, 4, 3, '#c8d8e8'); E(c, 7, 9, 4, 4, '#b8e83a'); R(c, 5, 4, 4, 2, '#c8d8e8'); Px(c, 5, 8, '#f0ffb0'); });
  ic('dice', (c) => { R(c, 2, 2, 10, 10, '#fff'); for (const [x, y] of [[4, 4], [9, 4], [4, 9], [9, 9], [6, 6]]) R(c, x, y, 2, 2, '#e0304a'); });
  ic('purr', (c) => { E(c, 7, 7, 5, 5, '#ff9ec0'); E(c, 7, 7, 3, 3, '#1b1424'); E(c, 7, 7, 1, 1, '#ffd0e0'); Px(c, 1, 7, '#fff'); Px(c, 12, 7, '#fff'); Px(c, 7, 1, '#fff'); Px(c, 7, 12, '#fff'); });
  ic('coat', (c) => { R(c, 3, 3, 8, 9, '#f6efdc'); R(c, 1, 3, 3, 5, '#cdbd9a'); R(c, 10, 3, 3, 5, '#cdbd9a'); R(c, 6, 3, 2, 9, '#6ac8ff'); for (let y = 4; y < 12; y += 2) Px(c, 4, y, '#fff'); });
  ic('nimble', (c) => { L(c, 2, 11, 5, 4, '#f6deb0', 2); L(c, 5, 4, 10, 3, '#f6deb0', 2); L(c, 10, 3, 12, 6, '#a96d3f', 2); Px(c, 11, 2, '#f08fa6'); });
  ic('spiky', (c) => { R(c, 2, 6, 10, 3, '#d9344a'); for (let x = 2; x < 12; x += 3) { tri(c, x, 6, x + 2, 6, x + 1, 2, '#d9e0ec'); tri(c, x, 9, x + 2, 9, x + 1, 13, '#d9e0ec'); } });
  ic('tuna', (c) => { E(c, 6, 7, 5, 3, '#4a78c8'); R(c, 3, 8, 7, 1, '#d8e8ff'); tri(c, 10, 7, 13, 4, 13, 10, '#2a58a8'); Px(c, 3, 6, '#fff'); Px(c, 3, 6, '#111'); Px(c, 7, 11, '#ff4a6a'); });
  ic('spool', (c) => { R(c, 3, 2, 8, 2, '#c8984e'); R(c, 3, 10, 8, 2, '#c8984e'); R(c, 4, 4, 6, 6, '#ff7aa8'); for (let y = 4; y < 10; y += 2) R(c, 4, y, 6, 1, '#c8487c'); });
  ic('pounce', (c) => { E(c, 7, 8, 5, 4, '#f6deb0'); E(c, 3, 4, 1, 2, '#f6deb0'); E(c, 6, 3, 1, 2, '#f6deb0'); E(c, 9, 3, 1, 2, '#f6deb0'); E(c, 12, 5, 1, 2, '#f6deb0'); R(c, 4, 10, 6, 3, '#d9344a'); });
  ic('purse', (c) => { E(c, 7, 9, 5, 4, '#8b5a33'); R(c, 5, 3, 4, 3, '#8b5a33'); R(c, 4, 5, 6, 1, '#f5c84a'); E(c, 7, 9, 2, 2, '#f5c84a'); });
  ic('charm', (c) => { E(c, 7, 8, 5, 4, '#2a2238'); tri(c, 3, 6, 3, 1, 6, 4, '#2a2238'); tri(c, 11, 6, 11, 1, 8, 4, '#2a2238'); R(c, 4, 7, 2, 2, '#d8ff3a'); R(c, 9, 7, 2, 2, '#d8ff3a'); });
  ic('chaos', (c) => { R(c, 2, 4, 10, 8, '#a8782e'); R(c, 2, 4, 10, 2, '#c8984e'); R(c, 6, 7, 2, 1, '#fff'); Px(c, 7, 8, '#fff'); Px(c, 7, 10, '#fff'); Px(c, 5, 2, '#ff6aa0'); Px(c, 9, 1, '#6ac8ff'); });
  // misc
  ic('coin', (c) => { E(c, 7, 7, 5, 5, '#f5c84a'); E(c, 7, 7, 3, 3, '#ffe680'); R(c, 6, 5, 2, 5, '#c08a1e'); });
  ic('skull', (c) => { E(c, 7, 6, 5, 5, '#ece6d3'); R(c, 4, 10, 6, 3, '#ece6d3'); R(c, 4, 5, 2, 2, '#222'); R(c, 8, 5, 2, 2, '#222'); Px(c, 7, 8, '#555'); });
  ic('clock', (c) => { E(c, 7, 7, 5, 5, '#e8edf6'); L(c, 7, 7, 7, 3, '#222'); L(c, 7, 7, 10, 8, '#222'); });
  ic('gem', (c) => { gem(c, '#4aa8ff', '#bfe4ff', 0); });
  ic('meat', (c) => { E(c, 6, 8, 4, 3, '#c0392b'); R(c, 9, 7, 4, 2, '#fff'); R(c, 11, 6, 2, 1, '#fff'); R(c, 11, 9, 2, 1, '#fff'); });
  ic('chest', (c) => { R(c, 2, 6, 10, 6, '#8b5a33'); R(c, 2, 3, 10, 4, '#a8703c'); R(c, 6, 5, 2, 3, '#f5c84a'); });
  ic('locked', (c) => { R(c, 3, 6, 8, 6, '#6a7184'); R(c, 5, 2, 4, 5, '#8f9bb0'); R(c, 6, 3, 2, 3, '#1b1424'); R(c, 6, 8, 2, 2, '#1b1424'); });
}

// ---------------------------------------------------------------- REGISTRY
export const S: Record<string, Spr> = {};
export const X: Record<string, Cv> = {};
export const ICON: Record<string, Cv> = {};
export const DECOR: Record<string, Cv[]> = {};
const eliteCache: Record<string, Spr> = {};
let built = false;

export function ensureSprites() {
  if (built) return;
  built = true;
  S.kitten = buildKitten();
  buildEnemies(S);
  buildBosses(S);
  buildMisc(S, X);
  buildDecor(DECOR);
  buildIcons(ICON);
}

export function eliteSpr(id: string): Spr {
  if (eliteCache[id]) return eliteCache[id];
  const base = S[id];
  const frames = base.f.map((f) => {
    const big = pad(scaleNN(f, 1.4), 2);
    const o = mk(big.width, big.height);
    ctxOf(o).drawImage(big, 0, 0);
    return outline(o, '#ffd24a');
  });
  return (eliteCache[id] = derive(frames));
}

export function drawSpr(ctx: C, spr: Spr, frame: number, cx: number, cy: number, flipRight: boolean, flash = false) {
  const set = flash ? (flipRight ? spr.wl : spr.w) : flipRight ? spr.fl : spr.f;
  const cv = set[frame % set.length];
  ctx.drawImage(cv, Math.round(cx - cv.width / 2), Math.round(cy - cv.height / 2));
}
export function drawCv(ctx: C, cv: Cv, cx: number, cy: number) {
  ctx.drawImage(cv, Math.round(cx - cv.width / 2), Math.round(cy - cv.height / 2));
}

/** Replace procedural art with PNGs listed in public/assets/manifest.json (written by tools/import_sheet.ts). */
export async function loadOverrides(base = 'assets/'): Promise<number> {
  let manifest: any;
  try {
    const r = await fetch(base + 'manifest.json', { cache: 'no-cache' });
    if (!r.ok) return 0;
    manifest = await r.json();
  } catch {
    return 0;
  }
  ensureSprites();
  const load = (url: string) => new Promise<Cv | null>((res) => {
    const im = new Image();
    im.onload = () => { const c = mk(im.width, im.height); ctxOf(c).drawImage(im, 0, 0); res(c); };
    im.onerror = () => res(null);
    im.src = base + url;
  });
  const got: Record<string, Cv[]> = {};
  await Promise.all(Object.entries(manifest.sprites || {}).map(async ([id, files]) => {
    const cvs = (await Promise.all((files as string[]).map(load))).filter(Boolean) as Cv[];
    if (cvs.length) got[id] = cvs;
  }));
  let n = 0;
  for (const [id, cvs] of Object.entries(got)) {
    if (id === 'kitten_dead') continue;
    if (id === 'kitten') {
      const frames = cvs.slice();
      while (frames.length < 6) frames.push(frames[frames.length - 1]);
      frames.push(got.kitten_dead ? got.kitten_dead[0] : S.kitten.f[6]);
      S.kitten = derive(frames);
      const fist = manifest.meta?.kitten?.fist;
      if (fist) { KG.x = fist[0]; KG.y = fist[1]; }
    } else if (X[id] !== undefined) X[id] = cvs[0];
    else if (S[id]) { const fr = cvs.slice(); while (fr.length < Math.min(2, S[id].f.length)) fr.push(fr[0]); S[id] = derive(fr); }
    else if (id.startsWith('icon_')) ICON[id.slice(5)] = cvs[0];
    else if (id.startsWith('decor_') && DECOR[id.slice(6)]) DECOR[id.slice(6)] = cvs;
    else continue;
    n++;
  }
  for (const k of Object.keys(eliteCache)) delete eliteCache[k];
  for (const k of Object.keys(urlCache)) delete urlCache[k];
  return n;
}

const urlCache: Record<string, string> = {};
export function iconURL(id: string): string {
  ensureSprites();
  if (urlCache['i' + id]) return urlCache['i' + id];
  const cv = ICON[id] || ICON.locked;
  return (urlCache['i' + id] = cv.toDataURL());
}
export function spriteURL(id: string, frame = 0): { url: string; w: number; h: number } {
  ensureSprites();
  const cv = (S[id] || S.rat).f[frame];
  const k = 's' + id + frame;
  if (!urlCache[k]) urlCache[k] = cv.toDataURL();
  return { url: urlCache[k], w: cv.width, h: cv.height };
}
export function rawURL(id: string): { url: string; w: number; h: number } {
  ensureSprites();
  const cv = X[id];
  const k = 'x' + id;
  if (!urlCache[k]) urlCache[k] = cv.toDataURL();
  return { url: urlCache[k], w: cv.width, h: cv.height };
}

/** Day/night dither mask (drawn over the world at night). */
export function buildVignette(w: number, h: number): Cv {
  const cv = mk(w, h);
  const c = ctxOf(cv);
  const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  c.fillStyle = '#02040e';
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const dx = (x - w / 2) / (w / 2), dy = (y - h / 2) / (h / 2);
      const d = Math.min(1, Math.max(0, (Math.sqrt(dx * dx * 0.7 + dy * dy) - 0.35) / 0.75));
      if ((bayer[(y & 3) * 4 + (x & 3)] + 0.5) / 16 < d) c.fillRect(x, y, 1, 1);
    }
  return cv;
}
