// ===== PARTICLE SYSTEM (ambient 2D background) =====
const canvas = document.getElementById('particles');
const ctx = canvas.getContext('2d');
let particles = [];
let mouse = { x: -1000, y: -1000 };

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

class Particle {
    constructor() { this.reset(); }
    reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 1.8 + 0.4;
        this.speedX = (Math.random() - 0.5) * 0.35;
        this.speedY = (Math.random() - 0.5) * 0.35;
        this.opacity = Math.random() * 0.4 + 0.1;
    }
    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        const dx = mouse.x - this.x;
        const dy = mouse.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 150) {
            const force = (150 - dist) / 150;
            this.x -= dx * force * 0.02;
            this.y -= dy * force * 0.02;
        }
        if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) this.reset();
    }
    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 255, 163, ${this.opacity})`;
        ctx.fill();
    }
}

const lowPower = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4)
    || (navigator.deviceMemory && navigator.deviceMemory <= 4);
const particleCount = Math.min(lowPower ? 36 : 70, Math.floor(window.innerWidth / 18));
for (let i = 0; i < particleCount; i++) particles.push(new Particle());

function drawConnections() {
    for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
            const dx = particles[i].x - particles[j].x;
            const dy = particles[i].y - particles[j].y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 120) {
                ctx.beginPath();
                ctx.moveTo(particles[i].x, particles[i].y);
                ctx.lineTo(particles[j].x, particles[j].y);
                ctx.strokeStyle = `rgba(0, 255, 163, ${0.05 * (1 - dist / 120)})`;
                ctx.lineWidth = 0.5;
                ctx.stroke();
            }
        }
    }
}

let particlesRafId = null;
function animateParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => { p.update(); p.draw(); });
    drawConnections();
    particlesRafId = requestAnimationFrame(animateParticles);
}
animateParticles();

// Stop burning CPU on this canvas while the tab is in the background.
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        if (particlesRafId) cancelAnimationFrame(particlesRafId);
        particlesRafId = null;
    } else if (!particlesRafId) {
        animateParticles();
    }
});

// ===== CURSOR GLOW =====
const cursorGlow = document.getElementById('cursor-glow');
document.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    cursorGlow.style.left = e.clientX + 'px';
    cursorGlow.style.top = e.clientY + 'px';
});

// ===== CUSTOM PRECISION CURSOR (dot snaps to the pointer, ring trails it) =====
// Only activates once a real mouse movement is seen, so touch devices (which
// can fire a single synthetic mousemove) never get stuck with cursor:none.
const cursorDot = document.getElementById('cursor-dot');
const cursorRing = document.getElementById('cursor-ring');
if (cursorDot && cursorRing && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    let activated = false;
    let ringX = 0, ringY = 0;
    const HOVER_SELECTOR = 'a, button, .btn, .project-card, .github-card, .skill-item, .timeline-card, .social-link, .contact-link, input, textarea, .rail-dot';

    document.addEventListener('mousemove', (e) => {
        if (!activated) { activated = true; document.body.classList.add('cursor-ready'); }
        cursorDot.style.left = e.clientX + 'px';
        cursorDot.style.top = e.clientY + 'px';
        const hovering = e.target.closest && e.target.closest(HOVER_SELECTOR);
        cursorRing.classList.toggle('cursor-hover', !!hovering && !document.body.classList.contains('core-grabbing'));
    });

    (function trailRing() {
        ringX += (parseFloat(cursorDot.style.left || 0) - ringX) * 0.18;
        ringY += (parseFloat(cursorDot.style.top || 0) - ringY) * 0.18;
        cursorRing.style.left = ringX + 'px';
        cursorRing.style.top = ringY + 'px';
        requestAnimationFrame(trailRing);
    })();

    // The 3D core's own drag state (scene.js) gets a distinct ring treatment.
    new MutationObserver(() => {
        cursorRing.classList.toggle('cursor-drag', document.body.classList.contains('core-grabbing'));
    }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
}

// ===== NAVBAR SCROLL =====
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 50);
}, { passive: true });

// ===== SMOOTH SCROLL FOR IN-PAGE ANCHORS =====
// A custom eased scroll reads more premium than native `scrollIntoView` smooth
// behaviour, which varies by browser and feels linear/abrupt on arrival.
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);

function smoothScrollTo(targetY, duration = 900) {
    const startY = window.scrollY;
    const delta = targetY - startY;
    const startTime = performance.now();
    function tick(now) {
        const t = Math.min(1, (now - startTime) / duration);
        // behavior:'auto' is required here — html has scroll-behavior:smooth
        // globally, which would otherwise let the browser's own native easing
        // fight this custom easing on every frame, causing lag/overshoot.
        window.scrollTo({ top: startY + delta * easeOutCubic(t), left: 0, behavior: 'auto' });
        if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

// Covers nav links, chapter-rail dots, the scroll indicator — anything href="#..."
document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        if (!href || href === '#') return;
        const target = document.querySelector(href);
        if (target) {
            e.preventDefault();
            const navH = navbar ? navbar.offsetHeight : 0;
            const targetY = Math.max(0, target.getBoundingClientRect().top + window.scrollY - navH - 12);
            smoothScrollTo(targetY);
        }
    });
});

// ===== TYPING EFFECT =====
const titles = [
    'Technical Product Owner',
    'Product Owner @ Playtronix',
    'Web Developer',
    'CRM Specialist',
    'AI/ML Student — Amsterdam ’26',
    'Builder from Yerevan'
];

let titleIndex = 0;
let charIndex = 0;
let isDeleting = false;
let typingSpeed = 80;
const typedText = document.getElementById('typed-text');

function typeEffect() {
    const currentTitle = titles[titleIndex];
    if (isDeleting) {
        typedText.textContent = currentTitle.substring(0, charIndex - 1);
        charIndex--;
        typingSpeed = 40;
    } else {
        typedText.textContent = currentTitle.substring(0, charIndex + 1);
        charIndex++;
        typingSpeed = 80;
    }
    if (!isDeleting && charIndex === currentTitle.length) {
        typingSpeed = 2000;
        isDeleting = true;
    } else if (isDeleting && charIndex === 0) {
        isDeleting = false;
        titleIndex = (titleIndex + 1) % titles.length;
        typingSpeed = 500;
    }
    setTimeout(typeEffect, typingSpeed);
}
if (typedText) setTimeout(typeEffect, 1000);

// ===== SCROLL REVEAL =====
const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            revealObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.05, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.reveal-up').forEach(el => revealObserver.observe(el));

// The hero entrance is handled by the intro (revealSite). This only acts as a
// safety net to reveal any near-viewport elements still hidden a few seconds in.
window.addEventListener('load', () => {
    setTimeout(() => {
        document.querySelectorAll('.reveal-up:not(.revealed)').forEach(el => {
            const rect = el.getBoundingClientRect();
            if (rect.top < window.innerHeight + 200) el.classList.add('revealed');
        });
    }, 3500);
});

// ===== COUNTER ANIMATION =====
const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            animateCounter(entry.target, parseInt(entry.target.getAttribute('data-count')));
            counterObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.5 });

document.querySelectorAll('.stat-number').forEach(c => counterObserver.observe(c));

function animateCounter(element, target) {
    let current = 0;
    const increment = target / 40;
    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            element.textContent = target;
            clearInterval(timer);
        } else {
            element.textContent = Math.ceil(current);
        }
    }, 35);
}

// ===== ACTIVE SECTION → NAV LINK + CHAPTER RAIL =====
const navLinks = document.querySelectorAll('.nav-link');
const railDots = document.querySelectorAll('.rail-dot');

const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const id = entry.target.getAttribute('id');
            const hash = '#' + id;
            navLinks.forEach(l => l.classList.toggle('active', l.getAttribute('href') === hash));
            railDots.forEach(d => d.classList.toggle('active', d.getAttribute('href') === hash));
        }
    });
}, { threshold: 0.4 });

document.querySelectorAll('section[id]').forEach(s => sectionObserver.observe(s));

// ===== MAGNETIC BUTTON EFFECT =====
document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        btn.style.transform = `translate(${x * 0.12}px, ${y * 0.12}px)`;
    });
    btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
});

// ===== SKILL CARD TILT =====
document.querySelectorAll('.skill-category').forEach(card => {
    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        card.style.transform = `perspective(600px) rotateY(${x * 5}deg) rotateX(${-y * 5}deg) translateY(-4px)`;
    });
    card.addEventListener('mouseleave', () => { card.style.transform = ''; });
});

// ===== INTRO / REVEAL =====
// The 3D core (scene.js) plays an opening animation and dispatches
// 'intro-complete'; we then fade the veil and bring the hero in.
const preloader = document.getElementById('preloader');
let siteRevealed = false;

function revealSite() {
    if (siteRevealed) return;
    siteRevealed = true;

    if (preloader) preloader.classList.add('ending');
    document.body.classList.remove('preloading');

    // staggered hero entrance, synced with the veil fade
    document.querySelectorAll('#hero .reveal-up').forEach((el, i) => {
        setTimeout(() => el.classList.add('revealed'), 120 + i * 110);
    });

    setTimeout(() => {
        if (preloader) preloader.classList.add('hidden');
        document.body.classList.remove('intro'); // core drops behind the content
    }, 900);
}

if (!preloader) {
    // Pages without the intro veil (e.g. gallery) reveal immediately.
    document.body.classList.remove('preloading');
    document.body.classList.remove('intro');
} else {
    window.addEventListener('intro-complete', revealSite);
    // Safety net: never stay stuck on the veil if the 3D never reports in.
    setTimeout(revealSite, 6000);
}

// ===== SCROLL PROGRESS BAR =====
const scrollProgress = document.getElementById('scroll-progress');
if (scrollProgress) {
    window.addEventListener('scroll', () => {
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const pct = docHeight > 0 ? (window.scrollY / docHeight) * 100 : 0;
        scrollProgress.style.width = pct + '%';
    }, { passive: true });
}

// ===== HAMBURGER / MOBILE MENU =====
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobile-menu');

if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => {
        const isOpen = mobileMenu.classList.toggle('open');
        hamburger.classList.toggle('open', isOpen);
        hamburger.setAttribute('aria-expanded', isOpen);
        document.body.style.overflow = isOpen ? 'hidden' : '';
    });
}

document.querySelectorAll('.mobile-nav-link').forEach(link => {
    link.addEventListener('click', () => {
        mobileMenu.classList.remove('open');
        hamburger.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
    });
});

// ===== VISITOR COUNTER =====
fetch('https://api.counterapi.dev/v1/armen-ghazaryan/portfolio/up')
    .then(r => r.json())
    .then(data => {
        const el = document.querySelector('.visitor-count');
        if (el && data.count) el.textContent = data.count.toLocaleString();
    })
    .catch(() => {});

// ===== EASTER EGG — type "armen" anywhere =====
let eggBuffer = '';
document.addEventListener('keydown', (e) => {
    eggBuffer = (eggBuffer + e.key.toLowerCase()).slice(-6);
    if (eggBuffer.includes('armen')) {
        eggBuffer = '';
        triggerMatrixRain();
    }
});

function triggerMatrixRain() {
    if (document.getElementById('matrix-rain')) return;

    const mc = document.createElement('canvas');
    mc.id = 'matrix-rain';
    Object.assign(mc.style, {
        position: 'fixed', inset: '0', zIndex: '9997',
        pointerEvents: 'none', opacity: '0', transition: 'opacity 0.6s ease'
    });
    document.body.appendChild(mc);

    mc.width = window.innerWidth;
    mc.height = window.innerHeight;
    const mctx = mc.getContext('2d');
    requestAnimationFrame(() => mc.style.opacity = '0.85');

    const chars = 'ARMENGHAZARYAN₿⟠◈⬡01アイウエオカキクケコ'.split('');
    const fontSize = 15;
    const cols = Math.floor(mc.width / fontSize);
    const drops = Array(cols).fill(0).map(() => Math.random() * -50);

    const interval = setInterval(() => {
        mctx.fillStyle = 'rgba(0,0,0,0.05)';
        mctx.fillRect(0, 0, mc.width, mc.height);
        for (let i = 0; i < cols; i++) {
            const char = chars[Math.floor(Math.random() * chars.length)];
            mctx.fillStyle = Math.random() > 0.95 ? '#ffffff' : '#00ffa3';
            mctx.font = `${fontSize}px 'JetBrains Mono', monospace`;
            mctx.fillText(char, i * fontSize, drops[i] * fontSize);
            if (drops[i] * fontSize > mc.height && Math.random() > 0.975) drops[i] = 0;
            drops[i] += 0.5;
        }
    }, 40);

    setTimeout(() => {
        mctx.fillStyle = 'rgba(0,0,0,0.7)';
        mctx.fillRect(mc.width / 2 - 220, mc.height / 2 - 40, 440, 80);
        mctx.fillStyle = '#00ffa3';
        mctx.font = "bold 18px 'JetBrains Mono', monospace";
        mctx.textAlign = 'center';
        mctx.fillText('// you found the easter egg, legend', mc.width / 2, mc.height / 2 - 10);
        mctx.fillStyle = '#888';
        mctx.font = "14px 'JetBrains Mono', monospace";
        mctx.fillText('armenghazaryan.am — built different', mc.width / 2, mc.height / 2 + 18);
        mctx.textAlign = 'left';
    }, 1500);

    setTimeout(() => {
        clearInterval(interval);
        mc.style.opacity = '0';
        setTimeout(() => mc.remove(), 700);
    }, 5000);
}

// ===== CONSOLE EASTER EGG =====
console.log(
    '%c AG %c Armen Ghazaryan — armenghazaryan.am ',
    'background: #00ffa3; color: #04070b; font-weight: bold; padding: 4px 8px; border-radius: 4px 0 0 4px;',
    'background: #0a0f14; color: #00ffa3; padding: 4px 8px; border-radius: 0 4px 4px 0; border: 1px solid #00ffa3;'
);
