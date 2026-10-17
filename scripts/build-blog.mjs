#!/usr/bin/env node
// Static blog builder for armenghazaryan.am — zero runtime dependencies.
//
// Reads content/blog/posts/*.md and publishes every post whose `date` has
// arrived (UTC). Future-dated posts stay unpublished until the daily GitHub
// Action (.github/workflows/publish-blog.yml) runs on or after their date —
// that's the whole scheduling mechanism.
//
// Generates: blog/index.html, blog/<slug>/index.html, blog/banners/*,
// blog/feed.xml, sitemap.xml, llms.txt, llms-full.txt, and the
// "From the blog" block on the homepage (between BLOG:LATEST markers).
//
// Output is deterministic: on a day when no post goes live, nothing changes,
// so the Action makes no commit. Banner PNGs need @resvg/resvg-js (installed
// by the Action); without it the build falls back to SVG banners.
//
// Usage: node scripts/build-blog.mjs        (BLOG_TODAY=YYYY-MM-DD to preview)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://armenghazaryan.am';
const POSTS_DIR = path.join(ROOT, 'content/blog/posts');
const FONTS_DIR = path.join(ROOT, 'content/blog/fonts');
const BLOG_DIR = path.join(ROOT, 'blog');
const TODAY = process.env.BLOG_TODAY || new Date().toISOString().slice(0, 10);

// Bump these by hand when the corresponding page meaningfully changes.
const PAGE_UPDATED = { home: '2026-10-17', gallery: '2026-06-24', daron: '2026-07-27' };

const LINKEDIN = 'https://am.linkedin.com/in/ghazaryan-armen15';
const GITHUB = 'https://github.com/h3l10w0r1d';
const AUTHOR = {
    '@type': 'Person',
    '@id': `${SITE}/#person`,
    name: 'Armen Ghazaryan',
    alternateName: 'Ghazaryan Armen',
    url: `${SITE}/`,
    image: `${SITE}/headshot.jpeg`,
    jobTitle: 'Technical Product Owner, CRM & MarTech',
    sameAs: [LINKEDIN, GITHUB, 'https://www.instagram.com/armen_g_ag/'],
};
const AUTHOR_BIO = 'Technical Product Owner for CRM &amp; MarTech at Voveron, freelance web developer since 2022 with 50+ clients, and AI student at Vrije Universiteit Amsterdam. Originally from Yerevan, Armenia.';

// ---------- helpers ----------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const jsonLd = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
const slugify = (s) => s.toLowerCase().replace(/&[a-z]+;/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const human = (d) => { const [y, m, day] = d.split('-').map(Number); return `${MONTHS[m - 1]} ${day}, ${y}`; };
const rfc822 = (d) => new Date(`${d}T06:00:00Z`).toUTCString();
const iso = (d) => `${d}T06:00:00+00:00`;

const written = [];
function write(rel, data) {
    const file = path.join(ROOT, rel);
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    if (fs.existsSync(file) && Buffer.compare(fs.readFileSync(file), buf) === 0) return;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, buf);
    written.push(rel);
}

