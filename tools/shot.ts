import { createCanvas } from 'canvas';
import fs from 'fs';
import { Image as NodeImage } from 'canvas';
import fsx from 'fs';
(globalThis as any).Image = NodeImage;
(globalThis as any).fetch = async (u: string) => ({ ok: fsx.existsSync(u), json: async () => JSON.parse(fsx.readFileSync(u, 'utf8')) });
const mkEl = (tag: string) => { if (tag === 'canvas') { const c: any = createCanvas(1, 1); c.toDataURL = c.toDataURL.bind(c); return c; } return {}; };
(globalThis as any).document = { createElement: mkEl, addEventListener() {}, removeEventListener() {}, hidden: false };
(globalThis as any).window = { addEventListener() {}, removeEventListener() {} };
(globalThis as any).localStorage = { getItem: () => null, setItem() {} };
(globalThis as any).location = { search: process.env.Q || '', host: 'localhost:5188', origin: 'http://localhost:5188', pathname: '/' };
(globalThis as any).requestAnimationFrame = () => 0;
(globalThis as any).cancelAnimationFrame = () => {};
const OUT = process.env.OUT!;
const { Game } = await import('../src/game/game');
const { S, ICON, X } = await import('../src/game/sprites');
const up = (src: any, k: number, name: string) => { const o = createCanvas(src.width * k, src.height * k); const c = o.getContext('2d'); c.imageSmoothingEnabled = false; c.drawImage(src, 0, 0, o.width, o.height); fs.writeFileSync(`${OUT}/${name}.png`, o.toBuffer('image/png')); };
if (!process.env.NOOVR) await (await import('../src/game/sprites')).loadOverrides('public/assets/');
const cv: any = createCanvas(320, 180);
let overlay: any = null;
const g: any = new Game(cv, { overlay: (k: string, d: any) => { overlay = { k, d }; }, end: () => {} });
// sprite sheet
const sheet = createCanvas(640, 420); const sc = sheet.getContext('2d'); sc.fillStyle = '#4a7a40'; sc.fillRect(0, 0, 640, 420);
let x = 4, y = 4, rowH = 0;
for (const k of Object.keys(S)) { const f = S[k].f[0]; if (x + f.width > 636) { x = 4; y += rowH + 4; rowH = 0; } sc.drawImage(f, x, y); x += f.width + 4; rowH = Math.max(rowH, f.height); }
y += rowH + 8; x = 4;
for (const k of Object.keys(ICON)) { sc.drawImage(ICON[k], x, y); x += 18; if (x > 620) { x = 4; y += 18; } }
y += 22; x = 4; for (const k of ['sword','holysword']) { sc.drawImage(X[k], x, y); x += 14; }
up(sheet, 2, 'sheet');
{ const ek = ['rat','slime','bat','spider','goblin','skeleton','wolf','wizard','orc','gspider','goose','vacuum']; const ec = createCanvas(12 * 34, 34); const ex = ec.getContext('2d'); ex.fillStyle = '#5a8a4a'; ex.fillRect(0, 0, ec.width, 34); ek.forEach((k, i) => ex.drawImage(S[k].f[0], i * 34, 2)); up(ec, 4, 'enemies'); const bc = createCanvas(380, 110); const bx = bc.getContext('2d'); bx.fillStyle = '#5a8a4a'; bx.fillRect(0, 0, 380, 110); let xx = 2; for (const k of ['dog','roobo','dragon','knight','cateater']) { bx.drawImage(S[k].f[0], xx, 2); xx += S[k].f[0].width + 4; } up(bc, 3, 'bosses'); }
const kc = createCanvas(42 * 7 + 10, 52); const kx = kc.getContext('2d'); kx.fillStyle = '#5a8a4a'; kx.fillRect(0, 0, kc.width, kc.height); kx.imageSmoothingEnabled = false;
S.kitten.f.slice(0, 7).forEach((f: any, i: number) => kx.drawImage(f, i * 42, 0));
kx.drawImage(X.sword, 0, 0);
up(kc, 5, 'kitten');
{ const z = createCanvas(42, 48); const zc = z.getContext('2d'); zc.fillStyle = '#5a8a4a'; zc.fillRect(0, 0, 42, 48); zc.drawImage(X.sword, 1, 9); zc.drawImage(S.kitten.f[0], 0, 0); up(z, 14, 'kitten1'); }
g.renderMenu(); g.menuT = 1; g.renderMenu(); up(cv, 3, 'menu');
{ const { renderShareCard } = await import('../src/game/share'); const mk = (win: boolean) => ({ win, time: 754, level: 31, kills: 2318, damage: 128400, gold: 640, bosses: 2, weapons: [], evolutions: [], newBest: true, quip: '', combo: 212, unlocks: [] }); up(renderShareCard(g, mk(false)), 1, 'share_lose'); up(renderShareCard(g, mk(true)), 1, 'share_win'); }
g.startRun();
const mins = parseFloat(process.env.MINS || '1');
for (let i = 0; i < 60 * 60 * mins; i++) { g.step(1 / 60); if (g.state === 'LEVEL_UP') g.chooseCard(overlay.d.cards[0]); if (g.state === 'CHEST') g.closeChest(); const p = g.p; }
g.render(); up(cv, 3, 'game');
console.log('state', g.state, g.time | 0, g.act.length, g.p.lvl);
process.exit(0);
