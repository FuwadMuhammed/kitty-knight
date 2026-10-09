# Kitty Knight — Tiny Knight Survivors

One tiny knight. An unreasonable number of monsters.

A pixel-art survival roguelite (bullet-heaven) that runs in the browser. Move, let your weapons fire automatically, collect XP, level up, beat the bosses, and defeat the Cat Eater at 15:00.

Made by [Fuwad.design](https://instagram.com/fuwad.design). Special thanks to Thejus and Sreejith.

## Run it

```bash
npm install
npm run dev      # http://127.0.0.1:5188
npm run build    # production build in dist/
```

Controls: WASD / arrows to move, Space to dash, Esc to pause. On phones: drag the left side to move, tap Dash.

## Tech
React + Vite + TypeScript, HTML Canvas at 320x180 with nearest-neighbour scaling. All audio is synthesized with Web Audio. Art lives in `public/assets` (imported from AI sheets with `tools/auto_import.ts`); anything missing falls back to code-drawn sprites.

## Dev tools
`npm run sim` (headless balance run), `tools/auto_import.ts` (sheet importer), `tools/export_assets.ts` (asset sheets + list).
