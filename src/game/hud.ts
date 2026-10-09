// Canvas HUD, drawn in the same 320x180 pixel grid as the game.
import type { Game } from './game';
import { drawText, textWidth } from './font';
import { ICON, S } from './sprites';
import { EVO_BY_ID, PASSIVE_BY_ID } from './data';
import { clamp, fmtNum, fmtTime, W, H } from './util';

type C = CanvasRenderingContext2D;

export function panel(ctx: C, x: number, y: number, w: number, h: number, fill = 'rgba(20,14,34,0.78)', border = '#6b5a8e') {
  ctx.fillStyle = '#0c0814';
  ctx.fillRect(x - 1, y + 1, w + 2, h);
  ctx.fillStyle = border;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(x + 1, y + 1, w - 2, 1);
}

function bar(ctx: C, x: number, y: number, w: number, h: number, frac: number, col: string, hi: string, bg = '#1a1226') {
  ctx.fillStyle = '#0c0814';
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  const fw = Math.round(w * clamp(frac, 0, 1));
  if (fw > 0) {
    ctx.fillStyle = col;
    ctx.fillRect(x, y, fw, h);
    ctx.fillStyle = hi;
    ctx.fillRect(x, y, fw, 1);
  }
}

export function drawHUD(g: Game, ctx: C) {
  const p = g.p;
  // --- top-left: portrait, HP, level, XP
  panel(ctx, 2, 2, 24, 22);
  const k = S.kitten.f[p.flash > 0.1 ? 5 : 0];
  ctx.drawImage(k, Math.round(k.width * 0.2), 1, Math.round(k.width * 0.6), Math.round(k.height * 0.42), 3, 3, 22, 20);
  const hpFrac = p.hp / p.s.maxHp;
  bar(ctx, 30, 4, 76, 8, hpFrac, hpFrac < 0.3 ? '#ff5a5a' : '#e8344f', '#ff9aa8');
  if (p.s.shieldMax > 0) {
    ctx.fillStyle = '#0c0814'; ctx.fillRect(29, 12, 78, 3);
    ctx.fillStyle = '#6ac8ff'; ctx.fillRect(30, 12, Math.round(76 * clamp(p.shield / p.s.shieldMax, 0, 1)), 2);
  }
  drawText(ctx, `${Math.ceil(p.hp)}/${Math.round(p.s.maxHp)}`, 68, 6, '#fff', '#3a0a14', 'c');
  drawText(ctx, `LV ${p.lvl}`, 30, 14, '#ffe680', '#000');
  bar(ctx, 30, 21, 76, 3, p.xp / p.xpNext, '#4aa8ff', '#bfe4ff');

  // --- top-right: time / kills / gold (icons are 16px, so rows are 17px apart)
  const rx = W - 4;
  const stat = (icon: HTMLCanvasElement, row: number, text: string, col: string) => {
    const y = 2 + row * 17;
    ctx.drawImage(icon, rx - 56 + Math.round((16 - icon.width) / 2), y + Math.round((16 - icon.height) / 2));
    drawText(ctx, text, rx, y + 6, col, '#000', 'r');
  };
  stat(ICON.clock, 0, fmtTime(g.time), '#fff');
  stat(ICON.skull, 1, fmtNum(g.kills), '#ffd0d0');
  stat(ICON.coin, 2, fmtNum(g.goldRun), '#ffe680');

  // --- combo
  if (g.combo >= 5 && g.comboT > 0) {
    const big = g.combo >= 50;
    const txt = big ? 'RAMPAGE!' : `COMBO X${g.combo}`;
    drawText(ctx, big ? `RAMPAGE! X${g.combo}` : txt, rx, 56, big ? '#ff6a3a' : '#ffd24a', '#000', 'r', big ? 1 : 1);
    ctx.fillStyle = '#000';
    ctx.fillRect(rx - 40, 64, 41, 3);
    ctx.fillStyle = big ? '#ff6a3a' : '#ffd24a';
    ctx.fillRect(rx - 39, 65, Math.round(39 * clamp(g.comboT / 2.4, 0, 1)), 1);
  }

  // --- boss bar
  const boss = g.activeBoss;
  if (boss && boss.boss) {
    const bw = 190, bx = Math.round((W - bw) / 2);
    drawText(ctx, boss.boss.name, W / 2, 3, '#ffd0d0', '#3a0a14', 'c');
    const frac = boss.hp / boss.maxHp;
    ctx.fillStyle = '#0c0814';
    ctx.fillRect(bx - 2, 9, bw + 4, 9);
    ctx.fillStyle = '#6b5a8e';
    ctx.fillRect(bx - 1, 10, bw + 2, 7);
    ctx.fillStyle = '#2a0a12';
    ctx.fillRect(bx, 11, bw, 5);
    ctx.fillStyle = '#ffc0c0'; // damage "chip" trail
    ctx.fillRect(bx, 11, Math.round(bw * clamp(boss.hpShown, 0, 1)), 5);
    ctx.fillStyle = '#d6203a';
    ctx.fillRect(bx, 11, Math.round(bw * clamp(frac, 0, 1)), 5);
    ctx.fillStyle = '#ff7a8a';
    ctx.fillRect(bx, 11, Math.round(bw * clamp(frac, 0, 1)), 1);
    for (let i = 1; i < 10; i++) { ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(bx + i * 19, 11, 1, 5); }
  }

  // --- bottom-left: weapons + passives
  const slot = (i: number, row: number, icon: string, lvl: number, col: string) => {
    const x = 3 + i * 21, y = row === 0 ? H - 23 : H - 45;
    panel(ctx, x, y, 20, 20, 'rgba(20,14,34,0.7)', col);
    const cv = ICON[icon] || ICON.locked;
    ctx.drawImage(cv, x + Math.round((20 - cv.width) / 2), y + Math.round((20 - cv.height) / 2));
    drawText(ctx, String(lvl), x + 19, y + 14, '#fff', '#000', 'r');
  };
  p.weapons.forEach((w, i) => slot(i, 0, w.evolved ? EVO_BY_ID[w.evoId].icon : w.def.icon, w.level, w.evolved ? '#ffc43a' : w.level >= 8 ? '#c36bff' : '#6b5a8e'));
  p.passives.forEach((ps, i) => slot(i, 1, PASSIVE_BY_ID[ps.id].icon, ps.level, ps.level >= PASSIVE_BY_ID[ps.id].max ? '#c36bff' : '#4a4a6a'));

  // --- dash indicator
  const dReady = p.dashCd <= 0;
  const dx = W / 2 - 22, dy = H - 9;
  ctx.fillStyle = '#0c0814';
  ctx.fillRect(dx - 1, dy - 1, 45, 6);
  ctx.fillStyle = '#22304a';
  ctx.fillRect(dx, dy, 43, 4);
  ctx.fillStyle = dReady ? '#9ae0ff' : '#4a78a8';
  ctx.fillRect(dx, dy, Math.round(43 * (1 - clamp(p.dashCd / 2, 0, 1))), 4);
  drawText(ctx, dReady ? (g.isTouch ? 'DASH READY' : 'SPACE: DASH') : 'DASH...', W / 2, dy - 7, dReady ? '#d6f0ff' : '#7a8aa8', '#000', 'c');

  // --- tutorial hints (first run only)
  if (g.tutorial && g.time < 32) {
    const hints: [string, string][] = [['MOVE', g.isTouch ? 'DRAG ON THE LEFT SIDE' : 'WASD / ARROW KEYS'], ['SURVIVE', 'YOUR SWORD ATTACKS AUTOMATICALLY'], ['LEVEL UP', 'COLLECT GEMS, CHOOSE UPGRADES'], ['DASH', g.isTouch ? 'TAP THE DASH BUTTON' : 'PRESS SPACE TO DASH']];
    const idx = Math.min(3, Math.floor(g.time / 8));
    const [a, b] = hints[idx];
    const w = Math.max(textWidth(a) * 2, textWidth(b)) + 14;
    panel(ctx, Math.round((W - w) / 2), 128, w, 24);
    drawText(ctx, a, W / 2, 132, '#ffe680', '#000', 'c', 2);
    drawText(ctx, b, W / 2, 144, '#fff', '#000', 'c');
  }

  // --- banners
  let by = 46;
  for (const b of g.banners) {
    const u = b.t / b.dur;
    const a = u < 0.12 ? u / 0.12 : u > 0.8 ? (1 - u) / 0.2 : 1;
    ctx.globalAlpha = clamp(a, 0, 1);
    drawText(ctx, b.text, W / 2, by, b.col, '#000', 'c', b.size);
    if (b.sub) drawText(ctx, b.sub, W / 2, by + 5 * b.size + 4, '#fff', '#000', 'c');
    ctx.globalAlpha = 1;
    by += 5 * b.size + 16;
  }

  // --- hurt vignette
  if (p.flash > 0 && !p.dead) {
    ctx.fillStyle = `rgba(255,30,60,${clamp(p.flash * 1.4, 0, 0.45)})`;
    ctx.fillRect(0, 0, W, 3); ctx.fillRect(0, H - 3, W, 3); ctx.fillRect(0, 0, 3, H); ctx.fillRect(W - 3, 0, 3, H);
    ctx.fillRect(0, 0, W, 1);
  }
  if (g.whiteFlash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${clamp(g.whiteFlash, 0, 0.9)})`;
    ctx.fillRect(0, 0, W, H);
  }

  // --- boss warning
  if (g.warnT > 0 && g.warnBoss) {
    const t = 3.4 - g.warnT;
    ctx.fillStyle = `rgba(0,0,0,${Math.min(0.45, t * 0.6)})`;
    ctx.fillRect(0, 0, W, H);
    const blink = Math.floor(t * 5) % 2 === 0;
    ctx.fillStyle = blink ? '#c01830' : '#6a0c1c';
    ctx.fillRect(0, 22, W, 10);
    ctx.fillRect(0, H - 32, W, 10);
    for (let x = -((t * 40) | 0) % 16; x < W; x += 16) { ctx.fillStyle = '#ffd24a'; ctx.fillRect(x, 24, 8, 2); ctx.fillRect(x + 8, H - 30, 8, 2); }
    if (blink || t > 2) drawText(ctx, 'WARNING', W / 2, 58, '#ff4d4d', '#2a0408', 'c', 4);
    drawText(ctx, g.warnBoss.warn, W / 2, 88, '#ffffff', '#000', 'c');
    if (t > 1.3) drawText(ctx, g.warnBoss.name, W / 2, 104, '#ffd24a', '#000', 'c', 2);
  }
}
