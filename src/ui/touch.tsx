import React, { useEffect, useRef, useState } from 'react';
import type { Game } from '../game/game';
import { T } from './Px';
import { isIOSBrowserTab } from './touchDetect';

const R = 46; // joystick travel in CSS px

/** Floating joystick (left side), dash + pause buttons (right side). Everything uses viewport coordinates. */
export function TouchControls({ game }: { game: () => Game | null }) {
  const [stick, setStick] = useState<{ ox: number; oy: number; kx: number; ky: number } | null>(null);
  const pid = useRef<number | null>(null);
  const origin = useRef({ x: 0, y: 0 });
  useEffect(() => () => game()?.setTouchMove(0, 0), [game]);

  const update = (cx: number, cy: number) => {
    let dx = cx - origin.current.x, dy = cy - origin.current.y;
    const m = Math.hypot(dx, dy);
    if (m > R) { dx = (dx / m) * R; dy = (dy / m) * R; }
    game()?.setTouchMove(dx / R, dy / R);
    setStick({ ox: origin.current.x, oy: origin.current.y, kx: dx, ky: dy });
  };
  const down = (e: React.PointerEvent) => {
    if (pid.current !== null) return;
    pid.current = e.pointerId;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    origin.current = { x: e.clientX, y: e.clientY };
    update(e.clientX, e.clientY);
  };
  const move = (e: React.PointerEvent) => { if (e.pointerId === pid.current) update(e.clientX, e.clientY); };
  const up = (e: React.PointerEvent) => {
    if (e.pointerId !== pid.current) return;
    pid.current = null;
    setStick(null);
    game()?.setTouchMove(0, 0);
  };
  return (
    <>
      <div className="tc-zone" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onContextMenu={(e) => e.preventDefault()}>
        {!stick && <div className="tc-ghost"><div className="tc-knob" /></div>}
        {stick && (
          <div className="tc-base" style={{ left: stick.ox - 52, top: stick.oy - 52 }}>
            <div className="tc-knob" style={{ transform: `translate(${stick.kx}px, ${stick.ky}px)` }} />
          </div>
        )}
      </div>
      <button className="tc-btn tc-pause" aria-label="Pause" onPointerDown={(e) => { e.preventDefault(); game()?.pause(); }}><span /><span /></button>
      <button className="tc-btn tc-dash" aria-label="Dash" onPointerDown={(e) => { e.preventDefault(); game()?.touchDash(); }}>
        <T s={2} c="#ffffff">DASH</T>
      </button>
    </>
  );
}

/** Full-screen, animated "turn your phone sideways" prompt. The game can't be started or played until the phone is landscape. */
export function RotatePrompt() {
  return (
    <div className="rotate" role="alert">
      <div className="phone"><div className="phone-screen"><i /><i /><i /></div></div>
      <div className="rot-text">
        <T s={3} c="#ffd24a" sh="#6a2a10" align="center">ROTATE YOUR PHONE</T>
        <div style={{ height: 10 }} />
        <T s={2} c="#e8dcc0" align="center">{'KITTY KNIGHT FIGHTS SIDEWAYS.\nTURN YOUR PHONE TO PLAY!'}</T>
        {isIOSBrowserTab() && (
          <div style={{ marginTop: 18 }}>
            <T s={2} c="#9ae0ff" align="center">{'TIP: TAP SHARE, THEN ADD TO HOME SCREEN\nFOR TRUE FULL SCREEN'}</T>
          </div>
        )}
      </div>
    </div>
  );
}
