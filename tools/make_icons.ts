import { Image as NodeImage, createCanvas } from 'canvas';
import fs from 'fs';
(globalThis as any).Image = NodeImage;
(globalThis as any).fetch = async (u: string) => ({ ok: fs.existsSync(u), json: async () => JSON.parse(fs.readFileSync(u, 'utf8')) });
(globalThis as any).document = { createElement: () => { const c: any = createCanvas(1, 1); c.toDataURL = c.toDataURL.bind(c); return c; }, addEventListener() {}, hidden: false };
(globalThis as any).window = {}; (globalThis as any).localStorage = { getItem: () => null, setItem() {} }; (globalThis as any).location = { search: '' };
const { loadOverrides, S } = await import('../src/game/sprites');
await loadOverrides('public/assets/');
const k = S.kitten.f[0];
for (const size of [180, 192, 512]) {
  const c = createCanvas(size, size); const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  x.fillStyle = '#2a1a4a'; x.fillRect(0, 0, size, size);
  x.fillStyle = '#3b2d57'; x.fillRect(size * 0.04, size * 0.04, size * 0.92, size * 0.92);
  x.fillStyle = '#2a1a4a'; x.fillRect(size * 0.07, size * 0.07, size * 0.86, size * 0.86);
  // head + shoulders crop of the kitten, scaled by a whole number so pixels stay square
  const sx = 6, sy = 0, sw = 32, sh = 36;
  const sc = Math.floor((size * 0.8) / sw);
  const dw = sw * sc, dh = sh * sc;
  x.drawImage(k, sx, sy, sw, sh, Math.round((size - dw) / 2), Math.round((size - dh) / 2), dw, dh);
  fs.writeFileSync(`public/icons/icon-${size}.png`, c.toBuffer('image/png'));
}
console.log('icons written');
process.exit(0);
