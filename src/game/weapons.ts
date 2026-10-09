// Weapon behaviours, projectiles and effects. Everything auto-fires; the kitten only needs to move.
import type { Game } from './game';
import { Enemy, Fx, Weapon } from './types';
import { S, X, SW, drawCv } from './sprites';
import { TAU, angDiff, clamp, rand, randInt } from './util';
import { sfx } from './audio';
import { WORLD_H, WORLD_W } from './world';
import { addStat } from './save';

const D2R = Math.PI / 180;
const tmp: Enemy[] = [];
const wd = (g: Game, w: Weapon) => w.st.damage * (1 + w.bonus) * g.p.s.dmg * g.comboMul;
const wcd = (g: Game, w: Weapon) => w.st.cooldown * g.p.s.cd;
const warea = (g: Game, w: Weapon) => w.st.area * g.p.s.area;
const wcnt = (g: Game, w: Weapon) => w.st.count + g.p.s.proj;
const wdur = (g: Game, w: Weapon) => w.st.duration * g.p.s.dur;

function line(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, th: number) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (let i = 0; i < 400; i++) {
    ctx.rect(x0, y0, th, th);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

export function weaponName(w: Weapon): string {
  return w.evolved ? g_evoName(w) : w.def.name;
}
import { EVO_BY_ID } from './data';
function g_evoName(w: Weapon) {
  return EVO_BY_ID[w.evoId]?.name || w.def.name;
}

// ------------------------------------------------------------------ per-frame weapon logic
export function updateWeapons(g: Game, dt: number) {
  const p = g.p;
  for (const w of p.weapons) {
    g.src = w.def.id;
    switch (w.def.id) {
      case 'sword': updSword(g, w, dt); break;
      case 'yarn': updYarn(g, w, dt); break;
      case 'paw': updPaw(g, w, dt); break;
      case 'fish': updFish(g, w, dt); break;
      case 'hiss': updHiss(g, w, dt); break;
      case 'shield': updShield(g, w, dt); break;
      case 'dash': updDash(g, w, dt); break;
      case 'lightning': updLightning(g, w, dt); break;
      case 'dragon': updDragon(g, w, dt); break;
      case 'bomb': updBomb(g, w, dt); break;
      case 'hairball': updHairball(g, w, dt); break;
      case 'marbles': updMarbles(g, w, dt); break;
      case 'blaster': updBlaster(g, w, dt); break;
      case 'catarang': updCatarang(g, w, dt); break;
      case 'scratcher': updScratcher(g, w, dt); break;
      case 'laser': updLaser(g, w, dt); break;
      case 'mouse': updMouse(g, w, dt); break;
      case 'shotgun': updShotgun(g, w, dt); break;
      case 'coldmilk': updColdMilk(g, w, dt); break;
      case 'twister': updTwister(g, w, dt); break;
      case 'voidbox': updVoid(g, w, dt); break;
      case 'flask': updFlask(g, w, dt); break;
      case 'dice': updDice(g, w, dt); break;
      case 'purr': updPurr(g, w, dt); break;
    }
  }
}

function orbit(g: Game, w: Weapon, n: number, radius: number, speed: number, dt: number, dmg: number, tickIdx: number, tickCd: number, hitR: number, kb: number, block: boolean) {
  const d = w.data;
  d.ang = (d.ang || 0) + speed * dt;
  if (!d.pos) d.pos = [];
  d.pos.length = n;
  const p = g.p;
  for (let i = 0; i < n; i++) {
    const a = d.ang + (i * TAU) / n;
    const pos = d.pos[i] || (d.pos[i] = { x: 0, y: 0, a: 0 });
    pos.a = a;
    pos.x = p.x + Math.cos(a) * radius;
    pos.y = p.y + Math.sin(a) * radius;
    const cnt = g.queryEnemies(pos.x, pos.y, hitR, tmp);
    for (let k = 0; k < cnt; k++) {
      const e = tmp[k];
      if (e.tick[tickIdx] > 0) continue;
      e.tick[tickIdx] = tickCd;
      const ang = Math.atan2(e.y - pos.y, e.x - pos.x);
      g.hurtEnemy(e, dmg, Math.cos(ang), Math.sin(ang), kb);
    }
    if (block) for (const pr of g.projs) if (pr.alive && pr.hostile && (pr.x - pos.x) ** 2 + (pr.y - pos.y) ** 2 < (hitR + pr.r) ** 2) { pr.alive = false; addStat('shotsBlocked'); g.burst(pr.x, pr.y, 5, ['#fff', '#f5c84a'], 40, 0.3); sfx('hit'); }
  }
}

// ---- sword
function updSword(g: Game, w: Weapon, dt: number) {
  const p = g.p;
  const evo = w.evolved;
  w.timer -= dt;
  if (w.timer <= 0 && !p.dead) {
    const tgt = g.nearest(p.x, p.y, 140);
    const a = tgt ? Math.atan2(tgt.y - p.y, tgt.x - p.x) : p.face > 0 ? 0 : Math.PI;
    const n = w.st.count + (evo ? 1 : 0);
    for (let i = 0; i < n; i++)
      g.addFx({
        k: 'slash', x: p.x, y: p.y, t: 0, dur: w.st.duration, delay: i * 0.17, a: a + (i % 2 ? Math.PI : 0), dir: i % 2 ? -1 : 1,
        R: 30 * warea(g, w) * (evo ? 1.3 : 1), dmg: wd(g, w), kb: w.st.knockback, hit: [] as Enemy[], holy: evo, played: false,
      });
    w.timer = wcd(g, w) * (evo ? 0.85 : 1);
  }
  if (evo) {
    const n = 4;
    orbit(g, w, n, 38 * warea(g, w), 3.4, dt, wd(g, w) * 0.7, 3, 0.35, 11, 70, false);
  } else w.data.pos = null;
}

// ---- yarn
function updYarn(g: Game, w: Weapon, dt: number) {
  const p = g.p;
  w.timer -= dt;
  if (w.timer > 0 || p.dead) return;
  const evo = w.evolved;
  const n = wcnt(g, w) + (evo ? 2 : 0);
  const targets = g.nearestN(p.x, p.y, n, 200);
  for (let i = 0; i < n; i++) {
    const pr = g.spawnProj('yarn');
    if (!pr) break;
    const t = targets[i];
    const a = t ? Math.atan2(t.y - p.y, t.x - p.x) + rand(-0.15, 0.15) : rand(0, TAU);
    const sp = w.st.speed * g.p.s.projSpeed;
    pr.x = p.x; pr.y = p.y; pr.vx = Math.cos(a) * sp; pr.vy = Math.sin(a) * sp;
    pr.r = evo ? 6 : 4; pr.dmg = wd(g, w) * (evo ? 1.4 : 1); pr.life = wdur(g, w) * (evo ? 1.4 : 1); pr.bounce = w.st.bounce + (evo ? 5 : 0);
    pr.knock = w.st.knockback; pr.evo = evo; pr.spr = evo ? 'chaosyarn' : 'yarn'; pr.aux = 0;
  }
  sfx('shoot');
  w.timer = wcd(g, w);
}

// ---- paw
function updPaw(g: Game, w: Weapon, dt: number) {
  const p = g.p;
  w.timer -= dt;
  if (w.timer > 0 || p.dead) return;
  const n = wcnt(g, w);
  for (let i = 0; i < n; i++) {
    const e = g.randomEnemyNear(p.x, p.y, 120);
    const tx = e ? e.x + rand(-6, 6) : p.x + rand(-80, 80);
    const ty = e ? e.y + rand(-6, 6) : p.y + rand(-60, 60);
    g.addFx({ k: 'paw', x: tx, y: ty, t: 0, dur: w.st.duration + i * 0.13 + 0.45, delay: w.st.duration + i * 0.13, r: 26 * warea(g, w), dmg: wd(g, w), kb: w.st.knockback, smashed: false });
  }
  w.timer = wcd(g, w);
}

// ---- fish
function updFish(g: Game, w: Weapon, dt: number) {
  const p = g.p;
  w.timer -= dt;
  if (w.timer > 0 || p.dead) return;
  const evo = w.evolved;
  const sp = w.st.speed * p.s.projSpeed;
  if (evo) {
    const n = 14 + w.st.count * 2;
    const off = rand(0, TAU);
    for (let i = 0; i < n; i++) {
      const pr = g.spawnProj('fish');
      if (!pr) break;
      const a = off + (i * TAU) / n + rand(-0.1, 0.1);
      const s2 = sp * rand(0.8, 1.25);
      pr.x = p.x; pr.y = p.y; pr.vx = Math.cos(a) * s2; pr.vy = Math.sin(a) * s2;
      pr.r = 4; pr.dmg = wd(g, w); pr.life = 2.2; pr.pierce = w.st.pierce + 2; pr.knock = w.st.knockback; pr.homing = true; pr.evo = true; pr.spr = 'fish';
    }
    g.shake(1.2);
    sfx('hiss');
    w.timer = wcd(g, w) * 0.65;
    return;
  }
  const n = wcnt(g, w);
  const targets = g.nearestN(p.x, p.y, n, 220);
  for (let i = 0; i < n; i++) {
    const pr = g.spawnProj('fish');
    if (!pr) break;
    const t = targets[i % Math.max(1, targets.length)];
    const a = t ? Math.atan2(t.y - p.y, t.x - p.x) + rand(-0.1, 0.1) : (p.face > 0 ? 0 : Math.PI) + (i - n / 2) * 0.25;
    pr.x = p.x; pr.y = p.y; pr.vx = Math.cos(a) * sp; pr.vy = Math.sin(a) * sp;
    pr.r = 3; pr.dmg = wd(g, w); pr.life = 1.5; pr.pierce = w.st.pierce; pr.knock = w.st.knockback; pr.spr = 'fish';
  }
  sfx('shoot');
  w.timer = wcd(g, w);
}

// ---- hiss
function updHiss(g: Game, w: Weapon, dt: number) {
  const p = g.p;
  w.timer -= dt;
  if (w.timer > 0 || p.dead) return;
  g.addFx({ k: 'ring', x: p.x, y: p.y, t: 0, dur: w.st.duration, R: 48 * warea(g, w), dmg: wd(g, w), kb: w.st.knockback, hit: [] as Enemy[] });
  if (Math.random() < 0.5) g.floatText(p.x, p.y - 22, 'HISS!', '#ff9ec0');
  sfx('hiss');
  w.timer = wcd(g, w);
}

// ---- shield
function updShield(g: Game, w: Weapon, dt: number) {
  const n = wcnt(g, w) - g.p.s.proj + (g.p.s.proj > 0 ? 0 : 0);
  orbit(g, w, Math.max(1, n), 27 * warea(g, w), w.st.speed, dt, wd(g, w), 0, w.st.cooldown, 7, w.st.knockback, true);
}

// ---- dash
function updDash(g: Game, w: Weapon, dt: number) {
  const p = g.p;
  w.timer -= dt;
  const evo = w.evolved;
  if (p.dash && p.dash.auto && p.dash.w === w) {
    const dd = p.dash;
    dd.acc += dd.speed * dt;
    const step = evo ? 22 : 8;
    while (dd.acc >= step) {
      dd.acc -= step;
      if (evo) g.addFx({ k: 'bomb', x: p.x, y: p.y, x0: p.x, y0: p.y, tx: p.x, ty: p.y, t: 0, dur: 99, flight: 0.01, fuse: 0.5, r: 30 * warea(g, w), dmg: wd(g, w) * 0.8, boomed: false });
      else g.addFx({ k: 'trail', x: p.x, y: p.y, t: 0, dur: wdur(g, w), dmg: wd(g, w) * 0.45, r: 9, tickT: 0 });
    }
    const cnt = g.queryEnemies(p.x, p.y, 13, tmp);
    for (let i = 0; i < cnt; i++) {
      const e = tmp[i];
      if (e.tick[1] > 0) continue;
      e.tick[1] = 0.22;
      g.hurtEnemy(e, wd(g, w), dd.dx, dd.dy, w.st.knockback);
    }
  } else if (w.timer <= 0 && !p.dash && !p.dead) {
    const tgt = g.nearest(p.x, p.y, 180);
    if (tgt) {
      const dx = tgt.x - p.x, dy = tgt.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      const dist = Math.min(d + 6, 72 * warea(g, w) * (evo ? 1.3 : 1));
      g.startDash(dx / d, dy / d, dist, 0.22, true, w);
      w.timer = wcd(g, w) * (evo ? 0.5 : 1);
      sfx('dash');
    }
  }
}
export function dashEnded(g: Game, w: Weapon | null) {
  if (w && w.evolved && w.def.id === 'dash') g.explode(g.p.x, g.p.y, 56 * warea(g, w), wd(g, w) * 2, 160, true);
}

// ---- lightning
function boltPoints(ax: number, ay: number, bx: number, by: number) {
  const pts = [{ x: ax, y: ay }];
  const d = Math.hypot(bx - ax, by - ay);
  const n = Math.max(2, Math.floor(d / 10));
  const nx = -(by - ay) / (d || 1), ny = (bx - ax) / (d || 1);
  for (let i = 1; i < n; i++) {
    const t = i / n, j = rand(-5, 5);
    pts.push({ x: ax + (bx - ax) * t + nx * j, y: ay + (by - ay) * t + ny * j });
  }
  pts.push({ x: bx, y: by });
  return pts;
}
export function zapChain(g: Game, e: Enemy, dmg: number, chain: number, area: number, fromX?: number, fromY?: number) {
  g.addFx({ k: 'bolt', x: e.x, y: e.y, t: 0, dur: 0.22, pts: boltPoints(fromX ?? e.x + rand(-8, 8), fromY ?? e.y - 110, e.x, e.y) });
  g.areaDamage(e.x, e.y, 15 * area, dmg, 40);
  g.burst(e.x, e.y, 6, ['#ffe14a', '#fff'], 70, 0.35);
  let cur = e;
  const struck: Enemy[] = [e];
  for (let c = 0; c < chain; c++) {
    let best: Enemy | null = null, bd = 80 * 80;
    for (const o of g.act) {
      if (o.dying || struck.includes(o)) continue;
      const d2 = (o.x - cur.x) ** 2 + (o.y - cur.y) ** 2;
      if (d2 < bd) { bd = d2; best = o; }
    }
    if (!best) break;
    g.addFx({ k: 'bolt', x: best.x, y: best.y, t: 0, dur: 0.22, pts: boltPoints(cur.x, cur.y, best.x, best.y) });
    g.hurtEnemy(best, dmg * 0.75, 0, 0, 20);
    struck.push(best);
    cur = best;
  }
  sfx('zap');
}
function updLightning(g: Game, w: Weapon, dt: number) {
  const p = g.p;
  w.timer -= dt;
  const evo = w.evolved;
  if (evo) {
    const sd = w.data.sd || (w.data.sd = { x: p.x - 24, y: p.y - 30, shoot: 0.5 });
    const bob = Math.sin(g.time * 3) * 3;
    sd.x += (p.x - 26 - sd.x) * Math.min(1, dt * 5);
    sd.y += (p.y - 34 + bob - sd.y) * Math.min(1, dt * 5);
    sd.shoot -= dt;
    if (sd.shoot <= 0) {
      const t = g.nearest(sd.x, sd.y, 170);
      if (t) { zapChain(g, t, wd(g, w) * 0.8, 2 + w.st.pierce, warea(g, w), sd.x, sd.y); sd.shoot = Math.max(0.3, wcd(g, w) * 0.4); }
      else sd.shoot = 0.2;
    }
  } else w.data.sd = null;
  if (w.timer > 0 || p.dead) return;
  const n = wcnt(g, w) + (evo ? 2 : 0);
  const used: Enemy[] = [];
  for (let i = 0; i < n; i++) {
    const e = g.randomEnemyNear(p.x, p.y, 160, used);
    if (!e) break;
    used.push(e);
    zapChain(g, e, wd(g, w), w.st.pierce + (evo ? 1 : 0), warea(g, w));
  }
  if (used.length) w.timer = wcd(g, w);
  else w.timer = 0.3;
}

// ---- dragon
function updDragon(g: Game, w: Weapon, dt: number) {
  const p = g.p;
  const n = wcnt(g, w) - g.p.s.proj;
  const d = w.data;
  if (!d.pos) d.pos = [];
  if (!d.tm) d.tm = [];
  d.pos.length = n;
  for (let i = 0; i < n; i++) {
    const a = g.time * 1.3 + (i * TAU) / n;
    const tx = p.x + Math.cos(a) * 24, ty = p.y - 10 + Math.sin(a) * 14 - 6 + Math.sin(g.time * 4 + i) * 2;
    const pos = d.pos[i] || (d.pos[i] = { x: tx, y: ty, a: 0, fr: 1 });
    pos.x += (tx - pos.x) * Math.min(1, dt * 6);
    pos.y += (ty - pos.y) * Math.min(1, dt * 6);
    d.tm[i] = (d.tm[i] ?? 0.3 + i * 0.25) - dt;
    if (d.tm[i] <= 0) {
      const t = g.nearest(pos.x, pos.y, 150);
      if (t) {
        const pr = g.spawnProj('fire');
        if (pr) {
          const aa = Math.atan2(t.y - pos.y, t.x - pos.x);
          const sp = w.st.speed * p.s.projSpeed;
          pr.x = pos.x; pr.y = pos.y; pr.vx = Math.cos(aa) * sp; pr.vy = Math.sin(aa) * sp; pr.r = 4; pr.dmg = wd(g, w); pr.life = 1.3; pr.pierce = w.st.pierce; pr.knock = 30; pr.spr = 'fire';
          pos.fr = Math.cos(aa) > 0 ? 1 : 0;
          sfx('shoot');
        }
        d.tm[i] = wcd(g, w);
      } else d.tm[i] = 0.15;
    }
  }
}

// ---- bomb
function updBomb(g: Game, w: Weapon, dt: number) {
  const p = g.p;
  w.timer -= dt;
  if (w.timer > 0 || p.dead) return;
  const n = wcnt(g, w);
  const used: Enemy[] = [];
  for (let i = 0; i < n; i++) {
    const e = g.randomEnemyNear(p.x, p.y, 130, used);
    if (e) used.push(e);
    const tx = e ? e.x : p.x + rand(-70, 70), ty = e ? e.y : p.y + rand(-50, 50);
    g.addFx({ k: 'bomb', x: p.x, y: p.y, x0: p.x, y0: p.y, tx, ty, t: 0, dur: 99, flight: 0.45 + i * 0.05, fuse: w.st.duration, r: 38 * warea(g, w), dmg: wd(g, w), boomed: false });
  }
  sfx('shoot');
  w.timer = wcd(g, w);
}

// ---- hairball launcher: exploding projectile
function updHairball(g: Game, w: Weapon, dt: number) {
  const p = g.p;
  w.timer -= dt;
  if (w.timer > 0 || p.dead) return;
  const n = wcnt(g, w);
  const targets = g.nearestN(p.x, p.y, n, 220);
  for (let i = 0; i < n; i++) {
    const pr = g.spawnProj('hairball');
    if (!pr) break;
    const t = targets[i % Math.max(1, targets.length)];
    const a = t ? Math.atan2(t.y - p.y, t.x - p.x) + rand(-0.12, 0.12) : rand(0, TAU);
    const sp = w.st.speed * p.s.projSpeed;
    pr.x = p.x; pr.y = p.y; pr.vx = Math.cos(a) * sp; pr.vy = Math.sin(a) * sp; pr.spin = 8;
    pr.r = 4; pr.dmg = wd(g, w); pr.life = 1.6; pr.aux2 = 24 * warea(g, w); pr.knock = w.st.knockback;
  }
  sfx('shoot');
  w.timer = wcd(g, w);
}
// ---- wind-up mouse: homing exploding mice
function updMouse(g: Game, w: Weapon, dt: number) {
  const p = g.p;
  w.timer -= dt;
  if (w.timer > 0 || p.dead) return;
  const n = wcnt(g, w);
  for (let i = 0; i < n; i++) {
    const pr = g.spawnProj('mouse');
    if (!pr) break;
    const a = rand(0, TAU);
    const sp = w.st.speed * p.s.projSpeed;
    pr.x = p.x; pr.y = p.y; pr.vx = Math.cos(a) * sp; pr.vy = Math.sin(a) * sp;
    pr.r = 4; pr.dmg = wd(g, w); pr.life = 3; pr.aux2 = 22 * warea(g, w); pr.knock = w.st.knockback; pr.homing = true;
  }
  sfx('shoot');
  w.timer = wcd(g, w);
}
function popProj(g: Game, pr: any) {
  pr.alive = false;
  g.addFx({ k: 'boom', x: pr.x, y: pr.y, t: 0, dur: 0.3, r: pr.aux2, col: pr.kind === 'mouse' ? '#ffd24a' : '#d8cbb8', col2: '#fff7e0' });
  g.areaDamage(pr.x, pr.y, pr.aux2, pr.dmg, pr.knock);
  g.burst(pr.x, pr.y, 8, pr.kind === 'mouse' ? ['#ffd24a', '#fff'] : ['#a89888', '#d8cbb8'], 80, 0.4);
  g.shake(0.3);
  sfx('boom');
}

// ---- marbles (orbit)
function updMarbles(g: Game, w: Weapon, dt: number) {
  const n = wcnt(g, w);
  orbit(g, w, n, 34 * warea(g, w), w.st.speed * g.p.s.projSpeed, dt, wd(g, w), 4, w.st.cooldown, 6 * warea(g, w) + 3, w.st.knockback, false);
}

// ---- mouse blaster: rapid volley
function updBlaster(g: Game, w: Weapon, dt: number) {
  const p = g.p;
  w.timer -= dt;
  if (w.timer > 0 || p.dead) return;
  const tgt = g.nearest(p.x, p.y, 200);
  if (!tgt) { w.timer = 0.2; return; }
  const a0 = Math.atan2(tgt.y - p.y, tgt.x - p.x);
  const n = wcnt(g, w);
  for (let i = 0; i < n; i++) {
    const pr = g.spawnProj('bullet');
    if (!pr) break;
    const a = a0 + rand(-0.09, 0.09);
    const sp = w.st.speed * p.s.projSpeed * rand(0.95, 1.1);
    pr.x = p.x - Math.cos(a) * i * 4; pr.y = p.y - Math.sin(a) * i * 4; pr.vx = Math.cos(a) * sp; pr.vy = Math.sin(a) * sp;
    pr.r = 2.5; pr.dmg = wd(g, w); pr.life = 0.9; pr.knock = w.st.knockback;
  }
  sfx('shoot');
  w.timer = wcd(g, w);
}

// ---- catarang: out and back
function updCatarang(g: Game, w: Weapon, dt: number) {
  const p = g.p;
  w.timer -= dt;
  if (w.timer > 0 || p.dead) return;
  const n = wcnt(g, w);
  const targets = g.nearestN(p.x, p.y, n, 200);
  for (let i = 0; i < n; i++) {
    const pr = g.spawnProj('catarang');
    if (!pr) break;
    const t = targets[i % Math.max(1, targets.length)];
    const a = t ? Math.atan2(t.y - p.y, t.x - p.x) + (i - (n - 1) / 2) * 0.35 : rand(0, TAU);
    const sp = w.st.speed * p.s.projSpeed;
    pr.x = p.x; pr.y = p.y; pr.vx = Math.cos(a) * sp; pr.vy = Math.sin(a) * sp; pr.x0 = sp;
    pr.r = 7 * warea(g, w); pr.dmg = wd(g, w); pr.life = 4; pr.pierce = 999; pr.knock = w.st.knockback; pr.spin = 14; pr.aux = 0; pr.aux2 = 0;
  }
  sfx('swing');
  w.timer = wcd(g, w);
}

// ---- scratching post: lands and shreds
function updScratcher(g: Game, w: Weapon, dt: number) {
  const p = g.p;
  w.timer -= dt;
  if (w.timer > 0 || p.dead) return;
  const n = wcnt(g, w);
  const used: Enemy[] = [];
  for (let i = 0; i < n; i++) {
    const e = g.randomEnemyNear(p.x, p.y, 140, used);
    if (e) used.push(e);
    const tx = e ? e.x : p.x + rand(-70, 70), ty = e ? e.y : p.y + rand(-50, 50);
    g.addFx({ k: 'spinner', x: p.x, y: p.y, x0: p.x, y0: p.y, tx, ty, t: 0, dur: 99, flight: 0.45, rest: wdur(g, w), r: 19 * warea(g, w), dmg: wd(g, w), kb: w.st.knockback, tickT: 0.1 });
  }
  sfx('swing');
  w.timer = wcd(g, w);
}

// ---- laser pointer: beam locked to a target, burns everything on the line
function updLaser(g: Game, w: Weapon, dt: number) {
  const p = g.p;
  w.timer -= dt;
  if (w.timer > 0 || p.dead) return;
  const n = wcnt(g, w);
  const targets = g.nearestN(p.x, p.y, n, 190);
  if (!targets.length) { w.timer = 0.3; return; }
  for (const t of targets) g.addFx({ k: 'laser', x: p.x, y: p.y, t: 0, dur: wdur(g, w), tgt: t, tickT: 0, dmg: wd(g, w), wid: 4 * warea(g, w) });
  sfx('zap');
  w.timer = wcd(g, w);
}
function laserHits(g: Game, f: Fx, tgt: Enemy) {
  const p = g.p;
  const dx = tgt.x - p.x, dy = tgt.y - p.y, len2 = dx * dx + dy * dy || 1;
  for (const e of g.act) {
    if (e.dying > 0) continue;
    const t = clamp(((e.x - p.x) * dx + (e.y - p.y) * dy) / len2, 0, 1.15);
    const cx = p.x + dx * t, cy = p.y + dy * t;
    if ((e.x - cx) ** 2 + (e.y - cy) ** 2 < (f.wid + e.r * 0.6) ** 2) g.hurtEnemy(e, f.dmg, dx / Math.sqrt(len2), dy / Math.sqrt(len2), 0);
  }
}

// ---- fluff shotgun
function updShotgun(g: Game, w: Weapon, dt: number) {
  const p = g.p;
  w.timer -= dt;
  if (w.timer > 0 || p.dead) return;
  const tgt = g.nearest(p.x, p.y, 150);
  if (!tgt) { w.timer = 0.2; return; }
  const a0 = Math.atan2(tgt.y - p.y, tgt.x - p.x);
  const n = wcnt(g, w);
  for (let i = 0; i < n; i++) {
    const pr = g.spawnProj('pellet');
    if (!pr) break;
    const a = a0 + (i - (n - 1) / 2) * (0.7 / Math.max(1, n - 1)) + rand(-0.05, 0.05);
    const sp = w.st.speed * p.s.projSpeed * rand(0.85, 1.1);
    pr.x = p.x; pr.y = p.y; pr.x0 = p.x; pr.y0 = p.y; pr.vx = Math.cos(a) * sp; pr.vy = Math.sin(a) * sp;
    pr.r = 2.5 * warea(g, w); pr.dmg = wd(g, w); pr.life = 0.45; pr.knock = w.st.knockback;
  }
  g.burst(p.x + Math.cos(a0) * 8, p.y + Math.sin(a0) * 8, 5, ['#fff', '#f0ecff'], 60, 0.25);
  sfx('boom');
  w.timer = wcd(g, w);
}

// ---- cold milk: freezing ring
function updColdMilk(g: Game, w: Weapon, dt: number) {
  const p = g.p;
  w.timer -= dt;
  if (w.timer > 0 || p.dead) return;
  g.addFx({ k: 'ring', x: p.x, y: p.y, t: 0, dur: 0.4, R: 46 * warea(g, w), dmg: wd(g, w), kb: w.st.knockback, hit: [] as Enemy[], freeze: wdur(g, w), col: '#bfe8ff' });
  sfx('hiss');
  w.timer = wcd(g, w);
}

// ---- zoomies twister
function updTwister(g: Game, w: Weapon, dt: number) {
  const p = g.p;
  w.timer -= dt;
  if (w.timer > 0 || p.dead) return;
  const n = wcnt(g, w);
  const off = rand(0, TAU);
  const targets = g.nearestN(p.x, p.y, n, 220);
  for (let i = 0; i < n; i++) {
    const pr = g.spawnProj('twister');
    if (!pr) break;
    const t = targets[i];
    const a = t ? Math.atan2(t.y - p.y, t.x - p.x) : off + (i * TAU) / n;
    const sp = w.st.speed * p.s.projSpeed;
    pr.x = p.x; pr.y = p.y; pr.vx = Math.cos(a) * sp; pr.vy = Math.sin(a) * sp;
    pr.r = 10 * warea(g, w); pr.dmg = wd(g, w); pr.life = wdur(g, w); pr.pierce = 999; pr.knock = w.st.knockback; pr.aux2 = warea(g, w);
  }
  sfx('hiss');
  w.timer = wcd(g, w);
}

// ---- void box: slow black hole
function updVoid(g: Game, w: Weapon, dt: number) {
  const p = g.p;
  w.timer -= dt;
  if (w.timer > 0 || p.dead) return;
  const n = wcnt(g, w);
  for (let i = 0; i < n; i++) {
    const t = g.randomEnemyNear(p.x, p.y, 150);
    const a = t ? Math.atan2(t.y - p.y, t.x - p.x) : rand(0, TAU);
    g.addFx({ k: 'hole', x: p.x + Math.cos(a) * 24, y: p.y + Math.sin(a) * 24, vx: Math.cos(a) * 26, vy: Math.sin(a) * 26, t: 0, dur: wdur(g, w), r: 54 * warea(g, w), dmg: wd(g, w), tickT: 0 });
  }
  sfx('paw');
  w.timer = wcd(g, w);
}

// ---- sour milk flask
function updFlask(g: Game, w: Weapon, dt: number) {
  const p = g.p;
  w.timer -= dt;
  if (w.timer > 0 || p.dead) return;
  const n = wcnt(g, w);
  const used: Enemy[] = [];
  for (let i = 0; i < n; i++) {
    const e = g.randomEnemyNear(p.x, p.y, 130, used);
    if (e) used.push(e);
    const tx = e ? e.x : p.x + rand(-70, 70), ty = e ? e.y : p.y + rand(-50, 50);
    g.addFx({ k: 'bomb', flask: true, x: p.x, y: p.y, x0: p.x, y0: p.y, tx, ty, t: 0, dur: 99, flight: 0.5 + i * 0.05, fuse: 0.02, r: 24 * warea(g, w), dmg: wd(g, w), rest: wdur(g, w), boomed: false });
  }
  sfx('shoot');
  w.timer = wcd(g, w);
}

// ---- lucky dice
function updDice(g: Game, w: Weapon, dt: number) {
  const p = g.p;
  w.timer -= dt;
  if (w.timer > 0 || p.dead) return;
  const n = wcnt(g, w);
  const targets = g.nearestN(p.x, p.y, n, 200);
  for (let i = 0; i < n; i++) {
    const pr = g.spawnProj('dice');
    if (!pr) break;
    const t = targets[i % Math.max(1, targets.length)];
    const a = t ? Math.atan2(t.y - p.y, t.x - p.x) + rand(-0.1, 0.1) : rand(0, TAU);
    const sp = w.st.speed * p.s.projSpeed;
    const roll = randInt(1, 6);
    pr.x = p.x; pr.y = p.y; pr.vx = Math.cos(a) * sp; pr.vy = Math.sin(a) * sp; pr.spin = 10;
    pr.r = 4 * warea(g, w); pr.dmg = wd(g, w) * roll; pr.aux = roll; pr.life = 1.1; pr.pierce = w.st.pierce; pr.knock = 20;
  }
  sfx('shoot');
  w.timer = wcd(g, w);
}

// ---- purr aura
function updPurr(g: Game, w: Weapon, dt: number) {
  const p = g.p;
  w.timer -= dt;
  if (w.timer > 0 || p.dead) return;
  g.areaDamage(p.x, p.y, 28 * warea(g, w), wd(g, w), w.st.knockback);
  w.timer = wcd(g, w);
}

// ------------------------------------------------------------------ projectiles
export function updateProjs(g: Game, dt: number) {
  const p = g.p;
  for (const pr of g.projs) {
    if (!pr.alive) continue;
    g.src = pr.src;
    pr.life -= dt;
    if (pr.lastT > 0) pr.lastT -= dt;
    if (pr.life <= 0) { if (!pr.hostile && (pr.kind === 'hairball' || pr.kind === 'mouse')) popProj(g, pr); else pr.alive = false; continue; }
    if (pr.kind === 'catarang') {
      pr.aux += dt;
      if (pr.aux2 === 0 && pr.aux >= 0.5) { pr.aux2 = 1; pr.hit.length = 0; }
      if (pr.aux2 === 1) {
        const dx = p.x - pr.x, dy = p.y - pr.y, d = Math.hypot(dx, dy) || 1;
        if (d < 9) { pr.alive = false; continue; }
        pr.vx = (dx / d) * pr.x0 * 1.15; pr.vy = (dy / d) * pr.x0 * 1.15;
      }
    }
    pr.rot += pr.spin * dt;
    if (pr.homing && !pr.hostile) {
      pr.aux -= dt;
      if (pr.aux <= 0) {
        pr.aux = pr.kind === 'mouse' ? 0.05 : 0.12;
        const t = g.nearest(pr.x, pr.y, pr.kind === 'mouse' ? 170 : 90);
        if (t) {
          const sp = Math.hypot(pr.vx, pr.vy);
          const want = Math.atan2(t.y - pr.y, t.x - pr.x);
          const cur = Math.atan2(pr.vy, pr.vx);
          const na = cur + clamp(angDiff(want, cur), -0.5, 0.5) * (pr.kind === 'mouse' ? 0.8 : 1);
          pr.vx = Math.cos(na) * sp; pr.vy = Math.sin(na) * sp;
        }
      }
    }
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;
    if (pr.hostile) {
      if (pr.x < -10 || pr.y < -10 || pr.x > WORLD_W + 10 || pr.y > WORLD_H + 10) { pr.alive = false; continue; }
      const dx = pr.x - p.x, dy = pr.y - p.y;
      if (dx * dx + dy * dy < (pr.r + 4) ** 2) {
        g.hurtPlayer(pr.dmg);
        if (pr.pierce-- <= 0) pr.alive = false;
      }
      continue;
    }
    // player projectile
    if (pr.kind === 'yarn') {
      if (pr.x < 6) { pr.x = 6; pr.vx = Math.abs(pr.vx); pr.bounce--; }
      else if (pr.x > WORLD_W - 6) { pr.x = WORLD_W - 6; pr.vx = -Math.abs(pr.vx); pr.bounce--; }
      if (pr.y < 6) { pr.y = 6; pr.vy = Math.abs(pr.vy); pr.bounce--; }
      else if (pr.y > WORLD_H - 6) { pr.y = WORLD_H - 6; pr.vy = -Math.abs(pr.vy); pr.bounce--; }
      if (pr.bounce < 0) { pr.alive = false; continue; }
    } else if (pr.x < -10 || pr.y < -10 || pr.x > WORLD_W + 10 || pr.y > WORLD_H + 10) { pr.alive = false; continue; }
    const cnt = g.queryEnemies(pr.x, pr.y, pr.r, tmp);
    for (let i = 0; i < cnt; i++) {
      const e = tmp[i];
      if (pr.kind === 'yarn') {
        if (e === pr.lastHit && pr.lastT > 0) continue;
        let nx = pr.x - e.x, ny = pr.y - e.y;
        const nl = Math.hypot(nx, ny) || 1;
        nx /= nl; ny /= nl;
        g.hurtEnemy(e, pr.dmg, -nx, -ny, pr.knock);
        const dot = pr.vx * nx + pr.vy * ny;
        const sp = Math.hypot(pr.vx, pr.vy);
        let vx = pr.vx - 2 * dot * nx + rand(-12, 12), vy = pr.vy - 2 * dot * ny + rand(-12, 12);
        const l = Math.hypot(vx, vy) || 1;
        vx = (vx / l) * sp; vy = (vy / l) * sp;
        pr.vx = vx; pr.vy = vy;
        pr.x = e.x + nx * (e.r + pr.r + 1); pr.y = e.y + ny * (e.r + pr.r + 1);
        pr.lastHit = e; pr.lastT = 0.15;
        pr.bounce--;
        if (pr.evo && pr.aux <= 0) {
          pr.aux = 0.45;
          g.addFx({ k: 'paw', x: e.x, y: e.y, t: 0, dur: 0.5, delay: 0.22, r: 20, dmg: pr.dmg * 0.9, kb: 40, smashed: false });
        }
        if (pr.bounce < 0) pr.alive = false;
        break;
      }
      if (pr.kind === 'twister') {
        if (e.tick[5] > 0) continue;
        e.tick[5] = 0.3;
        const l2 = Math.hypot(e.x - pr.x, e.y - pr.y) || 1;
        g.hurtEnemy(e, pr.dmg, (e.x - pr.x) / l2, (e.y - pr.y) / l2, pr.knock);
        continue;
      }
      if (pr.kind === 'hairball' || pr.kind === 'mouse') { popProj(g, pr); break; }
      if (pr.hit.includes(e)) continue;
      pr.hit.push(e);
      const l = Math.hypot(pr.vx, pr.vy) || 1;
      let fall = 1, cb = 0;
      if (pr.kind === 'pellet') fall = clamp(1.7 - Math.hypot(pr.x - pr.x0, pr.y - pr.y0) / 100, 0.55, 1.7);
      if (pr.kind === 'dice') {
        const dw = g.p.weapons.find((x) => x.def.id === 'dice');
        if (dw) { cb = dw.data.crit || 0; if (pr.aux === 6) dw.data.crit = Math.min(0.6, cb + 0.01); }
        if (pr.aux === 6) g.floatText(e.x, e.y - 10, '6!', '#ffd24a');
      }
      g.hurtEnemy(e, pr.dmg * fall, pr.vx / l, pr.vy / l, pr.knock, cb);
      if (pr.kind === 'fire') g.burst(pr.x, pr.y, 4, ['#ff7a2a', '#ffd24a'], 50, 0.3);
      if (pr.pierce-- <= 0) { pr.alive = false; break; }
    }
    if (pr.kind === 'yarn' && pr.aux > 0) pr.aux -= dt;
    if (pr.kind === 'hairball' && Math.random() < 0.3) g.spawnPart(pr.x, pr.y, rand(-8, 8), rand(-8, 8), 0.3, '#d8cbb8', 1, 0);
    if (pr.kind === 'fire' && Math.random() < 0.5) g.spawnPart(pr.x, pr.y, rand(-8, 8), rand(-8, 8), 0.25, Math.random() < 0.5 ? '#ff7a2a' : '#ffd24a', 1, 0);
  }
}

// ------------------------------------------------------------------ effects (slashes, rings, paws, bombs...)
const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
export function updateFx(g: Game, dt: number) {
  const p = g.p;
  for (let i = g.fx.length - 1; i >= 0; i--) {
    const f = g.fx[i];
    g.src = f.src || '';
    let done = false;
    switch (f.k) {
      case 'slash': {
        if (f.delay > 0) { f.delay -= dt; f.x = p.x; f.y = p.y; break; }
        if (!f.played) { f.played = true; sfx('swing'); }
        f.t += dt;
        f.x = p.x; f.y = p.y;
        const prog = Math.min(1, f.t / f.dur);
        const s = (-90 + 180 * prog) * D2R;
        const cnt = g.queryEnemies(f.x, f.y, f.R, tmp);
        for (let k = 0; k < cnt; k++) {
          const e = tmp[k];
          if (f.hit.includes(e)) continue;
          const ang = Math.atan2(e.y - f.y, e.x - f.x);
          const rel = angDiff(ang, f.a) * f.dir;
          if (rel >= -100 * D2R && rel <= s + 14 * D2R) {
            f.hit.push(e);
            g.hurtEnemy(e, f.dmg, Math.cos(ang), Math.sin(ang), f.kb);
          }
        }
        if (f.t >= f.dur + 0.06) done = true;
        break;
      }
      case 'ring': {
        f.t += dt;
        f.x = p.x; f.y = p.y;
        const rad = f.R * easeOut(Math.min(1, f.t / f.dur));
        const cnt = g.queryEnemies(f.x, f.y, rad + 4, tmp);
        for (let k = 0; k < cnt; k++) {
          const e = tmp[k];
          if (f.hit.includes(e)) continue;
          f.hit.push(e);
          if (f.freeze) { if (e.boss) e.slowT = f.freeze; else e.frozenT = f.freeze; }
          const ang = Math.atan2(e.y - f.y, e.x - f.x);
          g.hurtEnemy(e, f.dmg, Math.cos(ang), Math.sin(ang), f.kb);
        }
        if (f.t >= f.dur + 0.1) done = true;
        break;
      }
      case 'paw': {
        f.t += dt;
        if (!f.smashed && f.t >= f.delay) {
          f.smashed = true;
          g.areaDamage(f.x, f.y, f.r, f.dmg, f.kb);
          g.burst(f.x, f.y, 14, ['#ffc2d8', '#ff8fb4', '#fff'], 90, 0.45);
          g.shake(0.8);
          sfx('paw');
        }
        if (f.t >= f.dur) done = true;
        break;
      }
      case 'trail': {
        f.t += dt;
        f.tickT -= dt;
        if (f.tickT <= 0) {
          f.tickT = 0.3;
          const cnt = g.queryEnemies(f.x, f.y, f.r, tmp);
          for (let k = 0; k < cnt; k++) {
            const e = tmp[k];
            if (e.tick[2] > 0) continue;
            e.tick[2] = 0.3;
            g.hurtEnemy(e, f.dmg, 0, 0, 0);
          }
        }
        if (f.t >= f.dur) done = true;
        break;
      }
      case 'bomb': {
        f.t += dt;
        if (f.t < f.flight) {
          const u = f.t / f.flight;
          f.x = f.x0 + (f.tx - f.x0) * u;
          f.y = f.y0 + (f.ty - f.y0) * u;
          f.h = Math.sin(u * Math.PI) * 26;
        } else {
          f.x = f.tx; f.y = f.ty; f.h = 0;
          if (f.t >= f.flight + f.fuse && f.flask) {
            g.areaDamage(f.x, f.y, f.r * 0.8, f.dmg, 30);
            g.burst(f.x, f.y, 10, ['#b8e83a', '#f0ffb0', '#fff'], 70, 0.5);
            g.addFx({ k: 'cloud', x: f.x, y: f.y, t: 0, dur: f.rest, r: f.r * 1.5, dmg: f.dmg * 0.08, tickT: 0.1, poison: f.dmg * 0.3, c1: '#a8d02a', c2: '#e8ff70' });
            sfx('hit');
            done = true;
          } else if (f.t >= f.flight + f.fuse) {
            g.explode(f.x, f.y, f.r, f.dmg, 130, false);
            g.addFx({ k: 'cloud', x: f.x, y: f.y, t: 0, dur: 1.8 * g.p.s.dur, r: f.r * 0.9, dmg: f.dmg * 0.12, tickT: 0.2 });
            done = true;
          }
        }
        break;
      }
      case 'cloud': {
        f.t += dt;
        f.tickT -= dt;
        const tick = f.tickT <= 0;
        if (tick) f.tickT = 0.4;
        const cnt = g.queryEnemies(f.x, f.y, f.r, tmp);
        for (let k = 0; k < cnt; k++) {
          const e = tmp[k];
          if (f.poison) { e.poisonT = 2; e.poisonD = f.poison; if (e.poisonTick <= 0) e.poisonTick = 0.3; }
          else { if (e.slowT <= 0 && tick) addStat('slowed'); e.slowT = 0.3; }
          if (tick) g.hurtEnemy(e, f.dmg, 0, 0, 0);
        }
        if (f.t >= f.dur) done = true;
        break;
      }
      case 'boom': case 'bolt': f.t += dt; if (f.t >= f.dur) done = true; break;
      case 'spinner': {
        f.t += dt;
        if (f.t < f.flight) {
          const u = f.t / f.flight;
          f.x = f.x0 + (f.tx - f.x0) * u; f.y = f.y0 + (f.ty - f.y0) * u; f.h = Math.sin(u * Math.PI) * 22;
        } else {
          f.x = f.tx; f.y = f.ty; f.h = 0;
          f.tickT -= dt;
          if (f.tickT <= 0) { f.tickT = 0.28; g.areaDamage(f.x, f.y, f.r, f.dmg, f.kb); if (Math.random() < 0.7) g.burst(f.x, f.y, 3, ['#d8b078', '#fff', '#ff7aa8'], 50, 0.3); }
          if (f.t >= f.flight + f.rest) done = true;
        }
        break;
      }
      case 'laser': {
        f.t += dt;
        f.x = p.x; f.y = p.y;
        if (!f.tgt.alive || f.tgt.dying > 0) {
          const n = g.nearest(p.x, p.y, 190);
          if (!n) { done = true; break; }
          f.tgt = n;
        }
        f.tickT -= dt;
        if (f.tickT <= 0) { f.tickT = 0.2; laserHits(g, f, f.tgt); }
        if (f.t >= f.dur) done = true;
        break;
      }
      case 'hole': {
        f.t += dt;
        f.x += f.vx * dt; f.y += f.vy * dt;
        f.tickT -= dt;
        const tick = f.tickT <= 0;
        if (tick) f.tickT = 0.3;
        const cnt = g.queryEnemies(f.x, f.y, f.r, tmp);
        for (let k = 0; k < cnt; k++) {
          const e = tmp[k];
          const dx = f.x - e.x, dy = f.y - e.y, d = Math.hypot(dx, dy) || 1;
          const pull = (e.boss ? 14 : 75) * dt;
          e.x += (dx / d) * Math.min(pull, d); e.y += (dy / d) * Math.min(pull, d);
          if (tick && d < f.r * 0.7) g.hurtEnemy(e, f.dmg, 0, 0, 0);
        }
        if (f.t >= f.dur) { g.burst(f.x, f.y, 14, ['#9a6aff', '#fff', '#120a1e'], 90, 0.5); done = true; }
        break;
      }
      case 'tele': {
        f.t += dt;
        g.src = '';
        if (f.t >= f.dur) { if (f.done) f.done(g); done = true; }
        break;
      }
    }
    if (done) { g.fx[i] = g.fx[g.fx.length - 1]; g.fx.pop(); }
  }
}

// ------------------------------------------------------------------ drawing
export function drawProjs(g: Game, ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  const fr = Math.floor(g.time * 10) & 1;
  for (const pr of g.projs) {
    if (!pr.alive) continue;
    const sx = pr.x - cx, sy = pr.y - cy;
    if (sx < -20 || sy < -20 || sx > 340 || sy > 200) continue;
    const spr = S[pr.spr || pr.kind];
    if (!spr) continue;
    const cv = spr.f[fr % spr.f.length];
    if (pr.kind === 'twister') {
      ctx.save();
      ctx.translate(Math.round(sx), Math.round(sy));
      ctx.scale(pr.aux2, pr.aux2);
      ctx.drawImage(cv, -Math.floor(cv.width / 2), -Math.floor(cv.height / 2));
      ctx.restore();
    } else if (pr.kind === 'dice') {
      ctx.save();
      ctx.translate(Math.round(sx), Math.round(sy));
      ctx.rotate(pr.rot);
      { const dv = S.dice.f[(pr.aux - 1) % S.dice.f.length]; ctx.drawImage(dv, -Math.floor(dv.width / 2), -Math.floor(dv.height / 2)); }
      ctx.restore();
    } else if (pr.kind === 'fish' || pr.kind === 'yarn' || pr.kind === 'bone' || pr.kind === 'bullet' || pr.kind === 'catarang' || pr.kind === 'hairball') {
      ctx.save();
      ctx.translate(Math.round(sx), Math.round(sy));
      ctx.rotate(pr.kind === 'fish' ? Math.atan2(pr.vy, pr.vx) + Math.PI : pr.kind === 'bullet' ? Math.atan2(pr.vy, pr.vx) : pr.rot);
      ctx.drawImage(cv, -Math.floor(cv.width / 2), -Math.floor(cv.height / 2));
      ctx.restore();
    } else {
      drawCv(ctx, cv, sx, sy);
    }
  }
}

export function drawWeapons(g: Game, ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  for (const w of g.p.weapons) {
    const d = w.data;
    switch (w.def.id) {
      case 'sword':
        if (w.evolved && d.pos) {
          for (const pos of d.pos) {
            ctx.save();
            ctx.translate(Math.round(pos.x - cx), Math.round(pos.y - cy));
            ctx.rotate(pos.a + Math.PI / 2 + Math.PI);
            ctx.scale(0.8, 0.8);
            ctx.drawImage(X.holysword, -SW.gx, -SW.h / 2);
            ctx.restore();
          }
        }
        break;
      case 'marbles':
        if (d.pos) d.pos.forEach((pos: any, i: number) => drawCv(ctx, S[['marbleA', 'marbleB', 'marbleC'][i % 3]].f[0], pos.x - cx, pos.y - cy));
        break;
      case 'purr': {
        const r = 28 * w.st.area * g.p.s.area;
        const px = g.p.x - cx, py = g.p.y - cy;
        const ph = (g.time * 2) % 1;
        ctx.fillStyle = '#ff9ec0';
        ctx.globalAlpha = 0.5 * (1 - ph);
        const rr = r * (0.55 + 0.45 * ph);
        const n = Math.floor(rr * 1.4);
        for (let i = 0; i < n; i++) { const an = (i * TAU) / n; ctx.fillRect(Math.round(px + Math.cos(an) * rr), Math.round(py + Math.sin(an) * rr * 0.9), 1, 1); }
        ctx.globalAlpha = 0.09;
        for (let y = -r; y < r; y += 2) { const ww = Math.round(Math.sqrt(Math.max(0, r * r - y * y))); ctx.fillRect(Math.round(px - ww), Math.round(py + y * 0.9), ww * 2, 1); }
        ctx.globalAlpha = 1;
        break;
      }
      case 'shield':
        if (d.pos) for (const pos of d.pos) drawCv(ctx, S.shield.f[0], pos.x - cx, pos.y - cy);
        break;
      case 'dragon':
        if (d.pos) {
          const fr = Math.floor(g.time * 8) & 1;
          for (const pos of d.pos) {
            const cv = (pos.fr ? S.dragonP.fl : S.dragonP.f)[fr];
            drawCv(ctx, cv, pos.x - cx, pos.y - cy);
          }
        }
        break;
      case 'lightning':
        if (w.evolved && d.sd) {
          const fr = Math.floor(g.time * 8) & 1;
          drawCv(ctx, S.stormP.fl[fr], d.sd.x - cx, d.sd.y - cy);
        }
        break;
    }
  }
}

export function drawFx(g: Game, ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  for (const f of g.fx) {
    switch (f.k) {
      case 'slash': {
        if (f.delay > 0) break;
        const prog = Math.min(1, f.t / f.dur);
        const th = f.a + f.dir * (-90 + 180 * prog) * D2R;
        const px = f.x - cx, py = f.y - cy;
        // arc trail
        for (let i = 0; i < 9; i++) {
          const a = th - f.dir * i * 9 * D2R;
          const rel = angDiff(a, f.a) * f.dir;
          if (rel < -92 * D2R) break;
          const sz = i < 3 ? 3 : i < 6 ? 2 : 1;
          ctx.fillStyle = i < 3 ? (f.holy ? '#fff7c0' : '#ffffff') : f.holy ? '#ffd24a' : '#bfe4ff';
          ctx.globalAlpha = 1 - i * 0.09;
          ctx.fillRect(Math.round(px + Math.cos(a) * f.R * 0.92), Math.round(py + Math.sin(a) * f.R * 0.92), sz, sz);
        }
        ctx.globalAlpha = 1;
        ctx.save();
        ctx.translate(Math.round(px), Math.round(py));
        ctx.rotate(th + Math.PI / 2);
        const k = clamp(f.R / 32, 0.9, 1.9);
        ctx.scale(k, k);
        ctx.drawImage(f.holy ? X.holysword : X.sword, -SW.gx, -SW.slashY);
        ctx.restore();
        break;
      }
      case 'ring': {
        const rad = f.R * easeOut(Math.min(1, f.t / f.dur));
        const a = 1 - Math.min(1, f.t / (f.dur + 0.1));
        ctx.globalAlpha = Math.max(0.2, a);
        ctx.fillStyle = f.col || '#ffd0e4';
        const n = Math.max(12, Math.floor(rad * 0.9));
        for (let i = 0; i < n; i++) {
          const an = (i * TAU) / n;
          ctx.fillRect(Math.round(f.x - cx + Math.cos(an) * rad), Math.round(f.y - cy + Math.sin(an) * rad), 2, 2);
        }
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < n; i += 2) {
          const an = (i * TAU) / n + 0.05;
          ctx.fillRect(Math.round(f.x - cx + Math.cos(an) * (rad - 3)), Math.round(f.y - cy + Math.sin(an) * (rad - 3)), 1, 1);
        }
        ctx.globalAlpha = 1;
        break;
      }
      case 'paw': {
        const sx = f.x - cx, sy = f.y - cy;
        if (!f.smashed) {
          const u = Math.min(1, f.t / f.delay);
          ctx.fillStyle = 'rgba(30,20,50,0.35)';
          const rr = Math.round(f.r * (0.4 + 0.6 * u));
          for (let y = -rr * 0.6; y <= rr * 0.6; y += 2) {
            const w = Math.round(Math.sqrt(Math.max(0, 1 - (y / (rr * 0.6)) ** 2)) * rr);
            ctx.fillRect(Math.round(sx - w), Math.round(sy + y), w * 2, 2);
          }
          const h = (1 - u * u) * 120;
          ctx.globalAlpha = 0.45 + 0.4 * u;
          drawCv(ctx, S.paw.f[0], sx, sy - 14 - h);
          ctx.globalAlpha = 1;
        } else {
          const u = (f.t - f.delay) / (f.dur - f.delay);
          ctx.globalAlpha = Math.max(0, 0.8 - u);
          const sc = f.r / 26;
          ctx.save();
          ctx.translate(Math.round(sx), Math.round(sy - 6));
          ctx.scale(sc, sc);
          ctx.drawImage(S.paw.f[0], -Math.floor(S.paw.W / 2), -Math.floor(S.paw.H / 2));
          ctx.restore();
          ctx.globalAlpha = 1;
        }
        break;
      }
      case 'trail': {
        const u = 1 - f.t / f.dur;
        ctx.globalAlpha = Math.max(0, u);
        ctx.fillStyle = '#9ae0ff';
        ctx.fillRect(Math.round(f.x - cx) - 3, Math.round(f.y - cy) - 2, 6, 5);
        ctx.fillStyle = '#e8faff';
        ctx.fillRect(Math.round(f.x - cx) - 1, Math.round(f.y - cy) - 1, 2, 3);
        ctx.globalAlpha = 1;
        break;
      }
      case 'bomb': {
        const sx = f.x - cx, sy = f.y - cy - (f.h || 0);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(Math.round(sx) - 3, Math.round(f.y - cy) + 2, 7, 2);
        const fuse = f.t - f.flight;
        const blink = fuse > 0 && Math.floor(fuse * (6 + fuse * 14)) % 2 === 0;
        if (f.flask) { ctx.save(); ctx.translate(Math.round(sx), Math.round(sy)); ctx.rotate(f.t * 10); ctx.drawImage(S.flask.f[0], -Math.floor(S.flask.W / 2), -Math.floor(S.flask.H / 2)); ctx.restore(); }
        else drawCv(ctx, blink ? S.bomb.w[0] : S.bomb.f[Math.floor(g.time * 8) & 1], sx, sy);
        break;
      }
      case 'cloud': {
        const u = f.t / f.dur;
        ctx.globalAlpha = 0.55 * (1 - u * u);
        for (let i = 0; i < 26; i++) {
          const a = (i * 2.399963) + g.time * 0.4;
          const rr = Math.sqrt((i + 1) / 26) * f.r;
          const x = f.x - cx + Math.cos(a) * rr, y = f.y - cy + Math.sin(a) * rr * 0.8;
          ctx.fillStyle = i % 3 ? (f.c1 || '#58c878') : (f.c2 || '#b8ffcc');
          const s = 2 + ((i + Math.floor(g.time * 6)) % 3);
          ctx.fillRect(Math.round(x), Math.round(y), s, s);
        }
        ctx.globalAlpha = 1;
        break;
      }
      case 'spinner': {
        const sx = f.x - cx, sy = f.y - cy - (f.h || 0);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(Math.round(sx) - 6, Math.round(f.y - cy) + 3, 12, 2);
        const sc = f.r / 19; // spinner scale
        ctx.save();
        ctx.translate(Math.round(sx), Math.round(sy));
        ctx.rotate(f.t * 14);
        ctx.scale(Math.max(0.8, sc), Math.max(0.8, sc));
        ctx.drawImage(S.scratcher.f[0], -Math.floor(S.scratcher.W / 2), -Math.floor(S.scratcher.H / 2));
        ctx.restore();
        break;
      }
      case 'laser': {
        const tx = f.tgt.x - cx, ty = f.tgt.y - cy, sx = f.x - cx, sy = f.y - cy - 4;
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = '#ff3b3b';
        ctx.beginPath(); line(ctx, sx, sy, tx, ty, 2); ctx.fill();
        ctx.fillStyle = '#ffd0d0';
        ctx.beginPath(); line(ctx, sx, sy, tx, ty, 1); ctx.fill();
        ctx.fillStyle = '#ff3b3b';
        const r = 2 + (Math.floor(g.time * 14) & 1);
        ctx.fillRect(Math.round(tx) - r, Math.round(ty) - r, r * 2, r * 2);
        ctx.fillStyle = '#fff';
        ctx.fillRect(Math.round(tx) - 1, Math.round(ty) - 1, 2, 2);
        ctx.globalAlpha = 1;
        break;
      }
      case 'hole': {
        const sx = f.x - cx, sy = f.y - cy;
        const u = f.t / f.dur;
        const fade = u > 0.85 ? (1 - u) / 0.15 : Math.min(1, f.t * 4);
        ctx.globalAlpha = fade;
        for (let i = 0; i < 40; i++) {
          const k = (i / 40 + g.time * 0.35) % 1;
          const rr = f.r * (1 - k) * 0.95;
          const an = i * 2.4 + (1 - k) * 5;
          ctx.fillStyle = i % 3 ? '#9a6aff' : '#d8c0ff';
          ctx.fillRect(Math.round(sx + Math.cos(an) * rr), Math.round(sy + Math.sin(an) * rr * 0.8), 1 + (i % 2), 1);
        }
        ctx.fillStyle = '#120a1e';
        for (let y = -8; y <= 8; y += 2) { const w = Math.round(Math.sqrt(64 - y * y)); ctx.fillRect(Math.round(sx - w), Math.round(sy + y), w * 2, 2); }
        ctx.fillStyle = '#5a3aa8';
        ctx.fillRect(Math.round(sx) - 3, Math.round(sy) - 1, 2, 1);
        ctx.globalAlpha = 1;
        break;
      }
      case 'boom': {
        const u = f.t / f.dur;
        const rad = f.r * easeOut(u);
        const sx = f.x - cx, sy = f.y - cy;
        ctx.globalAlpha = 1 - u;
        if (u < 0.35) {
          ctx.fillStyle = f.col2 || '#fff7c0';
          for (let y = -rad; y <= rad; y += 2) {
            const w = Math.round(Math.sqrt(Math.max(0, rad * rad - y * y)));
            ctx.fillRect(Math.round(sx - w), Math.round(sy + y), w * 2, 2);
          }
        }
        ctx.fillStyle = f.col || '#ff9a3a';
        const n = Math.max(16, Math.floor(rad * 1.2));
        for (let i = 0; i < n; i++) {
          const an = (i * TAU) / n;
          ctx.fillRect(Math.round(sx + Math.cos(an) * rad), Math.round(sy + Math.sin(an) * rad * 0.9), 3, 3);
        }
        ctx.globalAlpha = 1;
        break;
      }
      case 'bolt': {
        const a = 1 - f.t / f.dur;
        ctx.globalAlpha = Math.max(0.3, a);
        ctx.fillStyle = '#ffe14a';
        ctx.beginPath();
        for (let i = 0; i < f.pts.length - 1; i++) line(ctx, f.pts[i].x - cx - 1, f.pts[i].y - cy, f.pts[i + 1].x - cx - 1, f.pts[i + 1].y - cy, 3);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        for (let i = 0; i < f.pts.length - 1; i++) line(ctx, f.pts[i].x - cx, f.pts[i].y - cy, f.pts[i + 1].x - cx, f.pts[i + 1].y - cy, 1);
        ctx.fill();
        ctx.globalAlpha = 1;
        break;
      }
      case 'tele': {
        const u = f.t / f.dur;
        const sx = f.x - cx, sy = f.y - cy;
        const pulse = 0.18 + 0.12 * Math.sin(f.t * 22);
        ctx.fillStyle = `rgba(255,40,40,${pulse + u * 0.2})`;
        if (f.shape === 'circle') {
          const rr = f.r;
          for (let y = -rr; y <= rr; y += 2) {
            const w = Math.round(Math.sqrt(Math.max(0, rr * rr - y * y)));
            ctx.fillRect(Math.round(sx - w), Math.round(sy + y), w * 2, 2);
          }
          ctx.fillStyle = 'rgba(255,200,200,0.7)';
          const rr2 = f.r * u;
          const n = Math.max(12, Math.floor(rr2));
          for (let i = 0; i < n; i++) { const an = (i * TAU) / n; ctx.fillRect(Math.round(sx + Math.cos(an) * rr2), Math.round(sy + Math.sin(an) * rr2), 1, 1); }
        } else {
          const half = f.spread / 2;
          for (let rr = 4; rr < f.r; rr += 2) {
            const steps = Math.max(2, Math.floor((rr * f.spread) / 3));
            for (let i = 0; i <= steps; i++) {
              const an = f.a - half + (f.spread * i) / steps;
              if (rr > f.r * u + 4 && (rr + i) % 2) continue;
              ctx.fillRect(Math.round(sx + Math.cos(an) * rr), Math.round(sy + Math.sin(an) * rr), 2, 2);
            }
          }
        }
        break;
      }
    }
  }
}
