'use strict';
/* ============================================================
   Engine: renderer, helpers, materials, particles, audio, physics
   ============================================================ */
const $ = s => document.querySelector(s);
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
const wrapA = a => ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;
const hexStr = n => '#' + n.toString(16).padStart(6, '0');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const isTouch = matchMedia('(pointer: coarse)').matches || ('ontouchstart' in window && navigator.maxTouchPoints > 0);

/* ---------- World layout ---------- */
const C = { x: 0, z: -90 };            // castle city centre (Heart of the Shield)
const DOME_R = 62, WALL_R = 50;
const COW_PEN = { x1: -58, x2: -12, z1: 28, z2: 78 };
const SHEEP_PEN = { x1: 12, x2: 58, z1: 28, z2: 78 };
const SPINDLE = { x: -28, z: -98 }, TEMPLE = { x: 24, z: -116 }, MARKET = { x: 28, z: -66 }, KEEP = { x: 0, z: -131 }, BOARD = { x: -9, z: -48 };
const BARN = { x: -36, z: 92 }, HOUSE = { x: 0, z: 116 }, CREAMERY = { x: 36, z: 93 }, CLOVER = { x: 50, z: 70 }, POND = { x: 64, z: 104 };
const SPAWN = { x: 0, z: 88 }, CRATE = { x: 8, z: 104 };
const CAVE_DOOR = { x: 168, z: -22 };   // Catnap Cavern entrance (overworld)
const CAVE = { x: 0, z: 560, r: 34 };   // the cavern arena lives far south, hidden by fog
const MARKET_PEN = { x: 40, z: -84 };

/* ---------- Renderer ---------- */
const stage = $('#stage');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  document.body.innerHTML = '<div style="padding:40px;font:600 18px Nunito,sans-serif;color:#4a2f27;background:#bfe8ff;height:100%">This game needs WebGL. Try a newer browser, or turn on hardware acceleration.</div>';
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(48, 1, 0.5, 900);
function resize() {
  const w = stage.clientWidth || innerWidth, h = stage.clientHeight || innerHeight;
  renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();
scene.background = new THREE.Color(0xa9d8f2);
scene.fog = new THREE.Fog(0xbfe8ff, 140, 380);
const hemi = new THREE.HemisphereLight(0xffffff, 0x8fc97a, 0.62); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1d6, 0.6);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -55, right: 55, top: 55, bottom: -55, near: 1, far: 220 });
sun.shadow.bias = -0.0008;
scene.add(sun); scene.add(sun.target);

/* ---------- Toon materials & shared geometry ---------- */
const GRAD = (() => {
  const d = new Uint8Array([105, 105, 105, 255, 160, 160, 160, 255, 205, 205, 205, 255, 228, 228, 228, 255]);
  const t = new THREE.DataTexture(d, 4, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; return t;
})();
const G = {
  sph: new THREE.SphereGeometry(1, 18, 14), sphLo: new THREE.SphereGeometry(1, 10, 8),
  box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(1, 1, 1, 14), cylLo: new THREE.CylinderGeometry(1, 1, 1, 8),
  cone: new THREE.ConeGeometry(1, 1, 14), cone4: new THREE.ConeGeometry(1, 1, 4),
  robe: new THREE.CylinderGeometry(0.5, 0.85, 1.6, 14), oct: new THREE.OctahedronGeometry(1, 0), dodec: new THREE.DodecahedronGeometry(1, 0),
  torus: new THREE.TorusGeometry(1, 0.08, 8, 32), plane: new THREE.PlaneGeometry(1, 1), circle: new THREE.CircleGeometry(1, 48),
};
const MC = {};
function M(color, emissive) {
  const k = color + '|' + (emissive || 0);
  return MC[k] || (MC[k] = new THREE.MeshToonMaterial({ color, gradientMap: GRAD, emissive: emissive || 0 }));
}
const BASIC = {};
function MB(color, opts) {
  const k = color + JSON.stringify(opts || {});
  return BASIC[k] || (BASIC[k] = new THREE.MeshBasicMaterial(Object.assign({ color }, opts || {})));
}
function P(par, geo, m, x, y, z, sx, sy, sz) {
  const mesh = new THREE.Mesh(geo, (typeof m === 'number') ? M(m) : m);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy === undefined ? sx : sy, sz === undefined ? sx : sz);
  mesh.castShadow = true;
  par.add(mesh); return mesh;
}
const _roofs = {};
function roofGeo(w, h, len) {
  const k = w + '_' + h + '_' + len; if (_roofs[k]) return _roofs[k];
  const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false }); g.translate(0, 0, -len / 2);
  return (_roofs[k] = g);
}
function flat(x, z, w, d, color, y = 0.03) {
  const m = new THREE.Mesh(G.plane, M(color)); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.scale.set(w, d, 1);
  m.receiveShadow = true; scene.add(m); return m;
}
function disc(x, z, r, color, y = 0.03) {
  const m = new THREE.Mesh(G.circle, M(color)); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.scale.set(r, r, 1);
  m.receiveShadow = true; scene.add(m); return m;
}
/* Night-glow materials: windows and lamps light up after dusk */
const winMat = new THREE.MeshToonMaterial({ color: 0x9cc3e6, gradientMap: GRAD, emissive: 0x000000 });
const lampMat = new THREE.MeshToonMaterial({ color: 0xfff1b8, gradientMap: GRAD, emissive: 0x000000 });

