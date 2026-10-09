// Boss AI: every boss has its own movement, telegraphed attacks and a phase change at 50% HP.
import type { Game } from './game';
import { Enemy } from './types';
import { angDiff, rand } from './util';
import { sfx } from './audio';

const go = (e: Enemy, st: number, t: number) => { e.st = st; e.stT = t; };

function move(g: Game, e: Enemy, tx: number, ty: number, speed: number, dt: number) {
  const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy) || 1;
  e.x += (dx / d) * speed * dt;
  e.y += (dy / d) * speed * dt;
  if (Math.abs(dx) > 2) e.face = dx > 0 ? 1 : -1;
}
function ring(g: Game, e: Enemy, n: number, speed: number, dmg: number, kind: string, off = 0) {
  for (let i = 0; i < n; i++) g.enemyShot(e.x, e.y, off + (i * Math.PI * 2) / n, speed, dmg, kind, 5);
}

export function updateBoss(g: Game, e: Enemy, dt: number) {
  const p = g.p;
  e.stT -= dt;
  e.ph = e.hp < e.maxHp * 0.5 ? 2 : 1;
  switch (e.boss!.id) {
    case 'dog': dog(g, e, dt); break;
    case 'roobo': roobo(g, e, dt); break;
    case 'dragon': dragon(g, e, dt); break;
    case 'knight': knight(g, e, dt); break;
    case 'cateater': cateater(g, e, dt); break;
  }
  void p;
}

// ---- THE EVIL DOG: chase, wind-up, charge, howl (summons rats)
function dog(g: Game, e: Enemy, dt: number) {
  const p = g.p;
  const sp = e.speed * (e.ph === 2 ? 1.3 : 1);
  switch (e.st) {
    case 0:
      move(g, e, p.x, p.y, sp, dt);
      if (e.stT <= 0) { go(e, 1, 0.8); g.floatText(e.x, e.y - 30, '!', '#ff4d4d'); }
      break;
    case 1: {
      e.flash = Math.max(e.flash, 0.02);
      e.x += rand(-0.5, 0.5);
      const d = Math.hypot(p.x - e.x, p.y - e.y) || 1;
      e.ax = (p.x - e.x) / d; e.ay = (p.y - e.y) / d;
      if (e.stT <= 0) { go(e, 2, 0.75); sfx('dash'); }
      break;
    }
    case 2: {
      const cs = e.ph === 2 ? 290 : 235;
      e.x += e.ax * cs * dt; e.y += e.ay * cs * dt;
      e.face = e.ax > 0 ? 1 : -1;
      if (Math.random() < 0.6) g.spawnPart(e.x, e.y + 10, rand(-20, 20), rand(-20, 0), 0.4, '#c8a878', 2, 0);
      if (e.stT <= 0) { go(e, 3, 0.7); ring(g, e, 8, 80, 8, 'dust'); g.shake(1.5); sfx('boom'); }
      break;
    }
    case 3:
      if (e.stT <= 0) {
        e.c1++;
        if (e.c1 % 2 === 0) { go(e, 4, 1.1); g.floatText(e.x, e.y - 34, 'AROOOO!', '#ffd24a'); sfx('hiss'); g.shake(1); }
        else go(e, 0, e.ph === 2 ? 2.2 : 3.2);
      }
      break;
    case 4:
      if (e.c2 === 0) {
        e.c2 = 1;
        for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.spawnEnemy('rat', e.x + Math.cos(a) * 34, e.y + Math.sin(a) * 34); }
        if (e.ph === 2) for (let i = 0; i < 3; i++) g.spawnEnemy('bat', e.x + rand(-40, 40), e.y + rand(-40, 40));
      }
      if (e.stT <= 0) { e.c2 = 0; go(e, 0, e.ph === 2 ? 2.2 : 3.2); }
      break;
  }
}

