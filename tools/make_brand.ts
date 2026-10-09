// Generates favicons (.ico + PNGs), app icons and the 1200x630 social preview image from the game's own sprites.
import { Image as NodeImage, createCanvas } from 'canvas';
import fs from 'fs';
(globalThis as any).Image = NodeImage;
(globalThis as any).fetch = async (u: string) => ({ ok: fs.existsSync(u), json: async () => JSON.parse(fs.readFileSync(u, 'utf8')) });
(globalThis as any).document = { createElement: () => { const c: any = createCanvas(1, 1); c.toDataURL = c.toDataURL.bind(c); return c; }, addEventListener() {}, hidden: false };
(globalThis as any).window = {}; (globalThis as any).localStorage = { getItem: () => null, setItem() {} }; (globalThis as any).location = { search: '', host: '', origin: '', pathname: '/' };
const { loadOverrides, S, X, SW, KG } = await import('../src/game/sprites');
const { drawText } = await import('../src/game/font');
const { World } = await import('../src/game/world');
await loadOverrides('public/assets/');
const k = S.kitten.f[0];

// ---- favicons: the kitten's face on a dark tile
const face = (size: number, rounded: boolean) => {
  const c = createCanvas(size, size); const x = c.getContext('2d');
  x.imageSmoothingEnabled = size > 48 ? false : true;
  x.fillStyle = '#2a1a4a'; x.fillRect(0, 0, size, size);
  const sx = 8, sy = 0, sw = 26, sh = 26; // ears + face
  const sc = size / sw * 0.92;
  x.drawImage(k, sx, sy, sw, sh, (size - sw * sc) / 2, size * 0.06, sw * sc, sh * sc);
  if (rounded) { x.globalCompositeOperation = 'destination-in'; x.fillStyle = '#000'; const r = size * 0.2; x.beginPath(); x.moveTo(r, 0); x.arcTo(size, 0, size, size, r); x.arcTo(size, size, 0, size, r); x.arcTo(0, size, 0, 0, r); x.arcTo(0, 0, size, 0, r); x.fill(); }
  return c;
};
fs.mkdirSync('public/icons', { recursive: true });
const sizes = [16, 32, 48];
const pngs = sizes.map((s) => face(s, false).toBuffer('image/png'));
sizes.forEach((s, i) => fs.writeFileSync(`public/favicon-${s}x${s}.png`, pngs[i]));
// .ico container with PNG payloads
const hdr = Buffer.alloc(6); hdr.writeUInt16LE(0, 0); hdr.writeUInt16LE(1, 2); hdr.writeUInt16LE(sizes.length, 4);
let off = 6 + 16 * sizes.length; const dir: Buffer[] = [];
sizes.forEach((s, i) => { const e = Buffer.alloc(16); e[0] = s; e[1] = s; e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6); e.writeUInt32LE(pngs[i].length, 8); e.writeUInt32LE(off, 12); off += pngs[i].length; dir.push(e); });
fs.writeFileSync('public/favicon.ico', Buffer.concat([hdr, ...dir, ...pngs]));
fs.writeFileSync('public/apple-touch-icon.png', face(180, false).toBuffer('image/png'));
fs.writeFileSync('public/icons/icon-192.png', face(192, true).toBuffer('image/png'));
fs.writeFileSync('public/icons/icon-512.png', face(512, true).toBuffer('image/png'));
fs.writeFileSync('public/icons/icon-180.png', face(180, false).toBuffer('image/png'));
// maskable icon: art kept inside the central safe zone, full-bleed background
{ const c = createCanvas(512, 512); const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.fillStyle = '#2a1a4a'; x.fillRect(0, 0, 512, 512);
  const f = face(512, false); x.drawImage(f, 64, 64, 384, 384); fs.writeFileSync('public/icons/icon-maskable-512.png', c.toBuffer('image/png')); }

// ---- social preview 1200x630 (drawn at 300x158 and scaled x4 so it stays pixel-perfect)
const W = 300, H = 158;
const cv = createCanvas(W, H); const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
const world = new World(1337);
world.draw(c as any, 1180, 760, W, H, true);
c.fillStyle = 'rgba(14,8,28,0.5)'; c.fillRect(0, 0, W, H);
// horde of tiny monsters surrounding the hero
const rows: [string, number, number][] = [['rat', 22, 120], ['slime', 52, 132], ['bat', 30, 70], ['goblin', 72, 108], ['skeleton', 18, 96], ['rat', 104, 136], ['wolf', 96, 126], ['wizard', 120, 100], ['goose', 142, 134], ['orc', 168, 122], ['rat', 190, 140], ['slime', 214, 130], ['bat', 240, 70], ['goblin', 252, 116], ['wolf', 270, 134], ['skeleton', 284, 100], ['rat', 236, 144]];
for (const [id, x, y] of rows) { const f = S[id].f[0]; c.drawImage(f, x - f.width / 2, y - f.height / 2); }
// hero in the middle of the horde
const sc = 2, hx = 150 - (k.width * sc) / 2, hy = 156 - k.height * sc;
c.fillStyle = 'rgba(0,0,0,0.35)'; for (let i = 0; i < 4; i++) c.fillRect(150 - 26 + i * 2, 152 + (i % 2), 52 - i * 4, 3);
c.save(); c.translate(hx + (k.width - KG.x) * sc, hy + KG.y * sc); c.rotate(0.05); c.scale(sc, sc); c.drawImage(X.sword, -SW.gx, -SW.gripY); c.restore();
c.drawImage(S.kitten.fl[0], hx, hy, k.width * sc, k.height * sc);
// title
drawText(c as any, 'TINY KNIGHT', W / 2, 5, '#ffd24a', '#6a2a10', 'c', 3);
drawText(c as any, 'SURVIVORS', W / 2, 23, '#f6efdc', '#3a2a5a', 'c', 3);
drawText(c as any, 'ONE TINY KNIGHT. AN UNREASONABLE NUMBER OF MONSTERS.', W / 2, 41, '#ffffff', '#000', 'c', 1);
drawText(c as any, 'FREE CUTE CAT SURVIVOR GAME - PLAY IN YOUR BROWSER', W / 2, 50, '#9affb0', '#103a18', 'c', 1);
const og = createCanvas(1200, 630); const ox = og.getContext('2d'); ox.imageSmoothingEnabled = false; ox.drawImage(cv, 0, 0, 1200, 632);
fs.writeFileSync('public/og-image.png', og.toBuffer('image/png'));
console.log('brand assets written');
process.exit(0);