/* ---------- Canvas textures ---------- */
function mkTex(fn, w = 64, h = w) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.minFilter = THREE.LinearFilter; return t;
}
function rr(x, X, Y, w, h, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); }
const PTEX = {
  dot: mkTex((x, s) => { const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.55, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, s, s); }),
  heart: mkTex((x, s) => { x.fillStyle = '#fff'; x.beginPath(); x.moveTo(32, 56); x.bezierCurveTo(4, 36, 6, 10, 22, 10); x.bezierCurveTo(28, 10, 32, 16, 32, 20); x.bezierCurveTo(32, 16, 36, 10, 42, 10); x.bezierCurveTo(58, 10, 60, 36, 32, 56); x.fill(); }),
  star: mkTex((x, s) => { x.fillStyle = '#fff'; x.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? s * 0.13 : s * 0.48, a = i * Math.PI / 4 - Math.PI / 2; x.lineTo(s / 2 + Math.cos(a) * r, s / 2 + Math.sin(a) * r); } x.closePath(); x.fill(); }),
  z: mkTex((x, s) => { x.fillStyle = '#fff'; x.font = 'bold 50px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('z', s / 2, s / 2 + 2); }),
  drop: mkTex(x => { x.lineWidth = 5; x.strokeStyle = '#4a2f27'; x.fillStyle = '#fff'; x.beginPath(); x.moveTo(32, 5); x.bezierCurveTo(44, 22, 52, 32, 52, 42); x.arc(32, 42, 20, 0, Math.PI); x.bezierCurveTo(12, 32, 20, 22, 32, 5); x.closePath(); x.fill(); x.stroke(); }),
  puff: mkTex(x => { x.lineWidth = 5; x.strokeStyle = '#4a2f27'; x.fillStyle = '#fff'; [[22, 36, 14], [42, 36, 14], [32, 24, 15]].forEach(([a, b, r]) => { x.beginPath(); x.arc(a, b, r, 0, TAU); x.stroke(); }); [[22, 36, 14], [42, 36, 14], [32, 24, 15]].forEach(([a, b, r]) => { x.beginPath(); x.arc(a, b, r - 2, 0, TAU); x.fill(); }); }),
  ring: mkTex((x, s) => { x.strokeStyle = '#fff'; x.lineWidth = 6; x.beginPath(); x.arc(s / 2, s / 2, s / 2 - 5, 0, TAU); x.stroke(); }),
};
function badgeTex(ch, bg) {
  return mkTex(x => { x.fillStyle = bg; x.strokeStyle = '#4a2f27'; x.lineWidth = 6; x.beginPath(); x.arc(32, 32, 26, 0, TAU); x.fill(); x.stroke(); x.fillStyle = '#4a2f27'; x.font = '900 38px Fredoka, Nunito, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(ch, 32, 34); });
}
function textSprite(text, o = {}) {
  const fs = o.fs || 40, pad = 16;
  const c = document.createElement('canvas'); const x = c.getContext('2d');
  const font = `700 ${fs}px Fredoka, Nunito, sans-serif`; x.font = font;
  const w = Math.ceil(x.measureText(text).width) + pad * 2, h = Math.ceil(fs * 1.5);
  c.width = w; c.height = h; x.font = font;
  if (o.bg !== null) { x.fillStyle = o.bg || 'rgba(74,47,39,0.8)'; rr(x, 0, 0, w, h, h / 2); x.fill(); }
  x.fillStyle = o.color || '#fffaf0'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, w / 2, h / 2 + 2);
  const t = new THREE.CanvasTexture(c); t.minFilter = THREE.LinearFilter;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false, depthTest: false, transparent: true }));
  const sc = o.scale || 0.8; s.scale.set(sc * w / h, sc, 1); s.renderOrder = 10; return s;
}
function signTex(lines, bg = '#fff4dc') {
  return mkTex((x, w, h) => {
    x.fillStyle = bg; x.fillRect(0, 0, w, h); x.strokeStyle = '#7a4e32'; x.lineWidth = 16; x.strokeRect(8, 8, w - 16, h - 16);
    x.fillStyle = '#4a2f27'; x.textAlign = 'center'; x.textBaseline = 'middle';
    lines.forEach((l, i) => {
      let fs = i === 0 ? 76 : 50; const max = w - 64;
      do { x.font = `${i === 0 ? 700 : 600} ${fs}px Fredoka, Nunito, sans-serif`; fs -= 2; } while (x.measureText(l).width > max && fs > 16);
      x.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * 84);
    });
  }, 512, 256);
}
/* ---------- Particles ---------- */
const parts = [], partPool = [];
function spawnPart(tex, color, x, y, z, vx, vy, vz, life, size, grav) {
  if (parts.length > 700) return;
  let s = partPool.pop();
  if (!s) { s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false })); s.material.map = tex; s.material.needsUpdate = true; }
  s.material.map = tex; s.material.color.set(color); s.material.opacity = 1;
  s.position.set(x, y, z); s.scale.setScalar(size); scene.add(s);
  parts.push({ s, vx, vy, vz, life, t: 0, size, grav });
}
function burst(kind, x, y, z, n = 8, color) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, sp = rand(1.5, 4.5);
    switch (kind) {
      case 'milk': spawnPart(PTEX.dot, color || 0xffffff, x, y, z, Math.cos(a) * sp, rand(2, 6), Math.sin(a) * sp, rand(.5, .8), rand(.25, .45), 14); break;
      case 'heart': spawnPart(PTEX.heart, color || 0xff6f9f, x + rand(-.5, .5), y, z + rand(-.5, .5), Math.cos(a) * .8, rand(1.5, 3), Math.sin(a) * .8, rand(.9, 1.4), rand(.45, .7), -1); break;
      case 'sparkle': spawnPart(PTEX.star, color || pick([0xfff3a0, 0xffffff, 0xffd6f0]), x + rand(-.8, .8), y + rand(-.5, .8), z + rand(-.8, .8), Math.cos(a) * 1.2, rand(.5, 2.5), Math.sin(a) * 1.2, rand(.6, 1), rand(.35, .6), 0); break;
      case 'wool': spawnPart(PTEX.dot, color || 0xffffff, x, y, z, Math.cos(a) * sp * .7, rand(2, 5), Math.sin(a) * sp * .7, rand(.8, 1.2), rand(.6, 1), 5); break;
      case 'mud': spawnPart(PTEX.dot, 0x7a5a3a, x, y, z, Math.cos(a) * sp, rand(2, 5), Math.sin(a) * sp, rand(.5, .8), rand(.3, .5), 12); break;
      case 'zap': spawnPart(PTEX.star, color || 0x7fe8ff, x, y, z, Math.cos(a) * sp * 1.5, rand(1, 5), Math.sin(a) * sp * 1.5, rand(.3, .6), rand(.4, .7), 4); break;
      case 'coin': spawnPart(PTEX.dot, 0xffcf3d, x, y, z, Math.cos(a) * sp * .6, rand(4, 7), Math.sin(a) * sp * .6, rand(.6, .9), rand(.3, .45), 14); break;
      case 'zzz': spawnPart(PTEX.z, 0xe6d9ff, x + rand(-.4, .4), y, z + rand(-.4, .4), rand(-.3, .3), rand(1, 1.8), rand(-.3, .3), rand(1.2, 1.8), rand(.5, .8), -.5); break;
      case 'rainbow': spawnPart(PTEX.star, new THREE.Color().setHSL(Math.random(), 0.9, 0.65), x, y, z, Math.cos(a) * sp, rand(1, 5), Math.sin(a) * sp, rand(.4, .8), rand(.4, .7), 3); break;
      case 'ring': spawnPart(PTEX.ring, color || 0xffffff, x, y, z, 0, 0, 0, 0.45, 0.5, 0); break;
    }
  }
}
function updateParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.t += dt;
    p.vy -= p.grav * dt; p.s.position.x += p.vx * dt; p.s.position.y += p.vy * dt; p.s.position.z += p.vz * dt;
    const k = p.t / p.life; p.s.material.opacity = 1 - k * k;
    if (p.s.material.map === PTEX.ring) p.s.scale.setScalar(p.size + k * 6);
    if (p.t >= p.life) { scene.remove(p.s); partPool.push(p.s); parts.splice(i, 1); }
  }
}

