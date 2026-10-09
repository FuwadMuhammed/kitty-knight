import React from 'react';
import { textURL } from '../game/font';
import { ICON, ensureSprites, iconURL, spriteURL } from '../game/sprites';
import { sfx } from '../game/audio';
import { WEB_FONT, FONT_FAMILY, UI_FONT_PX } from '../game/fontConfig';

/** Pixel text: renders each word from the bitmap font as a crisp image so it wraps naturally. */
export function T({
  children, s = 2, c = '#ffffff', sh = '#000000', align = 'left', style,
}: { children: React.ReactNode; s?: number; c?: string; sh?: string | null; align?: 'left' | 'center' | 'right'; style?: React.CSSProperties }) {
  const text = React.Children.toArray(children).join('');
  const lines = text.split('\n');
  if (WEB_FONT) {
    return (
      <span className="pxt webt" aria-label={text} style={{
        fontFamily: FONT_FAMILY, fontWeight: 600, fontSize: UI_FONT_PX * s, lineHeight: '0.95', color: c, textAlign: align,
        textTransform: 'uppercase', textShadow: sh ? `${s}px ${s}px 0 ${sh}` : undefined, whiteSpace: 'pre-wrap', ...style,
      }}>{text}</span>
    );
  }
  const jc = align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start';
  return (
    <span className="pxt" style={style} aria-label={text}>
      {lines.map((ln, i) => (
        <span key={i} className="pxl" style={{ justifyContent: jc, gap: `0 ${3 * s}px`, marginBottom: i < lines.length - 1 ? 2 * s : 0 }}>
          {ln.split(' ').filter(Boolean).map((w, j) => {
            const t = textURL(w, c, sh);
            return <img key={j} src={t.url} width={t.w * s} height={t.h * s} alt="" draggable={false} className="pxw" />;
          })}
        </span>
      ))}
    </span>
  );
}

export function Btn({
  children, onClick, disabled, s = 2, color = '#3b2d57', wide, small, active,
}: { children: React.ReactNode; onClick: () => void; disabled?: boolean; s?: number; color?: string; wide?: boolean; small?: boolean; active?: boolean }) {
  return (
    <button
      className={'pbtn' + (wide ? ' wide' : '') + (small ? ' small' : '') + (active ? ' active' : '')}
      style={{ ['--bc' as any]: color }}
      disabled={disabled}
      onClick={() => { sfx('click'); onClick(); }}
    >
      <T s={s} c={disabled ? '#8a8497' : '#fff'}>{children}</T>
    </button>
  );
}

export function Icon({ id, s = 2 }: { id: string; s?: number }) {
  ensureSprites();
  const cv = ICON[id] || ICON.locked;
  return <img className="pxi" src={iconURL(id)} width={cv.width * s} height={cv.height * s} alt="" draggable={false} />;
}

export function Sprite({ id, frame = 0, size = 32 }: { id: string; frame?: number; size?: number }) {
  const s = spriteURL(id, frame);
  const k = Math.max(1, Math.floor(size / Math.max(s.w, s.h)));
  const scale = size / Math.max(s.w, s.h) >= 1 ? k : size / Math.max(s.w, s.h);
  return <img className="pxi" src={s.url} width={Math.round(s.w * scale)} height={Math.round(s.h * scale)} alt="" draggable={false} />;
}

export function Panel({ children, w, h, style, className = '' }: { children: React.ReactNode; w?: number; h?: number; style?: React.CSSProperties; className?: string }) {
  return (
    <div className={'ppanel ' + className} style={{ width: w, height: h, ...style }}>
      {children}
    </div>
  );
}
