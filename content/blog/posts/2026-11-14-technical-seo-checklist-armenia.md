---
title: A Technical SEO Checklist for Armenian Business Websites
slug: technical-seo-checklist-armenia
date: 2026-11-14
category: SEO
description: A practical technical SEO checklist for businesses in Armenia — crawlable pages, Armenian/Russian/English versions, structured data, Google Business Profile, speed, and getting found by AI search.
keywords: SEO Armenia, technical SEO Armenia, SEO for Armenian businesses, multilingual SEO Armenian Russian English, hreflang Armenia, Google Business Profile Yerevan, web developer Armenia, Armen Ghazaryan
---

Most small business websites in Armenia don't have a content problem — they have a plumbing problem. Google can't crawl them properly, the Russian and English versions compete with each other, or the site takes eight seconds to load on mobile data. Fix the plumbing and the content you already have starts working.

This is the checklist I use when building or auditing a site. You don't need to be a developer to run through it, but your developer should be able to answer every item.

## 1. Make sure Google can actually read your pages

- Your important content should be in the **HTML**, not only drawn by JavaScript after the page loads.
- Every page needs a unique `<title>` and a meta description written for humans.
- Use one clear `<h1>` per page, then logical `<h2>`/`<h3>` headings.
- Avoid putting key text inside images — Google can't read your beautiful banner.

## 2. robots.txt and a sitemap

- `robots.txt` should **allow** crawling of your real pages and point to your sitemap.
- `sitemap.xml` should list every page you want indexed, with accurate last-modified dates.
- Submit the sitemap in **Google Search Console** and **Bing Webmaster Tools**. It's free and it's the single most useful SEO tool you'll ever open.

## 3. Get multilingual right: Armenian, Russian, English

This is where most Armenian sites lose rankings.

- Give each language its **own URL**, for example `/hy/`, `/ru/` and `/en/` — not a toggle that swaps text on the same address.
- Add `hreflang` tags so Google knows which version to show to whom (`hy`, `ru`, `en`, plus `x-default`).
- Set the correct `lang` attribute on each page.
- Translate titles and descriptions too, not just body text.
- Keep URL slugs readable — Latin transliteration such as `/hy/tsarayutyunner/` is usually more robust to share than encoded Armenian characters.

## 4. Claim your Google Business Profile

For local searches like "dentist Yerevan" or "coffee Gyumri", the map results often matter more than the website. Claim and verify your **Google Business Profile**, use the same name, address and phone everywhere, choose accurate categories, add real photos, and link to your website.

## 5. Add structured data

Structured data (JSON-LD) tells search engines what your page *is*:

- `LocalBusiness` (or a more specific type) with address, phone and opening hours,
- `Product` and `Offer` for online stores,
- `Article` or `BlogPosting` for blog posts,
- `BreadcrumbList` for site navigation,
- `Person` for a personal or founder site.

Validate it with Google's Rich Results Test. It won't fix a weak page, but it helps strong pages stand out.

## 6. Speed on real mobile connections

- Compress and resize images; serve modern formats where possible.
- Set `width` and `height` on images so the layout doesn't jump.
- Don't load five analytics scripts and three chat widgets on every page.
- Check **Core Web Vitals** in Search Console and PageSpeed Insights — on mobile, not just desktop.

When I rebuilt my own 3D portfolio I went through this exercise the hard way; I'll write about it in a separate post.

## 7. HTTPS, one canonical domain, clean URLs

- Serve everything over **HTTPS**.
- Pick one version — `example.am` or `www.example.am` — and redirect the other.
- Use `rel="canonical"` to avoid duplicate pages.
- Keep URLs short, lowercase and descriptive.

## 8. Internal links and a blog

Link your service pages to each other and from your homepage. A blog with genuinely useful articles — answering the questions your customers actually ask — gives Google more reasons to rank you and gives visitors more reasons to trust you.

## 9. Be visible to AI search, too

More people now ask ChatGPT, Perplexity or Google's AI answers instead of scrolling results. A few things help (often called GEO — generative engine optimisation):

- clear, factual "about" information on your site,
- consistent business details across the web,
- allowing reputable AI crawlers in `robots.txt`,
- an `llms.txt` file that summarises who you are and links your key pages.

## 10. Measure, then repeat

Connect Google Analytics or a privacy-friendly alternative, watch Search Console for errors and queries, and revisit this checklist every few months.

## Need a hand?

I'm Armen Ghazaryan, a web developer from Armenia who builds sites with SEO baked in from day one. If you'd like an audit or a new website, [get in touch](https://armenghazaryan.am/#contact). Planning a budget? Read [what drives website development costs in Armenia](/blog/website-development-cost-armenia/).
