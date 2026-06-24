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
        uColorC: { value: new THREE.Color('#7c5cff') }, // violet
        uGlobalAlpha: { value: 1 },
    };

    // Story palette — the core shifts from green (web roots) toward violet (AI future).
    const C_GREEN  = new THREE.Color('#00ffa3');
    const C_CYAN   = new THREE.Color('#22d3ee');
    const C_VIOLET = new THREE.Color('#7c5cff');
    const C_BLUE   = new THREE.Color('#3b82f6');
    const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    const lerp = (a, b, t) => a + (b - a) * t;

    const vertexShader = /* glsl */`
        uniform float uTime;
        uniform float uAmp;
        uniform float uFreq;
        uniform float uSpeed;
        uniform vec2  uMouse;
        varying float vNoise;
        varying vec3  vWorldNormal;
        varying vec3  vViewDir;

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

        void main(){
            float t = uTime * uSpeed;
            float n = snoise(normal * uFreq + t);
            n += 0.5 * snoise(normal * uFreq * 2.1 + t * 1.3);
            vNoise = n;
            float mouseLift = (uMouse.x * normal.x + uMouse.y * normal.y) * 0.18;
            vec3 displaced = position + normal * (n * uAmp + mouseLift);
            vec4 worldPos = modelMatrix * vec4(displaced, 1.0);
            vWorldNormal = normalize(mat3(modelMatrix) * normal);
            vViewDir = normalize(cameraPosition - worldPos.xyz);
            gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
    `;

    const fragmentShader = /* glsl */`
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        uniform vec3 uColorC;
        uniform float uGlobalAlpha;
        varying float vNoise;
        varying vec3  vWorldNormal;
        varying vec3  vViewDir;

        void main(){
            float fres = pow(1.0 - max(dot(vWorldNormal, vViewDir), 0.0), 2.4);
            float mixv = smoothstep(-1.0, 1.0, vNoise);
            vec3 base = mix(uColorB, uColorA, mixv);          // cyan -> green by noise
            vec3 col  = mix(base, uColorC, fres * 0.6);       // violet rim
            col += fres * 0.5;                                // glow boost
            float alpha = (0.42 + fres * 0.5) * uGlobalAlpha;
            gl_FragColor = vec4(col, alpha);
        }
    `;

    const coreMat = new THREE.ShaderMaterial({
        uniforms, vertexShader, fragmentShader,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
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

    // ---- Interaction state ----
    const mouse = new THREE.Vector2(0, 0);
    const targetMouse = new THREE.Vector2(0, 0);
    let progress = 0;        // 0..1 across the whole document
    let smoothProgress = 0;  // eased version
    let weave = 2.0;         // horizontal travel range (set in resize)

    function onPointer(e) {
        const x = (e.clientX / window.innerWidth) * 2 - 1;
        const y = -((e.clientY / window.innerHeight) * 2 - 1);
        targetMouse.set(x, y);
    }
    window.addEventListener('pointermove', onPointer, { passive: true });

    function updateProgress() {
        const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        progress = Math.min(1, Math.max(0, window.scrollY / max));
    }
    window.addEventListener('scroll', updateProgress, { passive: true });

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

    function frame() {
        const dt = clock.getDelta();
        const t = clock.elapsedTime;

        // ease the displacement in on load
        uniforms.uAmp.value += (uniforms.uAmpTarget.value - uniforms.uAmp.value) * 0.02;

        mouse.lerp(targetMouse, 0.06);
        uniforms.uMouse.value.copy(mouse);
        uniforms.uTime.value = prefersReduced ? 0 : t;

        // ease the scroll progress so the core glides between story beats
        smoothProgress += (progress - smoothProgress) * 0.08;
        const p = smoothProgress;

        // ---- The journey: weave the core across the page as you scroll ----
        // right (hero) → centre → left → centre → right, drifting and changing depth.
        const px = Math.cos(p * Math.PI * 2) * weave + mouse.x * 0.25;
        const py = Math.sin(p * Math.PI * 3) * 0.55 + mouse.y * 0.15;
        const pz = Math.sin(p * Math.PI * 2) * 0.6;
        group.position.set(px, py, pz);
        halo.position.set(px * 0.92, py * 0.92, pz);

        const spin = prefersReduced ? 0 : 0.12;
        group.rotation.y += dt * spin;
        group.rotation.x = mouse.y * 0.2 + p * 0.6;
        group.rotation.z = p * 0.5;
        wire.rotation.y -= dt * spin * 1.6;
        wire.rotation.z += dt * 0.04;
        halo.rotation.y += dt * 0.03;

        // ---- Scale: full in the hero, a touch calmer while reading ----
        const enter = smoothstep(0.0, 0.13, p);
        group.scale.setScalar(1.0 - 0.16 * enter - 0.05 * Math.sin(p * Math.PI));
        halo.scale.setScalar(1.0 + p * 0.5);

        // ---- Colour story: green → cyan → violet as the page moves toward "AI" ----
        const toViolet = smoothstep(0.35, 1.0, p);
        const toBlue   = smoothstep(0.15, 0.85, p);
        uniforms.uColorA.value.copy(C_GREEN).lerp(C_VIOLET, toViolet * 0.85);
        uniforms.uColorB.value.copy(C_CYAN).lerp(C_BLUE, toBlue * 0.7);

        // ---- Presence: bold in the hero, then settle to an ambient companion ----
        const ga = lerp(1.0, 0.55, smoothstep(0.02, 0.16, p));
        uniforms.uGlobalAlpha.value = ga;
        haloMat.opacity = 0.8 * ga;
        wireMat.opacity = 0.12 * ga;

        renderer.render(scene, camera);
        requestAnimationFrame(frame);
    }
    frame();

    // Pause rendering when the hero is fully scrolled past (saves battery).
    // (Loop keeps running but it's cheap; kept simple for reliability.)
}