// ---- ANCIENT ROOBO: drift, suction, dust spiral, summons mini vacuums
function roobo(g: Game, e: Enemy, dt: number) {
  const p = g.p;
  const sp = e.speed * (e.ph === 2 ? 1.5 : 1);
  switch (e.st) {
    case 0:
      move(g, e, p.x, p.y, sp, dt);
      if (e.stT <= 0) { go(e, 1, 2.6); g.floatText(e.x, e.y - 34, 'SUCK!', '#ff4d4d'); sfx('hiss'); }
      break;
    case 1:
      g.pullPlayer(e.x, e.y, e.ph === 2 ? 105 : 85, 230);
      e.x += rand(-0.3, 0.3);
      if (Math.random() < 0.7) {
        const a = rand(0, Math.PI * 2), r = rand(60, 120);
        g.spawnPart(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r, -Math.cos(a) * 90, -Math.sin(a) * 90, 0.6, '#c4cbd9', 1, 0);
      }
      if (e.stT <= 0) { go(e, 2, 2.0); e.c3 = 0; }
      break;
    case 2:
      e.c3 -= dt;
      if (e.c3 <= 0) {
        e.c3 = 0.11;
        const arms = e.ph === 2 ? 4 : 2;
        for (let i = 0; i < arms; i++) g.enemyShot(e.x, e.y, e.c1 + (i * Math.PI * 2) / arms, 70, 9, 'dust', 5);
        e.c1 += 0.45;
      }
      if (e.stT <= 0) { go(e, e.c2++ % 2 === 0 ? 3 : 0, e.c2 % 2 === 1 ? 0.8 : 3.2); }
      break;
    case 3:
      if (e.stT <= 0.4 && e.c2 > 0 && e.c1 !== -99) {
        e.c1 = -99;
        for (let i = 0; i < 2; i++) g.spawnEnemy('vacuum', e.x + (i ? 40 : -40), e.y + 10);
      }
      if (e.stT <= 0) { e.c1 = 0; go(e, 0, 3.2); }
      break;
  }
}

// ---- THE DRAGON: circles overhead, fan shots, fire breath, dive bombs, ring burst in phase 2
function dragon(g: Game, e: Enemy, dt: number) {
  const p = g.p;
  e.c1 += dt * (e.ph === 2 ? 0.9 : 0.65);
  const tx = p.x + Math.cos(e.c1) * 100, ty = p.y + Math.sin(e.c1) * 72;
  if (e.st !== 3 && e.st !== 2) {
    e.x += (tx - e.x) * Math.min(1, dt * 1.6);
    e.y += (ty - e.y) * Math.min(1, dt * 1.6);
    e.face = p.x > e.x ? 1 : -1;
  }
  if (e.ph === 2 && e.st !== 3) {
    e.c3 -= dt;
    if (e.c3 <= 0) { e.c3 = 5; ring(g, e, 14, 70, 11, 'bossfire', rand(0, 6)); g.shake(1); sfx('boom'); }
  }
  switch (e.st) {
    case 0:
      e.c2 -= dt;
      if (e.c2 <= 0) {
        e.c2 = e.ph === 2 ? 1.1 : 1.6;
        const a = Math.atan2(p.y - e.y, p.x - e.x);
        for (let i = -1; i <= 1; i++) g.enemyShot(e.x, e.y + 12, a + i * 0.28, 95, 11, 'bossfire', 4);
        sfx('shoot');
      }
      if (e.stT <= 0) {
        if (e.home++ % 2 === 0) { go(e, 1, 1.8); g.floatText(e.x, e.y - 40, 'FIRE!', '#ff9a3a'); sfx('hiss'); }
        else { go(e, 2, 0.8); e.ax = p.x; e.ay = p.y; g.addFx({ k: 'tele', shape: 'circle', x: p.x, y: p.y, a: 0, r: 22, spread: 0, t: 0, dur: 0.8, done: null }); }
      }
      break;
    case 1: {
      e.c2 -= dt;
      if (e.c2 <= 0) {
        e.c2 = 0.07;
        const a = Math.atan2(p.y - e.y, p.x - e.x) + rand(-0.3, 0.3);
        g.enemyShot(e.x, e.y + 12, a, 110, 10, 'bossfire', 3);
      }
      if (e.stT <= 0) { go(e, 0, 5.5); e.c2 = 0.5; }
      break;
    }
    case 2: // dive windup
      e.x += (e.ax - e.x) * Math.min(1, dt * 1.2);
      e.y += (e.ay - 90 - e.y) * Math.min(1, dt * 3);
      if (e.stT <= 0) { go(e, 3, 0.55); const d = Math.hypot(e.ax - e.x, e.ay - e.y) || 1; e.c2 = (e.ax - e.x) / d; e.c3 = (e.ay - e.y) / d; sfx('dash'); }
      break;
    case 3:
      e.x += e.c2 * 300 * dt; e.y += e.c3 * 300 * dt;
      if (e.stT <= 0) { go(e, 0, 5); e.c2 = 0.8; e.c3 = 2; g.burst(e.x, e.y, 14, ['#ff7a2a', '#ffd24a'], 90, 0.5); g.shake(1.4); }
      break;
  }
}