// ---------- posts ----------
function parsePost(file) {
    const raw = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!m) throw new Error(`${path.basename(file)}: missing --- front matter ---`);
    const meta = {};
    for (const line of m[1].split('\n')) {
        const i = line.indexOf(':');
        if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^(["'])(.*)\1$/, '$2');
    }
    for (const key of ['title', 'slug', 'date', 'description', 'category']) {
        if (!meta[key]) throw new Error(`${path.basename(file)}: front matter is missing "${key}"`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.date)) throw new Error(`${path.basename(file)}: date must be YYYY-MM-DD`);
    if (!/^[a-z0-9-]+$/.test(meta.slug)) throw new Error(`${path.basename(file)}: slug must be lowercase a-z, 0-9 and dashes`);
    const md = renderMarkdown(m[2]);
    const words = md.text.split(/\s+/).filter(Boolean).length;
    return {
        ...meta,
        updated: meta.updated || meta.date,
        keywords: (meta.keywords || '').split(',').map((s) => s.trim()).filter(Boolean),
        markdown: m[2].trim(),
        html: md.html,
        headings: md.headings,
        words,
        minutes: Math.max(1, Math.round(words / 220)),
        url: `${SITE}/blog/${meta.slug}/`,
        path: `/blog/${meta.slug}/`,
    };
}

// Minimal Markdown: ## / ### headings, paragraphs, - and 1. lists, > quotes,
// **bold**, *italic*, `code`, [links](url). Enough for long-form posts.
function inline(s) {
    return esc(s)
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, text, href) => {
            const external = /^https?:\/\//.test(href) && !href.startsWith(SITE);
            return `<a href="${href}"${external ? ' target="_blank" rel="noopener"' : ''}>${text}</a>`;
        })
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[^*\w])\*([^*\s][^*]*?)\*/g, '$1<em>$2</em>');
}
function renderMarkdown(src) {
    const out = [];
    const headings = [];
    const text = [];
    let para = [];
    let list = null;
    const flushPara = () => { if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; } };
    const flushList = () => { if (list) { out.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`); list = null; } };
    for (const line of src.split('\n')) {
        const t = line.trim();
        if (t) text.push(t.replace(/[#>*`[\]()-]/g, ' '));
        let m;
        if (!t) { flushPara(); flushList(); continue; }
        if ((m = t.match(/^(#{2,3})\s+(.*)$/))) {
            flushPara(); flushList();
            const level = m[1].length;
            const id = slugify(m[2]);
            if (level === 2) headings.push({ id, text: m[2] });
            out.push(`<h${level} id="${id}">${inline(m[2])}</h${level}>`);
        } else if ((m = t.match(/^[-*]\s+(.*)$/)) || (m = t.match(/^\d+\.\s+(.*)$/))) {
            flushPara();
            const tag = /^\d/.test(t) ? 'ol' : 'ul';
            if (list && list.tag !== tag) flushList();
            if (!list) list = { tag, items: [] };
            list.items.push(m[1]);
        } else if ((m = t.match(/^>\s?(.*)$/))) {
            flushPara(); flushList();
            out.push(`<blockquote><p>${inline(m[1])}</p></blockquote>`);
        } else {
            flushList();
            para.push(t);
        }
    }
    flushPara(); flushList();
    return { html: out.join('\n'), headings, text: text.join(' ') };
}

// ---------- banners ----------
let Resvg = null;
try { ({ Resvg } = await import('@resvg/resvg-js')); } catch { /* falls back to SVG banners */ }

const fontFiles = fs.existsSync(FONTS_DIR) ? fs.readdirSync(FONTS_DIR).filter((f) => f.endsWith('.ttf')).map((f) => path.join(FONTS_DIR, f)) : [];
const logoData = `data:image/png;base64,${fs.readFileSync(path.join(ROOT, 'logo.png')).toString('base64')}`;

function wrap(text, maxChars) {
    const lines = [];
    let cur = '';
    for (const word of text.split(/\s+/)) {
        if (cur && (cur + ' ' + word).length > maxChars) { lines.push(cur); cur = word; } else { cur = cur ? `${cur} ${word}` : word; }
    }
    if (cur) lines.push(cur);
    return lines;
}
// Wraps into the fewest lines that fit, then evens out line lengths so the
// last (accent-coloured) line is never a lone orphan word.
function balancedWrap(text, maxChars) {
    const lines = wrap(text, maxChars);
    for (let w = Math.ceil(text.length / lines.length); w <= maxChars; w++) {
        const balanced = wrap(text, w);
        if (balanced.length === lines.length) return balanced;
    }
    return lines;
}
function bannerSvg(post) {
    let size = 64, lines;
    for (size of [64, 56, 50, 44]) {
        lines = balancedWrap(post.title, Math.floor(1000 / (size * 0.56)));
        if (lines.length <= 3) break;
    }
    const lh = Math.round(size * 1.14);
    // Title block vertically centred between the category pill (y≈184) and the footer rule (y=528).
    const blockH = (lines.length - 1) * lh + size;
    const top = Math.round(200 + (328 - blockH) / 2 + size * 0.8);
    const title = lines.map((l, i) => `<text x="80" y="${top + i * lh}" font-family="Sora" font-weight="700" font-size="${size}" fill="${i === lines.length - 1 ? 'url(#acc)' : '#ffffff'}" letter-spacing="-1">${esc(l)}</text>`).join('');
    const cat = esc(post.category.toUpperCase());
    const catW = Math.round(post.category.length * 12.2 + 36);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<defs>
<radialGradient id="core" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#00ffa3" stop-opacity="0.55"/><stop offset="0.45" stop-color="#22d3ee" stop-opacity="0.22"/><stop offset="1" stop-color="#04070b" stop-opacity="0"/></radialGradient>
<radialGradient id="glow2" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#2bb6e0" stop-opacity="0.25"/><stop offset="1" stop-color="#04070b" stop-opacity="0"/></radialGradient>
<linearGradient id="acc" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#00ffa3"/><stop offset="0.55" stop-color="#22d3ee"/><stop offset="1" stop-color="#2bb6e0"/></linearGradient>
<pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" fill="none" stroke="#ffffff" stroke-opacity="0.035" stroke-width="1"/></pattern>
</defs>
<rect width="1200" height="630" fill="#04070b"/>
<rect width="1200" height="630" fill="url(#grid)"/>
<circle cx="1030" cy="300" r="360" fill="url(#core)"/>
<circle cx="140" cy="640" r="320" fill="url(#glow2)"/>
<circle cx="1030" cy="300" r="170" fill="none" stroke="#00ffa3" stroke-opacity="0.28" stroke-width="1.5"/>
<circle cx="1030" cy="300" r="240" fill="none" stroke="#22d3ee" stroke-opacity="0.14" stroke-width="1"/>
<circle cx="1030" cy="300" r="310" fill="none" stroke="#ffffff" stroke-opacity="0.06" stroke-width="1"/>
<image href="${logoData}" x="80" y="54" width="84" height="48"/>
<text x="184" y="86" font-family="JetBrains Mono" font-weight="500" font-size="22" fill="#7c8a97">armenghazaryan.am/blog</text>
<rect x="80" y="146" width="${catW}" height="38" rx="19" fill="#00ffa3" fill-opacity="0.08" stroke="#00ffa3" stroke-opacity="0.45"/>
<text x="98" y="172" font-family="JetBrains Mono" font-weight="500" font-size="18" fill="#00ffa3" letter-spacing="1.5">${cat}</text>
${title}
<rect x="80" y="528" width="1040" height="1" fill="#ffffff" fill-opacity="0.09"/>
<text x="80" y="574" font-family="JetBrains Mono" font-weight="500" font-size="22" fill="#cdd7df">Armen Ghazaryan · Technical Product Owner &amp; Web Developer</text>
<text x="1120" y="574" text-anchor="end" font-family="JetBrains Mono" font-weight="500" font-size="22" fill="#7c8a97">${human(post.date)}</text>
</svg>`;
}
// Returns the public banner path. Only re-renders when the SVG source changed.
function buildBanner(post) {
    const svg = bannerSvg(post);
    const svgRel = `blog/banners/${post.slug}.svg`;
    const pngRel = `blog/banners/${post.slug}.png`;
    const svgPath = path.join(ROOT, svgRel);
    const unchanged = fs.existsSync(svgPath) && fs.readFileSync(svgPath, 'utf8') === svg;
    write(svgRel, svg);
    if (Resvg && (!unchanged || !fs.existsSync(path.join(ROOT, pngRel)))) {
        const png = new Resvg(svg, {
            fitTo: { mode: 'width', value: 1200 },
            font: { fontFiles, loadSystemFonts: fontFiles.length === 0, defaultFontFamily: 'Sora' },
        }).render().asPng();
        write(pngRel, png);
    }
    return fs.existsSync(path.join(ROOT, pngRel)) ? `/${pngRel}` : `/${svgRel}`;
}

// ---------- page chrome ----------
function head({ title, description, canonical, type = 'website', image, imageAlt, keywords = [], article, ld = [] }) {
    const img = image ? `${SITE}${image}` : `${SITE}/headshot.jpeg`;
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}">
    ${keywords.length ? `<meta name="keywords" content="${esc(keywords.join(', '))}">` : ''}
    <meta name="author" content="Armen Ghazaryan">
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
    <link rel="canonical" href="${canonical}">
    <link rel="alternate" type="application/rss+xml" title="Armen Ghazaryan — Blog" href="${SITE}/blog/feed.xml">
    <meta property="og:type" content="${type}">
    <meta property="og:site_name" content="Armen Ghazaryan">
    <meta property="og:locale" content="en_US">
    <meta property="og:url" content="${canonical}">
    <meta property="og:title" content="${esc(title)}">
    <meta property="og:description" content="${esc(description)}">
    <meta property="og:image" content="${img}">
    <meta property="og:image:alt" content="${esc(imageAlt || title)}">
    ${article ? `<meta property="article:published_time" content="${iso(article.date)}">
    <meta property="article:modified_time" content="${iso(article.updated)}">
    <meta property="article:author" content="${SITE}/">
    <meta property="article:section" content="${esc(article.category)}">
    ${article.keywords.map((k) => `<meta property="article:tag" content="${esc(k)}">`).join('\n    ')}` : ''}
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${esc(title)}">
    <meta name="twitter:description" content="${esc(description)}">
    <meta name="twitter:image" content="${img}">
    <link rel="icon" type="image/x-icon" href="/favicon/favicon.ico">
    <link rel="icon" type="image/svg+xml" href="/favicon/favicon.svg">
    <link rel="apple-touch-icon" href="/favicon/apple-touch-icon.png">
    <meta name="theme-color" content="#04070b">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=JetBrains+Mono:wght@400;500&family=Sora:wght@700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/blog/blog.css">
    <script defer src="https://analytics.haylingua.am/script.js" data-website-id="2d00661c-aeea-4d6f-b959-da50a0dc0487"></script>
    ${ld.map(jsonLd).join('\n    ')}
</head>`;
}
function header(active) {
    return `<header class="b-header"><div class="b-wrap b-header-in">
    <a class="b-logo" href="/" aria-label="Armen Ghazaryan — home"><img src="/logo.png" alt="Armen Ghazaryan logo" width="59" height="34"></a>
    <nav class="b-nav" aria-label="Main">
        <a href="/">Home</a>
        <a href="/blog/"${active === 'blog' ? ' aria-current="page"' : ''}>Blog</a>
        <a href="/#projects">Projects</a>
        <a href="/#contact">Contact</a>
    </nav>
</div></header>`;
}
function footer() {
    return `<footer class="b-footer"><div class="b-wrap b-footer-in">
    <span>&copy; ${TODAY.slice(0, 4)} Armen Ghazaryan — Technical Product Owner &amp; Web Developer</span>
    <nav aria-label="Footer">
        <a href="/">armenghazaryan.am</a>
        <a href="/blog/feed.xml">RSS</a>
        <a href="/llms.txt">llms.txt</a>
        <a href="${LINKEDIN}" target="_blank" rel="me noopener">LinkedIn</a>
        <a href="${GITHUB}" target="_blank" rel="me noopener">GitHub</a>
    </nav>
</div></footer>
<script defer src="/_vercel/insights/script.js"></script>
</body>
</html>
`;
}
function card(post, { featured = false, level = 'h3' } = {}) {
    return `<article class="b-card${featured ? ' b-featured' : ''}"><a href="${post.path}">
    <img src="${post.banner}" alt="${esc(post.title)}" width="1200" height="630" loading="${featured ? 'eager' : 'lazy'}" decoding="async">
    <div class="b-card-body">
        <span><span class="b-cat">${esc(post.category)}</span></span>
        <${level}>${esc(post.title)}</${level}>
        <p>${esc(post.description)}</p>
        <span class="b-card-meta"><time datetime="${post.date}">${human(post.date)}</time> · ${post.minutes} min read</span>
    </div>
</a></article>`;
}
const crumbs = (items) => ({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })),
});

