// ===== GSAP SCROLL EFFECTS =====
// Purely additive parallax/scrub layer on top of the existing CSS reveals.
// If GSAP fails to load, the site renders exactly as before — nothing here
// hides content (every target is already visible without GSAP).

(function () {
    if (!window.gsap || !window.ScrollTrigger) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    gsap.registerPlugin(ScrollTrigger);

    // Parallax helper — drifts an element on a transform-only scrub.
    function parallax(selector, fromY, toY, opts) {
        opts = opts || {};
        gsap.utils.toArray(selector).forEach(function (el) {
            const trigger = (opts.trigger && el.closest(opts.trigger)) || el.closest('.section') || el.closest('#hero') || el;
            gsap.fromTo(el, { y: fromY }, {
                y: toY,
                ease: 'none',
                scrollTrigger: { trigger: trigger, start: 'top bottom', end: 'bottom top', scrub: opts.scrub || true }
            });
        });
    }

    // Big outlined chapter numbers float for depth.
    parallax('.chapter-index', 50, -50);

    // Ghost project numbers drift gently.
    parallax('.project-number', 26, -26);

    // The "What's Next" glow slides as the section passes.
    parallax('.next-glow', -40, 80, { trigger: '#next' });

    // Story photo moves a touch slower than the text beside it.
    parallax('.story-photo', 40, -40, { trigger: '#about' });

    // Section tag lines slide in horizontally on scrub.
    gsap.utils.toArray('.chapter-head .section-tag').forEach(function (el) {
        gsap.fromTo(el, { x: -24, opacity: 0.4 }, {
            x: 0, opacity: 1, ease: 'power2.out',
            scrollTrigger: { trigger: el, start: 'top 92%', end: 'top 60%', scrub: true }
        });
    });

    // Hero content drifts up and softens as you scroll past it (the 3D core
    // already reacts to scroll; this layers the foreground on top).
    gsap.to('.hero-inner', {
        yPercent: -14,
        opacity: 0.6,
        ease: 'none',
        scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true }
    });

    // Subtle stagger emphasis when a grid scrolls into view (cards are already
    // shown by the CSS reveal — this just adds a little spring on top).
    ['.projects-grid', '.skills-grid', '.edu-grid', '.github-grid', '.hobbies-grid'].forEach(function (gridSel) {
        const grid = document.querySelector(gridSel);
        if (!grid) return;
        const cards = grid.children;
        ScrollTrigger.create({
            trigger: grid,
            start: 'top 80%',
            once: true,
            onEnter: function () {
                gsap.from(cards, {
                    y: 26,
                    duration: 0.7,
                    ease: 'power3.out',
                    stagger: 0.06,
                    clearProps: 'transform'
                });
            }
        });
    });

    // Keep triggers accurate once fonts/images settle.
    window.addEventListener('load', function () { ScrollTrigger.refresh(); });
})();
