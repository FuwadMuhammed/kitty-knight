// Share card: a 1080x1080 pixel-art "scorecard" with the knight, drawn from the same procedural sprites.
import type { Game } from './game';
import type { RunResult } from './types';
import { S, X, SW, KG } from './sprites';
import { drawText } from './font';
import { WORLD_H, WORLD_W } from './world';
import { fmtNum, fmtTime } from './util';

export function shareText(res: RunResult): string {
  const url = typeof location !== 'undefined' ? location.origin + location.pathname : '';
  const head = res.win ? `I beat Tiny Knight Survivors in ${fmtTime(res.time)}` : `I survived ${fmtTime(res.time)} as a tiny kitten knight in Tiny Knight Survivors`;
  return `${head} (Lv ${res.level}, ${res.kills} kills)! Can you beat this time? 🐱⚔️ ${url}`.trim();
}

export function renderShareCard(game: Game, res: RunResult): HTMLCanvasElement {
  const W = 270, H = 270;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const c = cv.getContext('2d')!;
  c.imageSmoothingEnabled = false;

  // meadow background, darkened
  game.world.draw(c, Math.round(WORLD_W / 2 - W / 2), Math.round(WORLD_H / 2 - H / 2), W, H);
  c.fillStyle = 'rgba(14,8,28,0.66)';
  c.fillRect(0, 0, W, H);
  c.globalAlpha = 0.55;
  c.drawImage(game.vig, 0, 0, W, H);
  c.globalAlpha = 1;
  // frame
  c.fillStyle = '#0c0814'; c.fillRect(0, 0, W, 3); c.fillRect(0, H - 3, W, 3); c.fillRect(0, 0, 3, H); c.fillRect(W - 3, 0, 3, H);
  c.fillStyle = '#6b5a8e'; c.fillRect(3, 3, W - 6, 1); c.fillRect(3, H - 4, W - 6, 1); c.fillRect(3, 3, 1, H - 6); c.fillRect(W - 4, 3, 1, H - 6);

  // title
  drawText(c, 'TINY KNIGHT', W / 2, 10, '#ffd24a', '#6a2a10', 'c', 3);
  drawText(c, 'SURVIVORS', W / 2, 30, '#f6efdc', '#3a2a5a', 'c', 3);
  drawText(c, res.win ? 'RUN COMPLETE!' : 'THE KNIGHT HAS FALLEN', W / 2, 52, res.win ? '#7aff9a' : '#ff9a9a', '#000', 'c', 1);

  // the knight (standing if victorious, lying down when fallen)
  c.fillStyle = 'rgba(0,0,0,0.35)';
  for (let i = 0; i < 4; i++) c.fillRect(22 + i * 2, 190 + (i % 2), 70 - i * 4, 3);
  if (res.win) {
    const sc = 2, x = 12, y = 78;
    c.save();
    c.translate(x + (S.kitten.fl[0].width - KG.x) * sc, y + KG.y * sc);
    c.rotate(0.05);
    c.scale(sc, sc);
    c.drawImage(X.sword, -SW.gx, -SW.gripY);
    c.restore();
    c.drawImage(S.kitten.fl[0], x, y, S.kitten.fl[0].width * sc, S.kitten.fl[0].height * sc);
  } else {
    const sc = 2, d = S.kitten.f[6];
    c.save();
    c.translate(62, 180);
    c.rotate(Math.PI / 2 - 0.06);
    c.scale(sc * 0.8, sc * 0.8);
    c.drawImage(X.sword, -SW.gx, -SW.h / 2);
    c.restore();
    c.drawImage(d, 14, 112, d.width * sc, d.height * sc);
  }

  // stats panel
  const px = 108, py = 76, pw = 150, ph = 122;
  c.fillStyle = '#0c0814'; c.fillRect(px - 1, py - 1, pw + 2, ph + 2);
  c.fillStyle = '#6b5a8e'; c.fillRect(px, py, pw, ph);
  c.fillStyle = 'rgba(26,18,44,0.96)'; c.fillRect(px + 1, py + 1, pw - 2, ph - 2);
  drawText(c, 'TIME SURVIVED', px + pw / 2, py + 7, '#b9aed0', '#000', 'c', 1);
  drawText(c, fmtTime(res.time), px + pw / 2, py + 17, '#ffe680', '#7a4a10', 'c', 5);
  const rows: [string, string][] = [['LEVEL', String(res.level)], ['KILLS', fmtNum(res.kills)], ['DAMAGE', fmtNum(res.damage)], ['BOSSES', String(res.bosses)], ['BEST COMBO', `X${res.combo}`]];
  rows.forEach(([a, b], i) => {
    const y = py + 52 + i * 12;
    drawText(c, a, px + 8, y, '#b9aed0', '#000');
    drawText(c, b, px + pw - 8, y, '#ffffff', '#000', 'r');
  });

  // call to action
  c.fillStyle = '#0c0814'; c.fillRect(19, 207, W - 38, 40);
  c.fillStyle = '#ffd24a'; c.fillRect(20, 208, W - 40, 38);
  c.fillStyle = '#2a1a4a'; c.fillRect(22, 210, W - 44, 34);
  drawText(c, 'CAN YOU BEAT', W / 2, 214, '#ffffff', '#000', 'c', 2);
  drawText(c, 'THIS TIME?', W / 2, 228, '#ffd24a', '#6a2a10', 'c', 2);
  drawText(c, (typeof location !== 'undefined' ? location.host : '').toUpperCase().slice(0, 40), W / 2, 254, '#8a7aa0', null, 'c', 1);

  const out = document.createElement('canvas');
  out.width = 1080;
  out.height = 1080;
  const oc = out.getContext('2d')!;
  oc.imageSmoothingEnabled = false;
  oc.drawImage(cv, 0, 0, 1080, 1080);
  return out;
}

export const canvasBlob = (cv: HTMLCanvasElement) => new Promise<Blob>((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('blob'))), 'image/png'));

export function downloadBlob(blob: Blob, name = 'tiny-knight-survivors.png') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
export async function copyImage(blob: Blob): Promise<boolean> {
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return true;
  } catch {
    return false;
  }
}
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
