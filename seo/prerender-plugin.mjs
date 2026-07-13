// Build-time SEO prerender for the Local Data Tools SPA.
//
// The app is client-side rendered from a single index.html. Without this,
// every route (/csv-fusion, /ocr, ...) is served identical HTML whose
// canonical points at the homepage — so Google folds them into "/" and
// leaves them out of the index. This plugin emits one static HTML file per
// route with a self-referencing canonical, unique title/description/OG/JSON-LD
// and real crawlable content baked into #root (React replaces it on mount).
import fs from 'node:fs';
import path from 'node:path';
import { SITE, ROUTES } from './routes.mjs';

const escAttr = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escHtml = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// Prevent a "</script>" inside JSON from closing the surrounding tag.
const jsonLd = (obj) => JSON.stringify(obj).replace(/</g, '\\u003c');

const urlFor = (route) => SITE.origin + route.path;

function structuredData(route) {
  const url = urlFor(route);
  const blocks = [];

  if (route.slug !== '') {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: `${route.name} — Local Data Tools`,
      url,
      description: route.metaDescription,
      applicationCategory: 'UtilitiesApplication',
      operatingSystem: 'Any (web browser)',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      creator: { '@type': 'Organization', name: 'Local Data Tools', url: SITE.origin },
    });
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE.origin + '/' },
        { '@type': 'ListItem', position: 2, name: route.name, item: url },
      ],
    });
  }

  if (Array.isArray(route.faqs) && route.faqs.length) {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: route.faqs.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    });
  }

  return blocks
    .map((b) => `    <script type="application/ld+json">\n    ${jsonLd(b)}\n    </script>`)
    .join('\n');
}

// Content injected into #root. Inline styles only, so it renders correctly
// even before Tailwind loads and looks like a fast first paint. React clears
// #root when it mounts, so this is purely for crawlers / pre-hydration.
function rootContent(route) {
  const others = ROUTES.filter((r) => r.slug !== route.slug);
  const link = (r) =>
    `<a href="${r.path}" style="display:inline-block;padding:8px 14px;margin:0 8px 8px 0;border:1px solid #27272a;border-radius:10px;color:#d4d4d8;text-decoration:none;font-size:14px;">${escHtml(r.name)}</a>`;

  const features = (route.features || [])
    .map(
      (f) =>
        `<li style="padding:10px 0;border-bottom:1px solid #18181b;color:#d4d4d8;font-size:15px;">${escHtml(f)}</li>`
    )
    .join('');

  const faqs = (route.faqs || [])
    .map(
      (f) =>
        `<div style="margin:0 0 20px;"><h3 style="font-size:16px;color:#fafafa;margin:0 0 6px;font-weight:600;">${escHtml(
          f.q
        )}</h3><p style="font-size:15px;line-height:1.6;color:#a1a1aa;margin:0;">${escHtml(f.a)}</p></div>`
    )
    .join('');

  return `
      <div style="max-width:860px;margin:0 auto;padding:56px 24px 80px;font-family:Inter,system-ui,-apple-system,sans-serif;color:#e4e4e7;">
        ${
          route.slug === ''
            ? ''
            : `<a href="/" style="color:#a5b4fc;text-decoration:none;font-size:14px;">&larr; Local Data Tools</a>`
        }
        <h1 style="font-size:34px;line-height:1.2;margin:${
          route.slug === '' ? '0' : '22px'
        } 0 14px;color:#fafafa;font-weight:700;letter-spacing:-0.02em;">${escHtml(route.h1)}</h1>
        <p style="font-size:17px;line-height:1.65;color:#a1a1aa;margin:0 0 28px;max-width:680px;">${escHtml(
          route.intro
        )}</p>
        ${
          features
            ? `<ul style="list-style:none;padding:0;margin:0 0 36px;max-width:680px;">${features}</ul>`
            : ''
        }
        ${
          faqs
            ? `<h2 style="font-size:22px;color:#fafafa;margin:8px 0 18px;font-weight:700;">Frequently asked questions</h2>${faqs}`
            : ''
        }
        <h2 style="font-size:20px;color:#fafafa;margin:36px 0 16px;font-weight:700;">${
          route.slug === '' ? 'All tools' : 'More free tools'
        }</h2>
        <div>${others.map(link).join('')}</div>
        <p style="margin:40px 0 0;color:#52525b;font-size:13px;">Every tool runs entirely in your browser. Files are never uploaded &mdash; 100% private and free.</p>
      </div>`;
}

function buildRouteHtml(template, route) {
  const url = urlFor(route);
  let html = template;

  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escHtml(route.title)}</title>`);
  html = html.replace(
    /(<meta name="description" content=")[\s\S]*?("\s*\/?>)/,
    `$1${escAttr(route.metaDescription)}$2`
  );
  html = html.replace(
    /(<link rel="canonical" href=")[\s\S]*?("\s*\/?>)/,
    `$1${escAttr(url)}$2`
  );
  html = html.replace(/(<meta property="og:url" content=")[\s\S]*?("\s*\/?>)/, `$1${escAttr(url)}$2`);
  html = html.replace(
    /(<meta property="og:title" content=")[\s\S]*?("\s*\/?>)/,
    `$1${escAttr(route.title)}$2`
  );
  html = html.replace(
    /(<meta property="og:description" content=")[\s\S]*?("\s*\/?>)/,
    `$1${escAttr(route.metaDescription)}$2`
  );
  html = html.replace(
    /(<meta name="twitter:title" content=")[\s\S]*?("\s*\/?>)/,
    `$1${escAttr(route.title)}$2`
  );
  html = html.replace(
    /(<meta name="twitter:description" content=")[\s\S]*?("\s*\/?>)/,
    `$1${escAttr(route.metaDescription)}$2`
  );

  const sd = structuredData(route);
  if (sd) html = html.replace('</head>', `${sd}\n  </head>`);

  html = html.replace('<div id="root"></div>', `<div id="root">${rootContent(route)}</div>`);
  return html;
}

function buildSitemap(lastmod) {
  const urls = ROUTES.map((r) => {
    const priority = r.slug === '' ? '1.0' : r.priority || '0.8';
    const changefreq = r.slug === '' ? 'weekly' : 'monthly';
    return `  <url>\n    <loc>${urlFor(r)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

/** @returns {import('vite').Plugin} */
export default function seoPrerender() {
  return {
    name: 'ldt-seo-prerender',
    apply: 'build',
    closeBundle() {
      const outDir = path.resolve(process.cwd(), 'dist');
      const indexPath = path.join(outDir, 'index.html');
      if (!fs.existsSync(indexPath)) {
        this.warn(`[seo-prerender] ${indexPath} not found; skipping`);
        return;
      }
      const template = fs.readFileSync(indexPath, 'utf8');
      const lastmod = new Date().toISOString().slice(0, 10);

      let count = 0;
      for (const route of ROUTES) {
        const html = buildRouteHtml(template, route);
        if (route.slug === '') {
          fs.writeFileSync(indexPath, html); // overwrite home with content + JSON-LD
        } else {
          const dir = path.join(outDir, route.slug);
          fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(path.join(dir, 'index.html'), html);
        }
        count++;
      }

      fs.writeFileSync(path.join(outDir, 'sitemap.xml'), buildSitemap(lastmod));
      // eslint-disable-next-line no-console
      console.log(`\n[seo-prerender] wrote ${count} route pages + sitemap.xml`);
    },
  };
}
