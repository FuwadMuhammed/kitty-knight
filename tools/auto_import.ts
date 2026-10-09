// Auto-importer for AI-generated "contact sheet" images.
//   npx tsx tools/auto_import.ts <sheet.png> <spec.json> [outDir=public/assets] [debug.png]
// Finds each labelled card by its purple border, finds the frames inside it (gaps between sprites),
// removes the dark checker background, fits every frame of one asset to the game's pixel size with a
// shared scale (so animations stay registered), and writes PNGs + manifest entries.
import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';

const [, , sheetPath, specPath, outArg, debugPath] = process.argv;
const OUT = path.resolve(outArg || 'public/assets');
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const sheet = await loadImage(sheetPath);
const W = sheet.width, H = sheet.height;
const sc = createCanvas(W, H); const sx = sc.getContext('2d'); sx.drawImage(sheet, 0, 0);
const D = sx.getImageData(0, 0, W, H).data;

let SPECK = 0.06;
let DARK = false; // pickups/icons: also treat the near-black purple panel colour as background
let KILLB = false; // also remove light purple-grey border remnants
const isBg = (r: number, g: number, b: number) =>
  (r <= 66 && g <= 58 && b >= 50 && b <= 100 && b > r + 12 && b >= g + 8) || (DARK && r <= 36 && g <= 28 && b >= 38 && b <= 60 && b > r + 12) ||
  (KILLB && r >= 60 && r <= 150 && g >= 52 && g <= 125 && b >= 95 && b <= 175 && b > r + 24 && b > g + 28 && r + g + b < 380);
const isBorder = (r: number, g: number, b: number) => r >= 76 && r <= 150 && g >= 62 && g <= 128 && b >= 112 && b <= 190 && b > r + 20 && b > g + 25;

// ---------- 1. find card rectangles (large hollow purple outlines)
function findCards() {
  const mask = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) mask[i] = isBorder(D[i * 4], D[i * 4 + 1], D[i * 4 + 2]) ? 1 : 0;
  { // bridge small gaps in blurred outlines
    const src = mask.slice();
    for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) { if (!src[y * W + x]) continue; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) mask[(y + dy) * W + x + dx] = 1; }
  }
  const seen = new Uint8Array(W * H);
  const cards: { x0: number; y0: number; x1: number; y1: number }[] = [];
  for (let s = 0; s < W * H; s++) {
    if (!mask[s] || seen[s]) continue;
    let x0 = W, y0 = H, x1 = 0, y1 = 0, n = 0;
    const st = [s]; seen[s] = 1;
    while (st.length) {
      const i = st.pop()!; const X = i % W, Y = (i / W) | 0; n++;
      if (X < x0) x0 = X; if (X > x1) x1 = X; if (Y < y0) y0 = Y; if (Y > y1) y1 = Y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = X + dx, ny = Y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx; if (mask[j] && !seen[j]) { seen[j] = 1; st.push(j); }
      }
    }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    if (bw >= 90 && bh >= 70 && n < bw * bh * 0.3 && n > (bw + bh) * 1.5) cards.push({ x0, y0, x1, y1 });
  }
  // drop cards fully inside another (keep outermost)
  const out = cards.filter((c, i) => !cards.some((o, j) => j !== i && o.x0 <= c.x0 && o.y0 <= c.y0 && o.x1 >= c.x1 && o.y1 >= c.y1 && (o.x1 - o.x0) > (c.x1 - c.x0)));
  // reading order: rows by top edge, then x
  out.sort((a, b) => a.y0 - b.y0);
  const rows: typeof out[] = [];
  for (const c of out) { const r = rows.find((r) => Math.abs(r[0].y0 - c.y0) < 14); if (r) r.push(c); else rows.push([c]); }
  rows.sort((a, b) => a[0].y0 - b[0].y0);
  return rows.flatMap((r) => r.sort((a, b) => a.x0 - b.x0));
}