// ---------- pages ----------
function postPage(post, related) {
    const toc = post.headings.length >= 4
        ? `<nav class="b-toc" aria-label="Table of contents"><strong>In this post</strong><ul>${post.headings.map((h) => `<li><a href="#${h.id}">${inline(h.text)}</a></li>`).join('')}</ul></nav>`
        : '';
    const ld = [
        {
            '@context': 'https://schema.org',
            '@type': 'BlogPosting',
            '@id': `${post.url}#article`,
            headline: post.title,
            description: post.description,
            image: { '@type': 'ImageObject', url: `${SITE}${post.banner}`, width: 1200, height: 630 },
            datePublished: iso(post.date),
            dateModified: iso(post.updated),
            author: AUTHOR,
            publisher: { '@id': `${SITE}/#person` },
            mainEntityOfPage: { '@type': 'WebPage', '@id': post.url },
            isPartOf: { '@type': 'Blog', '@id': `${SITE}/blog/#blog` },
            articleSection: post.category,
            keywords: post.keywords.join(', '),
            wordCount: post.words,
            inLanguage: 'en',
        },
        crumbs([['Home', `${SITE}/`], ['Blog', `${SITE}/blog/`], [post.title, post.url]]),
    ];
    return `${head({ title: `${post.title} | Armen Ghazaryan`, description: post.description, canonical: post.url, type: 'article', image: post.banner, imageAlt: post.title, keywords: post.keywords, article: post, ld })}
<body>
${header('blog')}
<main class="b-wrap b-narrow">
    <nav class="b-crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><a href="/blog/">Blog</a><span>/</span><span aria-current="page">${esc(post.category)}</span></nav>
    <article>
        <header class="b-post-head">
            <span class="b-cat">${esc(post.category)}</span>
            <h1>${esc(post.title)}</h1>
            <p class="b-lede">${esc(post.description)}</p>
            <div class="b-meta">
                <img src="/headshot.jpeg" alt="Armen Ghazaryan" width="34" height="34">
                <span>By <a href="/" rel="author">Armen Ghazaryan</a></span><span>·</span>
                <time datetime="${post.date}">${human(post.date)}</time><span>·</span>
                <span>${post.minutes} min read</span>
            </div>
        </header>
        <figure class="b-banner"><img src="${post.banner}" alt="${esc(post.title)} — Armen Ghazaryan" width="1200" height="630" fetchpriority="high"></figure>
        ${toc}
        <div class="b-prose">
${post.html}
        </div>
        <aside class="b-author" aria-label="About the author">
            <img src="/headshot.jpeg" alt="Armen Ghazaryan" width="64" height="64" loading="lazy">
            <div>
                <h2>Armen Ghazaryan</h2>
                <p>${AUTHOR_BIO}</p>
                <div class="b-author-links"><a href="/">Portfolio</a><a href="/#contact">Work with me</a><a href="${LINKEDIN}" target="_blank" rel="me noopener">LinkedIn</a><a href="${GITHUB}" target="_blank" rel="me noopener">GitHub</a></div>
            </div>
        </aside>
    </article>
</main>
${related.length ? `<section class="b-wrap b-related" aria-label="More posts"><h2>Keep reading</h2><div class="b-grid">${related.map((p) => card(p)).join('\n')}</div></section>` : ''}
${footer()}`;
}

