import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Game } from './game/game';
import { loadOverrides } from './game/sprites';
import type { Card, Reward, RunResult } from './game/types';
import { applyAudioSettings, startMusic, stopMusic, unlockAudio } from './game/audio';
import { save } from './game/save';
import { ChestOverlay, HowToPlay, Collection, LevelUp, MainMenu, PauseMenu, Results, Settings, Upgrades } from './ui/screens';
import { query } from './game/util';
import { renderShareCard } from './game/share';
import { RotatePrompt, TouchControls } from './ui/touch';
import { isPortrait, isTouchDevice } from './ui/touchDetect';

/** biggest the game window gets on desktop (3 = 960x540) */
const MAX_DESKTOP_SCALE = 3;

type Screen = 'menu' | 'select' | 'upgrades' | 'collection' | 'settings' | 'run' | 'results';
type Overlay = { kind: 'none' | 'pause' | 'levelup' | 'chest'; data?: any };

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [screen, setScreen] = useState<Screen>('menu');
  const [overlay, setOverlay] = useState<Overlay>({ kind: 'none' });
  const [result, setResult] = useState<RunResult | null>(null);
  const [scale, setScale] = useState(4);
  const [ready, setReady] = useState(false);
  const touch = React.useMemo(() => isTouchDevice(), []);
  const [portrait, setPortrait] = useState(false);

  // Scale the 320x180 canvas to fit, snapped to whole *device* pixels so every art pixel is the same size
  // (crisp on retina screens and phones). Also tracks portrait vs landscape for the rotate prompt.
  useLayoutEffect(() => {
    let raf = 0;
    const fit = () => {
      const vv = window.visualViewport;
      // visualViewport follows the *visible* area as mobile browser bars slide in and out
      const w = vv?.width ?? window.innerWidth, h = vv?.height ?? window.innerHeight;
      const dpr = window.devicePixelRatio || 1;
      // desktop: leave a black margin around the framed game (like a console window); phones use every pixel
      const fill = touch ? 1 : 0.8;
      // ...and never bigger than 960x540 (3x): on huge monitors a giant game loses its cute, tiny-window charm
      const s = Math.min((w * fill) / 320, (h * fill) / 180, touch ? Infinity : MAX_DESKTOP_SCALE);
      setScale(Math.max(0.5, Math.floor(s * dpr) / dpr));
      setPortrait(touch && isPortrait());
    };
    const soon = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(fit); };
    fit();
    window.addEventListener('resize', soon);
    window.addEventListener('orientationchange', soon);
    window.visualViewport?.addEventListener('resize', soon);
    const t = window.setTimeout(fit, 350); // iOS reports the final size a beat after rotating
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
      window.removeEventListener('resize', soon);
      window.removeEventListener('orientationchange', soon);
      window.visualViewport?.removeEventListener('resize', soon);
    };
  }, [touch]);

  // never keep playing while the phone is held upright
  useEffect(() => {
    if (portrait) gameRef.current?.pause();
  }, [portrait]);

  useEffect(() => {
    let cancelled = false;
    let g: Game | null = null;
    (async () => {
      await loadOverrides(); // swap in any PNG art from public/assets (see tools/auto_import.ts)
      if (cancelled || !canvasRef.current) return;
      setReady(true);
      g = new Game(canvasRef.current, {
        overlay: (kind, data) => setOverlay({ kind, data }),
        end: (r) => { setResult(r); setOverlay({ kind: 'none' }); setScreen('results'); },
      });
      gameRef.current = g;
      if ((import.meta as any).env?.DEV) (window as any).__game = g;
      g.isTouch = touch;
      if (query.get('autostart') === '1') { g.startRun(); setScreen('run'); }
    })();
    return () => { cancelled = true; g?.dispose(); gameRef.current = null; };
  }, []);

  useEffect(() => {
    const unlock = () => { unlockAudio(); applyAudioSettings(); };
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  // menu music
  useEffect(() => {
    if (screen === 'run') return;
    if (save.settings.music) startMusic(); else stopMusic();
  }, [screen]);

  const go = useCallback((s: Screen) => {
    const g = gameRef.current;
    if (g && g.mode === 'run' && s !== 'run' && s !== 'results') g.showMenu();
    setScreen(s);
  }, []);
  const startRun = useCallback((id: string) => {
    if (portrait) return;
    if (touch) {
      // phones: go fullscreen and ask for landscape (works on Android; iOS falls back to the rotate prompt)
      try {
        const el: any = document.documentElement;
        Promise.resolve(el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.()).catch(() => {});
        (window.screen.orientation as any)?.lock?.('landscape')?.catch?.(() => {});
      } catch { /* not supported */ }
    }
    gameRef.current?.startRun(id);
    setOverlay({ kind: 'none' });
    setScreen('run');
  }, [portrait, touch]);
  const choose = useCallback((c: Card) => gameRef.current?.chooseCard(c), []);
  const closeChest = useCallback(() => gameRef.current?.closeChest(), []);

  const uiScale = scale / 2;
  return (
    <div className="wrap">
      <div className="stage" style={{ width: 320 * scale, height: 180 * scale }}>
        <canvas ref={canvasRef} className="game" />
        <div className="ui" style={{ transform: `scale(${uiScale})` }}>
          {ready && screen === 'menu' && <MainMenu go={(s) => go(s as Screen)} />}
          {screen === 'select' && <HowToPlay start={startRun} back={() => go('menu')} />}
          {screen === 'upgrades' && <Upgrades back={() => go(result && gameRef.current?.mode === 'run' ? 'menu' : 'menu')} />}
          {screen === 'collection' && <Collection back={() => go('menu')} />}
          {screen === 'settings' && <Settings back={() => go('menu')} />}
          {screen === 'run' && overlay.kind === 'none' && !touch && (
            <button className="pausebtn" tabIndex={-1} title="Pause (ESC)" aria-label="Pause" onMouseDown={(e) => e.preventDefault()} onClick={() => gameRef.current?.pause()}>
              <span /><span />
            </button>
          )}
          {screen === 'run' && overlay.kind === 'pause' && (
            <PauseMenu resume={() => gameRef.current?.resume()} quit={() => { setOverlay({ kind: 'none' }); gameRef.current?.quitRun(); }} />
          )}
          {screen === 'run' && overlay.kind === 'levelup' && (
            <LevelUp cards={overlay.data.cards as Card[]} level={overlay.data.level} remaining={overlay.data.remaining} choose={choose} />
          )}
          {screen === 'run' && overlay.kind === 'chest' && (
            <ChestOverlay rewards={overlay.data.rewards as Reward[]} triple={overlay.data.triple} close={closeChest} />
          )}
          {screen === 'results' && result && (
            <Results
              res={result}
              again={() => startRun('meows')}
              upgrades={() => go('upgrades')}
              menu={() => go('menu')}
              makeCard={() => renderShareCard(gameRef.current!, result)}
            />
          )}
        </div>
      </div>
      {touch && screen === 'run' && overlay.kind === 'none' && !portrait && <TouchControls game={() => gameRef.current} />}
      {portrait && <RotatePrompt />}
    </div>
  );
}