// ---------- 2. frames inside a card
function findFrames(card: { x0: number; y0: number; x1: number; y1: number }, labelH: number, n: number) {
  const ix0 = card.x0 + 8, ix1 = card.x1 - 8, iy0 = card.y0 + labelH, iy1 = card.y1 - 8;
  const colCount = new Int32Array(ix1 - ix0 + 1);
  for (let y = iy0; y <= iy1; y++) for (let x = ix0; x <= ix1; x++) { const i = (y * W + x) * 4; if (D[i + 3] > 0 && !isBg(D[i], D[i + 1], D[i + 2])) colCount[x - ix0]++; }
  let runs: [number, number][] = [];
  let start = -1;
  for (let x = 0; x < colCount.length; x++) {
    if (colCount[x] >= 2) { if (start < 0) start = x; } else if (start >= 0) { runs.push([start, x - 1]); start = -1; }
  }
  if (start >= 0) runs.push([start, colCount.length - 1]);
  // ignore specks and the card's inner divider strips (narrow but nearly full height)
  const regionH = iy1 - iy0;
  runs = runs.filter((r) => {
    const w = r[1] - r[0] + 1;
    if (w < 4) return false;
    let y0 = iy1, y1 = iy0;
    for (let y = iy0; y <= iy1; y++) for (let x = r[0]; x <= r[1]; x++) { const i = (y * W + x + ix0) * 4; if (D[i + 3] > 0 && !isBg(D[i], D[i + 1], D[i + 2])) { if (y < y0) y0 = y; if (y > y1) y1 = y; } }
    return !(w <= 16 && y1 - y0 >= regionH * 0.72);
  });
  while (runs.length > n) { // merge the closest pair
    let bi = 0, bg = Infinity;
    for (let i = 0; i < runs.length - 1; i++) { const g = runs[i + 1][0] - runs[i][1]; if (g < bg) { bg = g; bi = i; } }
    runs.splice(bi, 2, [runs[bi][0], runs[bi + 1][1]]);
  }
  if (runs.length > 0 && runs.length < n) { // frames too close to separate: split the occupied span evenly
    const a = runs[0][0], b = runs[runs.length - 1][1], wdt = (b - a + 1) / n;
    runs = Array.from({ length: n }, (_, i) => [Math.round(a + i * wdt), Math.round(a + (i + 1) * wdt - 1)] as [number, number]);
  }
  return runs.map(([a, b]) => {
    let y0 = iy1, y1 = iy0;
    for (let y = iy0; y <= iy1; y++) for (let x = a; x <= b; x++) { const i = (y * W + x + ix0) * 4; if (!isBg(D[i], D[i + 1], D[i + 2])) { if (y < y0) y0 = y; if (y > y1) y1 = y; } }
    return [a + ix0 - 3, y0 - 3, b - a + 7, y1 - y0 + 7] as [number, number, number, number];
  });
}

