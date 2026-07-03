// ===== 3D HERO CORE =====
// A noise-displaced icosahedron with a fresnel rim glow, a wireframe shell
// and a particle halo. Reacts to mouse + scroll. Degrades gracefully.

import * as THREE from 'three';

const canvas = document.getElementById('hero-canvas');
const hero = document.getElementById('hero');

const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function fail() {
    // Reveal the CSS gradient fallback and bail out cleanly.
    document.body.classList.add('no-3d');
    if (canvas) canvas.style.display = 'none';
    // No 3D intro — let the page reveal itself immediately.
    window.dispatchEvent(new Event('intro-complete'));
}

// Bail if WebGL is unavailable.
try {
    const test = document.createElement('canvas');
    const gl = test.getContext('webgl2') || test.getContext('webgl');
    if (!gl) throw new Error('no-webgl');
} catch (e) {
    fail();
}

if (canvas && !document.body.classList.contains('no-3d')) {
    init();
}

function init() {
    let renderer;
    try {
        renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    } catch (e) {
        fail();
        return;
    }

    const isMobile = window.innerWidth <= 768;
    const DPR = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2);
    renderer.setPixelRatio(DPR);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 6.4);

    const group = new THREE.Group();
    scene.add(group);

    // ---- Core: displaced icosahedron with custom shader ----
    const detail = isMobile ? 24 : 48;
    const geo = new THREE.IcosahedronGeometry(1.35, detail);

    const uniforms = {
        uTime:  { value: 0 },
        uAmp:   { value: 0.0 },          // eased in after load
        uAmpTarget: { value: isMobile ? 0.18 : 0.24 },
        uFreq:  { value: 1.35 },
        uSpeed: { value: 0.32 },
        uMouse: { value: new THREE.Vector2(0, 0) },
        uColorA: { value: new THREE.Color('#00ffa3') }, // neon green
        uColorB: { value: new THREE.Color('#22d3ee') }, // cyan
        uColorC: { value: new THREE.Color('#2bb6e0') }, // violet
        uGlobalAlpha: { value: 1 },
        uFlare: { value: 0 }, // ignition burst during the intro
    };

    // Story palette — the core shifts from green (web roots) toward violet (AI future).
    const C_GREEN  = new THREE.Color('#00ffa3');
    const C_CYAN   = new THREE.Color('#22d3ee');
    const C_VIOLET = new THREE.Color('#2bb6e0');
    const C_BLUE   = new THREE.Color('#3b82f6');
    const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    const lerp = (a, b, t) => a + (b - a) * t;
    const easeOutBack = (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };

    const vertexShader = /* glsl */`
        uniform float uTime;
        uniform float uAmp;
        uniform float uFreq;
        uniform float uSpeed;
        uniform vec2  uMouse;
        varying float vNoise;
        varying vec3  vWorldNormal;
        varying vec3  vViewDir;
        varying vec3  vReflect;

        // Simplex noise 3D — Ashima Arts / Stefan Gustavson
        vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x,289.0);}
        vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
        float snoise(vec3 v){
            const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
            vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
            vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
            vec3 x1=x0-i1+1.0*C.xxx; vec3 x2=x0-i2+2.0*C.xxx; vec3 x3=x0-1.0+3.0*C.xxx;
            i=mod(i,289.0);
            vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
            float n_=1.0/7.0; vec3 ns=n_*D.wyz-D.xzx;
            vec4 j=p-49.0*floor(p*ns.z*ns.z);
            vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
            vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
            vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
            vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
            vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
            vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
            vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
            p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
            vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
            return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
        }

        float dispAmount(vec3 dir, float t){
            float n = snoise(dir * uFreq + t);
            n += 0.5 * snoise(dir * uFreq * 2.1 + t * 1.3);
            return n;
        }

        void main(){
            float t = uTime * uSpeed;
            vec3 dir = normalize(position);
            float R = length(position);
            float mouseLift = (uMouse.x * dir.x + uMouse.y * dir.y) * 0.18;

            float d0 = dispAmount(dir, t);
            vNoise = d0;
            vec3 P = dir * (R + uAmp * d0 + mouseLift);

            // Reconstruct the surface normal AFTER displacement so the bumps catch light.
            vec3 up = mix(vec3(0.0, 1.0, 0.0), vec3(1.0, 0.0, 0.0), step(0.99, abs(dir.y)));
            vec3 tang = normalize(cross(dir, up));
            vec3 bitang = normalize(cross(dir, tang));
            float eps = 0.12;
            vec3 dirA = normalize(dir + tang * eps);
            vec3 dirB = normalize(dir + bitang * eps);
            vec3 PA = dirA * (R + uAmp * dispAmount(dirA, t) + mouseLift);
            vec3 PB = dirB * (R + uAmp * dispAmount(dirB, t) + mouseLift);
            vec3 objNormal = normalize(cross(PA - P, PB - P));
            objNormal *= sign(dot(objNormal, dir) + 1e-5);

            vec4 worldPos = modelMatrix * vec4(P, 1.0);
            vWorldNormal = normalize(mat3(modelMatrix) * objNormal);
            vViewDir = normalize(cameraPosition - worldPos.xyz);
            vReflect = reflect(-vViewDir, vWorldNormal);
            gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
    `;

    const fragmentShader = /* glsl */`
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        uniform vec3 uColorC;
        uniform float uGlobalAlpha;
        uniform float uFlare;
        varying float vNoise;
        varying vec3  vWorldNormal;
        varying vec3  vViewDir;
        varying vec3  vReflect;

        void main(){
            vec3 N = normalize(vWorldNormal);
            vec3 V = normalize(vViewDir);

            // Albedo shifts with the surface noise (cyan -> green).
            float mixv = smoothstep(-1.2, 1.2, vNoise);
            vec3 albedo = mix(uColorB, uColorA, mixv);

            // Key + fill lighting on the displaced surface.
            vec3 L1 = normalize(vec3(0.55, 0.8, 0.55));
            vec3 L2 = normalize(vec3(-0.6, -0.1, 0.25));
            float diff = max(dot(N, L1), 0.0) * 0.95 + max(dot(N, L2), 0.0) * 0.25;
            float ambient = 0.28;

            // Tight specular highlight that sweeps as the core turns.
            vec3 H = normalize(L1 + V);
            float spec = pow(max(dot(N, H), 0.0), 70.0);

            // Procedural environment reflection (ground -> sky gradient).
            float envY = clamp(vReflect.y * 0.5 + 0.5, 0.0, 1.0);
            vec3 envCol = mix(uColorC * 0.35, vec3(0.80, 1.0, 0.92), envY);

            // Fresnel edge.
            float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);

            vec3 color = albedo * (ambient + diff);
            color = mix(color, envCol, 0.22 + 0.18 * fres);
            color += spec * vec3(0.85, 1.0, 0.92) * 1.3;   // glints
            color += fres * uColorA * 0.7;                 // rim glow
            color += uFlare * (0.7 + fres * 1.6);          // ignition

            float alpha = (0.9 + fres * 0.1) * uGlobalAlpha;
            gl_FragColor = vec4(color, alpha);
        }
    `;

    const coreMat = new THREE.ShaderMaterial({
        uniforms, vertexShader, fragmentShader,
        transparent: true,
        blending: THREE.NormalBlending,
        depthWrite: true,
        side: THREE.FrontSide,
    });
    const core = new THREE.Mesh(geo, coreMat);
    group.add(core);

    // ---- Wireframe shell ----
    const wireGeo = new THREE.IcosahedronGeometry(1.62, 1);
    const wireMat = new THREE.MeshBasicMaterial({
        color: 0x00ffa3, wireframe: true, transparent: true, opacity: 0.12,
    });
    const wire = new THREE.Mesh(wireGeo, wireMat);
    group.add(wire);

    // ---- Particle halo ----
    const count = isMobile ? 280 : 650;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        const r = 2.1 + Math.random() * 1.9;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);
    }
    const haloGeo = new THREE.BufferGeometry();
    haloGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const haloMat = new THREE.PointsMaterial({
        color: 0x6df5d0, size: 0.028, transparent: true, opacity: 0.8,
        blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const halo = new THREE.Points(haloGeo, haloMat);
    scene.add(halo);

    // ---- Ignition spark burst (explodes outward when the core arrives) ----
    const SPARKS = isMobile ? 160 : 340;
    const sparkPos = new Float32Array(SPARKS * 3);
    const sparkVel = new Float32Array(SPARKS * 3);
    for (let i = 0; i < SPARKS; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const speed = 3.5 + Math.random() * 7.5;
        sparkVel[i * 3]     = Math.sin(phi) * Math.cos(theta) * speed;
        sparkVel[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * speed;
        sparkVel[i * 3 + 2] = Math.cos(phi) * speed;
    }
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
    const sparkMat = new THREE.PointsMaterial({
        color: 0xbfffe8, size: 0.07, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const sparks = new THREE.Points(sparkGeo, sparkMat);
    sparks.visible = false;
    scene.add(sparks);
    let burstT = -1; // -1 = not started, >=0 = seconds into the burst

    // ---- Interaction state ----
    const mouse = new THREE.Vector2(0, 0);
    const targetMouse = new THREE.Vector2(0, 0);
    let progress = 0;        // 0..1 across the whole document
    let smoothProgress = 0;  // eased version
    let weave = 2.0;         // horizontal travel range (set in resize)
    const caseEl = document.getElementById('adrenaline');
    let caseFocus = 0;       // 0..1 how centred the case study is in view
    let smoothCase = 0;      // eased version

    function onPointer(e) {
        const x = (e.clientX / window.innerWidth) * 2 - 1;
        const y = -((e.clientY / window.innerHeight) * 2 - 1);
        targetMouse.set(x, y);
    }
    window.addEventListener('pointermove', onPointer, { passive: true });

    function updateProgress() {
        const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        progress = Math.min(1, Math.max(0, window.scrollY / max));
        if (caseEl) {
            const r = caseEl.getBoundingClientRect();
            const vh = window.innerHeight || 1;
            const centerDist = Math.abs((r.top + r.bottom) * 0.5 - vh * 0.5) / vh;
            caseFocus = Math.max(0, 1 - centerDist * 1.3); // peaks when the section is centred
        }
    }
    window.addEventListener('scroll', updateProgress, { passive: true });

    // ---- Drag-to-rotate: grab the core directly, over the hero or the case study ----
    // Mouse-only (touch is left alone so page scrolling on phones is never hijacked).
    let dragging = false;
    let dragOffsetX = 0;               // accumulated manual tilt (persists across frames)
    const dragVel = { x: 0, y: 0 };    // per-frame spin — decays via friction once released
    const lastDragPt = { x: 0, y: 0 };
    const dragZones = [document.getElementById('hero'), document.querySelector('.case-study')].filter(Boolean);

    function beginDrag(e) {
        if (e.pointerType && e.pointerType !== 'mouse') return;
        if (e.button !== undefined && e.button !== 0) return;
        if (e.target.closest('a, button, .btn')) return;
        dragging = true;
        lastDragPt.x = e.clientX; lastDragPt.y = e.clientY;
        document.body.classList.add('core-grabbing');
    }
    function duringDrag(e) {
        if (!dragging) return;
        dragVel.y = (e.clientX - lastDragPt.x) * 0.006;
        dragVel.x = (e.clientY - lastDragPt.y) * 0.006;
        lastDragPt.x = e.clientX; lastDragPt.y = e.clientY;
    }
    function endDrag() {
        dragging = false;
        document.body.classList.remove('core-grabbing');
    }
    dragZones.forEach(function (zone) {
        zone.classList.add('core-drag-zone');
        zone.addEventListener('pointerdown', beginDrag);
    });
    window.addEventListener('pointermove', duringDrag);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);

    // ---- Sizing ----
    function resize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        // Narrow screens: keep the core close to centre with a smaller travel range.
        weave = w > 760 ? Math.min(2.6, w / 460) : 0.6;
        updateProgress();
    }
    window.addEventListener('resize', resize);
    resize();

    // ---- Render loop ----
    const clock = new THREE.Clock();
    const INTRO_DUR = prefersReduced ? 0.2 : 2.8; // seconds — the core "opens" the page
    let introDone = false;
    let ignited = false;

    function frame() {
        const dt = clock.getDelta();
        const t = clock.elapsedTime;

        // Intro timeline: the core rushes in from the depths, ignites, then settles.
        const introP = Math.min(1, t / INTRO_DUR);
        const introE = introP < 0.5 ? 4 * introP * introP * introP : 1 - Math.pow(-2 * introP + 2, 3) / 2;

        // Cinematic dolly: camera pulls from far away to its resting distance.
        camera.position.z = lerp(13.0, 6.4, introE);

        // Ignition burst — a flare at the moment the core arrives.
        const flare = Math.max(0, 1 - Math.abs(introP - 0.4) / 0.22);
        uniforms.uFlare.value = prefersReduced ? 0 : flare;
        if (!ignited && introP >= 0.38) {
            ignited = true;
            document.body.classList.add('intro-ignite'); // fires the CSS flash
            if (!prefersReduced) { burstT = 0; sparks.visible = true; } // launch the spark explosion
        }

        // Animate the spark explosion (outward, fading) + a quick camera shake.
        let shake = 0;
        if (burstT >= 0) {
            burstT += dt;
            const bp = burstT / 1.1;
            if (bp >= 1) {
                sparks.visible = false; burstT = -2;
            } else {
                const e = 1 - Math.pow(1 - bp, 3); // ease-out outward
                const sp = sparkGeo.attributes.position.array;
                for (let i = 0; i < SPARKS; i++) {
                    sp[i * 3]     = sparkVel[i * 3]     * e * 0.55;
                    sp[i * 3 + 1] = sparkVel[i * 3 + 1] * e * 0.55;
                    sp[i * 3 + 2] = sparkVel[i * 3 + 2] * e * 0.55;
                }
                sparkGeo.attributes.position.needsUpdate = true;
                sparkMat.opacity = (1 - bp) * 0.95;
                sparkMat.size = 0.07 * (1 - bp * 0.6);
                sparks.position.copy(group.position); // emanate from the core
                if (bp < 0.28) shake = (1 - bp / 0.28) * 0.16;
            }
        }
        camera.position.x = shake ? (Math.random() - 0.5) * shake : 0;
        camera.position.y = shake ? (Math.random() - 0.5) * shake : 0;

        // ease the displacement in on load (with an intro surge for energy)
        uniforms.uAmp.value += (uniforms.uAmpTarget.value - uniforms.uAmp.value) * 0.02;
        if (introP < 1 && !prefersReduced) {
            uniforms.uAmp.value = lerp(0.62, uniforms.uAmpTarget.value, introE);
        }

        mouse.lerp(targetMouse, 0.06);
        uniforms.uMouse.value.copy(mouse);
        uniforms.uTime.value = prefersReduced ? 0 : t;

        // ease the scroll progress so the core glides between story beats
        smoothProgress += (progress - smoothProgress) * 0.08;
        smoothCase += (caseFocus - smoothCase) * 0.07;
        const p = smoothProgress;
        const cf = smoothCase;

        // ---- The journey: weave the core across the page as you scroll ----
        // right (hero) → centre → left → centre → right, drifting and changing depth.
        let px = Math.cos(p * Math.PI * 2) * weave + mouse.x * 0.25;
        // While the case study is centred, draw the core in behind the panel.
        px = lerp(px, mouse.x * 0.2, cf * 0.85);
        const py = Math.sin(p * Math.PI * 3) * 0.55 + mouse.y * 0.15;
        const pz = Math.sin(p * Math.PI * 2) * 0.6;
        // Blend from centre-stage (intro) to the scroll-driven position.
        const ix = lerp(0.0, px, introE);
        const iy = lerp(0.0, py, introE);
        const iz = lerp(1.2, pz, introE);
        group.position.set(ix, iy, iz);
        halo.position.set(ix * 0.92, iy * 0.92, iz);

        // Manual drag spin — accumulates while grabbed, decays like real momentum after release.
        dragOffsetX += dragVel.x;
        if (!dragging) { dragVel.x *= 0.94; dragVel.y *= 0.94; }

        const spin = prefersReduced ? 0 : 0.12;
        group.rotation.y += dt * spin * (1 + (1 - introE) * 4 + cf * (isMobile ? 1.2 : 2.6)) + dragVel.y; // spins up while forming or in focus
        group.rotation.x = mouse.y * 0.2 + p * 0.6 + dragOffsetX;
        group.rotation.z = p * 0.5;
        wire.rotation.y -= dt * spin * 1.6;
        wire.rotation.z += dt * 0.04;
        halo.rotation.y += dt * 0.03;

        // ---- Scale: pops up from nothing on intro, then settles ----
        const enter = smoothstep(0.0, 0.13, p);
        const baseScale = 1.0 - 0.16 * enter - 0.05 * Math.sin(p * Math.PI);
        const introScale = prefersReduced ? introE : Math.max(0.02, easeOutBack(introP));
        // On phones the core is smaller and swells less, so text stays the star.
        group.scale.setScalar(baseScale * introScale * (1 + cf * (isMobile ? 0.08 : 0.22)) * (isMobile ? 0.82 : 1.0));
        // particles converge inward from a wide cloud as the core forms
        const haloConverge = lerp(3.4, 1.0, introE);
        halo.scale.setScalar((1.0 + p * 0.5) * haloConverge);

        // ---- Colour story: green → cyan → blue as the page moves toward "AI" ----
        const toViolet = smoothstep(0.35, 1.0, p);
        const toBlue   = smoothstep(0.15, 0.85, p);
        uniforms.uColorA.value.copy(C_GREEN).lerp(C_VIOLET, toViolet * 0.85);
        uniforms.uColorB.value.copy(C_CYAN).lerp(C_BLUE, toBlue * 0.7);

        // ---- Presence: fades in on intro, bold in hero, ambient afterwards ----
        // Phones settle to a fainter ambient level so the core never fights the text.
        const ambient = isMobile ? 0.4 : 0.55;
        const cfPresence = isMobile ? 0.12 : 0.3;
        const ga = Math.min(1.0, lerp(1.0, ambient, smoothstep(0.02, 0.16, p)) + cf * cfPresence);
        const introAlpha = Math.min(1, introP * 2.2);
        const dim = isMobile ? lerp(1.0, 0.6, Math.min(1, introP)) : 1.0; // keep the intro bright, calm it after
        uniforms.uGlobalAlpha.value = ga * introAlpha * dim;
        haloMat.opacity = 0.8 * ga * introAlpha * dim;
        wireMat.opacity = 0.12 * ga * introAlpha * dim;

        // Hand off to the page once the core reaches its hero position.
        if (!introDone && introP >= 1) {
            introDone = true;
            window.dispatchEvent(new Event('intro-complete'));
        }

        renderer.render(scene, camera);
        requestAnimationFrame(frame);
    }
    frame();

    // Pause rendering when the hero is fully scrolled past (saves battery).
    // (Loop keeps running but it's cheap; kept simple for reliability.)
}
