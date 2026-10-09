import type { BossDef, EnemyDef, WeaponDef, WStats, Rarity } from './data';
import type { Spr } from './sprites';

export class Enemy {
  id = 0;
  alive = false;
  x = 0; y = 0;
  kx = 0; ky = 0; // knockback velocity
  hp = 1; maxHp = 1; dmg = 1; speed = 1; r = 5;
  def!: EnemyDef;
  boss: BossDef | null = null;
  elite = false;
  t = 0; // age
  st = 0; stT = 0; // behaviour state + timer
  ax = 0; ay = 0; // locked aim / direction
  c1 = 0; c2 = 0; c3 = 0; // behaviour scratch
  ph = 1; // boss phase
  flash = 0;
  face = -1;
  anim = 0;
  slowT = 0;
  dying = 0;
  hpShown = 1;
  tick = new Float32Array(8);
  frozenT = 0;
  poisonT = 0; poisonD = 0; poisonTick = 0;
  lastSrc = '';
  spr!: Spr;
  xpMul = 1;
  home = 0;
}

export class Proj {
  alive = false;
  kind = '';
  x = 0; y = 0; vx = 0; vy = 0; r = 3;
  dmg = 1; life = 1; pierce = 0; bounce = 0; knock = 0;
  hostile = false;
  rot = 0; spin = 0;
  hit: Enemy[] = [];
  lastHit: Enemy | null = null; lastT = 0;
  homing = false;
  evo = false;
  aux = 0;
  aux2 = 0;
  spr = '';
  src = '';
  x0 = 0; y0 = 0;
}

export class Gem { alive = false; x = 0; y = 0; v = 1; age = 0; attract = false; vx = 0; vy = 0; }
export class Pickup { alive = false; kind: 'meat' | 'coin' | 'magnet' = 'coin'; x = 0; y = 0; v = 1; age = 0; vx = 0; vy = 0; }
export class Particle { alive = false; x = 0; y = 0; vx = 0; vy = 0; life = 0; max = 1; col = '#fff'; size = 1; grav = 0; }
export class DmgNum { alive = false; x = 0; y = 0; vy = 0; life = 0; text = ''; col = '#fff'; crit = false; big = false; }

export interface Chest { x: number; y: number; kind: 'world' | 'elite' | 'boss'; open: number; t: number; dead: boolean }
export interface Fx { k: string; x: number; y: number; t: number; dur: number; [key: string]: any }

export class Weapon {
  def: WeaponDef;
  level = 1;
  evolved = false;
  evoId = '';
  timer = 0.5;
  bonus = 0;
  st!: WStats;
  data: any = {};
  constructor(def: WeaponDef) {
    this.def = def;
    this.recalc();
  }
  recalc() {
    const st = { ...this.def.base };
    for (let i = 0; i < this.level - 1; i++) {
      const u = this.def.ups[i];
      if (!u) continue;
      for (const k of Object.keys(u) as (keyof WStats)[]) {
        if (k === 'cooldown' || k === 'area' || k === 'speed') st[k] *= u[k]!;
        else st[k] += u[k]!;
      }
    }
    this.st = st;
  }
}

export interface PStats {
  maxHp: number; speed: number; armor: number; pickup: number; luck: number; crit: number; area: number;
  cd: number; dmg: number; projSpeed: number; proj: number; xp: number; regen: number;
  kb: number; dur: number; evasion: number; shieldMax: number; thorns: number; lifesteal: number; goldMul: number; curse: number;
}
export interface PassiveState { id: string; level: number; pow: number }

export interface Card {
  kind: 'weapon' | 'passive' | 'evo' | 'heal' | 'gold';
  id: string; name: string; icon: string; rarity: Rarity; isNew: boolean; level: number; lines: string[];
}
export interface Reward { kind: string; name: string; icon: string; text: string }
export interface RunResult {
  win: boolean; time: number; level: number; kills: number; damage: number; gold: number; bosses: number;
  weapons: { id: string; name: string; icon: string; level: number }[]; evolutions: string[];
  newBest: boolean; quip: string; combo: number; unlocks: string[];
}
export interface GameEvents {
  overlay(kind: 'none' | 'pause' | 'levelup' | 'chest', data?: any): void;
  end(res: RunResult): void;
}