// ---------- 3. cut a frame out of the checker
type Cut = { w: number; h: number; d: Uint8ClampedArray; bb: [number, number, number, number] };
function cut(rect: number[], flipX: boolean): Cut {
  const [rx, ry, rw, rh] = rect;
  const c = createCanvas(rw, rh); const x = c.getContext('2d'); x.drawImage(sheet, rx, ry, rw, rh, 0, 0, rw, rh);
  const img = x.getImageData(0, 0, rw, rh); const d = img.data;
  const seen = new Uint8Array(rw * rh); const stack: number[] = [];
  const push = (X: number, Y: number) => { if (X < 0 || Y < 0 || X >= rw || Y >= rh) return; const i = Y * rw + X; if (seen[i]) return; const p = i * 4; if (!isBg(d[p], d[p + 1], d[p + 2])) return; seen[i] = 1; stack.push(i); };
  for (let X = 0; X < rw; X++) { push(X, 0); push(X, rh - 1); }
  for (let Y = 0; Y < rh; Y++) { push(0, Y); push(rw - 1, Y); }
  while (stack.length) { const i = stack.pop()!; const X = i % rw, Y = (i / rw) | 0; d[i * 4 + 3] = 0; push(X + 1, Y); push(X - 1, Y); push(X, Y + 1); push(X, Y - 1); }
  // drop tiny disconnected specks (AI sparkles / leftover label pixels)
  {
    const lab = new Int32Array(rw * rh).fill(-1); const areas: number[] = []; const bbs: number[][] = [];
    for (let s0 = 0; s0 < rw * rh; s0++) {
      if (lab[s0] >= 0 || d[s0 * 4 + 3] === 0) continue;
      const id = areas.length; let n = 0; const st = [s0]; lab[s0] = id; let bx0 = rw, by0 = rh, bx1 = 0, by1 = 0;
      while (st.length) { const i = st.pop()!; n++; const X = i % rw, Y = (i / rw) | 0; bx0 = Math.min(bx0, X); bx1 = Math.max(bx1, X); by0 = Math.min(by0, Y); by1 = Math.max(by1, Y);
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const nx = X + dx, ny = Y + dy; if (nx < 0 || ny < 0 || nx >= rw || ny >= rh) continue; const j = ny * rw + nx; if (lab[j] < 0 && d[j * 4 + 3] > 0) { lab[j] = id; st.push(j); } } }
      areas.push(n); bbs.push([bx0, by0, bx1, by1]);
    }
    const big = Math.max(0, ...areas);
    const drop = areas.map((a, id) => {
      const [bx0, by0, bx1, by1] = bbs[id]; const bw = bx1 - bx0 + 1, bh = by1 - by0 + 1;
      const edge = bx0 <= 1 || by0 <= 1 || bx1 >= rw - 2 || by1 >= rh - 2;
      const line = Math.min(bw, bh) <= 8 && Math.max(bw, bh) >= Math.min(bw, bh) * 6 && a < big * 0.8;
      return a < Math.max(12, big * SPECK) || (edge && Math.min(bw, bh) <= 5 && a < big * 0.5) || line;
    });
    for (let i = 0; i < rw * rh; i++) if (lab[i] >= 0 && drop[lab[i]]) d[i * 4 + 3] = 0;
  }
  let out = d;
  if (flipX) { out = new Uint8ClampedArray(d.length); for (let Y = 0; Y < rh; Y++) for (let X = 0; X < rw; X++) { const a = (Y * rw + X) * 4, b = (Y * rw + (rw - 1 - X)) * 4; for (let k = 0; k < 4; k++) out[b + k] = d[a + k]; } }
  let x0 = rw, y0 = rh, x1 = -1, y1 = -1;
  for (let Y = 0; Y < rh; Y++) for (let X = 0; X < rw; X++) if (out[(Y * rw + X) * 4 + 3] > 0) { x0 = Math.min(x0, X); y0 = Math.min(y0, Y); x1 = Math.max(x1, X); y1 = Math.max(y1, Y); }
  return { w: rw, h: rh, d: out, bb: [x0, y0, x1 + 1, y1 + 1] };
}

