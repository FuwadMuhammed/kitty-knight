// Exports every procedural sprite as PNG, builds labelled contact sheets and writes ASSETS.md.
import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';
const mkEl = (tag: string) => { if (tag === 'canvas') { const c: any = createCanvas(1, 1); c.toDataURL = c.toDataURL.bind(c); return c; } return {}; };
(globalThis as any).document = { createElement: mkEl, addEventListener() {}, removeEventListener() {}, hidden: false };
(globalThis as any).window = { addEventListener() {}, removeEventListener() {} };
(globalThis as any).localStorage = { getItem: () => null, setItem() {} };
(globalThis as any).location = { search: '', host: 'localhost', origin: 'http://localhost', pathname: '/' };
const OUT = path.resolve(process.argv[2] || 'assets-export');
const { ensureSprites, S, X, ICON, DECOR } = await import('../src/game/sprites');
const { drawText } = await import('../src/game/font');
const D = await import('../src/game/data');
ensureSprites();

const png = (cv: any, file: string) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, cv.toBuffer('image/png')); };

interface Item { id: string; label: string; frames: any[]; note?: string; cat: string; use: string; file: string }
const items: Item[] = [];
const name = (id: string) => D.ENEMY_BY_ID[id]?.name || D.BOSS_BY_ID[id]?.name || D.WEAPON_BY_ID[id]?.name || D.PASSIVE_BY_ID[id]?.name || D.EVO_BY_ID[id]?.name || id;

