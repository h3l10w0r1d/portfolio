// ===== INTERACTIVE SKILLS GRAPH (D3-force) =====
// Progressive enhancement: parses the real .skill-category / .skill-item
// markup (the accessible, no-JS, SEO-visible source of truth) into a
// force-directed node graph, using D3 for the physics (with proper
// collision avoidance), drag, and zoom/pan. If D3 fails to load, or
// anything here throws, the plain list under #skills-grid-fallback simply
// stays visible — nothing is ever hidden until this has successfully mounted.

(function () {
    if (!window.d3) return;

    const container = document.getElementById('skills-graph');
    const fallback = document.getElementById('skills-grid-fallback');
    if (!container || !fallback) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isMobile = window.innerWidth <= 760;

    // ---- 1. Build the dataset from the real DOM (single source of truth) ----
    const categories = [...fallback.querySelectorAll('.skill-category')];
    if (!categories.length) return;

    // Palette stays within the site's green/cyan/blue family — no purple.
    const PALETTE = ['#00ffa3', '#22d3ee', '#3b82f6', '#2dd4bf', '#34d399', '#38bdf8'];

    const nodes = [];
    const links = [];
    const leafByLabel = new Map();

    categories.forEach((cat, i) => {
        const title = cat.querySelector('.skill-cat-title');
        if (!title) return;
        const color = PALETTE[i % PALETTE.length];
        const hubId = 'hub:' + i;
        nodes.push({ id: hubId, label: title.textContent.trim(), isHub: true, color: color });

        [...cat.querySelectorAll('.skill-item')].forEach((item, j) => {
            const label = item.textContent.trim();
            if (!label) return;
            const leafId = 'leaf:' + i + ':' + j;
            nodes.push({ id: leafId, label: label, isHub: false, color: color });
            links.push({ source: hubId, target: leafId, dist: 70, k: 0.9 });
            leafByLabel.set(label, leafId);
        });
    });

    // Hub-to-hub backbone so the whole graph reads as one connected network.
    for (let i = 0; i < categories.length; i++) {
        links.push({ source: 'hub:' + i, target: 'hub:' + ((i + 1) % categories.length), dist: 260, k: 0.25 });
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
        const a = leafByLabel.get(pair[0]), b = leafByLabel.get(pair[1]);
        if (a && b) links.push({ source: a, target: b, dist: 130, k: 0.15 });
    });

    if (nodes.length < 3) return;

    nodes.forEach(function (n) {
        n.r = n.isHub
            ? Math.max(34, Math.min(60, 18 + n.label.length * 0.95))
            : Math.max(20, Math.min(46, 11 + n.label.length * 0.95));
    });

    // Precompute neighbours for hover highlighting.
    const neighbours = new Map();
    nodes.forEach(function (n) { neighbours.set(n.id, new Set()); });
    links.forEach(function (l) {
        neighbours.get(l.source).add(l.target);
        neighbours.get(l.target).add(l.source);
    });

    // ---- 2. Build the SVG ----
    let width = container.clientWidth || 900;
    let height = container.clientHeight || 720;

    const svg = d3.select(container).append('svg')
        .attr('viewBox', [0, 0, width, height])
        .attr('preserveAspectRatio', 'xMidYMid meet');

    // Subtle glow filter, applied only to hub nodes (cheap enough at n=6).
    const defs = svg.append('defs');
    const glow = defs.append('filter').attr('id', 'sg-glow').attr('x', '-60%').attr('y', '-60%').attr('width', '220%').attr('height', '220%');
    glow.append('feGaussianBlur').attr('stdDeviation', 4).attr('result', 'blur');
    const merge = glow.append('feMerge');
    merge.append('feMergeNode').attr('in', 'blur');
    merge.append('feMergeNode').attr('in', 'SourceGraphic');

    const world = svg.append('g').attr('class', 'sg-world');
    const linkGroup = world.append('g').attr('class', 'sg-links');
    const nodeGroup = world.append('g').attr('class', 'sg-nodes');

    // Seed positions: hubs in a ring, leaves jittered near their hub — gives
    // the simulation a head start toward readable category clusters.
    const cx = width / 2, cy = height / 2;
    const ringR = Math.min(width, height) * 0.34;
    categories.forEach(function (cat, i) {
        const angle = (i / categories.length) * Math.PI * 2 - Math.PI / 2;
        const hub = nodes.find(function (n) { return n.id === 'hub:' + i; });
        hub.x = cx + Math.cos(angle) * ringR;
        hub.y = cy + Math.sin(angle) * ringR;
    });
    nodes.forEach(function (n) {
        if (n.isHub) return;
        const hub = nodes.find(function (h) { return h.id === 'hub:' + n.id.split(':')[1]; });
        const a = Math.random() * Math.PI * 2, r = 40 + Math.random() * 60;
        n.x = hub.x + Math.cos(a) * r;
        n.y = hub.y + Math.sin(a) * r;
    });

    // ---- 3. Render elements ----
    const linkSel = linkGroup.selectAll('line').data(links).enter().append('line').attr('class', 'sg-link');

    const nodeSel = nodeGroup.selectAll('g').data(nodes).enter().append('g')
        .attr('class', function (d) { return 'sg-node ' + (d.isHub ? 'sg-hub' : 'sg-leaf'); });

    nodeSel.append('circle')
        .attr('r', function (d) { return d.r; })
        .attr('fill', function (d) { return d.isHub ? d.color + '2a' : d.color + '1f'; })
        .attr('stroke', function (d) { return d.isHub ? d.color : d.color + '80'; })
        .attr('stroke-width', function (d) { return d.isHub ? 1.8 : 1; })
        .style('filter', function (d) { return d.isHub ? 'url(#sg-glow)' : null; });

    nodeSel.append('text')
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
        .attr('font-size', function (d) { return d.isHub ? 13 : 11; })
        .attr('font-weight', function (d) { return d.isHub ? 700 : 400; })
        .style('fill', function (d) { return d.isHub ? d.color : 'var(--text)'; })
        .text(function (d) { return d.label; });

    // ---- 4. Force simulation — D3 handles repulsion/springs/centring, and
    // crucially forceCollide(), which the earlier hand-rolled version lacked
    // and is why labels were stacking on top of each other. ----
    const simulation = d3.forceSimulation(nodes)
        .force('charge', d3.forceManyBody().strength(function (d) { return d.isHub ? -1100 : -260; }).distanceMax(420))
        .force('link', d3.forceLink(links).id(function (d) { return d.id; }).distance(function (d) { return d.dist; }).strength(function (d) { return d.k; }))
        .force('collide', d3.forceCollide().radius(function (d) { return d.r + (d.isHub ? 14 : 8); }).strength(0.95).iterations(3))
        .force('x', d3.forceX(cx).strength(0.03))
        .force('y', d3.forceY(cy).strength(0.03))
        .alphaDecay(prefersReduced ? 0.08 : 0.02)
        .on('tick', function () {
            linkSel.attr('x1', function (d) { return d.source.x; }).attr('y1', function (d) { return d.source.y; })
                   .attr('x2', function (d) { return d.target.x; }).attr('y2', function (d) { return d.target.y; });
            nodeSel.attr('transform', function (d) { return 'translate(' + d.x + ',' + d.y + ')'; });
        });

    // ---- 5. Drag to explore ----
    let dragging = false;
    nodeSel.call(d3.drag()
        .on('start', function (event, d) {
            if (!event.active) simulation.alphaTarget(0.25).restart();
            d.fx = d.x; d.fy = d.y;
            dragging = true;
            container.classList.add('is-dragging');
            highlight(d);
        })
        .on('drag', function (event, d) {
            d.fx = event.x; d.fy = event.y;
        })
        .on('end', function (event, d) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null; d.fy = null;
            dragging = false;
            container.classList.remove('is-dragging');
            clearHighlight();
        }));

    // ---- 6. Hover highlight ----
    function clearHighlight() {
        nodeSel.classed('sg-lit', false).classed('sg-dim', false);
        linkSel.classed('sg-lit', false);
    }
    function highlight(d) {
        const near = neighbours.get(d.id);
        nodeSel.classed('sg-lit', function (m) { return m === d || near.has(m.id); })
               .classed('sg-dim', function (m) { return m !== d && !near.has(m.id); });
        linkSel.classed('sg-lit', function (l) { return l.source.id === d.id || l.target.id === d.id; });
    }
    nodeSel.on('pointerenter', function (event, d) { if (!dragging) highlight(d); })
           .on('pointerleave', function () { if (!dragging) clearHighlight(); });

    // ---- 7. Zoom / pan — plain wheel still scrolls the page; only
    // Ctrl/Cmd+wheel or pinch zoom the graph, and a single touch pans the
    // page as normal (two-finger touch is needed to engage the graph). ----
    const zoom = d3.zoom()
        .scaleExtent([0.45, 2.5])
        .filter(function (event) {
            if (event.type === 'wheel') return event.ctrlKey || event.metaKey;
            if (event.touches) return event.touches.length > 1;
            return !event.button;
        })
        .on('zoom', function (event) { world.attr('transform', event.transform); });
    svg.call(zoom);
    const controls = container.querySelector('.skills-graph-controls');
    if (controls) {
        controls.addEventListener('click', function (e) {
            const btn = e.target.closest('.sg-zoom-btn');
            if (!btn) return;
            const action = btn.getAttribute('data-zoom');
            if (action === 'in') zoom.scaleBy(svg, 1.35);
            else if (action === 'out') zoom.scaleBy(svg, 1 / 1.35);
            else zoom.transform(svg, d3.zoomIdentity);
        });
    }

    // ---- 8. Resize ----
    let resizeTimer = null;
    window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () {
            const w = container.clientWidth, h = container.clientHeight;
            if (!w || !h) return;
            width = w; height = h;
            svg.attr('viewBox', [0, 0, width, height]);
        }, 200);
    });

    // ---- 9. Go live ----
    document.body.classList.add('skills-graph-ready');
    container.classList.add('is-ready');
    container.removeAttribute('aria-hidden');
})();
