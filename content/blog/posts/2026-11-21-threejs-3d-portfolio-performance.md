---
title: "How I Built a 3D Portfolio with Three.js — and Kept It Fast on Weak Laptops"
slug: threejs-3d-portfolio-performance
date: 2026-11-21
category: Engineering
description: The story behind the WebGL hero on armenghazaryan.am — a custom Three.js shader, GSAP scroll effects and a D3 graph — and the performance fixes that stopped it lagging and heating laptops.
keywords: Three.js portfolio, WebGL performance, Three.js performance tips, GSAP ScrollTrigger performance, 3D website Armenia, creative web developer Armenia, Armen Ghazaryan
---

My portfolio at [armenghazaryan.am](https://armenghazaryan.am/) opens with a 3D core: a glowing, noise-displaced shape that flies in, ignites, and then follows you down the page as you scroll. People like it. Weak laptops, at first, did not.

This is how it's built, what went wrong, and the fixes that made it smooth — useful if you're putting WebGL on a site that real people visit.

## The stack

- **Three.js** for the 3D hero: an icosahedron with a custom shader that displaces its surface with simplex noise, reconstructs normals so the bumps catch light, and adds a fresnel rim glow and a soft procedural reflection. A particle halo and a spark burst complete the intro.
- **GSAP + ScrollTrigger** for scroll-linked parallax and a "spotlight" effect in the case-study section.
- **D3-force** for an interactive skills graph you can drag and zoom.

All three libraries are served from my own domain instead of a CDN, so an ad blocker or a CDN outage can't take the effects down.

## Problem 1: it never stopped rendering

The first version rendered at full cost forever — even when the tab was in the background, and even when nothing on screen was changing. On a weak machine that means fans spinning and a hot laptop.

The fixes:

- **Pause on hidden tabs.** Listen to `visibilitychange` and cancel the `requestAnimationFrame` loop when the document is hidden. Do the same for any 2D canvas effects.
- **Skip frames when calm.** Once the intro is done and the user isn't dragging or scrolling into a focus section, the scene is a slow ambient drift. Rendering every second (or third) frame looks identical and halves the GPU work.
- **Cap the pixel ratio.** A device pixel ratio of 3 renders nine times the pixels of 1. Capping it around 1.5–1.75 is visually almost free.
- **Scale geometry and particles.** Fewer subdivisions and particles on mobile and low-power devices.

## Problem 2: detecting "weak" devices is harder than it looks

My first heuristic treated any machine with four or fewer CPU cores as weak. Safari limits what `navigator.hardwareConcurrency` reports for privacy reasons, so powerful Macs were suddenly getting the low-quality version.

The better rule: only treat a device as weak when a very low core count is **corroborated** — for example by low `deviceMemory`, or when that API isn't available to contradict it. Never let one fingerprint-limited number decide quality.

## Problem 3: jank during the intro

The intro stuttered even on good machines. Three culprits, all competing for the main thread at the worst moment:

1. **A loading bar animating `width`.** That triggers layout every frame. Animating `transform: scaleX()` instead is compositor-only and stays smooth.
2. **A physics simulation nobody could see.** D3's force simulation starts ticking the instant it's created — even though the graph sat far below the fold. Now it's frozen on creation and only started by an `IntersectionObserver` when the section approaches the viewport.
3. **Dozens of ScrollTriggers created on load.** Each one measures layout. Deferring their creation until the intro finished removed a big synchronous layout burst.

## Problem 4: the bug that removed the 3D entirely

At one point the 3D vanished for everyone. I chased GPU context loss, CDNs and Safari quirks — all real things worth handling — but the actual cause was one line in the browser console:

> Cannot access 'lowPower' before initialization

A `const` was read by a function that ran *before* the line declaring it — JavaScript's temporal dead zone. The module crashed on every load, in every browser. Moving the declaration up fixed it instantly.

The lesson I keep relearning: **read the console before forming theories.**

## Problem 5: don't play the intro behind the curtain

I added a short loading screen so fonts and scripts could settle before the intro. But the 3D animation started on script load — so it played, invisibly, behind the loading screen and was already finished by the time the page appeared. Now the scene builds everything during loading but only starts its clock when the page is revealed.

## The checklist I'd give anyone adding WebGL to a website

- Pause when hidden; skip frames when nothing changes.
- Cap pixel ratio; scale detail by device — carefully.
- Animate `transform` and `opacity`, not layout properties.
- Don't run invisible work: start below-the-fold effects lazily.
- Self-host your libraries.
- Handle `webglcontextlost` and keep a non-3D fallback.
- Keep the real content in HTML so search engines never depend on the canvas.

If you want a website with a little more wow — without melting your visitors' laptops — [let's talk](https://armenghazaryan.am/#contact). And if SEO is your bigger worry, start with my [technical SEO checklist for Armenian business websites](/blog/technical-seo-checklist-armenia/).