function indexPage(posts) {
    const description = 'The blog of Armen Ghazaryan — Technical Product Owner (CRM & MarTech) and web developer from Armenia. Notes on product ownership, CRM, SEO and building websites for businesses in Armenia.';
    const ld = [
        {
            '@context': 'https://schema.org',
            '@type': 'Blog',
            '@id': `${SITE}/blog/#blog`,
            name: 'Armen Ghazaryan — Blog',
            url: `${SITE}/blog/`,
            description,
            inLanguage: 'en',
            author: AUTHOR,
            blogPost: posts.map((p) => ({ '@type': 'BlogPosting', headline: p.title, url: p.url, datePublished: iso(p.date), image: `${SITE}${p.banner}` })),
        },
        crumbs([['Home', `${SITE}/`], ['Blog', `${SITE}/blog/`]]),
    ];
    const [first, ...rest] = posts;
    return `${head({ title: 'Blog — Armen Ghazaryan | Product, CRM & Web Development in Armenia', description, canonical: `${SITE}/blog/`, image: first ? first.banner : null, keywords: ['Armen Ghazaryan blog', 'web developer Armenia', 'website development Armenia', 'Technical Product Owner', 'CRM', 'MarTech', 'SEO Armenia'], ld })}
<body>
${header('blog')}
<main class="b-wrap">
    <section class="b-hero">
        <span class="b-tag">// Blog</span>
        <h1>Notes on product, CRM <span class="b-grad">&amp; the web.</span></h1>
        <p>I'm Armen Ghazaryan — a Technical Product Owner for CRM &amp; MarTech and a web developer from Armenia. I write about shipping products, building websites for Armenian businesses, and what I'm learning studying AI in Amsterdam.</p>
    </section>
    <div class="b-grid">
${first ? card(first, { featured: true, level: 'h2' }) : '<p>New posts are on the way.</p>'}
${rest.map((p) => card(p, { level: 'h2' })).join('\n')}
    </div>
</main>
${footer()}`;
}

