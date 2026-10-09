// Static game data: weapons, passives, evolutions, enemies, bosses, characters, meta upgrades.
export type Rarity = 0 | 1 | 2 | 3;
export const RARITY = [
  { name: 'COMMON', color: '#cfd6e0', mult: 1, dmg: 0, w: 70 },
  { name: 'RARE', color: '#5ab0ff', mult: 1.5, dmg: 0.1, w: 22 },
  { name: 'EPIC', color: '#c36bff', mult: 2, dmg: 0.25, w: 7 },
  { name: 'LEGENDARY', color: '#ffc43a', mult: 3, dmg: 0.5, w: 1 },
];

export interface WStats {
  damage: number; cooldown: number; count: number; speed: number; area: number;
  duration: number; pierce: number; knockback: number; bounce: number;
}
export interface WeaponDef {
  id: string; name: string; icon: string; desc: string; countLabel: string;
  base: WStats; ups: Partial<WStats>[]; affects: string[];
}
const B = (o: Partial<WStats>): WStats => ({ damage: 0, cooldown: 1, count: 1, speed: 0, area: 1, duration: 0, pierce: 0, knockback: 0, bounce: 0, ...o });

export const WEAPONS: WeaponDef[] = [
  {
    id: 'sword', name: 'GIANT SWORD', icon: 'sword', countLabel: 'SWING',
    desc: 'A ridiculously big sword swings at the nearest foe.',
    base: B({ damage: 14, cooldown: 1.25, area: 1, duration: 0.24, knockback: 90 }),
    affects: [],
    ups: [{ damage: 5 }, { cooldown: 0.9 }, { area: 1.2 }, { damage: 6 }, { count: 1 }, { cooldown: 0.88 }, { damage: 9, area: 1.15 }],
  },
  {
    id: 'yarn', name: 'YARN BALL', icon: 'yarn', countLabel: 'BALL',
    desc: 'Bouncy yarn that ricochets off enemies and walls.',
    base: B({ damage: 10, cooldown: 1.9, speed: 95, duration: 3.2, knockback: 30, bounce: 3 }),
    affects: [],
    ups: [{ count: 1 }, { damage: 4, bounce: 1 }, { cooldown: 0.9 }, { count: 1 }, { damage: 5 }, { bounce: 2 }, { count: 1, damage: 6 }],
  },
  {
    id: 'paw', name: 'MAGIC PAW', icon: 'paw', countLabel: 'PAW',
    desc: 'A giant paw falls from the sky and smashes.',
    base: B({ damage: 30, cooldown: 3.0, duration: 0.55, knockback: 60 }),
    affects: [],
    ups: [{ count: 1 }, { area: 1.2 }, { damage: 12 }, { cooldown: 0.85 }, { count: 1 }, { damage: 16 }, { area: 1.2, count: 1 }],
  },
  {
    id: 'fish', name: 'FLYING FISH', icon: 'fish', countLabel: 'FISH',
    desc: 'Fish fly straight at your enemies. Fresh.',
    base: B({ damage: 11, cooldown: 1.5, count: 2, speed: 150, pierce: 1, knockback: 35 }),
    affects: [],
    ups: [{ count: 1 }, { damage: 4 }, { speed: 1.2, pierce: 1 }, { count: 1 }, { cooldown: 0.88 }, { damage: 7 }, { count: 2 }],
  },
  {
    id: 'hiss', name: 'HISS', icon: 'hiss', countLabel: 'RING',
    desc: 'A furious shockwave that blasts enemies away.',
    base: B({ damage: 16, cooldown: 3.4, area: 1, duration: 0.38, knockback: 220 }),
    affects: [],
    ups: [{ area: 1.15 }, { damage: 7 }, { knockback: 80 }, { cooldown: 0.88 }, { area: 1.2 }, { damage: 10 }, { cooldown: 0.85, area: 1.15 }],
  },
  {
    id: 'shield', name: 'ROYAL SHIELD', icon: 'shield', countLabel: 'SHIELD',
    desc: 'Shields orbit you, smashing foes and blocking shots.',
    base: B({ damage: 9, cooldown: 0.4, speed: 2.6, area: 1, knockback: 50 }),
    affects: [],
    ups: [{ count: 1 }, { damage: 4 }, { speed: 1.2 }, { count: 1 }, { damage: 6 }, { area: 1.2 }, { count: 1, damage: 4 }],
  },
  {
    id: 'dash', name: 'CAT DASH', icon: 'dash', countLabel: 'DASH',
    desc: 'Dashes at enemies on its own, leaving a damaging trail.',
    base: B({ damage: 22, cooldown: 7, area: 1, duration: 1.2, knockback: 60 }),
    affects: [],
    ups: [{ damage: 9 }, { cooldown: 0.88 }, { area: 1.25 }, { duration: 0.6 }, { damage: 13 }, { cooldown: 0.85 }, { area: 1.2, damage: 16 }],
  },
  {
    id: 'lightning', name: 'LIGHTNING CLAW', icon: 'lightning', countLabel: 'STRIKE',
    desc: 'Lightning strikes random enemies and chains onward.',
    base: B({ damage: 26, cooldown: 2.4, area: 1, pierce: 0 }),
    affects: [],
    ups: [{ count: 1 }, { damage: 9 }, { pierce: 1 }, { count: 1 }, { cooldown: 0.88 }, { pierce: 1, damage: 11 }, { count: 2 }],
  },
  {
    id: 'dragon', name: 'TINY DRAGON', icon: 'dragon', countLabel: 'DRAGON',
    desc: 'A tiny, furious dragon companion spits fire.',
    base: B({ damage: 13, cooldown: 1.7, speed: 140, pierce: 1 }),
    affects: [],
    ups: [{ damage: 5 }, { cooldown: 0.88 }, { count: 1 }, { damage: 7 }, { cooldown: 0.88 }, { count: 1 }, { damage: 11, pierce: 1 }],
  },
  {
    id: 'bomb', name: 'CATNIP BOMB', icon: 'bomb', countLabel: 'BOMB',
    desc: 'Lobs a bomb that blows up and leaves a catnip haze.',
    base: B({ damage: 36, cooldown: 3.6, area: 1, duration: 0.9 }),
    affects: [],
    ups: [{ area: 1.15 }, { count: 1 }, { damage: 13 }, { cooldown: 0.88 }, { area: 1.2 }, { count: 1 }, { damage: 22 }],
  },
  {
    id: 'hairball', name: 'HAIRBALL LAUNCHER', icon: 'hairball', countLabel: 'HAIRBALL', affects: [],
    desc: 'Coughs up hairballs that explode on impact.',
    base: B({ damage: 16, cooldown: 1.9, count: 1, speed: 115, area: 1, knockback: 60 }),
    ups: [{ count: 1 }, { damage: 6 }, { area: 1.2 }, { cooldown: 0.88 }, { count: 1 }, { damage: 8 }, { area: 1.2, count: 1 }],
  },
  {
    id: 'marbles', name: 'CAT MARBLES', icon: 'marbles', countLabel: 'MARBLE', affects: [],
    desc: 'Glass marbles orbit you and bonk everything.',
    base: B({ damage: 10, cooldown: 0.45, count: 2, speed: 2.2, area: 1, knockback: 60 }),
    ups: [{ count: 1 }, { damage: 4 }, { speed: 1.15 }, { count: 1 }, { area: 1.2 }, { damage: 6 }, { count: 1 }],
  },
  {
    id: 'blaster', name: 'MOUSE BLASTER', icon: 'blaster', countLabel: 'SHOT', affects: [],
    desc: 'Rapid-fire toy mouse bullets.',
    base: B({ damage: 7, cooldown: 0.95, count: 3, speed: 220, knockback: 20 }),
    ups: [{ count: 1 }, { damage: 3 }, { cooldown: 0.9 }, { count: 1 }, { damage: 4 }, { cooldown: 0.88 }, { count: 2, damage: 3 }],
  },
  {
    id: 'catarang', name: 'CATARANG', icon: 'catarang', countLabel: 'TOY', affects: [],
    desc: 'A thrown toy that flies out and comes back.',
    base: B({ damage: 14, cooldown: 2.0, count: 1, speed: 150, area: 1, knockback: 40 }),
    ups: [{ count: 1 }, { damage: 5 }, { speed: 1.15 }, { count: 1 }, { damage: 6 }, { area: 1.2 }, { count: 1, damage: 6 }],
  },
  {
    id: 'scratcher', name: 'SCRATCHING POST', icon: 'scratcher', countLabel: 'POST', affects: [],
    desc: 'A spinning post lands and shreds an area.',
    base: B({ damage: 12, cooldown: 2.6, count: 1, area: 1, duration: 2.2, knockback: 20 }),
    ups: [{ count: 1 }, { damage: 5 }, { duration: 0.6 }, { count: 1 }, { area: 1.2 }, { damage: 7 }, { count: 1 }],
  },
  {
    id: 'laser', name: 'LASER POINTER', icon: 'laser', countLabel: 'BEAM', affects: [],
    desc: 'A red dot that burns everything on its line.',
    base: B({ damage: 6, cooldown: 4, count: 1, area: 1, duration: 2 }),
    ups: [{ damage: 3 }, { duration: 0.5 }, { count: 1 }, { damage: 4 }, { cooldown: 0.85 }, { count: 1 }, { damage: 6 }],
  },
  {
    id: 'mouse', name: 'WIND-UP MOUSE', icon: 'mouse', countLabel: 'MOUSE', affects: [],
    desc: 'Homing clockwork mice that explode.',
    base: B({ damage: 12, cooldown: 2.2, count: 2, speed: 90, area: 1, knockback: 30 }),
    ups: [{ count: 1 }, { damage: 5 }, { area: 1.2 }, { cooldown: 0.88 }, { count: 1 }, { damage: 7 }, { count: 2 }],
  },
  {
    id: 'shotgun', name: 'FLUFF SHOTGUN', icon: 'shotgun', countLabel: 'PELLET', affects: [],
    desc: 'A spread of fluff. Hits harder up close.',
    base: B({ damage: 6, cooldown: 1.7, count: 5, speed: 200, area: 1, knockback: 60 }),
    ups: [{ count: 2 }, { damage: 2 }, { cooldown: 0.9 }, { count: 2 }, { damage: 3 }, { knockback: 40 }, { count: 2 }],
  },
  {
    id: 'coldmilk', name: 'COLD MILK', icon: 'milk2', countLabel: 'BLAST', affects: [],
    desc: 'A freezing splash that stops enemies cold.',
    base: B({ damage: 9, cooldown: 4.5, area: 1, duration: 1.4, knockback: 20 }),
    ups: [{ damage: 4 }, { area: 1.15 }, { duration: 0.4 }, { cooldown: 0.88 }, { damage: 6 }, { area: 1.2 }, { duration: 0.6 }],
  },
  {
    id: 'twister', name: 'ZOOMIES TWISTER', icon: 'twister', countLabel: 'TWISTER', affects: [],
    desc: 'Zoomies become tornadoes that fling enemies.',
    base: B({ damage: 8, cooldown: 3.0, count: 1, speed: 55, area: 1, duration: 3, knockback: 140 }),
    ups: [{ count: 1 }, { damage: 4 }, { area: 1.2 }, { speed: 1.2 }, { count: 1 }, { damage: 6 }, { count: 1 }],
  },
  {
    id: 'voidbox', name: 'VOID BOX', icon: 'voidbox', countLabel: 'BOX', affects: [],
    desc: 'If it fits, it sits. Pulls enemies in.',
    base: B({ damage: 8, cooldown: 6, count: 1, area: 1, duration: 3 }),
    ups: [{ duration: 0.5 }, { damage: 4 }, { area: 1.2 }, { count: 1 }, { damage: 6 }, { cooldown: 0.85 }, { duration: 1 }],
  },
  {
    id: 'flask', name: 'SOUR MILK FLASK', icon: 'flask', countLabel: 'FLASK', affects: [],
    desc: 'Toxic spilled milk that poisons.',
    base: B({ damage: 14, cooldown: 3.4, count: 1, area: 1, duration: 3.5 }),
    ups: [{ count: 1 }, { damage: 5 }, { area: 1.15 }, { duration: 1 }, { count: 1 }, { damage: 7 }, { area: 1.2 }],
  },
  {
    id: 'dice', name: 'LUCKY DICE', icon: 'dice', countLabel: 'DIE', affects: [],
    desc: 'Deals 1-6 per pip. Rolling a 6 raises its crit.',
    base: B({ damage: 5, cooldown: 1.6, count: 1, speed: 130, pierce: 1 }),
    ups: [{ count: 1 }, { damage: 2 }, { cooldown: 0.9 }, { count: 1 }, { damage: 2 }, { pierce: 1 }, { count: 1 }],
  },
  {
    id: 'purr', name: 'PURR AURA', icon: 'purr', countLabel: 'AURA', affects: [],
    desc: 'Constant purring damages everything nearby.',
    base: B({ damage: 4, cooldown: 0.4, area: 1, knockback: 0 }),
    ups: [{ damage: 2 }, { area: 1.15 }, { damage: 3 }, { cooldown: 0.85 }, { area: 1.2 }, { damage: 4 }, { damage: 5 }],
  },
];
export const WEAPON_AFFECTS: Record<string, string[]> = {
  sword: ['SIZE', 'COUNT', 'DAMAGE', 'KNOCKBACK'], yarn: ['DAMAGE', 'COUNT', 'PROJ SPEED', 'DURATION', 'KNOCKBACK'], paw: ['SIZE', 'COUNT', 'DAMAGE'],
  fish: ['CRIT', 'DAMAGE', 'COUNT', 'PROJ SPEED'], hiss: ['SIZE', 'DAMAGE', 'KNOCKBACK'], shield: ['COUNT', 'SIZE', 'DAMAGE', 'KNOCKBACK'],
  dash: ['SIZE', 'DURATION', 'DAMAGE'], lightning: ['DAMAGE', 'COUNT', 'SIZE'], dragon: ['PROJ SPEED', 'DAMAGE', 'CRIT'], bomb: ['DURATION', 'DAMAGE', 'SIZE', 'COUNT'],
  hairball: ['PROJ SPEED', 'SIZE', 'DAMAGE', 'COUNT'], marbles: ['SIZE', 'DAMAGE', 'KNOCKBACK', 'PROJ SPEED', 'COUNT'], blaster: ['CRIT', 'DAMAGE', 'COUNT', 'PROJ SPEED'],
  catarang: ['DAMAGE', 'COUNT', 'PROJ SPEED', 'SIZE'], scratcher: ['COUNT', 'DURATION', 'DAMAGE', 'SIZE'], laser: ['DAMAGE', 'SIZE', 'DURATION', 'COUNT'],
  mouse: ['PROJ SPEED', 'COUNT', 'DAMAGE', 'CRIT'], shotgun: ['CRIT', 'DAMAGE', 'KNOCKBACK', 'COUNT'], coldmilk: ['DAMAGE', 'SIZE', 'DURATION'],
  twister: ['KNOCKBACK', 'DAMAGE', 'SIZE', 'PROJ SPEED', 'COUNT'], voidbox: ['DURATION', 'DAMAGE', 'SIZE', 'COUNT'], flask: ['DAMAGE', 'DURATION', 'COUNT', 'SIZE'],
  dice: ['SIZE', 'CRIT', 'DAMAGE', 'PROJ SPEED', 'COUNT'], purr: ['DAMAGE', 'SIZE'],
};
for (const w of WEAPONS) w.affects = WEAPON_AFFECTS[w.id] || [];
export const WEAPON_BY_ID: Record<string, WeaponDef> = Object.fromEntries(WEAPONS.map((w) => [w.id, w]));
export const MAX_WEAPON_LEVEL = 8;

