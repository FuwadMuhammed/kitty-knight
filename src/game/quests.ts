import { Quest } from './data';
import { save } from './save';

/** Lifetime progress for stat/kill quests; null for "in a single run" quests. */
export function questLifetime(q: Quest): number | null {
  if (q.stat) return save.stats[q.stat] || 0;
  if (q.killsBy) return save.killsBy[q.killsBy] || 0;
  return null;
}

import { DEFAULT_UNLOCKED, QUEST_BY_TARGET } from './data';
export const isUnlocked = (id: string) => DEFAULT_UNLOCKED.includes(id) || !!save.unlocked[id] || !QUEST_BY_TARGET[id];
