// Procedural Web Audio: all sounds and the ambient music loop are synthesized, nothing is downloaded.
import { save } from './save';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxBus: GainNode | null = null;
let musicBus: GainNode | null = null;
const last: Record<string, number> = {};
let noiseBuf: AudioBuffer | null = null;

function ensure() {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.7;
    master.connect(ctx.destination);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.5;
    sfxBus.connect(master);
    musicBus = ctx.createGain();
    musicBus.gain.value = 0.16;
    musicBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch {
    ctx = null;
  }
  return ctx;
}

export function unlockAudio() {
  const c = ensure();
  if (c && c.state === 'suspended') c.resume();
}

function tone(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.2, slide = 0, delay = 0, bus: GainNode | null = null) {
  const c = ensure();
  if (!c || !(bus || sfxBus)) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(bus || sfxBus!);
  o.start(t);
  o.stop(t + dur + 0.02);
}
function noise(dur: number, vol = 0.2, f0 = 2000, f1 = 400, delay = 0) {
  const c = ensure();
  if (!c || !sfxBus || !noiseBuf) return;
  const t = c.currentTime + delay;
  const s = c.createBufferSource();
  s.buffer = noiseBuf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f);
  f.connect(g);
  g.connect(sfxBus);
  s.start(t);
  s.stop(t + dur + 0.02);
}

let xpPitch = 0;
let xpLast = 0;
export type Sfx =
  | 'swing' | 'hit' | 'crit' | 'xp' | 'levelup' | 'chest' | 'warning' | 'death' | 'evolve' | 'hurt' | 'dash'
  | 'boom' | 'zap' | 'click' | 'coin' | 'pickup' | 'shoot' | 'paw' | 'hiss' | 'bossdie' | 'victory';

export function sfx(name: Sfx) {
  if (!save.settings.sound) return;
  const c = ensure();
  if (!c) return;
  const now = performance.now();
  const gap: Partial<Record<Sfx, number>> = { hit: 45, xp: 28, shoot: 50, zap: 60, coin: 40, crit: 60, hurt: 100 };
  if (gap[name] && now - (last[name] || 0) < gap[name]!) return;
  last[name] = now;
  switch (name) {
    case 'swing': noise(0.14, 0.22, 3000, 500); break;
    case 'hit': tone(200 + Math.random() * 60, 0.05, 'square', 0.1, -90); break;
    case 'crit': tone(500, 0.1, 'triangle', 0.18, 500); noise(0.05, 0.12, 5000, 3000); break;
    case 'xp': {
      xpPitch = now - xpLast < 350 ? Math.min(xpPitch + 1, 12) : 0;
      xpLast = now;
      tone(660 * Math.pow(1.0595, xpPitch), 0.07, 'sine', 0.12, 160);
      break;
    }
    case 'coin': tone(988, 0.05, 'square', 0.08); tone(1318, 0.12, 'square', 0.08, 0, 0.05); break;
    case 'pickup': tone(520, 0.08, 'triangle', 0.15, 300); break;
    case 'levelup': [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.16, 'square', 0.12, 0, i * 0.08)); break;
    case 'chest': [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, 'triangle', 0.18, 0, i * 0.07)); break;
    case 'warning': for (let i = 0; i < 4; i++) tone(110, 0.3, 'sawtooth', 0.22, -40, i * 0.5); break;
    case 'death': tone(380, 0.9, 'sawtooth', 0.2, -340); tone(190, 0.9, 'square', 0.1, -150, 0.1); break;
    case 'evolve': [262, 330, 392, 523, 659, 784, 1046].forEach((f, i) => tone(f, 0.3, 'square', 0.12, 0, i * 0.07)); noise(0.8, 0.2, 400, 4000); break;
    case 'hurt': tone(160, 0.14, 'sawtooth', 0.2, -80); noise(0.1, 0.18, 1500, 300); break;
    case 'dash': noise(0.16, 0.16, 1200, 3500); break;
    case 'boom': noise(0.4, 0.4, 900, 80); tone(90, 0.3, 'sine', 0.3, -50); break;
    case 'zap': tone(900, 0.08, 'sawtooth', 0.14, -600); noise(0.06, 0.12, 6000, 2000); break;
    case 'click': tone(440, 0.05, 'square', 0.1, 120); break;
    case 'shoot': tone(420, 0.06, 'square', 0.06, -150); break;
    case 'paw': noise(0.25, 0.4, 500, 60); tone(70, 0.25, 'sine', 0.35, -30); break;
    case 'hiss': noise(0.4, 0.25, 6000, 1500); break;
    case 'bossdie': noise(1.2, 0.35, 800, 50); [220, 165, 110, 82].forEach((f, i) => tone(f, 0.4, 'sawtooth', 0.15, -30, i * 0.2)); break;
    case 'victory': [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => tone(f, 0.25, 'square', 0.14, 0, i * 0.12)); break;
  }
}

// ---- music: simple 16-step loop (bass + arpeggio + soft pad hat), intensity grows with run time
let musicTimer: number | null = null;
let step = 0;
let nextT = 0;
let intensity = 0;
const BASS = [55, 0, 55, 0, 65.4, 0, 49, 0, 55, 0, 55, 0, 73.4, 0, 65.4, 0];
const LEAD = [440, 523, 659, 523, 440, 523, 784, 659, 392, 494, 587, 494, 440, 587, 659, 523];
export function setMusicIntensity(v: number) {
  intensity = v;
}
function schedule() {
  const c = ctx;
  if (!c || !musicBus) return;
  const bpm = 92 + intensity * 28;
  const stepDur = 60 / bpm / 2;
  if (nextT < c.currentTime) nextT = c.currentTime + 0.05;
  while (nextT < c.currentTime + 0.2) {
    const d = nextT - c.currentTime;
    const i = step % 16;
    if (BASS[i]) tone(BASS[i], stepDur * 1.6, 'triangle', 0.55, 0, d, musicBus);
    if (i % 2 === 0 || intensity > 0.4) tone(LEAD[i] * (intensity > 0.7 && step % 32 >= 16 ? 2 : 1), stepDur * 0.9, 'square', 0.12, 0, d, musicBus);
    if (intensity > 0.2 && i % 4 === 2) {
      const s = c.createBufferSource();
      s.buffer = noiseBuf;
      const f = c.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 6000;
      const g = c.createGain();
      g.gain.setValueAtTime(0.25, c.currentTime + d);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + d + 0.05);
      s.connect(f); f.connect(g); g.connect(musicBus);
      s.start(c.currentTime + d);
      s.stop(c.currentTime + d + 0.06);
    }
    step++;
    nextT += stepDur;
  }
}
export function startMusic() {
  if (!save.settings.music) return;
  if (!ensure()) return;
  if (musicTimer !== null) return;
  musicTimer = window.setInterval(schedule, 60);
}
export function stopMusic() {
  if (musicTimer !== null) {
    clearInterval(musicTimer);
    musicTimer = null;
  }
}
export function applyAudioSettings() {
  if (save.settings.music) startMusic();
  else stopMusic();
}