export function upText(u: Partial<WStats>, def: WeaponDef): string[] {
  const out: string[] = [];
  if (u.damage) out.push(`+${u.damage} DAMAGE`);
  if (u.count) out.push(`+${u.count} ${def.countLabel}${u.count > 1 ? 'S' : ''}`);
  if (u.cooldown) out.push(`-${Math.round((1 - u.cooldown) * 100)}% COOLDOWN`);
  if (u.area) out.push(`+${Math.round((u.area - 1) * 100)}% AREA`);
  if (u.speed) out.push(`+${Math.round((u.speed - 1) * 100)}% SPEED`);
  if (u.pierce) out.push(`+${u.pierce} ${def.id === 'lightning' ? 'CHAIN' : 'PIERCE'}`);
  if (u.bounce) out.push(`+${u.bounce} BOUNCE`);
  if (u.knockback) out.push(`+${u.knockback} KNOCKBACK`);
  if (u.duration) out.push(`+${u.duration}S TRAIL`);
  return out;
}

export interface PassiveDef {
  id: string; name: string; icon: string; max: number; per: number; fmt: (v: number) => string; desc: string;
}
const pc = (s: string) => (v: number) => `+${Math.round(v * 100)}% ${s}`;
export const PASSIVES: PassiveDef[] = [
  { id: 'collar', name: 'IRON COLLAR', icon: 'collar', max: 5, per: 20, fmt: (v) => `+${Math.round(v)} MAX HP`, desc: 'Sturdy neck protection.' },
  { id: 'boots', name: 'TINY BOOTS', icon: 'boots', max: 5, per: 0.08, fmt: pc('MOVE SPEED'), desc: 'Fast little feet.' },
  { id: 'cape', name: 'ROYAL CAPE', icon: 'cape', max: 5, per: 0.25, fmt: pc('PICKUP RANGE'), desc: 'Majestic and magnetic.' },
  { id: 'armor', name: 'SHINY ARMOR', icon: 'armor', max: 5, per: 1, fmt: (v) => `+${Math.round(v)} ARMOR`, desc: 'Take less damage from hits.' },
  { id: 'snack', name: 'FISH SNACK', icon: 'snack', max: 5, per: 0.1, fmt: pc('XP GAIN'), desc: 'Delicious experience.' },
  { id: 'bell', name: 'LUCKY BELL', icon: 'bell', max: 5, per: 0.05, fmt: pc('LUCK'), desc: 'Jingle for better loot.' },
  { id: 'claws', name: 'SHARP CLAWS', icon: 'claws', max: 5, per: 0.06, fmt: pc('CRIT CHANCE'), desc: 'Pointy where it counts.' },
  { id: 'bigpaws', name: 'BIG PAWS', icon: 'bigpaws', max: 5, per: 0.1, fmt: pc('AREA'), desc: 'Bigger swings, bigger booms.' },
  { id: 'catnip', name: 'CATNIP', icon: 'catnip', max: 5, per: 0.07, fmt: pc('FASTER COOLDOWN'), desc: 'Weapons recharge quicker.' },
  { id: 'heart', name: 'BRAVE HEART', icon: 'heart', max: 5, per: 0.1, fmt: pc('DAMAGE'), desc: 'Courage hits harder.' },
  { id: 'feather', name: 'FEATHER', icon: 'feather', max: 5, per: 0.12, fmt: pc('PROJECTILE SPEED'), desc: 'Light as a feather.' },
  { id: 'bow', name: 'MAGIC BOW', icon: 'bow', max: 2, per: 1, fmt: (v) => `+${Math.round(v)} PROJECTILE`, desc: 'More shots per volley.' },
  { id: 'milk', name: 'WARM MILK', icon: 'milk', max: 5, per: 0.5, fmt: (v) => `+${v.toFixed(1)} HP/SEC`, desc: 'Slowly heals the kitten.' },
  { id: 'coat', name: 'FLUFF COAT', icon: 'coat', max: 5, per: 12, fmt: (v) => `+${Math.round(v)} SHIELD`, desc: 'A shield that recharges when you avoid hits.' },
  { id: 'nimble', name: 'NIMBLE TAIL', icon: 'nimble', max: 5, per: 0.06, fmt: pc('EVASION'), desc: 'Chance to dodge an attack entirely.' },
  { id: 'spiky', name: 'SPIKY COLLAR', icon: 'spiky', max: 5, per: 8, fmt: (v) => `+${Math.round(v)} THORNS`, desc: 'Hurts enemies that hurt you.' },
  { id: 'tuna', name: 'TASTY TUNA', icon: 'tuna', max: 5, per: 0.04, fmt: pc('LIFESTEAL CHANCE'), desc: 'Chance to heal 1 HP on hit.' },
  { id: 'spool', name: 'YARN SPOOL', icon: 'spool', max: 5, per: 0.12, fmt: pc('DURATION'), desc: 'Attacks and projectiles last longer.' },
  { id: 'pounce', name: 'POUNCE GLOVES', icon: 'pounce', max: 5, per: 0.15, fmt: pc('KNOCKBACK'), desc: 'Push enemies much farther.' },
  { id: 'purse', name: 'COIN PURSE', icon: 'purse', max: 5, per: 0.15, fmt: pc('GOLD'), desc: 'More gold from everything.' },
  { id: 'charm', name: 'BLACK CAT CHARM', icon: 'charm', max: 3, per: 1, fmt: (v) => `+${Math.round(v * 12)}% ENEMY STATS, +${Math.round(v * 6)}% XP & GOLD`, desc: 'Bad luck? More enemies, more rewards.' },
  { id: 'chaos', name: 'CHAOS BOX', icon: 'chaos', max: 3, per: 1, fmt: () => 'BOOST A RANDOM TOME', desc: 'Something inside is moving.' },
];
export const PASSIVE_BY_ID: Record<string, PassiveDef> = Object.fromEntries(PASSIVES.map((p) => [p.id, p]));
export const MAX_WEAPONS = 6;
export const MAX_PASSIVES = 6;