function feed(posts) {
    const items = posts.map((p) => `    <item>
      <title>${esc(p.title)}</title>
      <link>${p.url}</link>
      <guid isPermaLink="true">${p.url}</guid>
      <pubDate>${rfc822(p.date)}</pubDate>
      <category>${esc(p.category)}</category>
      <description>${esc(p.description)}</description>
    </item>`).join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Armen Ghazaryan — Blog</title>
    <link>${SITE}/blog/</link>
    <atom:link href="${SITE}/blog/feed.xml" rel="self" type="application/rss+xml"/>
    <description>Product ownership, CRM &amp; MarTech, and web development in Armenia — by Armen Ghazaryan.</description>
    <language>en</language>
    ${posts[0] ? `<lastBuildDate>${rfc822(posts[0].date)}</lastBuildDate>` : ''}
${items}
  </channel>
</rss>
`;
}

const GALLERY_IMAGES = [
    ['armen-ghazaryan-headshot.jpeg', 'Armen Ghazaryan headshot'],
    ['armen-ghazaryan-portrait-neon.jpg', 'Armen Ghazaryan portrait with neon lighting'],
    ['armen-ghazaryan-working.jpeg', 'Armen Ghazaryan working at a laptop'],
    ['armen-ghazaryan-traveling.jpg', 'Armen Ghazaryan traveling'],
    ['armen-ghazaryan-evening.png', 'Armen Ghazaryan, evening in Yerevan'],
    ['armen-ghazaryan-casual.jpg', 'Armen Ghazaryan casual photo'],
    ['cuty.jpg', 'Armen Ghazaryan casual close-up portrait'],
];
function sitemap(posts) {
    const latest = posts[0] ? posts[0].date : PAGE_UPDATED.home;
    const max = (a, b) => (a > b ? a : b);
    const url = (loc, lastmod, priority, images = []) => `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <priority>${priority}</priority>${images.map(([src, title]) => `
    <image:image><image:loc>${src}</image:loc><image:title>${esc(title)}</image:title></image:image>`).join('')}
  </url>`;
    return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generated by scripts/build-blog.mjs — edit the script, not this file. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${[
        url(`${SITE}/`, max(PAGE_UPDATED.home, latest), '1.0', [[`${SITE}/headshot.jpeg`, 'Armen Ghazaryan — Technical Product Owner & Web Developer']]),
        url(`${SITE}/blog/`, max(PAGE_UPDATED.home, latest), '0.9'),
        ...posts.map((p) => url(p.url, p.updated, '0.8', [[`${SITE}${p.banner}`, p.title]])),
        url(`${SITE}/gallery.html`, PAGE_UPDATED.gallery, '0.6', GALLERY_IMAGES.map(([f, t]) => [`${SITE}/gallery/${f}`, t])),
        url(`${SITE}/daron-serop/`, PAGE_UPDATED.daron, '0.5'),
    ].join('\n')}
</urlset>
`;
}

