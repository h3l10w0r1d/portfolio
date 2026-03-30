// ===== PARTICLE SYSTEM =====
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
    constructor() {
        this.reset();
    }

    reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2 + 0.5;
        this.speedX = (Math.random() - 0.5) * 0.4;
        this.speedY = (Math.random() - 0.5) * 0.4;
        this.opacity = Math.random() * 0.5 + 0.1;
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;

        // Mouse interaction
        const dx = mouse.x - this.x;
        const dy = mouse.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 150) {
            const force = (150 - dist) / 150;
            this.x -= dx * force * 0.02;
            this.y -= dy * force * 0.02;
        }

        if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) {
            this.reset();
        }
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 255, 136, ${this.opacity})`;
        ctx.fill();
    }
}

// Create particles
const particleCount = Math.min(80, Math.floor(window.innerWidth / 15));
for (let i = 0; i < particleCount; i++) {
    particles.push(new Particle());
}

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
                ctx.strokeStyle = `rgba(0, 255, 136, ${0.06 * (1 - dist / 120)})`;
                ctx.lineWidth = 0.5;
                ctx.stroke();
            }
        }
    }
}

function animateParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
        p.update();
        p.draw();
    });
    drawConnections();
    requestAnimationFrame(animateParticles);
}
animateParticles();

// ===== CURSOR GLOW =====
const cursorGlow = document.getElementById('cursor-glow');
document.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    cursorGlow.style.left = e.clientX + 'px';
    cursorGlow.style.top = e.clientY + 'px';
});

// ===== NAVBAR SCROLL =====
const navbar = document.getElementById('navbar');
let lastScroll = 0;

window.addEventListener('scroll', () => {
    const currentScroll = window.scrollY;
    if (currentScroll > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
    lastScroll = currentScroll;
});

// ===== SMOOTH SCROLL NAV LINKS =====
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const target = document.querySelector(link.getAttribute('href'));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});

// ===== TYPING EFFECT =====
const titles = [
    'Product Owner @ Playtronix',
    'CRM Specialist',
    'Web Developer',
    'IB Student — Quantum College',
    'Yerevan, Armenia'
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
        typingSpeed = 2000; // Pause at end
        isDeleting = true;
    } else if (isDeleting && charIndex === 0) {
        isDeleting = false;
        titleIndex = (titleIndex + 1) % titles.length;
        typingSpeed = 500; // Pause before next word
    }

    setTimeout(typeEffect, typingSpeed);
}

// Start typing after a short delay
setTimeout(typeEffect, 1000);

// ===== SCROLL REVEAL =====
const revealElements = document.querySelectorAll('.reveal-up');

const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            revealObserver.unobserve(entry.target);
        }
    });
}, {
    threshold: 0.05,
    rootMargin: '0px 0px -20px 0px'
});

revealElements.forEach(el => revealObserver.observe(el));

// Trigger hero reveals immediately on load
window.addEventListener('load', () => {
    document.querySelectorAll('#hero .reveal-up').forEach((el, i) => {
        setTimeout(() => el.classList.add('revealed'), 200 + i * 150);
    });

    // Fallback: reveal any elements still hidden after 3s
    setTimeout(() => {
        document.querySelectorAll('.reveal-up:not(.revealed)').forEach(el => {
            const rect = el.getBoundingClientRect();
            if (rect.top < window.innerHeight + 200) {
                el.classList.add('revealed');
            }
        });
    }, 3000);
});

// ===== COUNTER ANIMATION =====
const counters = document.querySelectorAll('.stat-number');

const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const target = parseInt(entry.target.getAttribute('data-count'));
            animateCounter(entry.target, target);
            counterObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.5 });

counters.forEach(counter => counterObserver.observe(counter));

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
    }, 40);
}

// ===== ACTIVE NAV LINK HIGHLIGHT =====
const sections = document.querySelectorAll('.section');
const navLinks = document.querySelectorAll('.nav-link');

const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const id = entry.target.getAttribute('id');
            navLinks.forEach(link => {
                link.style.color = '';
                if (link.getAttribute('href') === '#' + id) {
                    link.style.color = '#00ff88';
                }
            });
        }
    });
}, { threshold: 0.3 });

sections.forEach(section => sectionObserver.observe(section));

// ===== MAGNETIC BUTTON EFFECT =====
document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        btn.style.transform = `translate(${x * 0.15}px, ${y * 0.15}px)`;
    });

    btn.addEventListener('mouseleave', () => {
        btn.style.transform = '';
    });
});

// ===== SKILL ITEM TILT =====
document.querySelectorAll('.skill-category').forEach(card => {
    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        card.style.transform = `perspective(600px) rotateY(${x * 5}deg) rotateX(${-y * 5}deg) translateY(-4px)`;
    });

    card.addEventListener('mouseleave', () => {
        card.style.transform = '';
    });
});

// ===== PARALLAX ON HERO DECORATIONS =====
window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    const decorations = document.querySelectorAll('.photo-decoration');
    decorations.forEach((dec, i) => {
        dec.style.transform = `translateY(${scrollY * (0.05 + i * 0.02)}px)`;
    });
});

// ===== PRELOADER =====
const preloader = document.getElementById('preloader');
const preloaderVideo = document.getElementById('preloader-video');

function dismissPreloader() {
    preloader.classList.add('ending');
    setTimeout(() => {
        preloader.classList.add('hidden');
        document.body.classList.remove('preloading');
    }, 1300);
}

const isMobile = window.innerWidth <= 768;

if (isMobile) {
    // Skip preloader entirely on mobile
    preloader.classList.add('hidden');
    document.body.classList.remove('preloading');
} else if (preloaderVideo) {
    preloaderVideo.addEventListener('ended', dismissPreloader);
    // Fallback: if video fails to load or takes too long
    preloaderVideo.addEventListener('error', dismissPreloader);
    setTimeout(() => {
        if (!preloader.classList.contains('hidden')) dismissPreloader();
    }, 8000);
} else {
    dismissPreloader();
}

// ===== SCROLL PROGRESS BAR =====
const scrollProgress = document.getElementById('scroll-progress');
window.addEventListener('scroll', () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    scrollProgress.style.width = pct + '%';
}, { passive: true });

// ===== HAMBURGER / MOBILE MENU =====
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobile-menu');

hamburger.addEventListener('click', () => {
    const isOpen = mobileMenu.classList.toggle('open');
    hamburger.classList.toggle('open', isOpen);
    hamburger.setAttribute('aria-expanded', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
});

document.querySelectorAll('.mobile-nav-link').forEach(link => {
    link.addEventListener('click', () => {
        mobileMenu.classList.remove('open');
        hamburger.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
        const target = document.querySelector(link.getAttribute('href'));
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
});

// ===== VISITOR COUNTER =====
// Single shared key — works across armenghazaryan.am and vercel preview
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
    const existing = document.getElementById('matrix-rain');
    if (existing) return;

    const mc = document.createElement('canvas');
    mc.id = 'matrix-rain';
    Object.assign(mc.style, {
        position: 'fixed', inset: '0', zIndex: '9997',
        pointerEvents: 'none', opacity: '0',
        transition: 'opacity 0.6s ease'
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
        chars.forEach((_, i) => {
            const char = chars[Math.floor(Math.random() * chars.length)];
            const brightness = Math.random() > 0.95 ? '#ffffff' : '#00ff88';
            mctx.fillStyle = brightness;
            mctx.font = `${fontSize}px 'JetBrains Mono', monospace`;
            mctx.fillText(char, drops[i] * fontSize, drops[i] * fontSize);
            // wait — correct column rendering
            mctx.fillText(char, i * fontSize, drops[i] * fontSize);
            if (drops[i] * fontSize > mc.height && Math.random() > 0.975) drops[i] = 0;
            drops[i] += 0.5;
        });
    }, 40);

    // Show secret message mid-animation
    setTimeout(() => {
        mctx.fillStyle = 'rgba(0,0,0,0.7)';
        mctx.fillRect(mc.width / 2 - 220, mc.height / 2 - 40, 440, 80);
        mctx.fillStyle = '#00ff88';
        mctx.font = "bold 18px 'JetBrains Mono', monospace";
        mctx.textAlign = 'center';
        mctx.fillText('// you found the easter egg, legend 🐉', mc.width / 2, mc.height / 2 - 10);
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
    'background: #00ff88; color: #0a0a0a; font-weight: bold; padding: 4px 8px; border-radius: 4px 0 0 4px;',
    'background: #161616; color: #00ff88; padding: 4px 8px; border-radius: 0 4px 4px 0; border: 1px solid #00ff88;'
);