export interface EvoDef { id: string; name: string; icon: string; base: string; partner: string; partnerLevel: number; desc: string; }
export const EVOS: EvoDef[] = [
  { id: 'holyclaws', name: 'HOLY CLAWS', icon: 'holyclaws', base: 'sword', partner: 'shield', partnerLevel: 5, desc: 'Double holy swings + huge spinning swords.' },
  { id: 'chaosyarn', name: 'CHAOS YARN', icon: 'chaosyarn', base: 'yarn', partner: 'paw', partnerLevel: 5, desc: 'Yarn explodes into giant paw smashes.' },
  { id: 'fishapoc', name: 'FISH APOCALYPSE', icon: 'fishapoc', base: 'fish', partner: 'hiss', partnerLevel: 5, desc: 'A storm of fish rains in every direction.' },
  { id: 'stormdragon', name: 'STORM DRAGON', icon: 'stormdragon', base: 'lightning', partner: 'dragon', partnerLevel: 5, desc: 'A storm dragon chains lightning everywhere.' },
  { id: 'cataclysm', name: 'CATACLYSM', icon: 'cataclysm', base: 'dash', partner: 'bomb', partnerLevel: 5, desc: 'Dashes leave exploding catnip bombs.' },
];
export const EVO_BY_ID: Record<string, EvoDef> = Object.fromEntries(EVOS.map((e) => [e.id, e]));