function llms(posts) {
    return `# Armen Ghazaryan

> Armen Ghazaryan (also written Ghazaryan Armen) is an Armenian Technical Product Owner for CRM & MarTech at Voveron, a freelance web developer who has built websites and web apps for 50+ clients since 2022, and a BSc Artificial Intelligence student at Vrije Universiteit Amsterdam. He is originally from Yerevan, Armenia, and is now based in Amsterdam, Netherlands.

## Key facts

- Current role: Technical Product Owner, CRM & MarTech at Voveron (July 2026 – present).
- Previously: Product Owner at Playtronix (July 2024 – June 2026), leading a CMS for the iGaming industry, an affiliate-management platform, a CRM and a streaming service; CRM Specialist at Playtronix (July 2023 – June 2024).
- Web development: freelance web developer since March 2022 — 50+ clients, from landing pages to complex web apps, including design, build, SEO and delivery. Works with businesses in Armenia and abroad.
- Founder project: Adrenaline, a business-intelligence platform for the iGaming industry (Power BI, PostgreSQL).
- Skills: product ownership (Scrum, Kanban, Jira), CRM & marketing automation, Python, FastAPI, Flask, PostgreSQL, Docker, SEO and GEO, WebGL and Three.js, Power BI.
- Education: BSc Artificial Intelligence, Vrije Universiteit Amsterdam (2026 – 2029, in progress); IB Diploma, Quantum College, Yerevan.
- Languages: Armenian (native), Russian (native fluency), English (C1, IELTS 7.0), Dutch (A2, learning).
- Contact: ghazaryan.armen238@gmail.com · ${SITE}/#contact

## Pages

- [Portfolio / home](${SITE}/): Projects, experience, skills, education and contact details.
- [Blog](${SITE}/blog/): Writing on product ownership, CRM & MarTech, SEO and web development in Armenia.
- [Gallery](${SITE}/gallery.html): Photos of Armen Ghazaryan.

## Blog posts

${posts.map((p) => `- [${p.title}](${p.url}): ${p.description}`).join('\n') || '- (first posts coming soon)'}

## Optional

- [Full text of every blog post](${SITE}/llms-full.txt)
- [RSS feed](${SITE}/blog/feed.xml)
- [LinkedIn](${LINKEDIN})
- [GitHub](${GITHUB})
`;
}
function llmsFull(posts) {
    return `# Armen Ghazaryan — full blog text

> Every published post from ${SITE}/blog/, newest first. Author: Armen Ghazaryan, Technical Product Owner (CRM & MarTech) and web developer from Armenia.

${posts.map((p) => `---

# ${p.title}

URL: ${p.url}
Published: ${p.date}
Category: ${p.category}

${p.markdown}
`).join('\n')}`;
}