// ---- characters
items.push({ id: 'kitten', label: 'KITTY KNIGHT', frames: S.kitten.f.slice(0, 6), cat: 'characters', use: 'Player. Frames: 0 idle, 1 idle-breath, 2 walk A, 3 walk B, 4 blink, 5 hit. Faces LEFT.', file: 'characters/kitten' });
items.push({ id: 'kitten_dead', label: 'KITTY KNIGHT DEAD', frames: [S.kitten.f[6]], cat: 'characters', use: 'Player death pose (lying on side, X eyes). Faces LEFT.', file: 'characters/kitten_dead' });
for (const k of ['sword', 'holysword', 'runesword']) items.push({ id: k, label: k.toUpperCase(), frames: [X[k]], cat: 'characters', use: k === 'sword' ? 'Giant sword (held + swing). Blade points UP, grip/pommel at the bottom.' : k === 'holysword' ? 'Holy Claws evolution sword (orbit + swing). Same layout as sword.' : 'Rune sword (alt skin, spare).', file: `characters/${k}` });
// ---- enemies / bosses
for (const e of D.ENEMIES) items.push({ id: e.id, label: e.name, frames: S[e.id].f, cat: 'enemies', use: `Enemy. 2 walk frames, faces LEFT. Hit-box radius ${e.r}px.`, file: `enemies/${e.id}` });
for (const b of D.BOSSES) items.push({ id: b.sprite, label: b.name, frames: S[b.sprite].f, cat: 'bosses', use: `Boss. 2 frames, faces LEFT. Hit-box radius ${b.r}px.`, file: `bosses/${b.sprite}` });
// ---- pickups & world objects
const pick: [string, string, string][] = [
  ['gemB', 'XP GEM SMALL', 'XP crystal (value < 5). 2 frames: normal / sparkle.'], ['gemG', 'XP GEM MEDIUM', 'XP crystal (5-24).'], ['gemR', 'XP GEM LARGE', 'XP crystal (25-99).'], ['gemP', 'XP GEM HUGE', 'XP crystal (100+).'],
  ['meat', 'MEAT', 'Heal pickup (+20 HP).'], ['coin', 'COIN', 'Gold pickup. 3 frames spin.'], ['magnet', 'MAGNET', 'Pulls all gems.'], ['chest', 'TREASURE CHEST', 'Frame 0 closed, frame 1 open.'],
];
for (const [id, label, use] of pick) items.push({ id, label, frames: S[id].f, cat: 'pickups', use, file: `pickups/${id}` });
// ---- projectiles / weapon objects
const proj: [string, string][] = [
  ['yarn', 'Yarn Ball projectile (spins)'], ['chaosyarn', 'Chaos Yarn (evolved)'], ['fish', 'Flying Fish (faces LEFT, rotated in code)'], ['fire', 'Tiny Dragon fireball'], ['bossfire', 'Boss fireball (large)'],
  ['orb', 'Enemy magic orb'], ['dust', 'Roobo dust bunny'], ['bomb', 'Catnip Bomb'], ['paw', 'Magic Paw (big pink paw, drawn semi-transparent)'], ['dragonP', 'Tiny Dragon companion (2 flap frames)'],
  ['stormP', 'Storm Dragon companion (evolved)'], ['shield', 'Royal Shield orbiting'], ['bone', 'Bone (unused spare)'], ['leaf', 'Leaf (unused spare)'], ['hairball', 'Hairball projectile'],
  ['bullet', 'Mouse Blaster bullet (faces RIGHT)'], ['catarang', 'Catarang boomerang toy'], ['marbleA', 'Cat Marble blue'], ['marbleB', 'Cat Marble pink'], ['marbleC', 'Cat Marble green'],
  ['mouse', 'Wind-Up Mouse (2 frames)'], ['pellet', 'Fluff Shotgun pellet'], ['twister', 'Zoomies Twister (2 frames, scaled by area)'], ['dice', 'Lucky Dice - frame N = face N+1'], ['flask', 'Sour Milk Flask'], ['scratcher', 'Scratching Post (spins)'],
];
for (const [id, use] of proj) items.push({ id, label: id.toUpperCase(), frames: S[id].f, cat: 'weapons', use, file: `weapons/${id}` });
// ---- icons
const iconNote = (id: string) => {
  if (D.WEAPON_BY_ID[id]) return `Weapon icon: ${D.WEAPON_BY_ID[id].name}`;
  const w = D.WEAPONS.find((x) => x.icon === id);
  if (w) return `Weapon icon: ${w.name}`;
  const p = D.PASSIVES.find((x) => x.icon === id);
  if (p) return `Tome icon: ${p.name}`;
  const e = D.EVOS.find((x) => x.icon === id);
  if (e) return `Evolution icon: ${e.name}`;
  return 'UI / misc icon';
};
for (const id of Object.keys(ICON)) {
  const w = D.WEAPONS.find((x) => x.icon === id);
  const p = D.PASSIVES.find((x) => x.icon === id);
  const e = D.EVOS.find((x) => x.icon === id);
  items.push({ id: 'icon_' + id, label: (w?.name || p?.name || e?.name || id).toUpperCase(), frames: [ICON[id]], cat: w ? 'icons_weapons' : e ? 'icons_evolutions' : p ? 'icons_tomes' : 'icons_misc', use: iconNote(id), file: `icons/${id}` });
}
// ---- decor
for (const [id, arr] of Object.entries(DECOR)) items.push({ id: 'decor_' + id, label: id.toUpperCase(), frames: arr as any[], cat: 'world', use: `World decoration, ${arr.length} variant(s). Anchor = bottom-centre (sits on the ground).`, file: `world/${id}` });

// ---- export PNGs
const manifest: string[] = [];
for (const it of items) it.frames.forEach((f: any, i: number) => png(f, path.join(OUT, 'png', `${it.file}_${i}.png`)));