/* ---------- Floating text & speech bubbles (DOM) ---------- */
const floaters = $('#floaters'); const floats = [];
const _v = new THREE.Vector3();
function floatText(x, y, z, text, cls = '', life = 1.5) {
  const el = document.createElement('div'); el.className = 'float ' + cls; el.textContent = text; floaters.appendChild(el);
  floats.push({ el, x, y, z, t: 0, life, rise: 40 });
}
function bubble(obj, text, life = 3.2, cls = '') {
  const el = document.createElement('div'); el.className = 'bubble ' + cls; el.textContent = text; floaters.appendChild(el);
  floats.push({ el, obj, y: obj.userData.talkY || 3.2, t: 0, life, rise: 0 });
}
function updateFloats(dt) {
  const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i]; f.t += dt;
    if (f.obj) _v.set(f.obj.position.x, f.obj.position.y + f.y, f.obj.position.z); else _v.set(f.x, f.y, f.z);
    _v.project(camera);
    const sx = (_v.x * .5 + .5) * w, sy = (-_v.y * .5 + .5) * h - f.t * f.rise;
    f.el.style.transform = `translate(${sx.toFixed(1)}px,${sy.toFixed(1)}px) translate(-50%,-100%)`;
    f.el.style.opacity = _v.z > 1 ? 0 : Math.min(1, (f.life - f.t) * 3);
    if (f.t >= f.life) { f.el.remove(); floats.splice(i, 1); }
  }
}

