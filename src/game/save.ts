// localStorage persistence with graceful fallback for missing/corrupt data.
export interface Settings {
  sound: boolean; music: boolean; shake: boolean; dmgNumbers: boolean; reduced: boolean;
}
export interface SaveData {
  v: 1;
  gold: number;
  meta: Record<string, number>;
  coll: { weapons: Record<string, 1>; passives: Record<string, 1>; enemies: Record<string, 1>; bosses: Record<string, 1>; evos: Record<string, 1> };
  settings: Settings;
  best: { time: number; level: number; kills: number; win: boolean };
  tutorialDone: boolean;
  tourDone: boolean;
  levelTipDone: boolean;
  runs: number;
  unlocked: Record<string, 1>;
  stats: Record<string, number>;
  killsBy: Record<string, number>;
}
const KEY = 'tiny-knight-survivors-save-v1';

export const defaultSave = (): SaveData => ({
  v: 1,
  gold: 0,
  meta: {},
  coll: { weapons: {}, passives: {}, enemies: {}, bosses: {}, evos: {} },
  settings: { sound: true, music: true, shake: true, dmgNumbers: true, reduced: false },
  best: { time: 0, level: 1, kills: 0, win: false },
  tutorialDone: false,
  tourDone: false,
  levelTipDone: false,
  runs: 0,
  unlocked: {},
  stats: {},
  killsBy: {},
});

function sanitize(raw: any): SaveData {
  const d = defaultSave();
  if (!raw || typeof raw !== 'object') return d;
  if (typeof raw.gold === 'number' && isFinite(raw.gold)) d.gold = Math.max(0, Math.floor(raw.gold));
  if (raw.meta && typeof raw.meta === 'object') for (const k of Object.keys(raw.meta)) if (typeof raw.meta[k] === 'number') d.meta[k] = Math.max(0, Math.floor(raw.meta[k]));
  if (raw.coll && typeof raw.coll === 'object')
    for (const sec of Object.keys(d.coll) as (keyof SaveData['coll'])[]) if (raw.coll[sec] && typeof raw.coll[sec] === 'object') for (const k of Object.keys(raw.coll[sec])) d.coll[sec][k] = 1;
  if (raw.settings && typeof raw.settings === 'object') for (const k of Object.keys(d.settings) as (keyof Settings)[]) if (typeof raw.settings[k] === 'boolean') d.settings[k] = raw.settings[k];
  if (raw.best && typeof raw.best === 'object') {
    for (const k of ['time', 'level', 'kills'] as const) if (typeof raw.best[k] === 'number') d.best[k] = raw.best[k];
    d.best.win = !!raw.best.win;
  }
  d.tutorialDone = !!raw.tutorialDone;
  d.tourDone = !!raw.tourDone || d.tutorialDone;
  d.levelTipDone = !!raw.levelTipDone || d.tutorialDone;
  if (typeof raw.runs === 'number') d.runs = raw.runs;
  if (raw.unlocked && typeof raw.unlocked === 'object') for (const k of Object.keys(raw.unlocked)) d.unlocked[k] = 1;
  for (const sec of ['stats', 'killsBy'] as const) if (raw[sec] && typeof raw[sec] === 'object') for (const k of Object.keys(raw[sec])) if (typeof raw[sec][k] === 'number' && isFinite(raw[sec][k])) d[sec][k] = raw[sec][k];
  return d;
}

export const save: SaveData = (() => {
  try {
    const s = localStorage.getItem(KEY);
    if (s) return sanitize(JSON.parse(s));
  } catch {
    /* corrupt or unavailable */
  }
  return defaultSave();
})();

export function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    /* storage unavailable */
  }
}
export function resetSave() {
  const d = defaultSave();
  Object.assign(save, d);
  persist();
}
export function discover(sec: keyof SaveData['coll'], id: string) {
  if (!save.coll[sec][id]) {
    save.coll[sec][id] = 1;
    persist();
    return true;
  }
  return false;
}
export const metaLevel = (id: string) => save.meta[id] || 0;

export const addStat = (k: string, n = 1) => { save.stats[k] = (save.stats[k] || 0) + n; };