// ---- contact sheets
function sheet(cat: string, title: string, k: number, width = 1400) {
  const list = items.filter((i) => i.cat === cat);
  const pad = 14, labelH = 30;
  // layout
  type P = { it: Item; x: number; y: number; w: number; h: number };
  const placed: P[] = [];
  let x = pad, y = pad + 36, rowH = 0;
  for (const it of list) {
    const fw = Math.max(...it.frames.map((f: any) => f.width)), fh = Math.max(...it.frames.map((f: any) => f.height));
    const w = Math.max(fw * k * it.frames.length + (it.frames.length - 1) * 8 * 1, 150) + 16, h = fh * k + labelH + 22;
    if (x + w > width) { x = pad; y += rowH + pad; rowH = 0; }
    placed.push({ it, x, y, w, h });
    x += w + pad; rowH = Math.max(rowH, h);
  }
  const H = y + rowH + pad;
  const cv = createCanvas(width, H); const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
  c.fillStyle = '#17112a'; c.fillRect(0, 0, width, H);
  drawText(c, title, pad, pad, '#ffd24a', '#6a2a10', 'l', 3);
  for (const p of placed) {
    c.fillStyle = '#241a3c'; c.fillRect(p.x, p.y, p.w, p.h);
    c.strokeStyle = '#6b5a8e'; c.lineWidth = 2; c.strokeRect(p.x + 1, p.y + 1, p.w - 2, p.h - 2);
    const lab = p.it.label.length > 24 ? p.it.label.slice(0, 24) : p.it.label;
    drawText(c, lab, p.x + 8, p.y + 6, '#ffffff', '#000', 'l', 2);
    const fw = Math.max(...p.it.frames.map((f: any) => f.width)), fh = Math.max(...p.it.frames.map((f: any) => f.height));
    drawText(c, `${p.it.id.replace('icon_', '').toUpperCase()}  ${fw}X${fh}  ${p.it.frames.length}F`.slice(0, 40), p.x + 8, p.y + 20, '#9ae0ff', null, 'l', 1);
    let fx = p.x + 8;
    for (const f of p.it.frames) {
      // checkerboard behind each frame to show transparency
      for (let cy = 0; cy < f.height * k; cy += 8) for (let cx = 0; cx < f.width * k; cx += 8) { c.fillStyle = ((cx + cy) / 8) % 2 ? '#3a3158' : '#2e2650'; c.fillRect(fx + cx, p.y + labelH + 8 + cy, Math.min(8, f.width * k - cx), Math.min(8, f.height * k - cy)); }
      c.drawImage(f, fx, p.y + labelH + 8, f.width * k, f.height * k);
      fx += f.width * k + 8;
    }
  }
  png(cv, path.join(OUT, `sheet_${cat}.png`));
  return list.length;
}
const counts: Record<string, number> = {};
counts.characters = sheet('characters', 'CHARACTER + SWORD', 5);
counts.enemies = sheet('enemies', 'ENEMIES (12)', 5);
counts.bosses = sheet('bosses', 'BOSSES (5)', 3, 1500);
counts.weapons = sheet('weapons', 'WEAPON OBJECTS + PROJECTILES', 5);
counts.pickups = sheet('pickups', 'PICKUPS + CHEST', 5);
counts.icons_weapons = sheet('icons_weapons', 'WEAPON ICONS 14X14', 6);
counts.icons_evolutions = sheet('icons_evolutions', 'EVOLUTION ICONS 14X14', 6);
counts.icons_tomes = sheet('icons_tomes', 'TOME ICONS 14X14', 6);
counts.icons_misc = sheet('icons_misc', 'MISC / UI ICONS 14X14', 6);
counts.world = sheet('world', 'WORLD DECORATION', 4);

// ---- manifest
const md: string[] = [];
md.push('# Tiny Knight Survivors - asset list\n');
md.push('Every picture in the game is currently generated by code. Each row below is one asset you can replace. Sizes are in game pixels (the game renders at 320x180 and scales up with no smoothing).\n');
const sec = (cat: string, title: string) => {
  const list = items.filter((i) => i.cat === cat);
  md.push(`\n## ${title} (${list.length})\n`);
  md.push('| file (png/…) | name | size | frames | notes |');
  md.push('|---|---|---|---|---|');
  for (const it of list) {
    const fw = Math.max(...it.frames.map((f: any) => f.width)), fh = Math.max(...it.frames.map((f: any) => f.height));
    md.push(`| \`${it.file}_N.png\` | ${it.label} | ${fw}x${fh} | ${it.frames.length} | ${it.use} |`);
  }
};
sec('characters', 'Player + sword'); sec('enemies', 'Enemies'); sec('bosses', 'Bosses'); sec('pickups', 'Pickups and chest'); sec('weapons', 'Weapon objects and projectiles');
sec('icons_weapons', 'Weapon icons'); sec('icons_evolutions', 'Evolution icons'); sec('icons_tomes', 'Tome (passive) icons'); sec('icons_misc', 'Misc / UI icons'); sec('world', 'World decoration');
fs.writeFileSync(path.join(OUT, 'ASSETS.md'), md.join('\n') + '\n');
const total = items.reduce((a, i) => a + i.frames.length, 0);
console.log(JSON.stringify({ assets: items.length, frameFiles: total, counts }, null, 1));
process.exit(0);
