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

## Deploy on Vercel
1. Import `FuwadMuhammed/kitty-knight` in Vercel — the framework (Vite), build command and `dist` output are already set in `vercel.json`.
2. Deploy. That's it.

Live at **https://kitty.byfu.app**. In Vercel add it under Project → Settings → Domains and point your DNS (a CNAME for `kitty` to `cname.vercel-dns.com`, or the records Vercel shows).

The canonical URL, social-share tags, `robots.txt` and `sitemap.xml` are generated at build time and default to `https://kitty.byfu.app`. To use a different domain, set an environment variable `SITE_URL=https://your-domain.com` in Vercel and redeploy.

SEO / branding assets are generated from the game's own sprites with `npx tsx tools/make_brand.ts` (favicon set, app icons, 1200x630 share image).

## Tech
React + Vite + TypeScript, HTML Canvas at 320x180 with nearest-neighbour scaling. All audio is synthesized with Web Audio. Art lives in `public/assets` (imported from AI sheets with `tools/auto_import.ts`); anything missing falls back to code-drawn sprites.

## Dev tools
`npm run sim` (headless balance run), `tools/auto_import.ts` (sheet importer), `tools/export_assets.ts` (asset sheets + list).
