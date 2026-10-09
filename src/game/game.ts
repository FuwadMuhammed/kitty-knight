// Core engine: state machine, entities, spawning, progression and rendering.
import {
  BOSSES, CHARACTERS, ENEMIES, ENEMY_BY_ID, EVOS, MAX_PASSIVES, MAX_WEAPONS, MAX_WEAPON_LEVEL, META, PASSIVES, PASSIVE_BY_ID, RARITY, RUN_LENGTH,
  WEAPONS, WEAPON_BY_ID, upText, xpForLevel, EVO_BY_ID, QUESTS, DEFAULT_UNLOCKED, QUEST_BY_TARGET,
} from './data';
import type { Quest, RunStats } from './data';
import type { BossDef, EnemyDef, Rarity } from './data';
import { World, WORLD_H, WORLD_W } from './world';
import { DECOR, S, X, SW, KG, ICON, drawCv, drawSpr, eliteSpr, ensureSprites, buildVignette } from './sprites';
import { Card, Chest, DmgNum, Enemy, Fx, Gem, GameEvents, PassiveState, Particle, PStats, Pickup, Proj, Reward, RunResult, Weapon } from './types';
import { RNG, TAU, angDiff, clamp, fmtTime, pick, query, rand, randInt, weightedPick, H, W } from './util';
import { addStat, discover, metaLevel, persist, save } from './save';
import { sfx, setMusicIntensity, startMusic, stopMusic, unlockAudio, applyAudioSettings } from './audio';
import { dashEnded, drawFx, drawProjs, drawWeapons, updateFx, updateProjs, updateWeapons } from './weapons';
import { updateBoss } from './bosses';
import { drawHUD, panel } from './hud';
import { drawText, textWidth } from './font';

export type GState = 'MENU' | 'PLAYING' | 'LEVEL_UP' | 'PAUSED' | 'CHEST' | 'GAME_OVER' | 'VICTORY' | 'RESULTS';

interface DashState { t: number; dur: number; dx: number; dy: number; speed: number; auto: boolean; w: Weapon | null; acc: number }
interface Player {
  x: number; y: number; vx: number; vy: number; hp: number; face: 1 | -1; aimA: number; inv: number; flash: number; dashCd: number;
  dash: DashState | null; anim: number; dead: boolean; deathT: number; lvl: number; xp: number; xpNext: number; s: PStats;
  weapons: Weapon[]; passives: PassiveState[]; blink: number;
  shield: number; shieldT: number; hidden: Record<string, number>; noHit: number;
}

const MAXE = 520, MAXP = 360, MAXG = 560, MAXPU = 80, MAXPART = 900, MAXDN = 90;
const CELL = 24;
const GW = Math.ceil(WORLD_W / CELL), GH = Math.ceil(WORLD_H / CELL);
const tmpE: Enemy[] = [];
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

export class Game {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  ev: GameEvents;
  world: World;
  vig: HTMLCanvasElement;

  mode: 'menu' | 'run' = 'menu';
  state: GState = 'MENU';
  menuT = 0;

  // run state
  time = 0;
  kills = 0;
  goldRun = 0;
  dmgDealt = 0;
  bossesKilled = 0;
  evolutions: string[] = [];
  combo = 0; comboT = 0; bestCombo = 0;
  comboMul = 1;
  p!: Player;
  pvx = 0; pvy = 0;
  pullX = 0; pullY = 0;
  tutorial = false;
  tipOn = false; tipSaid = false;
  rng = new RNG(1);
  cam = { x: 0, y: 0 };
  shakeAmt = 0;
  whiteFlash = 0;
  pendingLevels = 0;
  lastOffered: string[] = [];
  warnT = 0;
  warnBoss: BossDef | null = null;
  bossIdx = 0;
  activeBoss: Enemy | null = null;
  bossList: Enemy[] = [];
  victoryT = 0;
  magnetT = 0;
  banners: { text: string; sub: string; col: string; size: number; t: number; dur: number }[] = [];
  speech: { text: string; t: number; dur: number } | null = null;
  saidKills = false; saidLevel = false;
  nextElite = 0; nextVac = 0; nextSwarm = 0; spawnAcc = 0;
  quip = '';
  src = '';
  bossFast = 0;
  questT = 1;
  unlockedNow: string[] = [];
  endSent = false;
  god = false;
  isTouch = false;

  // pools
  enemies: Enemy[] = [];
  act: Enemy[] = [];
  projs: Proj[] = [];
  gems: Gem[] = [];
  pickups: Pickup[] = [];
  parts: Particle[] = [];
  dnums: DmgNum[] = [];
  fx: Fx[] = [];
  chests: Chest[] = [];
  private cur = { e: 0, pr: 0, g: 0, pu: 0, pa: 0, dn: 0 };
  gemCount = 0;
  private gridHead = new Int32Array(GW * GH).fill(-1);
  private gridNext = new Int32Array(MAXE);
  private frameN = 0;
  private renderList: { k: number; t: number; o: any }[] = [];
  private tallTmp: any[] = [];

  // input
  private keys = new Set<string>();
  private dashQueued = false;
  /** analog stick from the on-screen touch joystick, -1..1 */
  touch = { x: 0, y: 0 };
  private raf = 0;
  private last = 0;
  private disposed = false;
  private enemySeen: Record<string, boolean> = {};

  constructor(canvas: HTMLCanvasElement, ev: GameEvents) {
    ensureSprites();
    this.canvas = canvas;
    this.ev = ev;
    canvas.width = W;
    canvas.height = H;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.ctx.imageSmoothingEnabled = false;
    this.world = new World(1337);
    this.vig = buildVignette(W, H);
    for (let i = 0; i < MAXE; i++) { const e = new Enemy(); e.id = i; this.enemies.push(e); }
    for (let i = 0; i < MAXP; i++) this.projs.push(new Proj());
    for (let i = 0; i < MAXG; i++) this.gems.push(new Gem());
    for (let i = 0; i < MAXPU; i++) this.pickups.push(new Pickup());
    for (let i = 0; i < MAXPART; i++) this.parts.push(new Particle());
    for (let i = 0; i < MAXDN; i++) this.dnums.push(new DmgNum());
    this.resetPlayer();
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('visibilitychange', this.onHidden);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
    (window as any).__game = this; // handy for debugging in the console
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('visibilitychange', this.onHidden);
    stopMusic();
  }

