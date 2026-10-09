import { Image as NodeImage, createCanvas } from 'canvas';
import fs from 'fs';
(globalThis as any).Image = NodeImage;
(globalThis as any).fetch = async (u: string) => ({ ok: fs.existsSync(u), json: async () => JSON.parse(fs.readFileSync(u, 'utf8')) });
(globalThis as any).document = { createElement: (t: string) => { const c: any = createCanvas(1, 1); c.toDataURL = c.toDataURL.bind(c); return c; }, addEventListener() {}, removeEventListener() {}, hidden: false };
(globalThis as any).window = { addEventListener() {}, removeEventListener() {} };
(globalThis as any).localStorage = { getItem: () => null, setItem() {} };
(globalThis as any).location = { search: '?god=1', host: 'x', origin: 'http://x', pathname: '/' };
(globalThis as any).requestAnimationFrame = () => 0;
const { loadOverrides } = await import('../src/game/sprites');
await loadOverrides('public/assets/');
const { Game } = await import('../src/game/game');
const cv: any = createCanvas(320, 180);
const g: any = new Game(cv, { overlay() {}, end() {} });
g.startRun();
const trees = g.world.decor.filter((d: any) => d.tall && d.cv.width >= 28 && Math.abs(d.x - 1200) < 400 && Math.abs(d.y - 800) < 300);
const t = trees[3];
const out = createCanvas(960 * 2, 540); const o = out.getContext('2d'); o.imageSmoothingEnabled = false;
for (const [i, dy] of [[0, -9], [1, 9]] as const) {
  g.p.x = t.x; g.p.y = t.y + dy; g.cam.x = t.x - 160; g.cam.y = t.y - 90;
  g.time = 20; g.step(0.016); g.cam.x = t.x - 160; g.cam.y = t.y - 90; g.render();
  o.drawImage(cv, i * 960, 0, 960, 540);
}
fs.writeFileSync(process.env.OUT!, out.toBuffer('image/png'));
process.exit(0);