// ---------------------------------------------------------------- ENEMIES
export type Behavior = 'chase' | 'zigzag' | 'lunge' | 'charge' | 'ranged' | 'splitter' | 'goose' | 'vacuum';
export interface EnemyDef {
  id: string; name: string; hp: number; dmg: number; speed: number; xp: number; kb: number; r: number;
  weight: number; from: number; beh: Behavior; col: string; group?: number; desc: string;
  /** Not spawned and not listed. Kept in the table so ids/sprites stay valid. */
  hidden?: boolean;
}
export const ENEMIES: EnemyDef[] = [
  { id: 'rat', name: 'RAT', hp: 6, dmg: 4, speed: 52, xp: 1, kb: 0, r: 4, weight: 10, from: 0, beh: 'chase', col: '#8c8896', group: 5, desc: 'Fast, weak, and everywhere.', hidden: true },
  { id: 'slime', name: 'SLIME', hp: 14, dmg: 4, speed: 32, xp: 2, kb: 0.2, r: 6, weight: 10, from: 0, beh: 'chase', col: '#5ed16a', group: 4, desc: 'Squishy and everywhere.' },
  { id: 'bat', name: 'BAT', hp: 7, dmg: 3, speed: 58, xp: 2, kb: 0, r: 5, weight: 7, from: 1, beh: 'zigzag', col: '#5a4a86', group: 3, desc: 'Flutters in unpredictable zig-zags.' },
  { id: 'spider', name: 'SPIDER', hp: 14, dmg: 4, speed: 44, xp: 3, kb: 0.1, r: 5, weight: 6, from: 2, beh: 'lunge', col: '#4a3556', desc: 'Stops, then pounces.' },
  { id: 'goose', name: 'ANGRY GOOSE', hp: 38, dmg: 9, speed: 52, xp: 6, kb: 0.2, r: 6, weight: 4, from: 3, beh: 'goose', col: '#f4f4f4', desc: 'Honks. Charges. Unpredictable.', hidden: true },
  { id: 'goblin', name: 'GOBLIN', hp: 29, dmg: 6, speed: 40, xp: 4, kb: 0.2, r: 6, weight: 8, from: 4, beh: 'chase', col: '#6fbf4a', desc: 'Medium speed, medium everything.' },
  { id: 'skeleton', name: 'SKELETON', hp: 51, dmg: 7, speed: 28, xp: 5, kb: 0.3, r: 6, weight: 7, from: 4, beh: 'chase', col: '#ece6d3', desc: 'Slow, bony, hard to put down.' },
  { id: 'vacuum', name: 'ROBO VACUUM', hp: 76, dmg: 8, speed: 32, xp: 15, kb: 0.5, r: 9, weight: 2, from: 5, beh: 'vacuum', col: '#8d97ab', desc: 'Sucks. Literally.' },
  { id: 'wolf', name: 'WOLF', hp: 36, dmg: 8, speed: 52, xp: 6, kb: 0.2, r: 7, weight: 6, from: 6, beh: 'charge', col: '#7c8190', desc: 'Winds up, then charges.' },
  { id: 'wizard', name: 'WIZARD', hp: 31, dmg: 6, speed: 32, xp: 8, kb: 0.1, r: 6, weight: 4, from: 6, beh: 'ranged', col: '#6a44b8', desc: 'Keeps its distance and throws magic.' },
  { id: 'orc', name: 'ORC', hp: 187, dmg: 10, speed: 20, xp: 18, kb: 0.7, r: 10, weight: 3, from: 8, beh: 'chase', col: '#6c8f4e', desc: 'Very slow. Extremely sturdy.' },
  { id: 'gspider', name: 'GIANT SPIDER', hp: 153, dmg: 9, speed: 30, xp: 20, kb: 0.6, r: 11, weight: 2.5, from: 8, beh: 'splitter', col: '#4a3b66', desc: 'Breeds little spiders.' },
];
export const ENEMY_BY_ID: Record<string, EnemyDef> = Object.fromEntries(ENEMIES.map((e) => [e.id, e]));

