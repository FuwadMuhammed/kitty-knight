import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Public site address, used for canonical / social-card URLs, robots.txt and the sitemap.
// On Vercel it is picked up automatically; elsewhere set SITE_URL=https://your.domain when building.
const siteUrl = (process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? 'https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL : '')).replace(/\/+$/, '');

const KEYWORDS = [
  'kitty knight', 'tiny knight survivors', 'cat knight', 'kitten in armor', 'cat in armor meme', 'cute cat game', 'pixel cat game', 'cat survivors game',
  'vampire survivors like', 'bullet heaven', 'roguelite', 'free browser game', 'play online no download',
];

function seo(): Plugin {
  return {
    name: 'kitty-knight-seo',
    transformIndexHtml(html) {
      const ld: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'VideoGame',
        name: 'Kitty Knight – Tiny Knight Survivors',
        alternateName: ['Kitty Knight', 'Tiny Knight Survivors'],
        description:
          'A cute pixel-art survivor roguelite where a tiny kitten in oversized armor fights endless monsters. Free to play in your browser, on phone or desktop.',
        genre: ['Roguelite', 'Survival', 'Action', 'Pixel art', 'Bullet heaven'],
        keywords: KEYWORDS.join(', '),
        applicationCategory: 'Game',
        gamePlatform: ['Web browser', 'Mobile web', 'Desktop web'],
        operatingSystem: 'Any',
        playMode: 'SinglePlayer',
        inLanguage: 'en',
        isAccessibleForFree: true,
        author: { '@type': 'Person', name: 'Fuwad.design', url: 'https://instagram.com/fuwad.design' },
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', availability: 'https://schema.org/InStock' },
        ...(siteUrl ? { url: siteUrl + '/', image: siteUrl + '/og-image.png' } : {}),
      };
      let out = html.replace('<!--JSONLD-->', `<script type="application/ld+json">${JSON.stringify(ld)}</script>`);
      // lines that need an absolute URL are dropped when the site address is unknown (e.g. a plain local build)
      out = siteUrl ? out.split('__SITE_URL__').join(siteUrl) : out.split('\n').filter((l) => !l.includes('__SITE_URL__')).join('\n');
      return out;
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: `User-agent: *\nAllow: /\n${siteUrl ? `\nSitemap: ${siteUrl}/sitemap.xml\n` : ''}` });
      if (siteUrl)
        this.emitFile({
          type: 'asset',
          fileName: 'sitemap.xml',
          source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${siteUrl}/</loc>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n  </url>\n</urlset>\n`,
        });
    },
  };
}

export default defineConfig({ plugins: [react(), seo()], base: './' });
