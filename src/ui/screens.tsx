import React, { useEffect, useState } from 'react';
import { Btn, Icon, Panel, Sprite, T } from './Px';
import { save, persist, resetSave } from '../game/save';
import { applyAudioSettings, sfx } from '../game/audio';
import {
  BOSSES, CHARACTERS, ENEMIES, EVOS, META, PASSIVES, RARITY, WEAPONS, metaCost, WEAPON_BY_ID,
} from '../game/data';
import type { Card, Reward, RunResult } from '../game/types';
import { fmtNum, fmtTime } from '../game/util';
import { isTouchDevice } from './touchDetect';
import { QUEST_BY_TARGET } from '../game/data';
import { isUnlocked, questLifetime } from '../game/quests';
import { spriteURL, rawURL, KG, SW } from '../game/sprites';
import { canvasBlob, copyImage, copyText, downloadBlob, shareText } from '../game/share';

const useRefresh = () => {
  const [, set] = useState(0);
  return () => set((n) => n + 1);
};

// ------------------------------------------------------------------ MAIN MENU
export function MainMenu({ go }: { go: (s: string) => void }) {
  return (
    <div className="screen">
      <div className="center" style={{ top: 10 }}>
        <T s={5} c="#ffd24a" sh="#6a2a10" align="center">TINY KNIGHT</T>
        <div style={{ height: 3 }} />
        <T s={5} c="#f6efdc" sh="#3a2a5a" align="center">SURVIVORS</T>
        <div style={{ height: 6 }} />
        <T s={2} c="#e8dcc0" align="center">{'ONE TINY KNIGHT.\nAN UNREASONABLE NUMBER OF MONSTERS.'}</T>
      </div>
      <div className="topright">
        <Icon id="coin" s={1} />
        <T s={2} c="#ffe680">{String(save.gold)}</T>
      </div>
      <div className="bottomrow">
        <Btn s={3} color="#2f7a3a" onClick={() => go('select')}>PLAY</Btn>
        <Btn onClick={() => go('upgrades')}>UPGRADES</Btn>
        <Btn onClick={() => go('collection')}>COLLECTION</Btn>
        <Btn onClick={() => go('settings')}>SETTINGS</Btn>
      </div>
      <div className="bottomnote">
        <T s={2} c="#b9aed0">{`BEST: ${fmtTime(save.best.time)}  LV ${save.best.level}  ${fmtNum(save.best.kills)} KILLS`}</T>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ YOUR KNIGHT + HOW TO PLAY
export function HowToPlay({ start, back }: { start: (id: string) => void; back: () => void }) {
  const ch = CHARACTERS[0];
  const [tour, setTour] = useState(false);
  const go = () => { if (save.tourDone) start(ch.id); else setTour(true); };
  const touchy = isTouchDevice();
  const k = spriteURL('kitten', 0);
  const sw = rawURL('sword');
  const steps: [string, string, string][] = [
    ['boots', 'MOVE', touchy ? 'DRAG ON THE LEFT SIDE' : 'WASD OR ARROW KEYS'],
    ['sword', 'FIGHT', 'YOUR SWORD ATTACKS AUTOMATICALLY'],
    ['gem', 'LEVEL UP', 'COLLECT GEMS, PICK UPGRADES'],
    ['dash', 'DASH', touchy ? 'TAP DASH TO DODGE DANGER' : 'SPACE DODGES DANGER'],
    ['skull', 'WIN', 'DEFEAT THE CAT EATER AT 15:00'],
  ];
  return (
    <div className="screen dim">
      <div className="center" style={{ top: 12 }}><T s={4} c="#ffd24a" sh="#6a2a10">THIS IS YOUR KNIGHT</T></div>
      <Panel className="abs" style={{ left: 28, top: 60, width: 190, height: 238, padding: 10, textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', margin: '2px 0 8px' }}>
          <div style={{ position: 'relative', width: k.w * 3, height: k.h * 3 }}>
            <img className="pxi" src={sw.url} width={sw.w * 3} height={sw.h * 3} alt=""
              style={{ position: 'absolute', left: (KG.x - SW.gx) * 3, top: (KG.y - SW.gripY) * 3, transformOrigin: `${SW.gx * 3}px ${SW.gripY * 3}px`, transform: 'rotate(-0.06rad)' }} />
            <img className="pxi" src={k.url} width={k.w * 3} height={k.h * 3} alt="" style={{ position: 'absolute', left: 0, top: 0 }} />
          </div>
        </div>
        <T s={3} c="#ffe680" align="center">{ch.name}</T>
        <div style={{ height: 6 }} />
        <T s={2} c="#e8dcc0" align="center">{ch.desc}</T>
      </Panel>
      <Panel className="abs" style={{ left: 232, top: 60, width: 380, height: 238, padding: '8px 10px' }}>
        <T s={3} c="#9ae0ff">HOW TO PLAY</T>
        <div style={{ height: 8 }} />
        {steps.map(([icon, head, body], i) => (
          <div key={i} className="step">
            <div className="stepnum"><T s={2} c="#1b1424" sh={null}>{String(i + 1)}</T></div>
            <Icon id={icon} s={2} />
            <div style={{ flex: 1 }}>
              <T s={2} c="#ffe680">{head}</T>
              <div style={{ height: 2 }} />
              <T s={2} c="#ffffff">{body}</T>
            </div>
          </div>
        ))}
      </Panel>
      <div className="bottomrow">
        <Btn s={3} color="#2f7a3a" onClick={go}>START RUN</Btn>
        <Btn onClick={() => setTour(true)}>TOUR</Btn>
        <Btn onClick={back}>BACK</Btn>
      </div>
      {tour && <Tour done={() => { setTour(false); if (!save.tourDone) { save.tourDone = true; persist(); start(ch.id); } }} close={() => setTour(false)} />}
    </div>
  );
}

// ------------------------------------------------------------------ QUICK TOUR (first run)
function Tour({ done, close }: { done: () => void; close: () => void }) {
  const [i, setI] = useState(0);
  const touchy = isTouchDevice();
  const sp = (id: string, z: number) => { const x = spriteURL(id, 0); return <img className="pxi" src={x.url} width={x.w * z} height={x.h * z} alt="" />; };
  const slides: { head: string; hc: string; art: React.ReactNode; lines: [string, string][] }[] = [
    { head: 'MOVE YOUR KITTY', hc: '#9ae0ff', art: sp('kitten', 2),
      lines: [[touchy ? 'DRAG ON THE LEFT SIDE TO MOVE' : 'WASD OR ARROW KEYS TO MOVE', '#fff'], ['YOUR SWORD ATTACKS AUTOMATICALLY', '#ffe680'], ['NO ATTACK BUTTON, JUST KEEP MOVING', '#fff']] },
    { head: 'DANGER! ENEMIES HURT YOU', hc: '#ff6a6a',
      art: <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end' }}>{sp('slime', 3)}{sp('bat', 3)}{sp('spider', 3)}</div>,
      lines: [['EVERY ENEMY HURTS WHEN IT TOUCHES YOU', '#fff'], ['EVEN THE CUTE AND SQUISHY ONES!', '#ff9a9a'], ['KEEP MOVING AND DO NOT LET THEM CATCH YOU', '#ffe680']] },
    { head: 'DODGE AND SURVIVE', hc: '#ffd24a', art: <Icon id="dash" s={3} />,
      lines: [[touchy ? 'TAP DASH TO ESCAPE A CROWD' : 'PRESS SPACE TO DASH OUT OF TROUBLE', '#fff'], ['YOUR OWN WEAPONS NEVER HURT YOU', '#9aff9a']] },
    { head: 'GROW STRONGER', hc: '#7ae8ff', art: <Icon id="gem" s={3} />,
      lines: [['COLLECT GEMS TO LEVEL UP', '#fff'], ['PICK A NEW WEAPON OR UPGRADE EACH TIME', '#ffe680'], ['SURVIVE TO 15:00 AND BEAT THE CAT EATER', '#fff']] },
  ];
  const sl = slides[i];
  const last = i === slides.length - 1;
  return (
    <div className="tourback">
      <Panel className="abs" style={{ left: 120, top: 56, width: 400, height: 248, padding: 12, textAlign: 'center' }}>
        <T s={3} c={sl.hc} sh="#1b1424" align="center">{sl.head}</T>
        <div style={{ height: 100, margin: '14px 0 10px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>{sl.art}</div>
        {sl.lines.map(([t, c], k) => <div key={k} style={{ marginBottom: 6 }}><T s={2} c={c} align="center">{t}</T></div>)}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 8, display: 'flex', justifyContent: 'center', gap: 6 }}>
          {slides.map((_, k) => <span key={k} style={{ width: 8, height: 8, background: k === i ? '#ffd24a' : '#4a3e6a', boxShadow: '0 0 0 1px #0c0814' }} />)}
        </div>
      </Panel>
      <div className="bottomrow">
        {i > 0 && <Btn onClick={() => setI(i - 1)}>BACK</Btn>}
        <Btn s={3} color="#2f7a3a" onClick={() => (last ? done() : setI(i + 1))}>{last ? (save.tourDone ? 'GOT IT' : "LET'S GO") : 'NEXT'}</Btn>
        {!last && save.tourDone && <Btn onClick={close}>SKIP</Btn>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ PERMANENT UPGRADES
export function Upgrades({ back }: { back: () => void }) {
  const refresh = useRefresh();
  return (
    <div className="screen dim">
      <div className="center" style={{ top: 10 }}><T s={4} c="#ffd24a" sh="#6a2a10">UPGRADES</T></div>
      <div className="topright"><Icon id="coin" s={1} /><T s={2} c="#ffe680">{String(save.gold)}</T></div>
      <div className="list" style={{ top: 56 }}>
        {META.map((m) => {
          const lvl = save.meta[m.id] || 0;
          const maxed = lvl >= m.max;
          const cost = metaCost(m, lvl);
          return (
            <Panel key={m.id} className="row">
              <Icon id={m.icon} s={2} />
              <div style={{ width: 150 }}><T s={2} c="#fff">{m.name}</T></div>
              <div style={{ width: 170 }}><T s={2} c="#9affb0">{maxed ? m.desc(lvl) : `NEXT: ${m.desc(lvl + 1)}`}</T></div>
              <div className="pips">{Array.from({ length: m.max }).map((_, i) => <span key={i} className={i < lvl ? 'pip on' : 'pip'} />)}</div>
              <Btn small disabled={maxed || save.gold < cost} onClick={() => { save.gold -= cost; save.meta[m.id] = lvl + 1; persist(); sfx('coin'); refresh(); }}>
                {maxed ? 'MAX' : `BUY ${cost}`}
              </Btn>
            </Panel>
          );
        })}
      </div>
      <div className="bottomrow"><Btn onClick={back}>BACK</Btn></div>
    </div>
  );
}

// ------------------------------------------------------------------ COLLECTION
type Sec = 'weapons' | 'passives' | 'enemies' | 'bosses' | 'evos';
export function Collection({ back }: { back: () => void }) {
  const [sec, setSec] = useState<Sec>('weapons');
  const [sel, setSel] = useState<string | null>(null);
  const tabs: [Sec, string][] = [['weapons', 'WEAPONS'], ['passives', 'PASSIVES'], ['enemies', 'ENEMIES'], ['bosses', 'BOSSES'], ['evos', 'EVOLUTIONS']];
  type Item = { id: string; name: string; desc: string; icon?: string; sprite?: string; hint: string; lockable?: boolean };
  const items: Item[] =
    sec === 'weapons' ? WEAPONS.map((w) => ({ id: w.id, name: w.name, desc: `${w.desc}\nAFFECTED BY: ${w.affects.join(', ')}.`, icon: w.icon, hint: 'FIND IT IN A RUN.', lockable: true }))
    : sec === 'passives' ? PASSIVES.map((p) => ({ id: p.id, name: p.name, desc: `${p.fmt(p.per)} PER LEVEL. ${p.desc}`, icon: p.icon, hint: 'FIND IT IN A RUN.', lockable: true }))
    : sec === 'enemies' ? ENEMIES.filter((e) => !e.hidden).map((e) => ({ id: e.id, name: e.name, desc: `${e.desc} HP ${e.hp}.`, sprite: e.id, hint: 'DEFEAT ONE TO LEARN MORE.' }))
    : sec === 'bosses' ? BOSSES.map((b) => ({ id: b.id, name: b.name, desc: b.desc, sprite: b.sprite, hint: 'MEET IT IN A RUN.' }))
    : EVOS.map((e) => ({ id: e.id, name: e.name, desc: `${WEAPON_BY_ID[e.base].name} LV8 + ${WEAPON_BY_ID[e.partner]?.name || e.partner} LV${e.partnerLevel}. ${e.desc}`, icon: e.icon, hint: 'MAX A WEAPON WITH ITS PARTNER.' }));
  const known = (id: string) => (sec === 'weapons' || sec === 'passives') ? isUnlocked(id) : !!save.coll[sec][id];
  const have = items.filter((i) => known(i.id)).length;
  const cur = items.find((i) => i.id === sel) || null;
  return (
    <div className="screen dim">
      <div className="center" style={{ top: 8 }}><T s={4} c="#ffd24a" sh="#6a2a10">COLLECTION</T></div>
      <div className="tabs">
        {tabs.map(([k, label]) => <Btn key={k} small active={sec === k} onClick={() => { setSec(k); setSel(null); }}>{label}</Btn>)}
      </div>
      <div className="center" style={{ top: 82 }}><T s={2} c="#b9aed0">{`${have}/${items.length} ${sec === 'weapons' || sec === 'passives' ? 'UNLOCKED' : 'DISCOVERED'}`}</T></div>
      <div className="grid">
        {items.map((it) => {
          const k = known(it.id);
          return (
            <button key={it.id} className={'cell' + (sel === it.id ? ' sel' : '')} onClick={() => { sfx('click'); setSel(it.id); }}>
              {k ? (it.icon ? <Icon id={it.icon} s={2} /> : <Sprite id={it.sprite!} size={30} />) : it.lockable ? <Icon id="locked" s={2} /> : <T s={2} c="#6a6080">???</T>}
            </button>
          );
        })}
      </div>
      <Panel className="abs" style={{ left: 90, top: 248, width: 460, height: 98, padding: 8 }}>
        {cur ? (
          known(cur.id) ? (
            <><T s={2} c="#ffe680">{cur.name}</T><div style={{ height: 4 }} /><T s={2} c="#fff">{cur.desc}</T></>
          ) : cur.lockable && QUEST_BY_TARGET[cur.id] ? (
            (() => {
              const q = QUEST_BY_TARGET[cur.id];
              const life = questLifetime(q);
              return <><T s={2} c="#ff9a6a">LOCKED</T><div style={{ height: 4 }} /><T s={2} c="#ffe680">{`UNLOCK: ${q.text}`}</T>{life !== null && <><br /><T s={2} c="#9ae0ff">{`PROGRESS ${Math.min(life, q.goal)}/${q.goal}`}</T></>}</>;
            })()
          ) : (
            <><T s={2} c="#6a6080">???</T><div style={{ height: 4 }} /><T s={2} c="#8a7aa0">{cur.hint}</T></>
          )
        ) : <T s={2} c="#8a7aa0">SELECT AN ENTRY.</T>}
      </Panel>
      <div className="abs" style={{ left: 12, top: 10 }}><Btn small onClick={back}>BACK</Btn></div>
    </div>
  );
}

// ------------------------------------------------------------------ SETTINGS
export function Credits({ back }: { back: () => void }) {
  return (
    <div className="screen dim">
      <div className="center" style={{ top: 14 }}><T s={4} c="#ffd24a" sh="#6a2a10">CREDITS</T></div>
      <Panel className="abs credits" style={{ left: 120, top: 62, width: 400, height: 220, padding: 14 }}>
        <T s={2} c="#b9aed0" align="center">MADE BY</T>
        <a className="pbtn link" href="https://instagram.com/fuwad.design" target="_blank" rel="noopener noreferrer" style={{ ['--bc' as any]: '#a8307a' }}>
          <T s={3} c="#ffffff">FUWAD.DESIGN</T>
        </a>
        <T s={2} c="#8a7aa0" align="center">TAP TO OPEN INSTAGRAM</T>
        <div style={{ height: 14 }} />
        <T s={2} c="#b9aed0" align="center">SPECIAL THANKS</T>
        <T s={3} c="#ffe680" align="center">THEJUS</T>
        <T s={3} c="#ffe680" align="center">SREEJITH</T>
        <div style={{ height: 6 }} />
        <T s={2} c="#7aff9a" align="center">THANKS FOR PLAYING KITTY KNIGHT!</T>
      </Panel>
      <div className="bottomrow"><Btn onClick={back}>BACK</Btn></div>
    </div>
  );
}

export function Settings({ back, label = 'BACK' }: { back: () => void; label?: string }) {
  const refresh = useRefresh();
  const [confirm, setConfirm] = useState(false);
  const [showCredits, setShowCredits] = useState(false);
  if (showCredits) return <Credits back={() => setShowCredits(false)} />;
  const rows: [keyof typeof save.settings, string][] = [
    ['sound', 'SOUND'], ['music', 'MUSIC'], ['shake', 'SCREEN SHAKE'], ['dmgNumbers', 'DAMAGE NUMBERS'], ['reduced', 'REDUCED EFFECTS'],
  ];
  return (
    <div className="screen dim">
      <div className="center" style={{ top: 12 }}><T s={4} c="#ffd24a" sh="#6a2a10">SETTINGS</T></div>
      <Panel className="abs" style={{ left: 140, top: 54, width: 360, height: 188, padding: 10 }}>
        {rows.map(([k, name]) => (
          <div key={k} className="setrow">
            <T s={2}>{name}</T>
            <Btn small color={save.settings[k] ? '#2f7a3a' : '#7a2f3a'} onClick={() => { save.settings[k] = !save.settings[k]; persist(); applyAudioSettings(); refresh(); }}>
              {save.settings[k] ? 'ON' : 'OFF'}
            </Btn>
          </div>
        ))}
      </Panel>
      <Panel className="abs" style={{ left: 140, top: 248, width: 360, height: 62, padding: 8 }}>
        <T s={2} c="#e8dcc0">{isTouchDevice() ? 'MOVE: DRAG THE LEFT SIDE\nDASH + PAUSE: BUTTONS' : 'MOVE: WASD / ARROWS\nDASH: SPACE\nPAUSE: ESC'}</T>
      </Panel>
      <div className="bottomrow">
        <Btn color="#a8307a" onClick={() => setShowCredits(true)}>CREDITS</Btn>
        <Btn color="#7a2f3a" onClick={() => { if (!confirm) setConfirm(true); else { resetSave(); setConfirm(false); applyAudioSettings(); refresh(); } }}>
          {confirm ? 'CLICK AGAIN TO ERASE' : 'RESET SAVE'}
        </Btn>
        <Btn onClick={back}>{label}</Btn>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ CELEBRATION FX (level-up / treasure)
const CONFETTI = ['#ffd24a', '#ff6aa8', '#6ac8ff', '#7aff9a', '#ffffff', '#c36bff', '#ff9a3a'];
export function CelebrationFx({ gold = false }: { gold?: boolean }) {
  const pieces = React.useMemo(
    () => Array.from({ length: 46 }, (_, i) => ({ l: Math.random() * 100, s: 3 + Math.floor(Math.random() * 3) * 2, d: 2.4 + Math.random() * 2.2, dl: -Math.random() * 4, c: CONFETTI[i % CONFETTI.length], sw: (Math.random() - 0.5) * 40 })),
    [],
  );
  const sparks = React.useMemo(() => Array.from({ length: 22 }, (_, i) => {
    const side = i % 4, t = Math.random() * 100;
    return { x: side === 0 ? t : side === 1 ? t : side === 2 ? 1.5 : 98.5, y: side === 0 ? 2 : side === 1 ? 97 : t, dl: Math.random() * 2, d: 0.9 + Math.random() };
  }), []);
  return (
    <div className={'fx' + (gold ? ' gold' : '')}>
      <div className="fx-rays" />
      <div className="fx-edgeglow" />
      <div className="fx-mq top" /><div className="fx-mq bottom" /><div className="fx-mq left" /><div className="fx-mq right" />
      <div className="fx-star tl" /><div className="fx-star tr" /><div className="fx-star bl" /><div className="fx-star br" />
      {pieces.map((p, i) => (
        <span key={i} className="cf" style={{ left: `${p.l}%`, width: p.s, height: p.s, background: p.c, animationDuration: `${p.d}s`, animationDelay: `${p.dl}s`, ['--sw' as any]: `${p.sw}px` }} />
      ))}
      {sparks.map((p, i) => <span key={i} className="sp" style={{ left: `${p.x}%`, top: `${p.y}%`, animationDelay: `${p.dl}s`, animationDuration: `${p.d}s` }} />)}
      <div className="fx-flash" />
    </div>
  );
}

// ------------------------------------------------------------------ LEVEL UP
export function LevelUp({ cards, level, remaining, choose: pick }: { cards: Card[]; level: number; remaining: number; choose: (c: Card) => void }) {
  const [step, setStep] = useState(() => (save.levelTipDone ? 99 : 0));
  const touchy = isTouchDevice();
  const choose = (c: Card) => { if (!save.levelTipDone) { save.levelTipDone = true; persist(); } pick(c); };
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (step < 2) {
        if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); setStep(step + 1); }
        return;
      }
      const i = ['Digit1', 'Digit2', 'Digit3', 'Numpad1', 'Numpad2', 'Numpad3'].indexOf(e.code) % 3;
      if (['Digit1', 'Digit2', 'Digit3', 'Numpad1', 'Numpad2', 'Numpad3'].includes(e.code) && cards[i]) choose(cards[i]);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [cards, choose, step]);
  return (
    <div className="screen overlay lvl">
      <CelebrationFx />
      <div className="center" style={{ top: 22 }}>
        <div className="pulse shine"><T s={5} c="#ffe680" sh="#7a4a10">LEVEL UP!</T></div>
        <div style={{ height: 4 }} />
        <T s={2} c="#bfe4ff">{`LEVEL ${level}${remaining > 1 ? `  (${remaining - 1} MORE)` : ''}`}</T>
      </div>
      <div className="cards">
        {cards.map((c, i) => {
          const r = RARITY[c.rarity];
          return (
            <button key={i} className={'card r' + c.rarity} style={{ ['--rc' as any]: r.color }} onClick={() => choose(c)}>
              <div className="cardkey"><T s={2} c="#8a7aa0">{String(i + 1)}</T></div>
              <div style={{ minHeight: 18 }}>
                {c.isNew ? <T s={2} c="#7aff9a">NEW!</T> : c.kind === 'evo' ? <T s={2} c="#ffc43a">EVOLUTION</T> : <T s={2} c={r.color}>{r.name}</T>}
              </div>
              <div className="cardicon" style={{ borderColor: r.color }}><Icon id={c.icon} s={4} /></div>
              <T s={2} c="#fff" align="center">{c.name}</T>
              <div style={{ height: 6 }} />
              <div className="cardlines">
                {c.lines.map((l, j) => <T key={j} s={2} c={j === 0 ? '#9affb0' : '#e8dcc0'} align="center">{l}</T>)}
              </div>
            </button>
          );
        })}
      </div>
      {step < 2 && (
        <div className="tourback" style={{ zIndex: 6 }}>
          <Panel className="abs" style={{ left: 120, top: 70, width: 400, height: 200, padding: 12, textAlign: 'center' }}>
            <T s={3} c="#ffe680" sh="#7a4a10" align="center">{step === 0 ? 'YOU LEVELED UP!' : 'PICK ONE UPGRADE'}</T>
            <div style={{ height: 52, margin: '12px 0 8px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
              <Icon id={step === 0 ? 'gem' : 'sword'} s={3} />
            </div>
            {step === 0 ? (
              <>
                <div style={{ marginBottom: 6 }}><T s={2} c="#fff" align="center">DEFEATED MONSTERS DROP GEMS. COLLECT THEM TO FILL THE BAR.</T></div>
                <T s={2} c="#9affb0" align="center">A FULL BAR MEANS A LEVEL UP, AND YOU GET STRONGER!</T>
              </>
            ) : (
              <>
                <div style={{ marginBottom: 6 }}><T s={2} c="#fff" align="center">THE GAME PAUSES AND OFFERS YOU 3 CARDS. PICK ONE.</T></div>
                <div style={{ marginBottom: 6 }}><T s={2} c="#9affb0" align="center">NEW WEAPONS AND UPGRADES MAKE YOU STRONGER.</T></div>
                <T s={2} c="#ffe680" align="center">{touchy ? 'TAP A CARD. CHOOSE WISELY!' : 'CLICK A CARD OR PRESS 1, 2, 3. CHOOSE WISELY!'}</T>
              </>
            )}
          </Panel>
          <div className="bottomrow" style={{ bottom: 40 }}>
            <Btn s={3} color="#2f7a3a" onClick={() => setStep(step + 1)}>{step === 0 ? 'NEXT' : "LET'S PICK"}</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ CHEST
export function ChestOverlay({ rewards, triple, close }: { rewards: Reward[]; triple: boolean; close: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); close(); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [close]);
  return (
    <div className="screen overlay lvl">
      <CelebrationFx gold />
      <div className="center" style={{ top: 40 }}>
        <div className="pulse shine"><T s={5} c="#ffe680" sh="#7a4a10">{triple ? 'TRIPLE REWARD!' : 'TREASURE!'}</T></div>
      </div>
      <div className="rewards">
        {rewards.map((r, i) => (
          <Panel key={i} className="reward" style={{ animationDelay: `${i * 0.18}s` }}>
            <Icon id={r.icon} s={4} />
            <div style={{ height: 6 }} />
            <T s={2} c="#fff" align="center">{r.name}</T>
            <div style={{ height: 4 }} />
            <T s={2} c={r.kind === 'evo' ? '#ffc43a' : '#9affb0'} align="center">{r.text}</T>
          </Panel>
        ))}
      </div>
      <div className="bottomrow"><Btn s={3} color="#2f7a3a" onClick={close}>NICE!</Btn></div>
    </div>
  );
}

// ------------------------------------------------------------------ PAUSE
export function PauseMenu({ resume, quit }: { resume: () => void; quit: () => void }) {
  const [showSettings, setShowSettings] = useState(false);
  const [confirm, setConfirm] = useState(false);
  if (showSettings) return <Settings back={() => setShowSettings(false)} label="BACK" />;
  return (
    <div className="screen overlay">
      <div className="center" style={{ top: 50 }}><T s={6} c="#ffd24a" sh="#6a2a10">PAUSED</T></div>
      <div className="vstack" style={{ top: 130 }}>
        <Btn s={3} color="#2f7a3a" wide onClick={resume}>RESUME</Btn>
        <Btn s={2} wide onClick={() => setShowSettings(true)}>SETTINGS</Btn>
        <Btn s={2} wide color="#7a2f3a" onClick={() => { if (confirm) quit(); else setConfirm(true); }}>{confirm ? 'SURE? CLICK AGAIN' : 'QUIT RUN'}</Btn>
      </div>
      <div className="bottomnote"><T s={2} c="#b9aed0">{isTouchDevice() ? 'TAP RESUME TO CONTINUE' : 'ESC TO RESUME'}</T></div>
    </div>
  );
}

// ------------------------------------------------------------------ RESULTS
export function Results({ res, again, upgrades, menu, makeCard }: { res: RunResult; again: () => void; upgrades: () => void; menu: () => void; makeCard: () => HTMLCanvasElement }) {
  const [sharing, setSharing] = useState(false);
  const title = res.win ? 'RUN COMPLETE' : res.quip === 'A tactical retreat.' ? 'RUN ABANDONED' : 'THE KNIGHT HAS FALLEN';
  const rows: [string, string][] = [
    ['TIME SURVIVED', fmtTime(res.time)], ['LEVEL', String(res.level)], ['KILLS', String(res.kills)], ['DAMAGE DEALT', fmtNum(res.damage)],
    ['GOLD EARNED', String(res.gold)], ['BOSSES DEFEATED', String(res.bosses)], ['BEST COMBO', `X${res.combo}`],
  ];
  return (
    <div className="screen dim">
      <div className="center" style={{ top: 12 }}>
        <T s={4} c={res.win ? '#ffd24a' : '#ff9a9a'} sh={res.win ? '#6a2a10' : '#3a0a14'} align="center">{title}</T>
        <div style={{ height: 4 }} />
        <T s={2} c="#e8dcc0" align="center">{`"${res.quip}"`}</T>
        {res.newBest && <div style={{ marginTop: 4 }}><T s={2} c="#7aff9a">NEW PERSONAL BEST!</T></div>}
      </div>
      <Panel className="abs" style={{ left: 24, top: 84, width: 250, height: 214, padding: '10px 12px' }}>
        {rows.map(([a, b]) => (
          <div key={a} className="statrow"><T s={2} c="#b9aed0">{a}</T><T s={2} c={a === 'GOLD EARNED' ? '#ffe680' : '#fff'}>{b}</T></div>
        ))}
      </Panel>
      <Panel className="abs" style={{ left: 286, top: 84, width: 330, height: 214, padding: '8px 10px', overflow: 'hidden' }}>
        <T s={2} c="#ffe680">WEAPONS</T>
        <div style={{ height: 5 }} />
        <div className="wgrid">
          {res.weapons.slice(0, 6).map((w) => (
            <div key={w.id + w.name} className="wcell">
              <Icon id={w.icon} s={2} />
              <div style={{ minWidth: 0 }}><T s={2} c="#fff">{w.name.length > 12 ? w.name.split(' ').slice(-1)[0] : w.name}</T><br /><T s={2} c="#9affb0">{`LV ${w.level}`}</T></div>
            </div>
          ))}
        </div>
        <div style={{ height: 6 }} />
        <T s={2} c="#ffe680">{`EVOLUTIONS: ${res.evolutions.length}`}</T>
        {res.evolutions.length > 0 && <div style={{ marginTop: 3 }}><T s={2} c="#fff">{res.evolutions.join(', ')}</T></div>}
        {res.unlocks.length > 0 && <div style={{ marginTop: 5 }}><T s={2} c="#7aff9a">{`UNLOCKED: ${res.unlocks.join(', ')}`}</T></div>}
      </Panel>
      <div className="bottomrow">
        <Btn s={3} color="#2f7a3a" onClick={again}>PLAY AGAIN</Btn>
        <Btn color="#2a5a9a" onClick={() => setSharing(true)}>SHARE</Btn>
        <Btn onClick={upgrades}>UPGRADES</Btn>
        <Btn onClick={menu}>MAIN MENU</Btn>
      </div>
      {sharing && <ShareDialog res={res} makeCard={makeCard} close={() => setSharing(false)} />}
    </div>
  );
}

// ------------------------------------------------------------------ SHARE
export function ShareDialog({ res, makeCard, close }: { res: RunResult; makeCard: () => HTMLCanvasElement; close: () => void }) {
  const [card] = useState(() => makeCard());
  const [url] = useState(() => card.toDataURL('image/png'));
  const [msg, setMsg] = useState('PICK WHERE TO SHARE');
  const text = shareText(res);
  const open = (href: string) => window.open(href, '_blank', 'noopener,noreferrer');

  const nativeShare = async () => {
    try {
      const blob = await canvasBlob(card);
      const file = new File([blob], 'tiny-knight-survivors.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text, title: 'Tiny Knight Survivors' });
        setMsg('SHARED!');
      } else if (navigator.share) {
        await navigator.share({ text, title: 'Tiny Knight Survivors' });
        setMsg('SHARED! (TEXT ONLY - USE SAVE IMAGE TOO)');
      } else setMsg('NO SHARE MENU HERE. USE THE BUTTONS BELOW.');
    } catch { setMsg('SHARE CANCELLED'); }
  };
  // Web links can't attach images, so we copy/save the picture and open the app with the caption filled in.
  const viaLink = async (href: string, name: string) => {
    open(href);
    const blob = await canvasBlob(card);
    const copied = await copyImage(blob);
    if (!copied) downloadBlob(blob);
    setMsg(copied ? `${name} OPENED. PASTE THE IMAGE (CTRL/CMD+V)` : `${name} OPENED. IMAGE SAVED - ATTACH IT`);
  };
  const instagram = async () => {
    const blob = await canvasBlob(card);
    downloadBlob(blob);
    const t = await copyText(text);
    open('https://www.instagram.com/');
    setMsg(t ? 'IMAGE SAVED + CAPTION COPIED. POST IT ON INSTAGRAM!' : 'IMAGE SAVED. POST IT ON INSTAGRAM!');
  };
  return (
    <div className="screen" style={{ background: 'rgba(8,4,16,0.94)' }}>
      <div className="center" style={{ top: 10 }}><T s={3} c="#ffd24a" sh="#6a2a10">SHARE YOUR RUN</T></div>
      <Panel className="abs" style={{ left: 30, top: 48, width: 244, height: 244, padding: 6 }}>
        <img src={url} width={230} height={230} alt="share card" className="pxi" draggable={false} />
      </Panel>
      <div className="abs sharegrid">
        <Btn color="#2a5a9a" onClick={nativeShare}>SHARE...</Btn>
        <Btn color="#1f8a4a" onClick={() => viaLink(`https://wa.me/?text=${encodeURIComponent(text)}`, 'WHATSAPP')}>WHATSAPP</Btn>
        <Btn color="#1a63a8" onClick={() => viaLink(`https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text)}`, 'LINKEDIN')}>LINKEDIN</Btn>
        <Btn color="#a8307a" onClick={instagram}>INSTAGRAM</Btn>
        <Btn onClick={async () => { downloadBlob(await canvasBlob(card)); setMsg('IMAGE SAVED'); }}>SAVE IMAGE</Btn>
        <Btn onClick={async () => setMsg((await copyText(text)) ? 'CAPTION COPIED' : 'COPY BLOCKED BY BROWSER')}>COPY TEXT</Btn>
      </div>
      <div className="abs" style={{ left: 292, top: 196, width: 320 }}><T s={2} c="#9ae0ff">{msg}</T></div>
      <div className="abs" style={{ left: 292, top: 238, width: 320 }}><T s={2} c="#8a7aa0">{`"${text.replace(/https?:\/\/\S+/, '').trim()}"`}</T></div>
      <div className="bottomrow"><Btn onClick={close}>CLOSE</Btn></div>
    </div>
  );
}