export interface BossDef {
  id: string; name: string; sprite: string; hp: number; dmg: number; speed: number; r: number; at: number; // minute
  xp: number; warn: string; col: string; desc: string; kill: string;
}
export const BOSSES: BossDef[] = [
  { id: 'dog', name: 'THE EVIL DOG', sprite: 'dog', hp: 1700, dmg: 16, speed: 36, r: 17, at: 3, xp: 150, warn: 'A HUGE THREAT APPROACHES...', col: '#8a5a34', desc: 'Charges, howls, summons slimes.', kill: 'Good kitty.' },
  { id: 'roobo', name: 'ANCIENT ROOBO', sprite: 'roobo', hp: 4200, dmg: 16, speed: 22, r: 24, at: 6, xp: 300, warn: 'THE ANCIENT EVIL HAS RETURNED.', col: '#b6bccb', desc: 'Sucks you in, spews dust bunnies.', kill: 'It was only a vacuum.' },
  { id: 'dragon', name: 'THE DRAGON', sprite: 'dragon', hp: 8500, dmg: 18, speed: 50, r: 28, at: 9, xp: 500, warn: 'SOMETHING HUGE IS BREATHING...', col: '#3c9a4a', desc: 'Circles overhead, breathes fire.', kill: 'Tiny dragon approves.' },
  { id: 'knight', name: 'THE DARK KNIGHT', sprite: 'knight', hp: 15000, dmg: 20, speed: 34, r: 24, at: 12, xp: 800, warn: 'AN OVERSIZED RIVAL APPEARS...', col: '#34344e', desc: 'Telegraphed slashes, leaps, skeletons.', kill: 'Size is not everything.' },
  { id: 'cateater', name: 'THE CAT EATER', sprite: 'cateater', hp: 26000, dmg: 24, speed: 18, r: 38, at: 15, xp: 2000, warn: 'IT HAS COME FOR THE KITTEN...', col: '#2e2250', desc: 'The final nightmare.', kill: 'Good kitty.' },
];
export const BOSS_BY_ID: Record<string, BossDef> = Object.fromEntries(BOSSES.map((b) => [b.id, b]));