/* ---------- Audio (tiny synth, starts after first click) ---------- */
let AC = null, muted = false;
try { localStorage.removeItem('tsm.mute'); } catch (e) { } // sound always starts ON; M mutes for this session only
let MASTER = null; const _sfxLast = {};
function audioInit() {
  if (AC) { if (AC.state === 'suspended' && !muted) AC.resume(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    const comp = AC.createDynamicsCompressor(); comp.threshold.value = -24; comp.knee.value = 12; comp.ratio.value = 8;
    MASTER = AC.createGain(); MASTER.gain.value = 0.35; MASTER.connect(comp); comp.connect(AC.destination);
  } catch (e) { }
}
function tone(freq, dur, type = 'sine', vol = 0.12, slideTo = null, delay = 0) {
  if (!AC || muted) return;
  const t0 = AC.currentTime + delay, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0); if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(MASTER); o.start(t0); o.stop(t0 + dur + 0.05);
}
function noise(dur, vol = 0.1, freq = 1500) {
  if (!AC || muted) return;
  const n = Math.floor(AC.sampleRate * dur), b = AC.createBuffer(1, n, AC.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = AC.createBufferSource(); s.buffer = b; const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq;
  const g = AC.createGain(); g.gain.value = vol; s.connect(f); f.connect(g); g.connect(MASTER); s.start();
}
/* A proper "mmm-OOO": sawtooth voice through a lowpass that opens like a mouth, with a little wobble */
let _lastMoo = 0;
function moo(vol = 1, pitch = 1) {
  if (!AC || muted) return;
  _lastMoo = performance.now();
  const t0 = AC.currentTime, dur = 0.85 + Math.random() * 0.35, f0 = 118 * pitch * (0.96 + Math.random() * 0.08);
  const o = AC.createOscillator(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(f0 * 0.9, t0); o.frequency.linearRampToValueAtTime(f0 * 1.12, t0 + dur * 0.35); o.frequency.linearRampToValueAtTime(f0 * 0.8, t0 + dur);
  const lfo = AC.createOscillator(), lg = AC.createGain(); lfo.frequency.value = 5 + Math.random() * 1.5; lg.gain.value = f0 * 0.025; lfo.connect(lg); lg.connect(o.frequency);
  const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 7;
  lp.frequency.setValueAtTime(280, t0); lp.frequency.linearRampToValueAtTime(950, t0 + dur * 0.35); lp.frequency.linearRampToValueAtTime(360, t0 + dur);
  const g = AC.createGain(), v = 0.1 * vol;
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + 0.12); g.gain.setValueAtTime(v, t0 + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(lp); lp.connect(g); g.connect(MASTER); o.start(t0); lfo.start(t0); o.stop(t0 + dur + 0.05); lfo.stop(t0 + dur + 0.05);
}
/* Only moo if no cow has mooed for a while, so it never gets annoying */
function tryMoo(vol, pitch, minGapMs = 4500) { if (performance.now() - _lastMoo < minGapMs) return false; moo(vol, pitch); return true; }
const _cowPitch = { classic: 1, choc: 0.9, straw: 1.15, blueberry: 1.05, banana: 1.1, orange: 1.12, almond: 0.95, cookie: 0.97, mochi: 1.28, mint: 1.08, moon: 0.84, gold: 1.0, super: 1.32 };
function cowPitch(d) { let h = 0; for (const ch of (d.name || '')) h = (h * 31 + ch.charCodeAt(0)) % 997; return (_cowPitch[d.type] || 1) * (0.95 + (h % 10) / 100); }
/* Wet, squishy squirt: a sweeping bandpass "psssh", a low squelch and the odd droplet blip */
let _noiseBuf = null;
function squirtGrain(vol = 1) {
  if (!AC || muted) return;
  if (!_noiseBuf) { const n = AC.sampleRate; _noiseBuf = AC.createBuffer(1, n, AC.sampleRate); const d = _noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; }
  const t0 = AC.currentTime, dur = 0.14;
  const src = AC.createBufferSource(); src.buffer = _noiseBuf;
  const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 3.5; bp.frequency.setValueAtTime(2300 + Math.random() * 500, t0); bp.frequency.exponentialRampToValueAtTime(800 + Math.random() * 300, t0 + dur);
  const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.11 * vol, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(bp); bp.connect(g); g.connect(MASTER); src.start(t0, Math.random() * 0.8, dur + 0.02);
  const sq = AC.createOscillator(), sg = AC.createGain(), d0 = t0 + Math.random() * 0.04; sq.type = 'sine';
  sq.frequency.setValueAtTime(240 + Math.random() * 80, d0); sq.frequency.exponentialRampToValueAtTime(70, d0 + 0.08);
  sg.gain.setValueAtTime(0.0001, d0); sg.gain.exponentialRampToValueAtTime(0.07 * vol, d0 + 0.01); sg.gain.exponentialRampToValueAtTime(0.0001, d0 + 0.09);
  sq.connect(sg); sg.connect(MASTER); sq.start(d0); sq.stop(d0 + 0.12);
  if (Math.random() < 0.3) tone(rand(900, 1300), 0.04, 'sine', 0.02 * vol, rand(1500, 2100), Math.random() * 0.08);
}
const SFX = {
  moo: () => moo(1, 1),
  baa: () => { tone(520, 0.12, 'square', 0.035, 480); tone(480, 0.32, 'square', 0.035, 400, 0.12); },
  splash: () => noise(0.14, 0.08, 1900),
  squirt: () => squirtGrain(1),
  coin: () => { tone(988, 0.08, 'square', 0.04); tone(1319, 0.16, 'square', 0.04, null, 0.08); },
  level: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.2, 'triangle', 0.07, null, i * 0.09)),
  meow: () => { tone(650, 0.12, 'sine', 0.07, 950); tone(950, 0.25, 'sine', 0.06, 520, 0.12); },
  purr: () => noise(0.5, 0.05, 120),
  hurt: () => tone(320, 0.25, 'sawtooth', 0.07, 120),
  zap: () => tone(1500, 0.1, 'square', 0.025, 500),
  alarm: () => { for (let i = 0; i < 3; i++) { tone(660, 0.14, 'triangle', 0.07, null, i * 0.3); tone(880, 0.14, 'triangle', 0.07, null, i * 0.3 + 0.15); } },
  spin: () => tone(330, 0.3, 'triangle', 0.05, 660),
  bless: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.5, 'sine', 0.05, null, i * 0.12)),
  click: () => tone(720, 0.05, 'square', 0.025),
  love: () => [659, 784, 988, 1319].forEach((f, i) => tone(f, 0.35, 'sine', 0.06, null, i * 0.11)),
  boom: () => { noise(0.4, 0.15, 400); tone(120, 0.4, 'sine', 0.1, 50); },
  pickup: () => { tone(300, 0.15, 'triangle', 0.06, 600); },
  roar: () => { tone(110, 0.9, 'sawtooth', 0.08, 70); noise(0.8, 0.08, 300); },
};
function sfx(n) {
  if (!AC || muted) return;
  const now = performance.now(), gap = n === 'squirt' ? 95 : n === 'boom' ? 300 : 90; if (now - (_sfxLast[n] || 0) < gap) return; _sfxLast[n] = now;
  try { SFX[n] && SFX[n](); } catch (e) { }
}