  // ------------------------------------------------------------ input
  private onKeyDown = (e: KeyboardEvent) => {
    unlockAudio();
    const c = e.code;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(c)) e.preventDefault();
    if (e.repeat) return;
    this.keys.add(c);
    if (c === 'Space' && this.state === 'PLAYING') this.dashQueued = true;
    if (c === 'Escape') {
      if (this.state === 'PLAYING') this.pause();
      else if (this.state === 'PAUSED') this.resume();
    }
  };
  private onKeyUp = (e: KeyboardEvent) => { this.keys.delete(e.code); };
  private onHidden = () => { if (document.hidden && this.state === 'PLAYING') this.pause(); };
  setTouchMove(x: number, y: number) { this.touch.x = x; this.touch.y = y; }
  touchDash() { if (this.state === 'PLAYING') this.dashQueued = true; }
  private onBlur = () => {
    this.keys.clear();
    if (this.state === 'PLAYING') this.pause();
  };

  pause() {
    if (this.state !== 'PLAYING') return;
    this.state = 'PAUSED';
    this.ev.overlay('pause');
  }
  resume() {
    if (this.state !== 'PAUSED') return;
    this.state = 'PLAYING';
    this.ev.overlay('none');
  }
  /** Quit the current run: banks gold, then shows results. */
  quitRun() {
    if (this.mode !== 'run' || this.endSent) return;
    this.finishRun(false, true);
  }
  showMenu() {
    this.mode = 'menu';
    this.state = 'MENU';
    this.keys.clear();
    this.ev.overlay('none');
  }

  // ------------------------------------------------------------ run setup
  private resetPlayer() {
    this.p = {
      x: WORLD_W / 2, y: WORLD_H / 2, vx: 0, vy: 0, hp: 100, face: 1, aimA: 0, inv: 0, flash: 0, dashCd: 0, dash: null, anim: 0, dead: false,
      deathT: 0, lvl: 1, xp: 0, xpNext: xpForLevel(1), s: { maxHp: 100, speed: 85, armor: 0, pickup: 40, luck: 0.05, crit: 0.05, area: 1, cd: 1, dmg: 1, projSpeed: 1, proj: 0, xp: 1, regen: 0, kb: 1, dur: 1, evasion: 0, shieldMax: 0, thorns: 0, lifesteal: 0, goldMul: 1, curse: 0 },
      weapons: [], passives: [], blink: 0, shield: 0, shieldT: 0, hidden: {}, noHit: 0,
    };
  }

  startRun(charId = 'meows') {
    const ch = CHARACTERS.find((c) => c.id === charId) || CHARACTERS[0];
    for (const e of this.enemies) e.alive = false;
    for (const pr of this.projs) pr.alive = false;
    for (const gm of this.gems) gm.alive = false;
    for (const pu of this.pickups) pu.alive = false;
    for (const pa of this.parts) pa.alive = false;
    for (const d of this.dnums) d.alive = false;
    this.act.length = 0; this.fx.length = 0; this.chests.length = 0; this.bossList.length = 0; this.banners.length = 0;
    this.gemCount = 0;
    this.resetPlayer();
    const dbgT = parseFloat(query.get('t') || '0') || 0;
    this.time = dbgT * 60;
    this.kills = 0; this.goldRun = 0; this.dmgDealt = 0; this.bossesKilled = 0; this.evolutions = [];
    this.combo = 0; this.comboT = 0; this.bestCombo = 0; this.comboMul = 1;
    this.pendingLevels = 0; this.lastOffered = []; this.warnT = 0; this.warnBoss = null; this.activeBoss = null; this.victoryT = 0; this.magnetT = 0;
    this.bossIdx = BOSSES.filter((b) => b.at * 60 <= this.time).length;
    this.saidKills = false; this.saidLevel = false; this.bossFast = 0; this.unlockedNow = []; this.src = '';
    this.spawnAcc = 0; this.nextElite = this.time + 150; this.nextVac = this.time + 300; this.nextSwarm = this.time + 80;
    this.shakeAmt = 0; this.whiteFlash = 0; this.speech = null; this.endSent = false; this.quip = '';
    this.god = query.get('god') === '1';
    this.tutorial = !save.tutorialDone;
    this.tipOn = this.tutorial; this.tipSaid = false;
    const sw = new Weapon(WEAPON_BY_ID[ch.weapon]);
    sw.timer = 1.2;
    this.p.weapons.push(sw);
    discover('weapons', sw.def.id);
    // debug loadout: ?gear=yarn:8,paw:5&pass=boots:3
    const gear = query.get('gear');
    if (gear) for (const part of gear.split(',')) {
      const [id, lv] = part.split(':');
      const def = WEAPON_BY_ID[id];
      if (!def) continue;
      let w = this.p.weapons.find((x) => x.def.id === id);
      if (!w) { w = new Weapon(def); this.p.weapons.push(w); }
      w.level = clamp(parseInt(lv || '1'), 1, 8); w.recalc();
      discover('weapons', id);
    }
    const pass = query.get('pass');
    if (pass) for (const part of pass.split(',')) {
      const [id, lv] = part.split(':');
      if (!PASSIVE_BY_ID[id]) continue;
      const n = clamp(parseInt(lv || '1'), 1, 5);
      this.p.passives.push({ id, level: n, pow: n });
    }
    this.recalcStats(true);
    this.p.hp = this.p.s.maxHp;
    const startLvl = parseInt(query.get('lvl') || '1') || 1;
    this.p.lvl = startLvl; this.p.xpNext = xpForLevel(startLvl);
    for (const sp of this.world.chestSpots) this.chests.push({ x: sp.x, y: sp.y, kind: 'world', open: 0, t: Math.random() * 3, dead: false });
    this.cam.x = clamp(this.p.x - W / 2, 0, WORLD_W - W);
    this.cam.y = clamp(this.p.y - H / 2, 0, WORLD_H - H);
    this.mode = 'run';
    this.state = 'PLAYING';
    this.ev.overlay('none');
    this.keys.clear();
    this.say('Monsters? Before breakfast?', 2.6, 0.8);
    this.say("I'll defend my honor!", 2.6, 3.9);
    unlockAudio();
    applyAudioSettings();
    startMusic();
  }

  recalcStats(initial = false) {
    const p = this.p, s = p.s;
    const ch = CHARACTERS[0];
    const pw = (id: string) => (p.passives.find((x) => x.id === id)?.pow || 0) + (p.hidden[id] || 0);
    const oldMax = s.maxHp;
    s.maxHp = Math.round(ch.hp * (1 + 0.1 * metaLevel('hp')) + 20 * pw('collar'));
    s.speed = ch.speed * (1 + 0.03 * metaLevel('speed')) * (1 + 0.08 * pw('boots'));
    s.armor = metaLevel('armor') + pw('armor');
    s.pickup = 40 * (1 + 0.1 * metaLevel('pickup')) * (1 + 0.25 * pw('cape'));
    s.luck = 0.05 + 0.02 * metaLevel('luck') + 0.05 * pw('bell');
    s.crit = 0.05 + 0.06 * pw('claws');
    s.area = 1 + 0.1 * pw('bigpaws');
    s.cd = Math.max(0.45, 1 - 0.07 * pw('catnip'));
    s.dmg = (1 + 0.05 * metaLevel('dmg')) * (1 + 0.1 * pw('heart'));
    s.projSpeed = 1 + 0.12 * pw('feather');
    s.proj = Math.floor(pw('bow') + 0.001);
    s.xp = (1 + 0.05 * metaLevel('xp')) * (1 + 0.1 * pw('snack'));
    s.regen = 0.5 * pw('milk');
    s.kb = 1 + 0.15 * pw('pounce');
    s.dur = 1 + 0.12 * pw('spool');
    s.evasion = Math.min(0.6, 0.06 * pw('nimble'));
    const oldShield = s.shieldMax;
    s.shieldMax = 12 * pw('coat');
    s.thorns = 8 * pw('spiky');
    s.lifesteal = 0.04 * pw('tuna');
    s.goldMul = 1 + 0.15 * pw('purse') + 0.06 * pw('charm');
    s.curse = pw('charm');
    s.xp *= 1 + 0.06 * s.curse;
    if (s.shieldMax > oldShield) p.shield += s.shieldMax - oldShield;
    if (!initial && s.maxHp > oldMax) p.hp += s.maxHp - oldMax;
  }

  // ------------------------------------------------------------ main loop
  private frame = (ts: number) => {
    if (this.disposed) return;
    const dt = Math.min(0.05, Math.max(0.0005, (ts - this.last) / 1000));
    this.last = ts;
    this.frameN++;
    try {
      if (this.mode === 'menu') {
        this.menuT += dt;
        this.renderMenu();
      } else {
        this.step(dt);
        this.render();
      }
    } catch (err) {
      console.error('frame error', err);
    }
    this.raf = requestAnimationFrame(this.frame);
  };

  private step(dt: number) {
    // UI-only timers that always tick
    if (this.shakeAmt > 0) this.shakeAmt = Math.max(0, this.shakeAmt - dt * 5);
    if (this.whiteFlash > 0) this.whiteFlash -= dt * 1.6;
    switch (this.state) {
      case 'PLAYING': this.simulate(dt); break;
      case 'GAME_OVER': this.simulateDeath(dt); break;
      case 'VICTORY': this.simulateVictory(dt); break;
      default: break;
    }
  }

  private simulate(dt: number) {
    this.time += dt;
    // timers
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.combo = 0; }
    this.comboMul = 1 + Math.min(0.2, this.combo * 0.002);
    for (let i = this.banners.length - 1; i >= 0; i--) { this.banners[i].t += dt; if (this.banners[i].t >= this.banners[i].dur) this.banners.splice(i, 1); }
    if (this.speech) { this.speech.t += dt; if (this.speech.t >= this.speech.dur) this.speech = null; }
    if (this.magnetT > 0) this.magnetT -= dt;
    if (this.tipOn && !this.tipSaid && this.time >= 7) {
      // first run: the kitten explains the basics when the first monster closes in
      let near = this.time >= 20;
      for (let i = 0; i < this.act.length && !near; i++) { const e = this.act[i]; if (e.alive && !e.dying && Math.abs(e.x - this.p.x) < 150 && Math.abs(e.y - this.p.y) < 100) near = true; }
      if (near) {
        this.tipSaid = true;
        this.say('Here they come!', 2.4);
        this.say('If they touch me, I lose health!', 3, 2.6);
        this.say('I need to survive!', 2.8, 5.8);
      }
    }
    if (this.tutorial && this.time > 32) { this.tutorial = false; save.tutorialDone = true; persist(); }
    const minute = this.time / 60;
    setMusicIntensity(clamp(minute / 12, 0, 1));
    if (this.p.s.regen > 0 && !this.p.dead) this.p.hp = Math.min(this.p.s.maxHp, this.p.hp + this.p.s.regen * dt);

    this.updatePlayer(dt);
    this.buildGrid();
    this.updateEnemies(dt);
    updateWeapons(this, dt);
    updateProjs(this, dt);
    updateFx(this, dt);
    this.updateGems(dt);
    this.updatePickups(dt);
    this.updateChests(dt);
    this.director(dt);
    this.updateBossSchedule(dt);
    this.updateParticles(dt);
    this.updateCamera(dt);
    this.src = '';
    this.questT -= dt;
    if (this.questT <= 0) { this.questT = 1; this.checkQuests(); }
    if (this.pendingLevels > 0 && this.state === 'PLAYING') this.openLevelUp();
  }

  private simulateDeath(dt: number) {
    const p = this.p;
    p.deathT += dt;
    this.updateParticles(dt);
    this.updateCamera(dt);
    for (const e of this.act) e.flash = Math.max(0, e.flash - dt);
    if (p.deathT > 2.6 && !this.endSent) this.finishRun(false);
  }
  private simulateVictory(dt: number) {
    this.victoryT += dt;
    this.updateParticles(dt);
    this.updateCamera(dt);
    if (Math.random() < 0.5) {
      const p = this.p;
      this.spawnPart(p.x + rand(-60, 60), p.y + rand(-60, 20), rand(-20, 20), rand(-60, -20), 1.2, pick(['#ffd24a', '#ff6a8a', '#6ac8ff', '#9affb0', '#fff']), 2, 40);
    }
    if (this.victoryT > 4.5 && !this.endSent) this.finishRun(true);
  }

  // ------------------------------------------------------------ player
  private updatePlayer(dt: number) {
    const p = this.p;
    if (p.dead) return;
    let ix = 0, iy = 0;
    const k = this.keys;
    if (k.has('KeyA') || k.has('ArrowLeft')) ix -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) ix += 1;
    if (k.has('KeyW') || k.has('ArrowUp')) iy -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) iy += 1;
    const tm = Math.hypot(this.touch.x, this.touch.y);
    if (tm > 0.12) { const k2 = Math.min(1, tm * 1.15) / tm; ix = this.touch.x * k2; iy = this.touch.y * k2; }
    else if (ix && iy) { ix *= 0.7071; iy *= 0.7071; }
    const moving = ix !== 0 || iy !== 0;
    if (ix !== 0) p.face = ix > 0 ? 1 : -1;
    if (moving) p.aimA = Math.atan2(iy, ix);

    if (this.dashQueued) {
      this.dashQueued = false;
      if (p.dashCd <= 0 && !p.dash) {
        const dx = moving ? ix : p.face, dy = moving ? iy : 0;
        this.startDash(dx, dy, 54, 0.17, false, null);
        addStat('dashes');
        p.dashCd = 2.0;
        sfx('dash');
      }
    }
    p.dashCd = Math.max(0, p.dashCd - dt);
    p.noHit += dt;
    if (p.shieldT > 0) p.shieldT -= dt;
    else if (p.shield < p.s.shieldMax) p.shield = Math.min(p.s.shieldMax, p.shield + p.s.shieldMax * 0.6 * dt);
    p.inv = Math.max(0, p.inv - dt);
    p.flash = Math.max(0, p.flash - dt);
    p.blink -= dt;
    if (p.blink < -3.2) p.blink = 0.14;

    if (p.dash) {
      const d = p.dash;
      p.vx = d.dx * d.speed; p.vy = d.dy * d.speed;
      d.t -= dt;
      if (Math.random() < 0.8) this.spawnPart(p.x + rand(-3, 3), p.y + rand(-2, 6), rand(-6, 6), rand(-6, 6), 0.3, d.auto ? '#9ae0ff' : '#e8faff', 2, 0);
      if (d.t <= 0) { const w = d.w; p.dash = null; p.vx *= 0.3; p.vy *= 0.3; dashEnded(this, w); }
    } else {
      const sp = p.s.speed;
      const kk = 1 - Math.exp(-dt * (moving ? 13 : 10));
      p.vx += (ix * sp - p.vx) * kk;
      p.vy += (iy * sp - p.vy) * kk;
    }
    p.x = clamp(p.x + (p.vx + this.pullX) * dt, 10, WORLD_W - 10);
    p.y = clamp(p.y + (p.vy + this.pullY) * dt, 12, WORLD_H - 8);
    this.pvx = p.vx; this.pvy = p.vy;
    this.pullX = 0; this.pullY = 0;
    p.anim += dt * (Math.hypot(p.vx, p.vy) > 12 ? 1 : 0.35);
  }

  startDash(dx: number, dy: number, dist: number, dur: number, auto: boolean, w: Weapon | null) {
    const p = this.p;
    const l = Math.hypot(dx, dy) || 1;
    p.dash = { t: dur, dur, dx: dx / l, dy: dy / l, speed: dist / dur, auto, w, acc: 0 };
    p.inv = Math.max(p.inv, dur + 0.15);
  }
  pullPlayer(x: number, y: number, str: number, rad: number) {
    const p = this.p;
    const dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy);
    if (d > rad || d < 4 || p.dash) return;
    const f = str * (1 - (d / rad) * 0.5);
    this.pullX += (dx / d) * f;
    this.pullY += (dy / d) * f;
  }

  hurtPlayer(dmg: number) {
    const p = this.p;
    if (p.dead || p.inv > 0 || this.god || this.state !== 'PLAYING') return;
    if (p.s.evasion > 0 && Math.random() < p.s.evasion) {
      p.inv = 0.3;
      this.floatText(p.x, p.y - 16, 'DODGE!', '#9ae0ff');
      return;
    }
    const shields = p.weapons.find((w) => w.def.id === 'shield');
    const block = shields ? Math.ceil(shields.st.count / 2) : 0;
    let d = Math.max(1, Math.round(dmg - p.s.armor - block));
    addStat('blocked', Math.max(0, Math.round(dmg) - d));
    p.noHit = 0;
    p.shieldT = 3;
    p.inv = 0.7;
    if (p.shield > 0) {
      const ab = Math.min(p.shield, d);
      p.shield -= ab;
      d -= ab;
      addStat('blocked', ab);
      this.dnumAdd(p.x, p.y - 12, String(ab), '#6ac8ff', false, false, 0.9);
    }
    if (p.s.thorns > 0) {
      this.src = 'thorns';
      this.areaDamage(p.x, p.y, 26, p.s.thorns + dmg * 0.5, 120);
      this.src = '';
    }
    if (d <= 0) { sfx('hit'); this.burst(p.x, p.y, 6, ['#6ac8ff', '#fff'], 60, 0.3); return; }
    addStat('damageTaken', d);
    p.hp -= d;
    p.flash = 0.3;
    this.shake(0.9);
    sfx('hurt');
    this.burst(p.x, p.y, 8, ['#ff4d6a', '#fff'], 60, 0.4);
    this.dnumAdd(p.x, p.y - 12, String(d), '#ff6a7a', false, false, 0.9);
    if (p.hp <= 0) { p.hp = 0; this.die(); }
  }

  private die() {
    const p = this.p;
    p.dead = true;
    p.deathT = 0;
    p.dash = null;
    this.state = 'GAME_OVER';
    this.quip = 'He tried his best.';
    this.say('He tried his best.', 3, 0.6);
    sfx('death');
    stopMusic();
    this.burst(p.x, p.y, 20, ['#f6deb0', '#d9e0ec', '#fff'], 80, 0.8);
    this.shake(1.5);
  }

  // ------------------------------------------------------------ enemies
  private buildGrid() {
    this.act.length = 0;
    this.gridHead.fill(-1);
    for (let i = 0; i < MAXE; i++) {
      const e = this.enemies[i];
      if (!e.alive) continue;
      const idx = this.act.length;
      this.act.push(e);
      if (e.boss) continue;
      const cx = clamp((e.x / CELL) | 0, 0, GW - 1), cy = clamp((e.y / CELL) | 0, 0, GH - 1);
      const ci = cy * GW + cx;
      this.gridNext[idx] = this.gridHead[ci];
      this.gridHead[ci] = idx;
    }
  }

  /** Fills `out` with enemies whose circle overlaps the query circle. Returns count. */
  queryEnemies(x: number, y: number, r: number, out: Enemy[]): number {
    let n = 0;
    const pad = 17;
    const x0 = clamp(((x - r - pad) / CELL) | 0, 0, GW - 1), x1 = clamp(((x + r + pad) / CELL) | 0, 0, GW - 1);
    const y0 = clamp(((y - r - pad) / CELL) | 0, 0, GH - 1), y1 = clamp(((y + r + pad) / CELL) | 0, 0, GH - 1);
    for (let cy = y0; cy <= y1; cy++)
      for (let cx = x0; cx <= x1; cx++) {
        let i = this.gridHead[cy * GW + cx];
        while (i !== -1) {
          const e = this.act[i];
          const dx = e.x - x, dy = e.y - y, rr = r + e.r;
          if (e.dying <= 0 && dx * dx + dy * dy < rr * rr && n < 160) out[n++] = e;
          i = this.gridNext[i];
        }
      }
    for (const b of this.bossList) {
      const dx = b.x - x, dy = b.y - y, rr = r + b.r * 0.85;
      if (b.dying <= 0 && b.alive && dx * dx + dy * dy < rr * rr) out[n++] = b;
    }
    return n;
  }
  nearest(x: number, y: number, maxD: number, exclude?: Enemy[]): Enemy | null {
    let best: Enemy | null = null, bd = maxD * maxD;
    for (const e of this.act) {
      if (e.dying > 0) continue;
      const d = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (d < bd && !(exclude && exclude.includes(e))) { bd = d; best = e; }
    }
    return best;
  }
  nearestN(x: number, y: number, n: number, maxD: number): Enemy[] {
    const cand: { e: Enemy; d: number }[] = [];
    for (const e of this.act) {
      if (e.dying > 0) continue;
      const d = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (d < maxD * maxD) cand.push({ e, d });
    }
    cand.sort((a, b) => a.d - b.d);
    return cand.slice(0, n).map((c) => c.e);
  }
  randomEnemyNear(x: number, y: number, r: number, exclude?: Enemy[]): Enemy | null {
    let chosen: Enemy | null = null, seen = 0;
    for (const e of this.act) {
      if (e.dying > 0 || (exclude && exclude.includes(e))) continue;
      if ((e.x - x) ** 2 + (e.y - y) ** 2 > r * r) continue;
      seen++;
      if (Math.random() * seen < 1) chosen = e;
    }
    return chosen;
  }
  areaDamage(x: number, y: number, r: number, dmg: number, kb: number) {
    const n = this.queryEnemies(x, y, r, tmpE);
    const list = tmpE.slice(0, n);
    for (const e of list) {
      const a = Math.atan2(e.y - y, e.x - x);
      this.hurtEnemy(e, dmg, Math.cos(a), Math.sin(a), kb);
    }
  }
  explode(x: number, y: number, r: number, dmg: number, kb: number, big = false, visualOnly = false) {
    this.addFx({ k: 'boom', x, y, t: 0, dur: big ? 0.55 : 0.4, r, col: big ? '#ff6a3a' : '#9affb0', col2: big ? '#fff0b0' : '#e0ffe8' });
    if (!visualOnly) this.areaDamage(x, y, r, dmg, kb);
    this.burst(x, y, big ? 26 : 16, big ? ['#ff9a3a', '#ffd24a', '#fff'] : ['#58c878', '#b8ffcc', '#fff'], 110, 0.6);
    this.shake(big ? 1.6 : 0.9);
    sfx('boom');
  }

  hurtEnemy(e: Enemy, dmg: number, kx: number, ky: number, kb: number, critBonus = 0) {
    if (!e.alive || e.dying > 0) return;
    // crit: every full 100% of chance is a guaranteed crit tier ("overcrit"), the remainder is rolled
    const cc = this.p.s.crit + critBonus;
    const tiers = Math.floor(cc) + (Math.random() < cc - Math.floor(cc) ? 1 : 0);
    const crit = tiers > 0;
    let d = Math.max(1, Math.round(dmg * (1 + tiers)));
    e.lastSrc = this.src;
    if (this.p.s.lifesteal > 0 && Math.random() < this.p.s.lifesteal) this.p.hp = Math.min(this.p.s.maxHp, this.p.hp + 1);
    e.hp -= d;
    e.flash = 0.09;
    this.dmgDealt += d;
    const res = e.boss ? 0.93 : clamp(e.def.kb + (e.elite ? 0.3 : 0), 0, 0.95);
    const kk = kb * this.p.s.kb * (1 - res);
    e.kx = clamp(e.kx + kx * kk, -260, 260);
    e.ky = clamp(e.ky + ky * kk, -260, 260);
    if (save.settings.dmgNumbers) this.dnumAdd(e.x + rand(-4, 4), e.y - e.r - 4, d >= 100 ? `${d}!` : String(d), crit ? '#ffd24a' : d >= 100 ? '#ff9a3a' : '#ffffff', crit, d >= 100);
    if (crit) { this.shake(0.35); sfx('crit'); } else sfx('hit');
    if (e.slowT > 0 && false) void 0;
    if (!save.settings.reduced) this.spawnPart(e.x, e.y, rand(-30, 30), rand(-30, 30), 0.2, '#fff', 1, 0);
    if (e.hp <= 0) this.killEnemy(e);
  }

  private killEnemy(e: Enemy) {
    if (e.boss) {
      e.hp = 0; e.dying = 2.6;
      this.whiteFlash = 0.8;
      sfx('bossdie');
      return;
    }
    e.alive = false;
    this.kills++;
    addStat('kills');
    if (e.lastSrc) save.killsBy[e.lastSrc] = (save.killsBy[e.lastSrc] || 0) + 1;
    if (e.elite) addStat('elites');
    this.combo++;
    this.comboT = 2.4;
    if (this.combo > this.bestCombo) this.bestCombo = this.combo;
    if ([10, 25, 50, 100, 200].includes(this.combo)) this.banner(this.combo >= 50 ? 'RAMPAGE!' : `COMBO X${this.combo}`, this.combo >= 50 ? '#ff6a3a' : '#ffd24a', 2, this.combo >= 50 ? `X${this.combo} KILLS` : '', 1.6);
    if (this.kills === 1000) this.say("Are you sure you're the hero?", 3.5);
    const m = this.time / 60;
    const xpv = e.def.xp * 0.6 * (1 + 0.06 * this.p.s.curse) * (e.elite ? 4 : 1) * e.xpMul * (1 + m * 0.02);
    this.dropGem(e.x, e.y, xpv);
    const luck = this.p.s.luck;
    if (Math.random() < 0.006 + luck * 0.05) this.dropPickup('meat', e.x, e.y, 20);
    if (Math.random() < 0.035 + luck * 0.3) this.dropPickup('coin', e.x + rand(-4, 4), e.y + rand(-4, 4), Math.max(1, Math.round((randInt(1, 3) + Math.floor(m / 3)) * this.p.s.goldMul)));
    if (Math.random() < 0.0035 + luck * 0.02) this.dropPickup('magnet', e.x, e.y, 1);
    if (e.elite) {
      this.chests.push({ x: e.x, y: e.y, kind: 'elite', open: 0, t: 0, dead: false });
      for (let i = 0; i < 4; i++) this.dropPickup('coin', e.x + rand(-10, 10), e.y + rand(-10, 10), randInt(2, 5) + Math.floor(m / 2));
      this.burst(e.x, e.y, 16, ['#ffd24a', '#fff'], 100, 0.6);
    }
    this.burst(e.x, e.y, e.elite ? 12 : 6, [e.def.col, '#fff', '#2b1d22'], 55, 0.45);
    discover('enemies', e.def.id);
    if (e.def.beh === 'splitter') for (let i = 0; i < 3; i++) this.spawnEnemy('spider', e.x + rand(-12, 12), e.y + rand(-12, 12));
  }

  private finishBoss(e: Enemy) {
    const def = e.boss!;
    e.alive = false;
    this.bossList = this.bossList.filter((b) => b !== e);
    if (this.activeBoss === e) this.activeBoss = this.bossList[0] || null;
    this.bossesKilled++;
    addStat('bossKills');
    if (def.id === 'dog' && this.bossFast === 0 && this.time <= 270) this.bossFast = 1;
    discover('bosses', def.id);
    // the boss's death throes wipe out the regular horde
    for (const o of this.act.slice()) if (o.alive && !o.boss) this.killEnemy(o);
    for (const pr of this.projs) if (pr.hostile) pr.alive = false;
    for (let i = 0; i < 22; i++) this.dropGem(e.x + rand(-40, 40), e.y + rand(-30, 30), def.xp / 12);
    this.chests.push({ x: e.x, y: e.y, kind: 'boss', open: 0, t: 0, dead: false });
    this.dropPickup('meat', e.x - 20, e.y + 10, 40);
    this.dropPickup('meat', e.x + 20, e.y + 10, 40);
    for (let i = 0; i < 10; i++) this.dropPickup('coin', e.x + rand(-30, 30), e.y + rand(-20, 20), randInt(5, 10));
    this.p.hp = Math.min(this.p.s.maxHp, this.p.hp + this.p.s.maxHp * 0.25);
    this.burst(e.x, e.y, 60, ['#ffd24a', '#fff', def.col], 170, 1);
    this.shake(2.5);
    this.whiteFlash = 0.9;
    this.kills += 10;
    if (def.id === 'cateater') {
      this.state = 'VICTORY';
      this.victoryT = 0;
      this.quip = 'Good kitty.';
      this.banner('VICTORY!', '#ffd24a', 4, 'THE KITTEN SAVED THE DAY', 4);
      for (const o of this.act) if (o.alive && !o.boss) { o.alive = false; this.burst(o.x, o.y, 4, [o.def.col, '#fff'], 60, 0.4); }
      for (const pr of this.projs) pr.alive = false;
      sfx('victory');
      stopMusic();
    } else {
      this.banner('BOSS DEFEATED!', '#ffd24a', 2, '', 2.4);
      this.say(def.kill, 3);
    }
  }

  spawnEnemy(id: string, x?: number, y?: number, elite = false): Enemy | null {
    const def = ENEMY_BY_ID[id];
    if (!def) return null;
    let e: Enemy | null = null;
    for (let i = 0; i < MAXE; i++) {
      const idx = (this.cur.e + i) % MAXE;
      if (!this.enemies[idx].alive) { e = this.enemies[idx]; this.cur.e = idx + 1; break; }
    }
    if (!e) return null;
    const m = this.time / 60;
    const hpMul = 1 + 0.2 * m + 0.03 * m * m;
    const spdMul = 1 + Math.min(0.35, m * 0.03);
    const cu = this.p.s.curse * 0.12;
    const dmgMul = (1 + m * 0.04) * (1 + cu * 0.7);
    if (x === undefined || y === undefined) {
      const pos = this.spawnPos();
      x = pos.x; y = pos.y;
    }
    e.alive = true; e.def = def; e.boss = null; e.elite = elite;
    e.x = clamp(x, 6, WORLD_W - 6); e.y = clamp(y, 6, WORLD_H - 6);
    e.kx = 0; e.ky = 0; e.t = rand(0, 2); e.st = 0; e.stT = rand(0.5, 2.5); e.c1 = 0; e.c2 = 0; e.c3 = 0; e.ph = 1; e.ax = 0; e.ay = 0;
    e.flash = 0; e.slowT = 0; e.dying = 0; e.anim = rand(0, 2); e.tick.fill(0); e.frozenT = 0; e.poisonT = 0; e.lastSrc = ''; e.face = this.p.x > e.x ? 1 : -1; e.home = 0;
    // slimes never get tankier: always a one-hit pop for the starting sword
    e.maxHp = def.hp * (def.id === 'slime' && !elite ? 1 : hpMul) * (1 + cu) * (elite ? 3 : 1);
    e.hp = e.maxHp;
    e.dmg = def.dmg * dmgMul * (elite ? 1.5 : 1);
    e.speed = def.speed * spdMul * (1 + cu * 0.35) * (elite ? 0.95 : 1);
    e.r = def.r * (elite ? 1.35 : 1);
    e.xpMul = 1;
    e.spr = elite ? eliteSpr(def.id) : S[def.id];
    e.hpShown = 1;
    if (!this.enemySeen[def.id]) { this.enemySeen[def.id] = true; }
    return e;
  }

  private spawnPos(): { x: number; y: number } {
    const p = this.p;
    for (let tries = 0; tries < 8; tries++) {
      const a = rand(0, TAU), d = rand(195, 225);
      const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d * 0.75 + 0;
      if (x > 8 && x < WORLD_W - 8 && y > 8 && y < WORLD_H - 8) return { x, y };
    }
    const a = rand(0, TAU);
    return { x: clamp(p.x + Math.cos(a) * 200, 8, WORLD_W - 8), y: clamp(p.y + Math.sin(a) * 160, 8, WORLD_H - 8) };
  }

  private spawnBoss(def: BossDef) {
    let e: Enemy | null = null;
    for (const c of this.enemies) if (!c.alive) { e = c; break; }
    if (!e) { e = this.enemies[0]; e.alive = false; }
    const a = rand(0, TAU);
    const p = this.p;
    e.alive = true; e.def = ENEMIES[0]; e.boss = def; e.elite = false;
    e.x = clamp(p.x + Math.cos(a) * 190, 40, WORLD_W - 40); e.y = clamp(p.y + Math.sin(a) * 140, 40, WORLD_H - 40);
    e.kx = 0; e.ky = 0; e.t = 0; e.st = 0; e.stT = 2.5; e.c1 = 0; e.c2 = 0; e.c3 = 0; e.ph = 1; e.home = 0; e.ax = 0; e.ay = 0;
    e.flash = 0; e.slowT = 0; e.dying = 0; e.anim = 0; e.tick.fill(0); e.frozenT = 0; e.poisonT = 0; e.lastSrc = '';
    e.maxHp = def.hp; e.hp = def.hp; e.dmg = def.dmg; e.speed = def.speed; e.r = def.r; e.xpMul = 1;
    e.spr = S[def.sprite]; e.hpShown = 1; e.face = -1;
    this.bossList.push(e);
    this.activeBoss = e;
    discover('bosses', def.id);
    this.say(def.id === 'roobo' ? 'THE ANCIENT EVIL HAS RETURNED.' : def.id === 'cateater' ? 'Uh oh.' : 'Oh no.', 2.6);
  }

  private updateBossSchedule(dt: number) {
    if (this.warnT > 0) {
      this.warnT -= dt;
      if (this.warnT <= 0 && this.warnBoss) {
        this.spawnBoss(this.warnBoss);
        this.warnBoss = null;
        this.bossIdx++;
        this.shake(1.5);
      }
      return;
    }
    if (this.bossIdx >= BOSSES.length || this.bossList.length > 0) return;
    const def = BOSSES[this.bossIdx];
    if (this.time >= def.at * 60) {
      this.warnT = 3.4;
      this.warnBoss = def;
      sfx('warning');
    }
  }

  private updateEnemies(dt: number) {
    const p = this.p;
    const frameParity = this.frameN & 1;
    for (let i = 0; i < this.act.length; i++) {
      const e = this.act[i];
      e.t += dt;
      e.anim += dt;
      if (e.flash > 0) e.flash -= dt;
      if (e.slowT > 0) e.slowT -= dt;
      for (let k = 0; k < 8; k++) if (e.tick[k] > 0) e.tick[k] -= dt;
      if (e.frozenT > 0) e.frozenT -= dt;
      if (e.poisonT > 0) { e.poisonT -= dt; e.poisonTick -= dt; if (e.poisonTick <= 0) { e.poisonTick = 0.5; this.src = 'flask'; this.hurtEnemy(e, e.poisonD, 0, 0, 0); this.src = ''; if (!e.alive) continue; } }
      if (e.boss) {
        this.updateBossEntity(e, dt);
        continue;
      }
      const dx = p.x - e.x, dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const ux = dx / d, uy = dy / d;
      const sf = e.frozenT > 0 ? 0 : e.slowT > 0 ? 0.5 : 1;
      const sp = e.speed * sf;
      if (Math.abs(dx) > 3) e.face = dx > 0 ? 1 : -1;
      let mx = 0, my = 0;
      switch (e.def.beh) {
        case 'chase': mx = ux * sp; my = uy * sp; break;
        case 'zigzag': {
          const w = Math.sin(e.t * 5 + e.id) * 1.0;
          const c = Math.cos(w), s = Math.sin(w);
          mx = (ux * c - uy * s) * sp; my = (ux * s + uy * c) * sp;
          break;
        }
        case 'lunge': // spider: scuttle, crouch, pounce
          if (e.st === 0) { mx = ux * sp; my = uy * sp; e.stT -= dt; if (e.stT <= 0 && d < 90) { e.st = 1; e.stT = 0.4; } }
          else if (e.st === 1) { e.stT -= dt; e.flash = Math.max(e.flash, 0.01); if (e.stT <= 0) { e.st = 2; e.stT = 0.3; e.ax = ux; e.ay = uy; } }
          else { mx = e.ax * sp * 4; my = e.ay * sp * 4; e.stT -= dt; if (e.stT <= 0) { e.st = 0; e.stT = rand(1.2, 2.4); } }
          break;
        case 'charge': // wolf
          e.stT -= dt;
          if (e.st === 0) { mx = ux * sp; my = uy * sp; if (e.stT <= 0 && d < 150) { e.st = 1; e.stT = 0.5; e.ax = ux; e.ay = uy; } }
          else if (e.st === 1) { e.x += rand(-0.4, 0.4); e.ax = ux; e.ay = uy; if (e.stT <= 0) { e.st = 2; e.stT = 0.65; } }
          else if (e.st === 2) { mx = e.ax * 150 * sf; my = e.ay * 150 * sf; if (e.stT <= 0) { e.st = 3; e.stT = 0.7; } }
          else { mx = ux * sp * 0.3; my = uy * sp * 0.3; if (e.stT <= 0) { e.st = 0; e.stT = rand(0.5, 1.5); } }
          break;
        case 'ranged': // wizard keeps distance and fires orbs
          if (d > 110) { mx = ux * sp; my = uy * sp; } else if (d < 70) { mx = -ux * sp; my = -uy * sp; } else { mx = -uy * sp * 0.6; my = ux * sp * 0.6; }
          e.stT -= dt;
          if (e.stT <= 0 && d < 190) {
            if (e.st === 0) { e.st = 1; e.stT = 0.35; }
            else { e.st = 0; e.stT = 2.4 + Math.random(); this.enemyShot(e.x, e.y, Math.atan2(dy, dx), 72, e.dmg, 'orb', 4); }
          }
          if (e.st === 1) e.flash = Math.max(e.flash, 0.01);
          break;
        case 'splitter':
          mx = ux * sp; my = uy * sp;
          e.stT -= dt;
          if (e.stT <= 0) { e.stT = 4.5; if (this.act.length < 380) for (let k = 0; k < 2; k++) this.spawnEnemy('spider', e.x + rand(-14, 14), e.y + rand(-14, 14)); }
          break;
        case 'goose': { // honk! erratic bursts
          e.stT -= dt;
          if (e.st === 0) {
            const a = Math.atan2(uy, ux) + Math.sin(e.t * 3 + e.id) * 0.7;
            mx = Math.cos(a) * sp; my = Math.sin(a) * sp;
            if (e.stT <= 0) { e.st = 1; e.stT = rand(0.5, 0.9); const a2 = Math.atan2(uy, ux) + rand(-0.6, 0.6); e.ax = Math.cos(a2); e.ay = Math.sin(a2); if (d < 160 && Math.random() < 0.4) this.floatText(e.x, e.y - 12, 'HONK!', '#fff'); }
          } else { mx = e.ax * sp * 2.5; my = e.ay * sp * 2.5; if (e.stT <= 0) { e.st = 0; e.stT = rand(1, 2.5); } }
          break;
        }
        case 'vacuum': {
          if (e.st === 0) { mx = ux * sp; my = uy * sp; e.stT -= dt; if (e.stT <= 0 && d < 150) { e.st = 1; e.stT = 1.8; } else if (e.stT <= 0) e.stT = 1; }
          else {
            e.stT -= dt;
            mx = ux * sp * 0.2; my = uy * sp * 0.2;
            this.pullPlayer(e.x, e.y, 70, 120);
            if (Math.random() < 0.5) { const a = rand(0, TAU); this.spawnPart(e.x + Math.cos(a) * 40, e.y + Math.sin(a) * 40, -Math.cos(a) * 60, -Math.sin(a) * 60, 0.5, '#c4cbd9', 1, 0); }
            if (e.stT <= 0) { e.st = 0; e.stT = rand(5, 8); }
          }
          break;
        }
      }
      e.x += (mx + e.kx) * dt;
      e.y += (my + e.ky) * dt;
      const kd = Math.exp(-9 * dt);
      e.kx *= kd; e.ky *= kd;
      e.x = clamp(e.x, 4, WORLD_W - 4);
      e.y = clamp(e.y, 4, WORLD_H - 4);
      // soft separation so hordes don't collapse into one pixel
      if (((e.id + frameParity) & 1) === 0) {
        const cnt = this.queryEnemies(e.x, e.y, 0, tmpE);
        let pushed = 0;
        for (let k = 0; k < cnt && pushed < 3; k++) {
          const o = tmpE[k];
          if (o === e || o.boss) continue;
          const ox = e.x - o.x, oy = e.y - o.y;
          const od = Math.hypot(ox, oy) || 0.1;
          const min = (e.r + o.r) * 0.7;
          if (od < min) { const f = (min - od) * 0.5; e.x += (ox / od) * f; e.y += (oy / od) * f; pushed++; }
        }
      }
      // contact damage
      if (d < e.r + 4.5 && p.inv <= 0 && !p.dead) this.hurtPlayer(e.dmg);
      // recycle stragglers that fell far behind
      if (d > 430 && !e.elite) { const pos = this.spawnPos(); e.x = pos.x; e.y = pos.y; }
    }
  }

  private updateBossEntity(e: Enemy, dt: number) {
    const p = this.p;
    if (e.dying > 0) {
      e.dying -= dt;
      e.x += rand(-0.6, 0.6);
      if (Math.random() < 0.6) {
        const bx = e.x + rand(-e.r, e.r), by = e.y + rand(-e.r, e.r);
        this.burst(bx, by, 4, ['#ff9a3a', '#ffd24a', '#fff'], 80, 0.4);
        if (Math.random() < 0.25) { this.addFx({ k: 'boom', x: bx, y: by, t: 0, dur: 0.35, r: 14, col: '#ff6a3a', col2: '#fff0b0' }); sfx('boom'); this.shake(0.6); }
      }
      if (e.dying <= 0) this.finishBoss(e);
      return;
    }
    const frac = e.hp / e.maxHp;
    if (e.hpShown > frac) e.hpShown = Math.max(frac, e.hpShown - dt * 0.3);
    updateBoss(this, e, dt);
    e.x = clamp(e.x + e.kx * dt, 20, WORLD_W - 20);
    e.y = clamp(e.y + e.ky * dt, 20, WORLD_H - 20);
    e.kx *= Math.exp(-9 * dt); e.ky *= Math.exp(-9 * dt);
    e.x = clamp(e.x, 20, WORLD_W - 20);
    e.y = clamp(e.y, 20, WORLD_H - 20);
    const d = Math.hypot(p.x - e.x, p.y - e.y);
    if (d < e.r * 0.8 + 4.5 && p.inv <= 0 && !p.dead) this.hurtPlayer(e.dmg);
  }

  enemyShot(x: number, y: number, a: number, speed: number, dmg: number, kind: string, life: number) {
    const pr = this.spawnProj(kind);
    if (!pr) return;
    pr.x = x; pr.y = y; pr.vx = Math.cos(a) * speed; pr.vy = Math.sin(a) * speed;
    pr.dmg = dmg; pr.life = life; pr.hostile = true; pr.spr = kind;
    pr.r = kind === 'bossfire' ? 6 : kind === 'orb' ? 4 : 3;
    pr.pierce = 0;
  }

  spawnProj(kind: string): Proj | null {
    for (let i = 0; i < MAXP; i++) {
      const idx = (this.cur.pr + i) % MAXP;
      const pr = this.projs[idx];
      if (!pr.alive) {
        this.cur.pr = idx + 1;
        pr.alive = true; pr.kind = kind; pr.hostile = false; pr.src = this.src; pr.aux2 = 0; pr.x0 = 0; pr.y0 = 0; pr.rot = 0; pr.spin = kind === 'yarn' ? 9 : 0; pr.hit.length = 0;
        pr.lastHit = null; pr.lastT = 0; pr.homing = false; pr.evo = false; pr.aux = 0; pr.bounce = 0; pr.pierce = 0; pr.knock = 0; pr.spr = kind; pr.r = 3;
        return pr;
      }
    }
    return null;
  }

  // ------------------------------------------------------------ director (spawn waves)
  private director(dt: number) {
    if (this.time < 3.5 || this.p.dead) return;
    const m = this.time / 60;
    let target = Math.min(330, 12 + 17 * m + 0.55 * m * m) * Math.min(1, (this.time - 3.5) / 20);
    if (m >= 12) target *= 1.18;
    target *= 1 + this.p.s.curse * 0.12;
    if (this.bossList.length) target *= 0.55;
    this.spawnAcc = Math.min(14, this.spawnAcc + dt * (8 + 4 * m));
    let guard = 0;
    while (this.spawnAcc >= 1 && guard++ < 22) {
      this.spawnAcc -= 1;
      if (this.act.length < target && this.act.length < MAXE - 24) this.spawnGroup(m);
    }
    if (m >= 3.5 && this.time >= this.nextElite) {
      this.spawnElite(m);
      this.nextElite = this.time + (m < 10 ? 36 : 13) + rand(-3, 3);
    }
    if (m >= 5 && this.time >= this.nextVac) {
      const n = m >= 10 ? 2 : 1;
      for (let i = 0; i < n; i++) this.spawnEnemy('vacuum');
      this.nextVac = this.time + (m < 10 ? 55 : 32);
    }
    if (this.time >= this.nextSwarm) {
      this.spawnSwarm(m);
      this.nextSwarm = this.time + (m < 8 ? 75 : 55);
    }
  }
  private pickDef(m: number, elite = false): EnemyDef | null {
    const avail = ENEMIES.filter((d) => !d.hidden && d.from <= m && !(elite && ['rat', 'bat', 'slime', 'vacuum'].includes(d.id)));
    return weightedPick(avail, (d) => {
      let w = d.weight;
      if (elite) return d.hp;
      if (d.from > 0) w *= clamp((m - d.from) / 1.2 + 0.25, 0.25, 1);
      if (m > d.from + 6) w *= 0.6;
      if (d.id === 'rat' || d.id === 'slime') w *= Math.max(0.2, 1 - Math.max(0, m - 6) * 0.12);
      return w;
    });
  }
  private spawnGroup(m: number) {
    const def = this.pickDef(m);
    if (!def) return;
    const n = def.group ? randInt(Math.min(2, def.group), def.group) : 1;
    const base = this.spawnPos();
    for (let i = 0; i < n; i++) this.spawnEnemy(def.id, base.x + rand(-14, 14), base.y + rand(-14, 14));
  }
  private spawnElite(m: number) {
    const def = this.pickDef(m, true);
    if (def) this.spawnEnemy(def.id, undefined, undefined, true);
  }
  private spawnSwarm(m: number) {
    const id = m >= 2 && Math.random() < 0.5 ? 'bat' : 'slime';
    const a0 = rand(0, TAU);
    const n = Math.min(34, 16 + Math.floor(m * 2));
    const p = this.p;
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * Math.PI * 1.1;
      this.spawnEnemy(id, p.x + Math.cos(a) * 205, p.y + Math.sin(a) * 160);
    }
    this.banner('SWARM!', '#ff9a6a', 2, '', 1.4);
  }

  // ------------------------------------------------------------ pickups, gems, chests
  dropGem(x: number, y: number, v: number) {
    for (let i = 0; i < MAXG; i++) {
      const idx = (this.cur.g + i) % MAXG;
      const g = this.gems[idx];
      if (!g.alive) {
        this.cur.g = idx + 1;
        g.alive = true; g.x = x; g.y = y; g.v = v; g.age = 0; g.attract = false; g.vx = rand(-25, 25); g.vy = rand(-25, 25);
        this.gemCount++;
        return;
      }
    }
    // pool full: fold into an existing gem
    this.gems[randInt(0, MAXG - 1)].v += v;
  }
  dropPickup(kind: Pickup['kind'], x: number, y: number, v: number) {
    for (let i = 0; i < MAXPU; i++) {
      const idx = (this.cur.pu + i) % MAXPU;
      const pu = this.pickups[idx];
      if (!pu.alive) {
        this.cur.pu = idx + 1;
        pu.alive = true; pu.kind = kind; pu.x = x; pu.y = y; pu.v = v; pu.age = 0; pu.vx = rand(-30, 30); pu.vy = rand(-40, -10);
        return;
      }
    }
  }
  private updateGems(dt: number) {
    const p = this.p;
    const pr = p.s.pickup;
    const overflow = this.gemCount > 420;
    let attractBudget = overflow ? 40 : 0;
    for (const g of this.gems) {
      if (!g.alive) continue;
      g.age += dt;
      g.x += g.vx * dt; g.y += g.vy * dt;
      g.vx *= Math.exp(-5 * dt); g.vy *= Math.exp(-5 * dt);
      const dx = p.x - g.x, dy = p.y - g.y;
      const d2 = dx * dx + dy * dy;
      if (!g.attract && !p.dead) {
        if (d2 < pr * pr || this.magnetT > 0 || g.age > 26) g.attract = true;
        else if (attractBudget > 0 && g.age > 6) { g.attract = true; attractBudget--; }
      }
      if (g.attract) {
        const d = Math.sqrt(d2) || 1;
        const sp = 130 + Math.min(200, g.age * 8) + (this.magnetT > 0 ? 120 : 0);
        g.x += (dx / d) * sp * dt;
        g.y += (dy / d) * sp * dt;
        if (d < 7) {
          g.alive = false;
          this.gemCount--;
          this.addXp(g.v);
          addStat('gems');
          sfx('xp');
          if (!save.settings.reduced) this.spawnPart(g.x, g.y, rand(-20, 20), rand(-30, -10), 0.3, '#bfe4ff', 1, 0);
        }
      }
    }
  }
  addXp(v: number) {
    const p = this.p;
    p.xp += v * p.s.xp;
    while (p.xp >= p.xpNext) {
      p.xp -= p.xpNext;
      p.lvl++;
      p.xpNext = xpForLevel(p.lvl);
      this.pendingLevels++;
      if (p.lvl === 25 && !this.saidLevel) { this.saidLevel = true; this.say('WHO GAVE HIM THIS MUCH POWER?', 3.5); }
    }
  }
  private updatePickups(dt: number) {
    const p = this.p;
    for (const pu of this.pickups) {
      if (!pu.alive) continue;
      pu.age += dt;
      pu.x += pu.vx * dt; pu.y += pu.vy * dt;
      pu.vx *= Math.exp(-4 * dt); pu.vy *= Math.exp(-4 * dt);
      if (pu.age > (pu.kind === 'magnet' ? 40 : 28)) { pu.alive = false; continue; }
      const dx = p.x - pu.x, dy = p.y - pu.y;
      const d = Math.hypot(dx, dy);
      if (d < p.s.pickup * 0.7 && !p.dead) { pu.x += (dx / (d || 1)) * 140 * dt; pu.y += (dy / (d || 1)) * 140 * dt; }
      if (d < 9 && !p.dead) {
        pu.alive = false;
        if (pu.kind === 'meat') { p.hp = Math.min(p.s.maxHp, p.hp + pu.v); this.dnumAdd(p.x, p.y - 14, `+${pu.v}`, '#7aff9a', false, false, 0.9); sfx('pickup'); }
        else if (pu.kind === 'coin') { this.goldRun += pu.v; sfx('coin'); }
        else { this.magnetT = 1.6; sfx('pickup'); this.floatText(p.x, p.y - 16, 'MAGNET!', '#ff6a8a'); }
      }
    }
  }
  private updateChests(dt: number) {
    const p = this.p;
    for (const c of this.chests) {
      c.t += dt;
      if (c.dead || c.open) continue;
      if ((c.x - p.x) ** 2 + (c.y - p.y) ** 2 < 14 * 14 && !p.dead) { this.openChest(c); break; }
      if ((c.kind !== 'world') && Math.random() < 0.08) this.spawnPart(c.x + rand(-8, 8), c.y + rand(-6, 6), 0, rand(-14, -6), 0.6, '#ffe680', 1, 0);
    }
    for (let i = this.chests.length - 1; i >= 0; i--) if (this.chests[i].dead) this.chests.splice(i, 1);
  }

  private openChest(c: Chest) {
    c.open = 1;
    c.dead = true;
    addStat('chests');
    if (c.kind === 'world') addStat('worldChests');
    const triple = c.kind === 'boss' || (c.kind === 'elite' && Math.random() < 0.12 + this.p.s.luck * 0.5) || (c.kind === 'world' && Math.random() < 0.05);
    const rewards: Reward[] = [];
    for (let i = 0; i < (triple ? 3 : 1); i++) rewards.push(this.rollReward(i === 0));
    this.burst(c.x, c.y, 24, ['#ffd24a', '#fff', '#ffe680'], 110, 0.7);
    sfx('chest');
    this.state = 'CHEST';
    this.ev.overlay('chest', { rewards, triple });
  }
  closeChest() {
    if (this.state !== 'CHEST') return;
    this.state = 'PLAYING';
    this.ev.overlay('none');
  }
  private rollReward(first: boolean): Reward {
    const p = this.p;
    const evos = this.availableEvos();
    if (evos.length && first) {
      const evo = evos[0];
      this.evolve(evo.id);
      return { kind: 'evo', name: evo.name, icon: evo.icon, text: 'EVOLUTION!' };
    }
    const options: { w: number; fn: () => Reward | null }[] = [
      {
        w: 3, fn: () => {
          const up = p.weapons.filter((w) => w.level < MAX_WEAPON_LEVEL);
          if (!up.length) return null;
          const w = pick(up);
          w.level++; w.recalc();
          return { kind: 'weapon', name: w.def.name, icon: w.def.icon, text: `LEVEL ${w.level}` };
        },
      },
      {
        w: 2.5, fn: () => {
          const up = p.passives.filter((x) => x.level < PASSIVE_BY_ID[x.id].max);
          const free = PASSIVES.filter((d) => !p.passives.find((x) => x.id === d.id) && this.isUnlocked(d.id));
          if (p.passives.length < MAX_PASSIVES && free.length && (!up.length || Math.random() < 0.4)) {
            const d = pick(free);
            this.applyPassive(d.id, 0);
            return { kind: 'passive', name: d.name, icon: d.icon, text: 'NEW!' };
          }
          if (!up.length) return null;
          const ps = pick(up);
          this.applyPassive(ps.id, 0);
          return { kind: 'passive', name: PASSIVE_BY_ID[ps.id].name, icon: PASSIVE_BY_ID[ps.id].icon, text: `LEVEL ${ps.level}` };
        },
      },
      { w: 2, fn: () => { const g = Math.round((25 + this.time / 60 * 8) * (0.8 + Math.random() * 0.6) * this.p.s.goldMul); this.goldRun += g; return { kind: 'gold', name: 'GOLD', icon: 'coin', text: `+${g}` }; } },
      { w: 1.5, fn: () => { p.hp = Math.min(p.s.maxHp, p.hp + p.s.maxHp * 0.5); return { kind: 'heal', name: 'HEARTY MEAL', icon: 'meat', text: '+50% HP' }; } },
    ];
    for (let tries = 0; tries < 8; tries++) {
      const o = weightedPick(options, (x) => x.w);
      const r = o && o.fn();
      if (r) return r;
    }
    this.goldRun += 30;
    return { kind: 'gold', name: 'GOLD', icon: 'coin', text: '+30' };
  }

  // ------------------------------------------------------------ unlocks (quests)
  isUnlocked(id: string) { return DEFAULT_UNLOCKED.includes(id) || !!save.unlocked[id] || !QUEST_BY_TARGET[id]; }
  private questValue(q: Quest): number {
    if (q.stat) return save.stats[q.stat] || 0;
    if (q.killsBy) return save.killsBy[q.killsBy] || 0;
    const p = this.p;
    const r = q.run as string;
    if (r === 'time') return this.time;
    if (r === 'level') return p.lvl;
    if (r === 'noHitSec') return p.noHit;
    if (r === 'win') return this.state === 'VICTORY' ? 1 : 0;
    if (r === 'bossFast') return this.bossFast;
    if (r.startsWith('weapon:')) return p.weapons.find((w) => w.def.id === r.slice(7))?.level || 0;
    if (r.startsWith('passive:')) return p.passives.find((x) => x.id === r.slice(8))?.level || 0;
    return 0;
  }
  checkQuests() {
    let any = false;
    for (const q of QUESTS) {
      if (this.isUnlocked(q.target)) continue;
      if (this.questValue(q) >= q.goal) {
        save.unlocked[q.target] = 1;
        any = true;
        const name = (q.kind === 'weapon' ? WEAPON_BY_ID[q.target]?.name : PASSIVE_BY_ID[q.target]?.name) || q.target;
        this.unlockedNow.push(name);
        this.banner('UNLOCKED!', '#7aff9a', 2, name, 3);
        sfx('chest');
      }
    }
    if (any) persist();
  }

  // ------------------------------------------------------------ level-up / upgrades
  availableEvos() {
    const p = this.p;
    return EVOS.filter((e) => {
      const b = p.weapons.find((w) => w.def.id === e.base);
      if (!b || b.evolved || b.level < MAX_WEAPON_LEVEL) return false;
      const part = p.weapons.find((w) => w.def.id === e.partner) || null;
      return !!part && part.level >= e.partnerLevel;
    });
  }
  evolve(evoId: string) {
    const evo = EVO_BY_ID[evoId];
    const w = this.p.weapons.find((x) => x.def.id === evo.base);
    if (!w) return;
    w.evolved = true; w.evoId = evoId; w.data = {}; w.timer = 0.2;
    this.evolutions.push(evoId);
    discover('evos', evoId);
    this.whiteFlash = 0.9;
    this.shake(2);
    this.banner('EVOLUTION!', '#ffd24a', 3, evo.name, 3);
    sfx('evolve');
    this.burst(this.p.x, this.p.y, 50, ['#ffd24a', '#fff', '#ffe680', '#c36bff'], 160, 1);
    this.say('Is that... better?', 2.5);
  }

  private rollRarity(): Rarity {
    const l = this.p.s.luck;
    const w = [RARITY[0].w, RARITY[1].w * (1 + l * 3), RARITY[2].w * (1 + l * 5), RARITY[3].w * (1 + l * 10)];
    let r = Math.random() * (w[0] + w[1] + w[2] + w[3]);
    for (let i = 0; i < 4; i++) { r -= w[i]; if (r <= 0) return i as Rarity; }
    return 0;
  }

  private buildChoices(): Card[] {
    const p = this.p;
    type Cand = { w: number; make: () => Card; key: string };
    const cands: Cand[] = [];
    const penal = (key: string) => (this.lastOffered.includes(key) ? 0.4 : 1);
    for (const w of p.weapons) {
      if (w.level >= MAX_WEAPON_LEVEL) continue;
      const key = 'w:' + w.def.id;
      cands.push({ key, w: 3 * penal(key), make: () => this.weaponCard(w, this.rollRarity()) });
    }
    if (p.weapons.length < MAX_WEAPONS)
      for (const d of WEAPONS) {
        if (p.weapons.find((w) => w.def.id === d.id) || !this.isUnlocked(d.id)) continue;
        const key = 'w:' + d.id;
        cands.push({ key, w: 1.4 * penal(key), make: () => ({ kind: 'weapon', id: d.id, name: d.name, icon: d.icon, rarity: 0, isNew: true, level: 1, lines: [d.desc] }) });
      }
    for (const ps of p.passives) {
      const d = PASSIVE_BY_ID[ps.id];
      if (ps.level >= d.max) continue;
      const key = 'p:' + d.id;
      cands.push({ key, w: 2.5 * penal(key), make: () => this.passiveCard(d.id, this.rollRarity()) });
    }
    if (p.passives.length < MAX_PASSIVES)
      for (const d of PASSIVES) {
        if (p.passives.find((x) => x.id === d.id) || !this.isUnlocked(d.id)) continue;
        const key = 'p:' + d.id;
        cands.push({ key, w: 1.3 * penal(key), make: () => ({ kind: 'passive', id: d.id, name: d.name, icon: d.icon, rarity: 0, isNew: true, level: 1, lines: [d.fmt(d.per), d.desc] }) });
      }
    for (const e of this.availableEvos())
      cands.push({ key: 'e:' + e.id, w: 12, make: () => ({ kind: 'evo', id: e.id, name: e.name, icon: e.icon, rarity: 3, isNew: false, level: 9, lines: ['EVOLUTION!', e.desc] }) });
    const out: Card[] = [];
    const keys: string[] = [];
    const pool = cands.slice();
    while (out.length < 3 && pool.length) {
      const c = weightedPick(pool, (x) => x.w);
      if (!c) break;
      pool.splice(pool.indexOf(c), 1);
      out.push(c.make());
      keys.push(c.key);
    }
    const fillers: Card[] = [
      { kind: 'heal', id: 'heal', name: 'MEAT', icon: 'meat', rarity: 0, isNew: false, level: 0, lines: ['RESTORE 40 HP'] },
      { kind: 'gold', id: 'gold', name: 'GOLD', icon: 'coin', rarity: 0, isNew: false, level: 0, lines: ['+60 GOLD'] },
    ];
    for (let i = 0; out.length < 3; i++) out.push(fillers[i % fillers.length]);
    this.lastOffered = keys;
    return out;
  }
  private weaponCard(w: Weapon, rarity: Rarity): Card {
    const lvl = w.level + 1;
    const lines = [`LV ${w.level} > ${lvl}`, ...upText(w.def.ups[lvl - 2] || {}, w.def)];
    if (rarity > 0) lines.push(`+${Math.round(RARITY[rarity].dmg * 100)}% DAMAGE`);
    return { kind: 'weapon', id: w.def.id, name: w.def.name, icon: w.def.icon, rarity, isNew: false, level: lvl, lines };
  }
  private passiveCard(id: string, rarity: Rarity): Card {
    const d = PASSIVE_BY_ID[id];
    const ps = this.p.passives.find((x) => x.id === id)!;
    return { kind: 'passive', id, name: d.name, icon: d.icon, rarity, isNew: false, level: ps.level + 1, lines: [d.fmt(d.per * RARITY[rarity].mult), `LV ${ps.level} > ${ps.level + 1}`] };
  }
  private applyPassive(id: string, rarity: Rarity) {
    const p = this.p;
    let ps = p.passives.find((x) => x.id === id);
    if (!ps) { ps = { id, level: 0, pow: 0 }; p.passives.push(ps); discover('passives', id); }
    ps.level++;
    ps.pow += RARITY[rarity].mult;
    if (id === 'chaos') {
      const pool = PASSIVES.filter((d) => !['chaos', 'charm', 'bow'].includes(d.id));
      const d = pick(pool);
      this.p.hidden[d.id] = (this.p.hidden[d.id] || 0) + RARITY[rarity].mult;
      this.banner('CHAOS!', '#c36bff', 2, `${d.name} BOOSTED`, 2.2);
    }
    this.recalcStats();
  }

  private openLevelUp() {
    this.state = 'LEVEL_UP';
    const cards = this.buildChoices();
    this.ev.overlay('levelup', { cards, level: this.p.lvl, remaining: this.pendingLevels });
    sfx('levelup');
    this.burst(this.p.x, this.p.y, 24, ['#ffe680', '#fff', '#4aa8ff'], 110, 0.7);
  }
  chooseCard(card: Card) {
    if (this.state !== 'LEVEL_UP') return;
    const p = this.p;
    switch (card.kind) {
      case 'weapon': {
        let w = p.weapons.find((x) => x.def.id === card.id);
        if (card.isNew || !w) { w = new Weapon(WEAPON_BY_ID[card.id]); w.timer = 0.3; p.weapons.push(w); discover('weapons', card.id); }
        else { w.level++; w.bonus += RARITY[card.rarity].dmg; w.recalc(); }
        break;
      }
      case 'passive': this.applyPassive(card.id, card.rarity); break;
      case 'evo': this.evolve(card.id); break;
      case 'heal': p.hp = Math.min(p.s.maxHp, p.hp + 40); break;
      case 'gold': this.goldRun += Math.round(60 * p.s.goldMul); break;
    }
    sfx('click');
    this.pendingLevels = Math.max(0, this.pendingLevels - 1);
    if (this.pendingLevels > 0) this.openLevelUp();
    else { this.state = 'PLAYING'; this.ev.overlay('none'); }
  }

  // ------------------------------------------------------------ effects helpers
  addFx(f: Fx) { if (f.src === undefined) f.src = this.src; this.fx.push(f); }
  shake(a: number) { if (save.settings.shake) this.shakeAmt = Math.min(2.5, Math.max(this.shakeAmt, a)); }
  say(text: string, dur = 2.5, delay = 0) {
    if (delay > 0) setTimeout(() => { if (this.mode === 'run' && !this.disposed) this.speech = { text, t: 0, dur }; }, delay * 1000);
    else this.speech = { text, t: 0, dur };
  }
  banner(text: string, col: string, size: number, sub = '', dur = 2) {
    this.banners.push({ text, sub, col, size, t: 0, dur });
    if (this.banners.length > 3) this.banners.shift();
  }
  spawnPart(x: number, y: number, vx: number, vy: number, life: number, col: string, size: number, grav: number) {
    for (let i = 0; i < MAXPART; i++) {
      const idx = (this.cur.pa + i) % MAXPART;
      const pa = this.parts[idx];
      if (!pa.alive) {
        this.cur.pa = idx + 1;
        pa.alive = true; pa.x = x; pa.y = y; pa.vx = vx; pa.vy = vy; pa.life = life; pa.max = life; pa.col = col; pa.size = size; pa.grav = grav;
        return;
      }
    }
  }
  burst(x: number, y: number, n: number, cols: string[], speed: number, life: number) {
    if (save.settings.reduced) n = Math.ceil(n / 3);
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(0.3, 1) * speed;
      this.spawnPart(x, y, Math.cos(a) * s, Math.sin(a) * s, life * rand(0.6, 1), cols[i % cols.length], Math.random() < 0.3 ? 2 : 1, 60);
    }
  }
  dnumAdd(x: number, y: number, text: string, col: string, crit: boolean, big: boolean, life = 0.7) {
    if (!save.settings.dmgNumbers && col !== '#ff6a7a') return;
    let n: DmgNum | null = null;
    for (let i = 0; i < MAXDN; i++) {
      const idx = (this.cur.dn + i) % MAXDN;
      if (!this.dnums[idx].alive) { n = this.dnums[idx]; this.cur.dn = idx + 1; break; }
    }
    if (!n) return;
    n.alive = true; n.x = x; n.y = y; n.vy = -26; n.life = life; n.text = text; n.col = col; n.crit = crit; n.big = big;
  }
  floatText(x: number, y: number, text: string, col: string) {
    let n: DmgNum | null = null;
    for (let i = 0; i < MAXDN; i++) {
      const idx = (this.cur.dn + i) % MAXDN;
      if (!this.dnums[idx].alive) { n = this.dnums[idx]; this.cur.dn = idx + 1; break; }
    }
    if (!n) return;
    n.alive = true; n.x = x; n.y = y; n.vy = -14; n.life = 1.1; n.text = text; n.col = col; n.crit = false; n.big = true;
  }
  private updateParticles(dt: number) {
    for (const pa of this.parts) {
      if (!pa.alive) continue;
      pa.life -= dt;
      if (pa.life <= 0) { pa.alive = false; continue; }
      pa.x += pa.vx * dt; pa.y += pa.vy * dt;
      pa.vy += pa.grav * dt;
      pa.vx *= Math.exp(-2.5 * dt);
    }
    for (const n of this.dnums) {
      if (!n.alive) continue;
      n.life -= dt;
      if (n.life <= 0) { n.alive = false; continue; }
      n.y += n.vy * dt;
      n.vy *= Math.exp(-2.2 * dt);
    }
  }
  private updateCamera(dt: number) {
    const p = this.p;
    const tx = clamp(p.x - W / 2, 0, WORLD_W - W), ty = clamp(p.y - H / 2, 0, WORLD_H - H);
    const k = 1 - Math.exp(-dt * 7);
    this.cam.x += (tx - this.cam.x) * k;
    this.cam.y += (ty - this.cam.y) * k;
  }

  // ------------------------------------------------------------ end of run
  private finishRun(win: boolean, quit = false) {
    if (this.endSent) return;
    this.endSent = true;
    const p = this.p;
    const earned = Math.floor(this.kills * 0.25 + this.time * 0.3 + this.bossesKilled * 60 + this.goldRun + (win ? 300 : 0));
    save.gold += earned;
    save.runs++;
    let newBest = false;
    if (this.time > save.best.time || win) { if (win || !save.best.win) { save.best.time = Math.max(save.best.time, this.time); newBest = true; } }
    if (p.lvl > save.best.level) { save.best.level = p.lvl; newBest = true; }
    if (this.kills > save.best.kills) { save.best.kills = this.kills; newBest = true; }
    if (win) save.best.win = true;
    save.tutorialDone = true;
    this.checkQuests();
    persist();
    stopMusic();
    this.state = 'RESULTS';
    const quip = win ? 'Good kitty.' : this.kills >= 1000 ? "Are you sure you're the hero?" : quit ? 'A tactical retreat.' : 'He tried his best.';
    const res: RunResult = {
      win, time: this.time, level: p.lvl, kills: this.kills, damage: this.dmgDealt, gold: earned, bosses: this.bossesKilled,
      weapons: p.weapons.map((w) => ({ id: w.def.id, name: w.evolved ? EVO_BY_ID[w.evoId].name : w.def.name, icon: w.evolved ? EVO_BY_ID[w.evoId].icon : w.def.icon, level: w.level })),
      evolutions: this.evolutions.map((e) => EVO_BY_ID[e].name), newBest, quip, combo: this.bestCombo, unlocks: this.unlockedNow.slice(),
    };
    this.ev.end(res);
  }

  // ------------------------------------------------------------ rendering
  private dayTint(m: number): [number, number, number, number] {
    const keys: [number, number, number, number, number][] = [
      [0, 255, 214, 150, 0.13], [3, 255, 236, 200, 0.04], [6, 255, 240, 210, 0.0], [7.5, 255, 128, 70, 0.17],
      [9, 120, 70, 120, 0.22], [10.5, 14, 22, 80, 0.34], [12, 8, 14, 64, 0.42], [13.5, 4, 8, 40, 0.5],
    ];
    if (m <= keys[0][0]) return [keys[0][1], keys[0][2], keys[0][3], keys[0][4]];
    for (let i = 1; i < keys.length; i++) {
      if (m <= keys[i][0]) {
        const a = keys[i - 1], b = keys[i];
        const t = (m - a[0]) / (b[0] - a[0]);
        return [a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t, a[4] + (b[4] - a[4]) * t];
      }
    }
    const k = keys[keys.length - 1];
    return [k[1], k[2], k[3], k[4]];
  }

  private drawMist(ctx: CanvasRenderingContext2D, camX: number, camY: number, t: number, alpha: number) {
    const ox = -(((camX * 0.6 + t * 4) % 320) + 320) % 320;
    const oy = -((camY * 0.3) % 20);
    ctx.globalAlpha = alpha;
    ctx.drawImage(this.world.mist, Math.round(ox), Math.round(oy));
    ctx.drawImage(this.world.mist, Math.round(ox + 320), Math.round(oy));
    ctx.globalAlpha = 1;
  }

  private renderMenu() {
    const ctx = this.ctx;
    const t = this.menuT;
    const cx = Math.round(WORLD_W / 2 - W / 2 + Math.sin(t * 0.15) * 24), cy = Math.round(WORLD_H / 2 - H / 2 + 20);
    this.world.draw(ctx, cx, cy, W, H);
    // fireflies
    for (let i = 0; i < 18; i++) {
      const x = (i * 53 + Math.sin(t * 0.6 + i) * 14 + t * 3) % W, y = (i * 29 + Math.cos(t * 0.5 + i * 2) * 10) % H;
      const a = 0.5 + 0.5 * Math.sin(t * 2 + i);
      ctx.fillStyle = `rgba(255,240,150,${a})`;
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    this.drawMist(ctx, cx, cy, t, 0.2);
    ctx.fillStyle = 'rgba(255,214,150,0.09)';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 0.5;
    ctx.drawImage(this.vig, 0, 0);
    ctx.globalAlpha = 1;
    // the kitten: breathing, blinking, caped, sword wobble
    const frames = S.kitten;
    const breathe = Math.floor(t * 1.4) & 1;
    const blink = t % 3.4 < 0.14;
    const fr = frames.f[blink ? 4 : breathe];
    const sc = 2;
    const px = 160, py = 99 + (breathe ? 1 : 0);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    for (let i = 0; i < 4; i++) ctx.fillRect(px - 26 + i * 2, py + 38 + (i === 0 || i === 3 ? 0 : 0) - (i % 3 === 0 ? 0 : 1), 52 - i * 4, 3);
    const tlx = Math.round(px - (fr.width * sc) / 2), tly = Math.round(py - (fr.height * sc) / 2) - 2;
    // sword first (the gauntlet is drawn over the grip)
    ctx.save();
    ctx.translate(tlx + (fr.width - KG.x) * sc, tly + KG.y * sc);
    ctx.rotate(0.06 + Math.sin(t * 1.6) * 0.03);
    ctx.scale(sc, sc);
    ctx.drawImage(X.sword, -SW.gx, -SW.gripY);
    ctx.restore();
    ctx.drawImage(frames.fl[blink ? 4 : breathe], tlx, tly, fr.width * sc, fr.height * sc);
    // ground particles drifting
    for (let i = 0; i < 8; i++) {
      const x = (i * 71 + t * 6) % W, y = 150 + ((i * 17 + t * 4) % 28);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
  }

  private render() {
    const ctx = this.ctx;
    const p = this.p;
    const sh = save.settings.shake && this.shakeAmt > 0 ? this.shakeAmt : 0;
    const camX = Math.round(this.cam.x + (sh ? rand(-sh, sh) * 2 : 0));
    const camY = Math.round(this.cam.y + (sh ? rand(-sh, sh) * 2 : 0));
    ctx.fillStyle = '#1b2a1e';
    ctx.fillRect(0, 0, W, H);
    this.world.draw(ctx, camX, camY, W, H, false);
    ctx.save();

    // chests
    for (const c of this.chests) {
      const sx = c.x - camX, sy = c.y - camY;
      if (sx < -20 || sx > W + 20 || sy < -20 || sy > H + 20) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(Math.round(sx) - 7, Math.round(sy) + 6, 14, 3);
      const bob = c.kind === 'world' ? 0 : Math.sin(c.t * 4) * 1.2;
      drawCv(ctx, S.chest.f[c.open ? 1 : 0], sx, sy + bob);
      if (c.kind !== 'world') { ctx.fillStyle = '#ffe680'; const f = Math.floor(c.t * 5) & 3; ctx.fillRect(Math.round(sx) - 8 + f * 4, Math.round(sy) - 12, 1, 1); }
    }

    // shadows
    ctx.fillStyle = 'rgba(10,20,20,0.32)';
    ctx.beginPath();
    for (const e of this.act) {
      const sx = e.x - camX, sy = e.y - camY;
      if (sx < -60 || sx > W + 60 || sy < -60 || sy > H + 60) continue;
      const w = Math.round(e.r * 1.7), yy = Math.round(sy + (e.boss ? e.r * 0.8 : e.r * 0.75));
      ctx.rect(Math.round(sx - w / 2), yy, w, 2);
      ctx.rect(Math.round(sx - w / 2) + 1, yy - 1, w - 2, 1);
      ctx.rect(Math.round(sx - w / 2) + 1, yy + 2, w - 2, 1);
    }
    ctx.rect(Math.round(p.x - camX) - 8, Math.round(p.y - camY) + 11, 16, 2);
    ctx.rect(Math.round(p.x - camX) - 7, Math.round(p.y - camY) + 10, 14, 1);
    ctx.fill();

    // everything that stands on the ground is depth-sorted by its feet so the kitten walks behind trees, not over them
    const rl = this.renderList;
    let rn = 0;
    const put = (k: number, t: number, o: any) => { const it = rl[rn] || (rl[rn] = { k: 0, t: 0, o: null }); it.k = k; it.t = t; it.o = o; rn++; };
    this.tallTmp.length = 0;
    this.world.collectTall(camX, camY, W, H, this.tallTmp);
    for (const d of this.tallTmp) put(d.y, 0, d);
    for (const e of this.act) {
      const sx = e.x - camX, sy = e.y - camY;
      if (sx < -70 || sx > W + 70 || sy < -70 || sy > H + 70) continue;
      put(e.y + e.r * 0.6 + (e.boss ? 1 : 0), 1, e);
    }
    put(p.y + 10, 2, p);
    const view = rl.slice(0, rn);
    view.sort((a, b) => a.k - b.k);
    const pk = p.y + 10, px0 = p.x - camX - 14, py0 = p.y - camY - 24;
    for (const it of view) {
      if (it.t === 1) { const e = it.o as Enemy; this.drawEnemy(ctx, e, e.x - camX, e.y - camY); }
      else if (it.t === 2) this.drawPlayer(ctx, camX, camY);
      else {
        const d = it.o;
        // a prop in front of the kitten becomes see-through where it would hide him
        const dx0 = d.x - d.cv.width / 2 - camX, dy0 = d.y - d.cv.height + 3 - camY;
        const hides = it.k > pk && dx0 < px0 + 28 && dx0 + d.cv.width > px0 && dy0 < py0 + 40 && dy0 + d.cv.height > py0 && !p.dead;
        if (hides) ctx.globalAlpha = 0.42;
        this.world.drawTallProp(ctx, d, camX, camY);
        if (hides) ctx.globalAlpha = 1;
      }
    }
    drawWeapons(this, ctx, camX, camY);

    // day / night
    const m = this.time / 60;
    const [tr, tg, tb, ta] = this.dayTint(m);
    ctx.fillStyle = `rgba(${tr | 0},${tg | 0},${tb | 0},${ta})`;
    ctx.fillRect(0, 0, W, H);
    const night = clamp((m - 8.5) / 4, 0, 1);
    if (night > 0) { ctx.globalAlpha = night * 0.85; ctx.drawImage(this.vig, 0, 0); ctx.globalAlpha = 1; }
    this.drawMist(ctx, camX, camY, this.time, m < 3 ? 0.2 : 0.1);

    // gems + pickups (above tint so XP stays readable)
    for (const g of this.gems) {
      if (!g.alive) continue;
      const sx = g.x - camX, sy = g.y - camY;
      if (sx < -8 || sx > W + 8 || sy < -8 || sy > H + 8) continue;
      const kind = g.v < 5 ? 'gemB' : g.v < 25 ? 'gemG' : g.v < 100 ? 'gemR' : 'gemP';
      drawCv(ctx, S[kind].f[(Math.floor(g.age * 5) + (g.x | 0)) & 1], sx, sy);
    }
    for (const pu of this.pickups) {
      if (!pu.alive) continue;
      if (pu.age > 22 && Math.floor(pu.age * 8) % 2) continue;
      const sx = pu.x - camX, sy = pu.y - camY;
      if (sx < -10 || sx > W + 10 || sy < -10 || sy > H + 10) continue;
      const bob = Math.sin(pu.age * 5) * 1.5;
      if (pu.kind === 'coin') drawCv(ctx, S.coin.f[Math.floor(pu.age * 8) % 3], sx, sy + bob);
      else drawCv(ctx, S[pu.kind].f[0], sx, sy + bob);
    }
    drawProjs(this, ctx, camX, camY);
    drawFx(this, ctx, camX, camY);

    // particles
    for (const pa of this.parts) {
      if (!pa.alive) continue;
      const sx = pa.x - camX, sy = pa.y - camY;
      if (sx < -4 || sx > W + 4 || sy < -4 || sy > H + 4) continue;
      ctx.globalAlpha = Math.min(1, (pa.life / pa.max) * 1.5);
      ctx.fillStyle = pa.col;
      ctx.fillRect(Math.round(sx), Math.round(sy), pa.size, pa.size);
    }
    ctx.globalAlpha = 1;

    // damage numbers
    for (const n of this.dnums) {
      if (!n.alive) continue;
      const sx = n.x - camX, sy = n.y - camY;
      if (sx < -20 || sx > W + 20 || sy < -10 || sy > H + 10) continue;
      ctx.globalAlpha = Math.min(1, n.life * 3);
      if (n.crit) drawText(ctx, 'CRIT!', sx, sy - 7, '#ff9a3a', '#000', 'c');
      drawText(ctx, n.text, sx, sy, n.col, '#000', 'c');
    }
    ctx.globalAlpha = 1;

    // speech bubble
    if (this.speech) {
      const s = this.speech;
      const w = textWidth(s.text) + 6;
      const bx = clamp(Math.round(p.x - camX - w / 2), 2, W - w - 2), by = Math.round(p.y - camY - 46);
      ctx.globalAlpha = clamp(Math.min(s.t * 6, (s.dur - s.t) * 4), 0, 1);
      panel(ctx, bx, by, w, 11, 'rgba(250,244,230,0.96)', '#1b1424');
      drawText(ctx, s.text, bx + 3, by + 3, '#1b1424', null);
      ctx.fillStyle = '#1b1424';
      ctx.fillRect(Math.round(p.x - camX) - 1, by + 11, 3, 1);
      ctx.fillRect(Math.round(p.x - camX), by + 12, 1, 1);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    drawHUD(this, ctx);
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, sx: number, sy: number) {
    const spr = e.spr;
    const fast = e.def.beh === 'zigzag' || e.boss ? 10 : 7;
    const fr = Math.floor(e.anim * fast) & 1;
    let ox = 0, oy = 0;
    if (e.boss) {
      const id = e.boss.id;
      if (id === 'dragon') oy = Math.sin(this.time * 4) * 3 - 6;
      if (id === 'knight' && e.st === 3) oy = -Math.sin(Math.min(1, e.c2) * Math.PI) * 40;
      if (e.dying > 0) { ox = rand(-2, 2); oy += rand(-1, 1); }
      if ((id === 'dog' && e.st === 1) || (id === 'cateater' && e.st === 4)) ox = rand(-1.5, 1.5);
    } else {
      if ((e.def.beh === 'charge' && e.st === 1) || (e.def.beh === 'lunge' && e.st === 1)) ox = rand(-1, 1);
      if (e.def.beh === 'vacuum' && e.st === 1) ox = rand(-0.6, 0.6);
    }
    let flash = e.flash > 0;
    if (e.dying > 0) flash = Math.floor(e.dying * 12) % 2 === 0;
    // wizard/spider wind-up reads as a pulse
    if (!flash && !e.boss && e.st === 1 && (e.def.beh === 'ranged' || e.def.beh === 'lunge' || e.def.beh === 'charge')) flash = Math.floor(e.t * 16) % 2 === 0;
    drawSpr(ctx, spr, fr, sx + ox, sy + oy, e.face > 0, flash);
    if (e.slowT > 0) { ctx.fillStyle = '#58c878'; ctx.fillRect(Math.round(sx) - 1, Math.round(sy - e.r - 3), 3, 1); }
    if (e.elite && Math.random() < 0.05) this.spawnPart(sx + this.cam.x + rand(-e.r, e.r), sy + this.cam.y - e.r * 0.5, 0, -12, 0.5, '#ffd24a', 1, 0);
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
    const p = this.p;
    const moving = !p.dead && Math.hypot(p.vx, p.vy) > 14;
    const sx = p.x - camX, sy = p.y - camY - 2 - (moving && Math.sin(p.anim * 16) > 0 ? 1 : 0);
    const spr = S.kitten;
    let fr = 0;
    if (p.dead) fr = 6;
    else if (p.flash > 0.15) fr = 5;
    else if (Math.hypot(p.vx, p.vy) > 14) fr = 2 + (Math.floor(p.anim * 8) & 1);
    else fr = p.blink > 0 && p.blink < 0.14 ? 4 : Math.floor(this.time * 1.4) & 1;
    if (p.inv > 0 && !p.dead && Math.floor(p.inv * 20) % 2 === 0 && p.flash <= 0.15) ctx.globalAlpha = 0.45;
    const facing = p.face > 0;
    const slashing = this.fx.some((f) => f.k === 'slash' && f.delay <= 0 && f.t < f.dur);
    // held sword (huge compared to the kitten) behind the body on the facing side
    if (!p.dead && !slashing) {
      const bob = fr === 1 ? 1 : 0;
      ctx.save();
      const kw = spr.f[0].width, kh = spr.f[0].height;
      ctx.translate(Math.round(sx + (facing ? 1 : -1) * (kw / 2 - KG.x)), Math.round(sy + KG.y - kh / 2 + bob));
      ctx.rotate((facing ? 1 : -1) * (0.05 + Math.sin(this.time * 2.2) * 0.02));
      ctx.drawImage(X.sword, -SW.gx, -SW.gripY);
      ctx.restore();
    }
    if (p.dead) {
      // sword drops beside the fallen kitten
      ctx.save();
      ctx.translate(Math.round(sx + 20), Math.round(sy + 13));
      ctx.rotate(Math.PI / 2 + 0.2);
      ctx.drawImage(X.sword, -SW.gx, -SW.h / 2);
      ctx.restore();
      const d = clamp(p.deathT * 3, 0, 1);
      drawSpr(ctx, spr, fr, sx, sy + 4 * d, !facing);
    } else {
      drawSpr(ctx, spr, fr, sx, sy, facing, false);
    }
    ctx.globalAlpha = 1;
  }
}

export { fmtTime };
void ICON; void DECOR; void RUN_LENGTH; void META; void angDiff; void randInt; void Particle;