export interface CharDef { id: string; name: string; desc: string; hp: number; speed: number; weapon: string; }
export const CHARACTERS: CharDef[] = [
  { id: 'meows', name: 'KITTY KNIGHT', desc: 'A tiny knight with a very large sword.', hp: 100, speed: 85, weapon: 'sword' },
];

export interface MetaDef { id: string; name: string; icon: string; max: number; base: number; desc: (lvl: number) => string; }
export const META: MetaDef[] = [
  { id: 'hp', name: 'MAX HP', icon: 'heart', max: 5, base: 60, desc: (l) => `+${l * 10}% MAX HP` },
  { id: 'speed', name: 'MOVE SPEED', icon: 'boots', max: 5, base: 70, desc: (l) => `+${l * 3}% MOVE SPEED` },
  { id: 'dmg', name: 'DAMAGE', icon: 'claws', max: 5, base: 90, desc: (l) => `+${l * 5}% DAMAGE` },
  { id: 'pickup', name: 'PICKUP RANGE', icon: 'cape', max: 5, base: 60, desc: (l) => `+${l * 10}% PICKUP RANGE` },
  { id: 'luck', name: 'LUCK', icon: 'bell', max: 5, base: 80, desc: (l) => `+${l * 2}% LUCK` },
  { id: 'armor', name: 'ARMOR', icon: 'armor', max: 3, base: 150, desc: (l) => `+${l} ARMOR` },
  { id: 'xp', name: 'XP GAIN', icon: 'snack', max: 5, base: 80, desc: (l) => `+${l * 5}% XP GAIN` },
];
export const metaCost = (m: MetaDef, lvl: number) => Math.round(m.base * Math.pow(1 + lvl, 1.35));