function resample(c: Cut, sx0: number, sy0: number, dw: number, dh: number, dx: number, dy: number, scale: number, out: Uint8ClampedArray, OW: number) {
  for (let Y = 0; Y < dh; Y++) for (let X = 0; X < dw; X++) {
    const o = ((Y + dy) * OW + (X + dx)) * 4;
    if (scale >= 1) { // up-scaling: nearest, keeps pixels crisp
      const xx = Math.floor(sx0 + (X + 0.5) / scale), yy = Math.floor(sy0 + (Y + 0.5) / scale);
      if (xx < 0 || yy < 0 || xx >= c.w || yy >= c.h) continue;
      const p = (yy * c.w + xx) * 4; if (c.d[p + 3] < 128) continue;
      out[o] = c.d[p]; out[o + 1] = c.d[p + 1]; out[o + 2] = c.d[p + 2]; out[o + 3] = 255; continue;
    }
    const ax = sx0 + X / scale, ay = sy0 + Y / scale, bx = sx0 + (X + 1) / scale, by = sy0 + (Y + 1) / scale;
    let r = 0, g = 0, b = 0, a = 0, n = 0;
    for (let yy = Math.floor(ay); yy < Math.ceil(by); yy++) for (let xx = Math.floor(ax); xx < Math.ceil(bx); xx++) {
      const wgt = (Math.min(bx, xx + 1) - Math.max(ax, xx)) * (Math.min(by, yy + 1) - Math.max(ay, yy));
      if (xx < 0 || yy < 0 || xx >= c.w || yy >= c.h) { n += wgt; continue; }
      const p = (yy * c.w + xx) * 4; const al = c.d[p + 3] / 255;
      r += c.d[p] * al * wgt; g += c.d[p + 1] * al * wgt; b += c.d[p + 2] * al * wgt; a += al * wgt; n += wgt;
    }
    if (n > 0 && a > 0 && a / n >= 0.5) { out[o] = r / a; out[o + 1] = g / a; out[o + 2] = b / a; out[o + 3] = 255; }
  }
}

function cleanSpecks(px: Uint8ClampedArray, w: number, h: number, minArea: number) {
  const lab = new Int32Array(w * h).fill(-1); const areas: number[] = [];
  for (let s0 = 0; s0 < w * h; s0++) {
    if (lab[s0] >= 0 || px[s0 * 4 + 3] === 0) continue;
    const id = areas.length; let n = 0; const st = [s0]; lab[s0] = id;
    while (st.length) { const i = st.pop()!; n++; const X = i % w, Y = (i / w) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = X + dx, ny = Y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue; const j = ny * w + nx; if (lab[j] < 0 && px[j * 4 + 3] > 0) { lab[j] = id; st.push(j); } } }
    areas.push(n);
  }
  const big = Math.max(0, ...areas);
  for (let i = 0; i < w * h; i++) if (lab[i] >= 0 && areas[lab[i]] < Math.max(minArea, big * 0.04) && areas[lab[i]] < big) px[i * 4 + 3] = 0;
}
function addOutline(px: Uint8ClampedArray, w: number, h: number) {
  const al = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : px[(y * w + x) * 4 + 3]);
  const add: number[][] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (al(x, y)) continue;
    let best = -1, lum = 1e9;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { if (!al(x + dx, y + dy)) continue; const j = ((y + dy) * w + x + dx) * 4; const l = px[j] * 0.3 + px[j + 1] * 0.59 + px[j + 2] * 0.11; if (l < lum) { lum = l; best = j; } }
    // only outline where the neighbour is not already dark (AI art usually has its own dark edge)
    if (best >= 0 && lum > 70) add.push([(y * w + x) * 4, px[best], px[best + 1], px[best + 2]]);
  }
  for (const [k, r, g, b] of add) { px[k] = r * 0.26 + 14; px[k + 1] = g * 0.22 + 8; px[k + 2] = b * 0.28 + 18; px[k + 3] = 255; }
}

