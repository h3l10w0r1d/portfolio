# Blog content

Posts live in `posts/` as Markdown with front matter:

```
---
title: Post title
slug: url-slug              # → https://armenghazaryan.am/blog/url-slug/
date: 2026-12-19            # publish date (UTC); future dates stay unpublished
category: Web Development
description: One or two sentences — used for Google, social cards and llms.txt.
keywords: comma, separated, keywords
updated: 2027-01-05         # optional — set when you meaningfully edit a post
---

Body in Markdown: ## and ### headings, paragraphs, - lists, 1. lists,
> quotes, **bold**, *italic*, `code` and [links](https://example.com).
```

**Scheduling:** `.github/workflows/publish-blog.yml` runs every day at 06:00 UTC.
Any post whose `date` has arrived gets built, its banner rendered, and the blog,
sitemap, RSS feed, llms.txt and homepage "From the blog" block updated and
committed — Vercel then deploys it. To publish now instead, run the workflow
manually from the Actions tab (or run `node scripts/build-blog.mjs` and push).

This folder is excluded from the Vercel deployment (`.vercelignore`), so
scheduled posts aren't reachable on the live site before their date. The repo
is public, though, so they are visible on GitHub.

Preview a future date locally: `BLOG_TODAY=2026-12-31 node scripts/build-blog.mjs`
(then rebuild without it before committing).