export const xpForLevel = (lvl: number): number => {
  // XP needed to go from `lvl` to `lvl+1`
  const t = [0, 20, 25, 30, 40];
  if (lvl < t.length) return t[lvl];
  let inc = 40;
  for (let l = 5; l < lvl; l++) inc = Math.floor(inc * 1.085 + 4);
  return inc;
};

export const LEVEL_QUIPS: Record<number, string> = { 25: 'WHO GAVE HIM THIS MUCH POWER?' };
export const RUN_LENGTH = 15; // minutes

// ---------------------------------------------------------------- UNLOCKS (quests, like Megabonk's wiki list)
export interface RunStats { time: number; level: number; weapons: Record<string, number>; passives: Record<string, number>; noHitSec: number; win: boolean; bossFast: number; }
export interface Quest {
  target: string; kind: 'weapon' | 'passive'; text: string;
  stat?: string; killsBy?: string; run?: keyof RunStats | `weapon:${string}` | `passive:${string}`; goal: number;
}
export const DEFAULT_UNLOCKED = [
  'sword', 'yarn', 'lightning', 'hairball', 'marbles', 'fish', 'dash',
  'collar', 'boots', 'bigpaws', 'milk', 'feather', 'claws', 'heart', 'catnip', 'coat', 'nimble', 'pounce', 'purse',
];
export const QUESTS: Quest[] = [
  { target: 'shield', kind: 'weapon', text: 'ABSORB 400 DAMAGE WITH ARMOR OR SHIELDS', stat: 'blocked', goal: 400 },
  { target: 'hiss', kind: 'weapon', text: 'KILL 500 ENEMIES WITH CAT DASH', killsBy: 'dash', goal: 500 },
  { target: 'paw', kind: 'weapon', text: 'REACH LEVEL 15 IN A SINGLE RUN', run: 'level', goal: 15 },
  { target: 'dragon', kind: 'weapon', text: 'GET LIGHTNING CLAW TO LEVEL 6', run: 'weapon:lightning', goal: 6 },
  { target: 'bomb', kind: 'weapon', text: 'OPEN 8 TREASURE CHESTS', stat: 'chests', goal: 8 },
  { target: 'blaster', kind: 'weapon', text: 'KILL 1,500 ENEMIES', stat: 'kills', goal: 1500 },
  { target: 'catarang', kind: 'weapon', text: 'FIND 4 WORLD TREASURE CHESTS', stat: 'worldChests', goal: 4 },
  { target: 'purr', kind: 'weapon', text: 'TAKE NO DAMAGE FOR 2 MINUTES', run: 'noHitSec', goal: 120 },
  { target: 'scratcher', kind: 'weapon', text: 'KILL 1,000 ENEMIES WITH THE GIANT SWORD', killsBy: 'sword', goal: 1000 },
  { target: 'laser', kind: 'weapon', text: 'SURVIVE 8 MINUTES IN A RUN', run: 'time', goal: 480 },
  { target: 'mouse', kind: 'weapon', text: 'KILL 1,500 ENEMIES WITH THE MOUSE BLASTER', killsBy: 'blaster', goal: 1500 },
  { target: 'shotgun', kind: 'weapon', text: 'DEFEAT 10 ELITE ENEMIES', stat: 'elites', goal: 10 },
  { target: 'coldmilk', kind: 'weapon', text: 'SLOW 800 ENEMIES WITH CATNIP CLOUDS', stat: 'slowed', goal: 800 },
  { target: 'twister', kind: 'weapon', text: 'DASH 80 TIMES', stat: 'dashes', goal: 80 },
  { target: 'voidbox', kind: 'weapon', text: 'GET POUNCE GLOVES TO LEVEL 4', run: 'passive:pounce', goal: 4 },
  { target: 'flask', kind: 'weapon', text: 'DEFEAT 3 BOSSES', stat: 'bossKills', goal: 3 },
  { target: 'dice', kind: 'weapon', text: 'GET LUCKY BELL TO LEVEL 3', run: 'passive:bell', goal: 3 },
  { target: 'spiky', kind: 'passive', text: 'BLOCK 60 ENEMY SHOTS WITH ROYAL SHIELD', stat: 'shotsBlocked', goal: 60 },
  { target: 'bow', kind: 'passive', text: 'FIRE 3,000 PROJECTILES', stat: 'projectiles', goal: 3000 },
  { target: 'tuna', kind: 'passive', text: 'KILL 6,000 ENEMIES', stat: 'kills', goal: 6000 },
  { target: 'cape', kind: 'passive', text: 'COLLECT 2,000 XP GEMS', stat: 'gems', goal: 2000 },
  { target: 'armor', kind: 'passive', text: 'TAKE 400 DAMAGE IN TOTAL', stat: 'damageTaken', goal: 400 },
  { target: 'spool', kind: 'passive', text: 'GET YARN BALL TO LEVEL 6', run: 'weapon:yarn', goal: 6 },
  { target: 'bell', kind: 'passive', text: 'DEFEAT 5 ELITE ENEMIES', stat: 'elites', goal: 5 },
  { target: 'snack', kind: 'passive', text: 'OPEN 3 TREASURE CHESTS', stat: 'chests', goal: 3 },
  { target: 'charm', kind: 'passive', text: 'DEFEAT THE EVIL DOG IN UNDER 4:30', run: 'bossFast', goal: 1 },
  { target: 'chaos', kind: 'passive', text: 'WIN A RUN (DEFEAT THE CAT EATER)', run: 'win', goal: 1 },
];
export const QUEST_BY_TARGET: Record<string, Quest> = Object.fromEntries(QUESTS.map((q) => [q.target, q]));