// ---- THE DARK KNIGHT: telegraphed slashes, leap slam, skeleton summons
function knight(g: Game, e: Enemy, dt: number) {
  const p = g.p;
  e.c3 -= dt;
  switch (e.st) {
    case 0:
      move(g, e, p.x, p.y, e.speed * (e.ph === 2 ? 1.4 : 1), dt);
      if (e.stT <= 0) {
        const r = Math.random();
        if (r < 0.28 && e.c3 <= 0) { go(e, 5, 1.1); g.floatText(e.x, e.y - 44, 'ARISE!', '#ff4d4d'); }
        else if (r < 0.55) { go(e, 3, 0.9); e.ax = p.x; e.ay = p.y; g.addFx({ k: 'tele', shape: 'circle', x: e.ax, y: e.ay, a: 0, r: 44, spread: 0, t: 0, dur: 0.9, done: null }); sfx('hiss'); }
        else { go(e, 1, 0.7); e.c1 = 0; slashTele(g, e, 0.7); }
      }
      break;
    case 1:
      if (e.stT <= 0) {
        e.c1++;
        if (e.c1 < (e.ph === 2 ? 3 : 2)) { go(e, 1, 0.5); slashTele(g, e, 0.5); }
        else go(e, 0, 2.2);
      }
      break;
    case 3: // leap windup
      e.c2 = Math.min(1, e.c2 + dt * 2);
      if (e.stT <= 0) {
        e.x = e.ax; e.y = e.ay; e.c2 = 0;
        g.explode(e.x, e.y, 44, 0, 0, false, true);
        if (Math.hypot(p.x - e.x, p.y - e.y) < 44) g.hurtPlayer(e.dmg * 1.3);
        ring(g, e, e.ph === 2 ? 14 : 10, 80, 10, 'orb', rand(0, 3));
        g.shake(2); sfx('boom');
        go(e, 0, e.ph === 2 ? 1.6 : 2.4);
      }
      break;
    case 5:
      if (e.stT <= 0.5 && e.c1 !== -9) {
        e.c1 = -9;
        for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2; g.spawnEnemy('skeleton', e.x + Math.cos(a) * 40, e.y + Math.sin(a) * 40); }
        if (e.ph === 2) for (let i = 0; i < 2; i++) g.spawnEnemy('wizard', e.x + rand(-50, 50), e.y + rand(-50, 50));
      }
      if (e.stT <= 0) { e.c1 = 0; e.c3 = 14; go(e, 0, 2.2); }
      break;
  }
}
function slashTele(g: Game, e: Enemy, dur: number) {
  const p = g.p;
  const a = Math.atan2(p.y - e.y, p.x - e.x);
  e.face = Math.cos(a) > 0 ? 1 : -1;
  const sx = e.x, sy = e.y;
  g.addFx({
    k: 'tele', shape: 'cone', x: sx, y: sy, a, r: 66, spread: 1.9, t: 0, dur,
    done: (gg: Game) => {
      const pp = gg.p;
      const ang = Math.atan2(pp.y - sy, pp.x - sx);
      if (Math.hypot(pp.x - sx, pp.y - sy) < 66 + 4 && Math.abs(angDiff(ang, a)) < 0.95) gg.hurtPlayer(e.dmg * 1.2);
      gg.burst(sx + Math.cos(a) * 40, sy + Math.sin(a) * 40, 10, ['#fff', '#ff7a7a'], 100, 0.3);
      gg.shake(0.8); sfx('swing');
    },
  });
}

