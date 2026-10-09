import { createCanvas } from 'canvas';
import { Image as NodeImage } from 'canvas';
import fsx from 'fs';
(globalThis as any).Image = NodeImage;
(globalThis as any).fetch = async (u: string) => ({ ok: fsx.existsSync(u), json: async () => JSON.parse(fsx.readFileSync(u, 'utf8')) });
const mkEl = (tag: string) => { if (tag === 'canvas') { const c: any = createCanvas(1, 1); c.toDataURL = c.toDataURL.bind(c); return c; } return {}; };
(globalThis as any).document = { createElement: mkEl, addEventListener() {}, removeEventListener() {}, hidden: false };
(globalThis as any).window = { addEventListener() {}, removeEventListener() {}, AudioContext: undefined };
(globalThis as any).localStorage = { getItem: () => null, setItem() {} };
(globalThis as any).location = { search: process.env.Q || '' };
(globalThis as any).requestAnimationFrame = () => 0;
(globalThis as any).cancelAnimationFrame = () => {};
(globalThis as any).performance = performance;
const { Game } = await import('../src/game/game');
if (!process.env.NOOVR) await (await import('../src/game/sprites')).loadOverrides('public/assets/');
const cv: any = createCanvas(320, 180);
let overlay: any = null;
const g: any = new Game(cv, { overlay: (k: string, d: any) => { overlay = { k, d }; }, end: (r: any) => console.log('END', JSON.stringify(r)) });
console.log('constructed');
g.startRun();
const mins = parseFloat(process.env.MINS || '2');
let t0 = Date.now();
for (let i = 0; i < 60 * 60 * mins; i++) {
  g.step(1 / 60);
  if (process.env.KILLBOSS && g.bossList.length && g.bossList[0].hp > 5 && g.bossList[0].dying <= 0) { g.bossList[0].hp = 5; g.hurtEnemy(g.bossList[0], 50, 0, 0, 0); console.log('killed boss at', g.time | 0); }
  g.render();
  if (g.state === 'LEVEL_UP' && overlay?.k === 'levelup') { const cs = overlay.d.cards; g.chooseCard(cs.find((c: any) => c.kind === 'evo') || cs[Math.floor(Math.random() * 3)]); };
  if (g.state === 'CHEST') g.closeChest();
  if (i % 600 === 0 && g.bossList.length) console.log('  boss', g.bossList[0].boss.id, g.bossList[0].hp | 0, 'st', g.bossList[0].st, 'bk', g.bossesKilled);
  if (i % 3600 === 0) console.log('t', (g.time | 0), 'en', g.act.length, 'hp', g.p.hp | 0, 'lvl', g.p.lvl, 'kills', g.kills, 'ms', Date.now() - t0);
  if (g.state === 'RESULTS') break;
}
console.log('evos', g.evolutions.join(','), 'bk', g.bossesKilled); console.log('done', g.state, g.time | 0, g.act.length, g.p.lvl, g.kills, Date.now() - t0, 'ms');
process.exit(0);