// ---------- run
const cards = spec.cards ? spec.cards.map((c: number[]) => ({ x0: c[0], y0: c[1], x1: c[2], y1: c[3] })) : findCards();
console.log(`cards found: ${cards.length}, expected: ${spec.items.length}`);
if (cards.length !== spec.items.length) { console.error('CARD COUNT MISMATCH'); }
const dbg = createCanvas(W, H); const dc = dbg.getContext('2d'); dc.drawImage(sheet, 0, 0); dc.lineWidth = 2;
const manifestPath = path.join(OUT, 'manifest.json');
const manifest: any = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : { sprites: {}, meta: {} };
let ok = 0;
spec.items.forEach((item: any, idx: number) => {
  const card = cards[idx];
  if (!card) { console.log('NO CARD for', item.id); return; }
  dc.strokeStyle = '#0f0'; dc.strokeRect(card.x0, card.y0, card.x1 - card.x0, card.y1 - card.y0);
  dc.fillStyle = '#ff0'; dc.font = '14px sans-serif'; dc.fillText(item.id, card.x0 + 4, card.y1 - 4);
  if (item.skip) { console.log('skip', item.id, '-', item.skip); return; }
  const labelH = item.labelH ?? spec.labelH;
  SPECK = item.speckFrac ?? spec.speckFrac ?? 0.06; DARK = item.darkBg ?? !!spec.darkBg; KILLB = item.killBorder ?? !!spec.killBorder;
  const rects = findFrames(card, labelH, item.n);
  if (process.env.DBG === item.id) console.log("RECTS", item.id, JSON.stringify(rects), JSON.stringify(card));
  if (rects.length < item.n) console.log(`WARN ${item.id}: found ${rects.length}/${item.n} frames`);
  rects.forEach((r) => { dc.strokeStyle = '#f0f'; dc.strokeRect(r[0], r[1], r[2], r[3]); });
  const start = item.start ?? 0;
  const use = Math.min(item.use ?? item.n, rects.length - start);
  const cuts = rects.slice(start, start + use).map((r) => cut(r, !!item.flipX));
  const [tw, th] = item.target;
  const ub: number[] = [1e9, 1e9, -1e9, -1e9];
  for (const c of cuts) { ub[0] = Math.min(ub[0], c.bb[0]); ub[1] = Math.min(ub[1], c.bb[1]); ub[2] = Math.max(ub[2], c.bb[2]); ub[3] = Math.max(ub[3], c.bb[3]); }
  // each frame has its own crop origin, so register frames by their own bbox against the shared scale
  const maxW = Math.max(...cuts.map((c) => c.bb[2] - c.bb[0])), maxH = Math.max(...cuts.map((c) => c.bb[3] - c.bb[1]));
  const pad = item.pad ?? 0;
  const scale = Math.min((tw - pad * 2) / maxW, (th - pad * 2) / maxH);
  const files: string[] = [];
  cuts.forEach((c, i) => {
    const bw = c.bb[2] - c.bb[0], bh = c.bb[3] - c.bb[1];
    const cw = Math.max(1, Math.round(bw * scale)), ch = Math.max(1, Math.round(bh * scale));
    const ox = Math.floor((tw - cw) / 2);
    const oy = item.align === 'bottom' ? th - ch - pad : item.align === 'top' ? pad : Math.floor((th - ch) / 2);
    const out = new Uint8ClampedArray(tw * th * 4);
    resample(c, c.bb[0], c.bb[1], cw, ch, ox, oy, scale, out, tw);
    cleanSpecks(out, tw, th, item.minSpeck ?? 6);
    if (item.outline !== false) addOutline(out, tw, th);
    const cv = createCanvas(tw, th); const x = cv.getContext('2d');
    const id = x.createImageData(tw, th); id.data.set(out); x.putImageData(id, 0, 0);
    const rel = `${item.group}/${item.id}_${i}.png`;
    fs.mkdirSync(path.dirname(path.join(OUT, rel)), { recursive: true });
    fs.writeFileSync(path.join(OUT, rel), cv.toBuffer('image/png'));
    files.push(rel);
  });
  manifest.sprites[item.id] = files;
  ok++;
  console.log(item.id.padEnd(16), `frames ${cuts.length}`, `scale ${scale.toFixed(3)}`, `src ${maxW}x${maxH} -> ${tw}x${th}`);
});
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
if (debugPath) fs.writeFileSync(debugPath, dbg.toBuffer('image/png'));
console.log(`imported ${ok}/${spec.items.length}`);
process.exit(0);
