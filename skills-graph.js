// ===== INTERACTIVE SKILLS GRAPH =====
// Progressive enhancement: parses the real .skill-category / .skill-item
// markup (the accessible, no-JS, SEO-visible source of truth) into a small
// force-directed node graph. If anything here fails, the plain list under
// #skills-grid-fallback simply stays visible — nothing is ever hidden until
// this has successfully mounted.

(function () {
    const container = document.getElementById('skills-graph');
    const fallback = document.getElementById('skills-grid-fallback');
    if (!container || !fallback) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ---- 1. Build the dataset from the real DOM (single source of truth) ----
    const categories = [...fallback.querySelectorAll('.skill-category')];
    if (!categories.length) return;

    const nodes = [];
    const links = [];
    const leafByLabel = new Map();

    categories.forEach((cat, i) => {
        const title = cat.querySelector('.skill-cat-title');
        if (!title) return;
        const hubId = 'hub:' + i;
        const hub = { id: hubId, label: title.textContent.trim(), isHub: true };
        nodes.push(hub);

        const items = [...cat.querySelectorAll('.skill-item')];
        items.forEach((item, j) => {
            const label = item.textContent.trim();
            if (!label) return;
            const leafId = 'leaf:' + i + ':' + j;
            nodes.push({ id: leafId, label: label, isHub: false });
            links.push({ source: hubId, target: leafId, dist: 115, k: 0.045 });
            leafByLabel.set(label, leafId);
        });
    });

    // Hub-to-hub backbone so the whole graph reads as one connected network.
    for (let i = 0; i < categories.length; i++) {
        const a = 'hub:' + i;
        const b = 'hub:' + ((i + 1) % categories.length);
        links.push({ source: a, target: b, dist: 300, k: 0.012 });
    }

    // A handful of hand-picked cross-category bridges — real relationships,
    // not an exhaustive hairball.
    const bridges = [
        ['Business Intelligence', 'Business Analysis'],
        ['Python', 'Machine Learning'],
        ['FastAPI', 'REST APIs'],
        ['Google Analytics', 'SEO'],
        ['Power BI', 'CRM'],
    ];
    bridges.forEach(function (pair) {
        const a = leafByLabel.get(pair[0]);
        const b = leafByLabel.get(pair[1]);
        if (a && b) links.push({ source: a, target: b, dist: 150, k: 0.02 });
    });

    if (nodes.length < 3) return;

    // ---- 2. Build the SVG ----
    let width = container.clientWidth || 900;
    let height = container.clientHeight || 620;
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    const linkGroup = document.createElementNS(svgNS, 'g');
    const nodeGroup = document.createElementNS(svgNS, 'g');
    svg.appendChild(linkGroup);
    svg.appendChild(nodeGroup);
    container.appendChild(svg);

    const byId = new Map();
    nodes.forEach(function (n) {
        n.r = n.isHub
            ? Math.max(32, Math.min(58, 16 + n.label.length * 0.9))
            : Math.max(18, Math.min(44, 9 + n.label.length * 0.85));
        byId.set(n.id, n);
    });

    // Seed positions: hubs in a ring, leaves jittered near their hub — gives
    // the simulation a head start toward readable category clusters instead
    // of untangling from pure randomness.
    const cx = width / 2, cy = height / 2;
    const ringR = Math.min(width, height) * 0.32;
    categories.forEach(function (cat, i) {
        const angle = (i / categories.length) * Math.PI * 2 - Math.PI / 2;
        const hub = byId.get('hub:' + i);
        hub.x = cx + Math.cos(angle) * ringR;
        hub.y = cy + Math.sin(angle) * ringR;
    });
    nodes.forEach(function (n) {
        if (n.isHub) return;
        const hubId = 'hub:' + n.id.split(':')[1];
        const hub = byId.get(hubId);
        const a = Math.random() * Math.PI * 2;
        const r = 50 + Math.random() * 70;
        n.x = hub.x + Math.cos(a) * r;
        n.y = hub.y + Math.sin(a) * r;
        n.vx = 0; n.vy = 0;
    });
    nodes.forEach(function (n) { n.vx = n.vx || 0; n.vy = n.vy || 0; });

    // ---- 3. Render elements ----
    links.forEach(function (l) {
        l.el = document.createElementNS(svgNS, 'line');
        l.el.setAttribute('class', 'sg-link');
        linkGroup.appendChild(l.el);
    });
    nodes.forEach(function (n) {
        const g = document.createElementNS(svgNS, 'g');
        g.setAttribute('class', 'sg-node ' + (n.isHub ? 'sg-hub' : 'sg-leaf'));
        const circle = document.createElementNS(svgNS, 'circle');
        circle.setAttribute('r', n.r);
        const text = document.createElementNS(svgNS, 'text');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'central');
        text.textContent = n.label;
        g.appendChild(circle);
        g.appendChild(text);
        nodeGroup.appendChild(g);
        n.el = g;
        n.circleEl = circle;
    });

    // Precompute each node's connected neighbours for hover highlighting.
    const neighbours = new Map();
    nodes.forEach(function (n) { neighbours.set(n.id, new Set()); });
    links.forEach(function (l) {
        neighbours.get(l.source).add(l.target);
        neighbours.get(l.target).add(l.source);
    });

    // ---- 4. Force simulation (vanilla — repulsion + springs + centering) ----
    let alpha = 1;
    const ALPHA_DECAY = prefersReduced ? 0.94 : 0.992;
    const REPEL_K = 5200;
    const CENTER_K = 0.012;
    const DAMPING = 0.82;
    const PAD = 40;
    let rafId = null;
    let dragging = null;

    function tick() {
        if (alpha < 0.002) { rafId = null; return; }

        // Repulsion between every pair (n is small — ~45 nodes — so O(n^2) is fine).
        for (let i = 0; i < nodes.length; i++) {
            const a = nodes[i];
            if (a === dragging) continue;
            let fx = 0, fy = 0;
            for (let j = 0; j < nodes.length; j++) {
                if (i === j) continue;
                const b = nodes[j];
                let dx = a.x - b.x, dy = a.y - b.y;
                let d2 = dx * dx + dy * dy;
                if (d2 < 1) d2 = 1;
                const force = REPEL_K / d2;
                const d = Math.sqrt(d2);
                fx += (dx / d) * force;
                fy += (dy / d) * force;
            }
            // Gentle pull toward centre so the graph doesn't drift off-canvas.
            fx += (cx - a.x) * CENTER_K;
            fy += (cy - a.y) * CENTER_K;
            a.vx = (a.vx + fx * alpha * 0.02) * DAMPING;
            a.vy = (a.vy + fy * alpha * 0.02) * DAMPING;
        }

        // Springs along links.
        links.forEach(function (l) {
            const a = byId.get(l.source), b = byId.get(l.target);
            let dx = b.x - a.x, dy = b.y - a.y;
            let d = Math.sqrt(dx * dx + dy * dy) || 1;
            const diff = (d - l.dist) * l.k * alpha;
            const nx = (dx / d) * diff, ny = (dy / d) * diff;
            if (a !== dragging) { a.vx += nx; a.vy += ny; }
            if (b !== dragging) { b.vx -= nx; b.vy -= ny; }
        });

        nodes.forEach(function (n) {
            if (n === dragging) return;
            n.x += n.vx;
            n.y += n.vy;
            n.x = Math.max(PAD + n.r, Math.min(width - PAD - n.r, n.x));
            n.y = Math.max(PAD + n.r, Math.min(height - PAD - n.r, n.y));
        });

        render();
        alpha *= ALPHA_DECAY;
        rafId = requestAnimationFrame(tick);
    }

    function render() {
        links.forEach(function (l) {
            const a = byId.get(l.source), b = byId.get(l.target);
            l.el.setAttribute('x1', a.x); l.el.setAttribute('y1', a.y);
            l.el.setAttribute('x2', b.x); l.el.setAttribute('y2', b.y);
        });
        nodes.forEach(function (n) {
            n.el.setAttribute('transform', 'translate(' + n.x + ',' + n.y + ')');
        });
    }

    function wake(strength) {
        alpha = Math.max(alpha, strength);
        if (!rafId) rafId = requestAnimationFrame(tick);
    }

    // ---- 5. Drag to explore ----
    let pointerId = null;
    function toLocal(e) {
        const rect = svg.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) * (width / rect.width),
            y: (e.clientY - rect.top) * (height / rect.height)
        };
    }
    nodes.forEach(function (n) {
        n.el.addEventListener('pointerdown', function (e) {
            e.preventDefault();
            dragging = n;
            pointerId = e.pointerId;
            container.classList.add('is-dragging');
            highlight(n);
            wake(0.5);
        });
    });
    window.addEventListener('pointermove', function (e) {
        if (!dragging || e.pointerId !== pointerId) return;
        const p = toLocal(e);
        dragging.x = Math.max(PAD + dragging.r, Math.min(width - PAD - dragging.r, p.x));
        dragging.y = Math.max(PAD + dragging.r, Math.min(height - PAD - dragging.r, p.y));
        dragging.vx = 0; dragging.vy = 0;
        wake(0.3);
        render();
    });
    function endDrag() {
        dragging = null;
        pointerId = null;
        container.classList.remove('is-dragging');
        clearHighlight();
    }
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);

    // ---- 6. Hover highlight ----
    function clearHighlight() {
        nodes.forEach(function (n) { n.el.classList.remove('sg-lit', 'sg-dim'); });
        links.forEach(function (l) { l.el.classList.remove('sg-lit'); });
    }
    function highlight(n) {
        const near = neighbours.get(n.id);
        nodes.forEach(function (m) {
            if (m === n || near.has(m.id)) { m.el.classList.add('sg-lit'); m.el.classList.remove('sg-dim'); }
            else { m.el.classList.add('sg-dim'); m.el.classList.remove('sg-lit'); }
        });
        links.forEach(function (l) {
            l.el.classList.toggle('sg-lit', l.source === n.id || l.target === n.id);
        });
    }
    nodes.forEach(function (n) {
        n.el.addEventListener('pointerenter', function () { if (!dragging) highlight(n); });
        n.el.addEventListener('pointerleave', function () { if (!dragging) clearHighlight(); });
    });

    // ---- 7. Resize ----
    let resizeTimer = null;
    window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () {
            const w = container.clientWidth, h = container.clientHeight;
            if (!w || !h) return;
            width = w; height = h;
            svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
            wake(0.25);
        }, 200);
    });

    // ---- 8. Go live ----
    render();
    wake(1);
    document.body.classList.add('skills-graph-ready');
    container.classList.add('is-ready');
    container.removeAttribute('aria-hidden');
})();