function homepageBlock(posts) {
    const latest = posts.slice(0, 3);
    if (!latest.length) return '';
    const icon = '<svg width="22" height="22" style="flex-shrink:0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>';
    return `
    <!-- ===== FROM THE BLOG (generated by scripts/build-blog.mjs) ===== -->
    <section id="blog" class="section chapter">
        <div class="container">
            <div class="chapter-head reveal-up">
                <span class="section-tag">// FROM THE BLOG</span>
            </div>
            <h2 class="section-title reveal-up">Latest <span class="accent">writing</span></h2>
            <div class="github-grid">
${latest.map((p) => `                <a href="${p.path}" class="github-card reveal-up">
                    <div class="github-header">${icon}<h3>${esc(p.title)}</h3></div>
                    <p>${esc(p.description)}</p>
                    <span class="github-link">${human(p.date)} · Read post →</span>
                </a>`).join('\n')}
            </div>
            <p class="reveal-up" style="margin-top:28px"><a href="/blog/" class="btn btn-outline"><span>All posts</span></a></p>
        </div>
    </section>
    `;
}

// ---------- run ----------
const all = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md')).map((f) => parsePost(path.join(POSTS_DIR, f)));
const slugs = new Set();
for (const p of all) {
    if (slugs.has(p.slug)) throw new Error(`duplicate slug "${p.slug}"`);
    slugs.add(p.slug);
}
const published = all.filter((p) => p.date <= TODAY).sort((a, b) => (b.date + b.slug).localeCompare(a.date + a.slug));
const scheduled = all.filter((p) => p.date > TODAY).sort((a, b) => a.date.localeCompare(b.date));

