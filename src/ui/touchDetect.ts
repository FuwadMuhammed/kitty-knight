/** true on phones/tablets whose primary input is a finger (not on laptops that merely have a touchscreen) */
export const isTouchDevice = () =>
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches;

/** portrait check that survives on-screen keyboards and shrinking browser bars */
export const isPortrait = () => {
  if (typeof window === 'undefined') return false;
  const mq = window.matchMedia?.('(orientation: portrait)');
  if (mq) return mq.matches;
  return window.innerHeight > window.innerWidth;
};

/** iPhone/iPad Safari running in a normal tab (no fullscreen API there; "Add to Home Screen" is the way to hide the bars) */
export const isIOSBrowserTab = () => {
  if (typeof navigator === 'undefined') return false;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1);
  const standalone = (navigator as any).standalone === true || window.matchMedia?.('(display-mode: fullscreen), (display-mode: standalone)').matches;
  return ios && !standalone;
};
