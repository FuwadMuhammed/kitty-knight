import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
const [, , layoutPath, k0, out, cols0] = process.argv; const k = +k0; const cols = +(cols0 || 6);
const spec = JSON.parse(fs.readFileSync(layoutPath, 'utf8')); const m = JSON.parse(fs.readFileSync('public/assets/manifest.json', 'utf8'));
type Cell = { id: string; imgs: any[] }; const cells: Cell[] = [];
for (const it of spec.items) { if (!m.sprites[it.id] || it.skip) continue; cells.push({ id: it.id, imgs: await Promise.all(m.sprites[it.id].map((f: string) => loadImage('public/assets/' + f))) }); }
const cw = Math.max(...cells.map((c) => c.imgs.reduce((a, i) => a + i.width * k + 4, 0))) + 12, ch = Math.max(...cells.map((c) => Math.max(...c.imgs.map((i: any) => i.height)))) * k + 22;
const rows = Math.ceil(cells.length / cols); const cv = createCanvas(cw * cols, ch * rows); const x = cv.getContext('2d'); x.fillStyle = '#5a8a4a'; x.fillRect(0, 0, cv.width, cv.height); x.imageSmoothingEnabled = false;
cells.forEach((c, i) => { const ox = (i % cols) * cw + 6, oy = Math.floor(i / cols) * ch; x.fillStyle = '#fff'; x.font = '11px sans-serif'; x.fillText(c.id, ox, oy + 12); let px = ox; for (const im of c.imgs) { x.drawImage(im, px, oy + 18, im.width * k, im.height * k); px += im.width * k + 4; } });
fs.writeFileSync(out, cv.toBuffer('image/png')); process.exit(0);