for (const p of published) p.banner = buildBanner(p);

// Remove pages/banners for posts that are no longer published (renamed, re-dated, deleted).
const keep = new Set(published.map((p) => p.slug));
for (const entry of fs.readdirSync(BLOG_DIR, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name !== 'banners' && !keep.has(entry.name)) {
        fs.rmSync(path.join(BLOG_DIR, entry.name), { recursive: true });
        written.push(`blog/${entry.name}/ (removed)`);
    }
}
const bannerDir = path.join(BLOG_DIR, 'banners');
if (fs.existsSync(bannerDir)) {
    for (const f of fs.readdirSync(bannerDir)) {
        if (!keep.has(f.replace(/\.(png|svg)$/, ''))) { fs.rmSync(path.join(bannerDir, f)); written.push(`blog/banners/${f} (removed)`); }
    }
}

for (const p of published) {
    const related = [...published.filter((o) => o !== p && o.category === p.category), ...published.filter((o) => o !== p && o.category !== p.category)].slice(0, 3);
    write(`blog/${p.slug}/index.html`, postPage(p, related));
}
write('blog/index.html', indexPage(published));
write('blog/feed.xml', feed(published));

const sitemapPath = path.join(ROOT, 'sitemap.xml');
const before = fs.existsSync(sitemapPath) ? new Set([...fs.readFileSync(sitemapPath, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])) : new Set();
const sitemapXml = sitemap(published);
write('sitemap.xml', sitemapXml);
write('llms.txt', llms(published));
write('llms-full.txt', llmsFull(published));

const home = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const homeOut = home.replace(/(<!-- BLOG:LATEST:START -->)[\s\S]*?(<!-- BLOG:LATEST:END -->)/, (_, start, end) => start + homepageBlock(published) + end);
write('index.html', homeOut);

// New URLs for IndexNow (Bing, Yandex, Seznam…) — consumed by the Action.
const added = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).filter((u) => !before.has(u));
if (process.env.INDEXNOW_OUT && added.length) fs.writeFileSync(process.env.INDEXNOW_OUT, added.join('\n') + '\n');

console.log(`Today (UTC): ${TODAY}`);
console.log(`Published: ${published.length} · Scheduled: ${scheduled.length}${Resvg ? '' : ' · (no @resvg/resvg-js: SVG banners only)'}`);
for (const p of scheduled) console.log(`  ⏳ ${p.date}  ${p.slug}`);
console.log(written.length ? `Changed:\n  ${written.join('\n  ')}` : 'No changes.');
