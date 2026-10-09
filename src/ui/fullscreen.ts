// Fullscreen helpers. iPhone Safari has no Fullscreen API for pages, so there the only route is
// "Add to Home Screen" (the manifest + apple-mobile-web-app-capable then launch it without browser chrome).
export const fsElement = () => (document as any).fullscreenElement || (document as any).webkitFullscreenElement || null;
export const canFullscreen = () => { const el: any = document.documentElement; return !!(el.requestFullscreen || el.webkitRequestFullscreen); };
export const isStandalone = () =>
  (window.matchMedia?.('(display-mode: standalone)').matches || window.matchMedia?.('(display-mode: fullscreen)').matches || (navigator as any).standalone === true);
export async function enterFullscreen() {
  const el: any = document.documentElement;
  try {
    await (el.requestFullscreen?.({ navigationUI: 'hide' }) ?? el.webkitRequestFullscreen?.());
    (window.screen.orientation as any)?.lock?.('landscape')?.catch?.(() => {});
  } catch { /* refused */ }
}
export async function exitFullscreen() {
  try { await ((document as any).exitFullscreen?.() ?? (document as any).webkitExitFullscreen?.()); } catch { /* ignore */ }
}