// ---- THE CAT EATER (final): bullet spirals, devouring circles, summons, lunge
function cateater(g: Game, e: Enemy, dt: number) {
  const p = g.p;
  const sp = e.speed * (e.ph === 2 ? 1.7 : 1);
  switch (e.st) {
    case 0:
      move(g, e, p.x, p.y, sp, dt);
      if (e.stT <= 0) {
        const pick = e.home++ % (e.ph === 2 ? 4 : 3);
        if (pick === 0) { go(e, 1, 4.2); g.floatText(e.x, e.y - 50, 'MEOW?', '#ff4d4d'); }
        else if (pick === 1) { go(e, 2, 2.4); e.c2 = 0; }
        else if (pick === 2) go(e, 3, 1.2);
        else { go(e, 4, 0.9); g.addFx({ k: 'tele', shape: 'circle', x: p.x, y: p.y, a: 0, r: 16, spread: 0, t: 0, dur: 0.9, done: null }); }
      }
      break;
    case 1: {
      move(g, e, p.x, p.y, sp * 0.6, dt);
      e.c3 -= dt;
      if (e.c3 <= 0) {
        e.c3 = e.ph === 2 ? 0.075 : 0.1;
        const arms = e.ph === 2 ? 5 : 3;
        for (let i = 0; i < arms; i++) g.enemyShot(e.x, e.y + 10, e.c1 + (i * Math.PI * 2) / arms, 58, 10, 'orb', 6);
        e.c1 += 0.42;
      }
      if (e.stT <= 0) go(e, 0, 1.6);
      break;
    }
    case 2: {
      const t = 2.4 - e.stT;
      if (e.c2 < 3 && t >= e.c2 * 0.6) {
        const lead = e.c2 * 0.5;
        const tx = p.x + g.pvx * lead * 0.6, ty = p.y + g.pvy * lead * 0.6;
        e.c2++;
        g.addFx({
          k: 'tele', shape: 'circle', x: tx, y: ty, a: 0, r: 34, spread: 0, t: 0, dur: 0.9,
          done: (gg: Game) => {
            if (Math.hypot(gg.p.x - tx, gg.p.y - ty) < 34) gg.hurtPlayer(e.dmg);
            gg.burst(tx, ty, 14, ['#8a1030', '#ff4d4d', '#fff'], 90, 0.5);
            gg.shake(1); sfx('boom');
          },
        });
      }
      if (e.stT <= 0) go(e, 0, 1.4);
      break;
    }
    case 3:
      if (e.stT <= 0.6 && e.c1 !== -9) {
        e.c1 = -9;
        const pool = ['goblin', 'skeleton', 'wolf', 'bat', 'orc'];
        for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; g.spawnEnemy(pool[i % pool.length], e.x + Math.cos(a) * 60, e.y + Math.sin(a) * 60); }
        sfx('hiss');
      }
      if (e.stT <= 0) { e.c1 = 0; go(e, 0, 1.6); }
      break;
    case 4: {
      if (e.stT > 0.1) {
        const d = Math.hypot(p.x - e.x, p.y - e.y) || 1;
        e.ax = (p.x - e.x) / d; e.ay = (p.y - e.y) / d;
        e.x += rand(-0.6, 0.6);
      } else { go(e, 5, 0.85); sfx('dash'); }
      break;
    }
    case 5:
      e.x += e.ax * 210 * dt; e.y += e.ay * 210 * dt;
      if (e.stT <= 0) { go(e, 0, 1.4); ring(g, e, 12, 70, 10, 'orb'); g.shake(1.5); }
      break;
  }
}