/* ---------- Collision ---------- */
const segs = [], circs = [];
function segC(ax, az, bx, bz, low) { segs.push([ax, az, bx, bz, !!low]); }
function circC(x, z, r) { circs.push([x, z, r]); }
function boxC(x, z, w, d) { const hw = w / 2, hd = d / 2; segC(x - hw, z - hd, x + hw, z - hd); segC(x + hw, z - hd, x + hw, z + hd); segC(x + hw, z + hd, x - hw, z + hd); segC(x - hw, z + hd, x - hw, z - hd); }
function collide(p, r, airborne) {
  for (let i = 0; i < circs.length; i++) {
    const c = circs[i], dx = p.x - c[0], dz = p.z - c[1], m = c[2] + r;
    if (dx > m || dx < -m || dz > m || dz < -m) continue;
    const d = Math.hypot(dx, dz); if (d < m && d > 1e-4) { p.x = c[0] + dx / d * m; p.z = c[1] + dz / d * m; }
  }
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i]; if (airborne && s[4]) continue;
    const ax = s[0], az = s[1], vx = s[2] - ax, vz = s[3] - az;
    if (p.x < Math.min(ax, s[2]) - r - 1 || p.x > Math.max(ax, s[2]) + r + 1 || p.z < Math.min(az, s[3]) - r - 1 || p.z > Math.max(az, s[3]) + r + 1) continue;
    const L = vx * vx + vz * vz; let t = ((p.x - ax) * vx + (p.z - az) * vz) / L; t = clamp(t, 0, 1);
    const cx = ax + vx * t, cz = az + vz * t, dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz);
    if (d < r && d > 1e-4) { p.x = cx + dx / d * r; p.z = cz + dz / d * r; }
  }
}
