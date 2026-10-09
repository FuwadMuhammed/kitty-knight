// Tiny 3x5 bitmap font, drawn with pixel rectangles. Everything text-related in the game uses this.
const G: Record<string, number[]> = {
  A: [2, 5, 7, 5, 5], B: [6, 5, 6, 5, 6], C: [3, 4, 4, 4, 3], D: [6, 5, 5, 5, 6], E: [7, 4, 6, 4, 7],
  F: [7, 4, 6, 4, 4], G: [3, 4, 5, 5, 3], H: [5, 5, 7, 5, 5], I: [7, 2, 2, 2, 7], J: [1, 1, 1, 5, 2],
  K: [5, 5, 6, 5, 5], L: [4, 4, 4, 4, 7], M: [5, 7, 7, 5, 5], N: [7, 5, 5, 5, 5], O: [2, 5, 5, 5, 2],
  P: [6, 5, 6, 4, 4], Q: [2, 5, 5, 6, 3], R: [6, 5, 6, 5, 5], S: [3, 4, 2, 1, 6], T: [7, 2, 2, 2, 2],
  U: [5, 5, 5, 5, 7], V: [5, 5, 5, 5, 2], W: [5, 5, 7, 7, 5], X: [5, 5, 2, 5, 5], Y: [5, 5, 2, 2, 2],
  Z: [7, 1, 2, 4, 7],
  '0': [7, 5, 5, 5, 7], '1': [2, 6, 2, 2, 7], '2': [7, 1, 7, 4, 7], '3': [7, 1, 7, 1, 7], '4': [5, 5, 7, 1, 1],
  '5': [7, 4, 7, 1, 7], '6': [7, 4, 7, 5, 7], '7': [7, 1, 1, 2, 2], '8': [7, 5, 7, 5, 7], '9': [7, 5, 7, 1, 7],
  '.': [0, 0, 0, 0, 2], ',': [0, 0, 0, 2, 4], ':': [0, 2, 0, 2, 0], '!': [2, 2, 2, 0, 2], '?': [6, 1, 2, 0, 2],
  '+': [0, 2, 7, 2, 0], '-': [0, 0, 7, 0, 0], '%': [5, 1, 2, 4, 5], '/': [1, 1, 2, 4, 4], "'": [2, 2, 0, 0, 0],
  '(': [1, 2, 2, 2, 1], ')': [4, 2, 2, 2, 4], '=': [0, 7, 0, 7, 0], '>': [4, 2, 1, 2, 4], '<': [1, 2, 4, 2, 1],
  '_': [0, 0, 0, 0, 7], '*': [5, 2, 7, 2, 5], '#': [5, 7, 5, 7, 5], '"': [5, 5, 0, 0, 0], ' ': [0, 0, 0, 0, 0],
  X_: [0, 5, 2, 5, 0],
};
G['x'] = [0, 5, 2, 5, 0];

export const GLYPH_H = 5;
export function textWidth(s: string) {
  return s.length ? s.length * 4 - 1 : 0;
}

type Ctx = CanvasRenderingContext2D;

function glyphRects(ctx: Ctx, s: string, x: number, y: number) {
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const g = ch === 'x' ? G.x : G[ch.toUpperCase()] || G['?'];
    const gx = x + i * 4;
    for (let r = 0; r < 5; r++) {
      const row = g[r];
      if (!row) continue;
      for (let c = 0; c < 3; c++) if (row & (4 >> c)) ctx.rect(gx + c, y + r, 1, 1);
    }
  }
}

/** Draw text at integer pixel coords. align: 'l' | 'c' | 'r'. */
export function drawText(
  ctx: Ctx,
  s: string,
  x: number,
  y: number,
  col = '#fff',
  shadow: string | null = '#000',
  align: 'l' | 'c' | 'r' = 'l',
  scale = 1,
) {
  const w = textWidth(s) * scale;
  let px = x;
  if (align === 'c') px = x - Math.floor(w / 2);
  else if (align === 'r') px = x - w;
  px = Math.round(px);
  y = Math.round(y);
  if (scale !== 1) {
    ctx.save();
    ctx.translate(px, y);
    ctx.scale(scale, scale);
    if (shadow) {
      ctx.fillStyle = shadow;
      ctx.beginPath();
      glyphRects(ctx, s, 1, 1);
      ctx.fill();
    }
    ctx.fillStyle = col;
    ctx.beginPath();
    glyphRects(ctx, s, 0, 0);
    ctx.fill();
    ctx.restore();
    return;
  }
  if (shadow) {
    ctx.fillStyle = shadow;
    ctx.beginPath();
    glyphRects(ctx, s, px + 1, y + 1);
    ctx.fill();
  }
  ctx.fillStyle = col;
  ctx.beginPath();
  glyphRects(ctx, s, px, y);
  ctx.fill();
}

const urlCache = new Map<string, { url: string; w: number; h: number }>();
/** Pre-render a string to a data URL (used by React UI for crisp pixel text). */
export function textURL(s: string, col: string, shadow: string | null) {
  const key = s + '|' + col + '|' + shadow;
  let r = urlCache.get(key);
  if (r) return r;
  const w = Math.max(1, textWidth(s) + (shadow ? 1 : 0));
  const h = GLYPH_H + (shadow ? 1 : 0);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  drawText(c.getContext('2d')!, s, 0, 0, col, shadow);
  r = { url: c.toDataURL(), w, h };
  urlCache.set(key, r);
  return r;
}
