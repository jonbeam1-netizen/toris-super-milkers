'use strict';
/* ============================================================
   Models: cows, sheep, kittens, sheep-folk, human farmers
   ============================================================ */
function eyes(par, x, y, z, r, white) {
  for (const s of [-1, 1]) {
    if (white) P(par, G.sphLo, 0xffffff, s * x, y, z - 0.02, r * 1.35);
    P(par, G.sphLo, 0x1d1a24, s * x, y, z + (white ? r * 0.35 : 0), r);
    P(par, G.sphLo, 0xffffff, s * x - r * 0.3, y + r * 0.35, z + r * 0.75, r * 0.32).castShadow = false;
  }
}
function legSet(par, coords, top, len, r, mat, hoof) {
  const legs = [];
  for (const [lx, lz] of coords) {
    const L = new THREE.Group(); L.position.set(lx, top, lz); par.add(L);
    P(L, G.cylLo, mat, 0, -len / 2, 0, r, len, r);
    if (hoof) P(L, G.cylLo, hoof, 0, -len + 0.06, 0, r * 1.1, 0.14, r * 1.1);
    legs.push(L);
  }
  return legs;
}

/* ---------- Cow ---------- */
function makeCow(type) {
  const T = COWS[type], g = new THREE.Group();
  const bodyM = new THREE.MeshToonMaterial({ color: T.body, gradientMap: GRAD, emissive: T.glow || 0 });
  const bw = T.round ? 1.2 : 1.05, bh = T.round ? 1.05 : 0.9, bl = T.round ? 1.35 : 1.5;
  P(g, G.sph, bodyM, 0, 1.45, 0, bw, bh, bl);
  // spots / chips / stars / berries / seeds
  const nSpots = T.chips ? 14 : T.stars ? 9 : T.berries ? 7 : T.seeds ? 16 : 5;
  for (let i = 0; i < nSpots; i++) {
    const dir = new THREE.Vector3(rand(-1, 1), rand(-0.25, 0.9), rand(-0.9, 0.9)).normalize();
    const px = dir.x * bw * 0.97, py = 1.45 + dir.y * bh * 0.97, pz = dir.z * bl * 0.97;
    if (T.seeds) { P(g, G.sphLo, 0xfff27a, px, py, pz, 0.07, 0.1, 0.07); continue; }
    if (T.stars) { const s = P(g, G.oct, M(T.spot, 0x5a5020), px, py, pz, 0.16); s.rotation.set(rand(0, 3), rand(0, 3), 0); continue; }
    if (T.berries) { for (let j = 0; j < 3; j++) P(g, G.sphLo, T.spot, px + rand(-.12, .12), py + rand(-.1, .1), pz + rand(-.12, .12), 0.13); continue; }
    const col = T.spot2 && i % 2 ? T.spot2 : T.spot;
    const r = T.chips ? rand(0.1, 0.17) : rand(0.28, 0.42);
    P(g, G.sphLo, col, px * 0.97, py, pz * 0.97, r, r * 0.8, r);
  }
  if (type === 'orange') for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; P(g, G.box, 0xffd9a8, Math.cos(a) * 0.2, 2.33, Math.sin(a) * 0.2 - 0.2, 0.06, 0.04, 0.5).rotation.y = -a; }
  if (type === 'almond') for (let i = 0; i < 4; i++) P(g, G.sph, 0xb27a4a, rand(-.6, .6), 2.15, rand(-.9, .6), 0.16, 0.08, 0.26);
  // head
  const head = new THREE.Group(); head.position.set(0, 1.95, bl * 0.95); g.add(head);
  P(head, G.sph, bodyM, 0, 0, 0.15, 0.62, 0.58, 0.62);
  P(head, G.sph, T.snout, 0, -0.2, 0.62, 0.48, 0.34, 0.3);
  for (const s of [-1, 1]) P(head, G.sphLo, 0x6b3b4b, s * 0.15, -0.18, 0.9, 0.06).castShadow = false;
  eyes(head, 0.27, 0.12, 0.66, 0.1, false);
  for (const s of [-1, 1]) {
    const e = P(head, G.sphLo, bodyM, s * 0.66, 0.12, 0.05, 0.32, 0.12, 0.18); e.rotation.z = s * 0.4;
    const h = P(head, G.cone, 0xfff4d6, s * 0.3, 0.6, 0.0, 0.09, 0.32, 0.09); h.rotation.z = -s * 0.3;
    P(head, G.sphLo, 0xffa4b8, s * 0.42, -0.08, 0.54, 0.1, 0.06, 0.05).castShadow = false;
  }
  P(head, G.sphLo, T.spot, 0, 0.5, 0.15, 0.2);
  if (T.leaf) for (const s of [-1, 0, 1]) { const l = P(head, G.sph, type === 'orange' ? 0x5fbf4a : 0x4fbf5a, s * 0.14, 0.72, 0.05, 0.08, 0.22, 0.05); l.rotation.z = s * 0.6; }
  if (T.stem) P(head, G.cylLo, 0x6b4a22, 0, 0.75, 0.05, 0.06, 0.3, 0.06).rotation.z = 0.3;
  if (type === 'mochi') P(head, G.cylLo, 0xe0bba0, 0, 0.62, 0.1, 0.03, 0.5, 0.03); // little dango stick
  if (type === 'mochi') for (const [c, y] of [[0xffb3cc, 0.95], [0xffffff, 1.15], [0xbfe3a6, 1.35]]) P(head, G.sphLo, c, 0, y - 0.25, 0.1, 0.11);
  // legs, udder, tail, bell
  const lx = bw * 0.52, lz = bl * 0.56;
  const legs = legSet(g, [[-lx, lz], [lx, lz], [-lx, -lz], [lx, -lz]], 1.0, 0.92, 0.2, bodyM, 0x3a2e2a);
  P(g, G.sph, 0xffb3c8, 0, 0.72, -0.35, 0.42, 0.32, 0.42);
  for (const [tx, tz] of [[-.15, -.2], [.15, -.2], [-.15, -.5], [.15, -.5]]) P(g, G.cylLo, 0xff9fb8, tx, 0.42, tz, 0.05, 0.16, 0.05);
  const tail = new THREE.Group(); tail.position.set(0, 1.8, -bl * 0.95); g.add(tail);
  P(tail, G.cylLo, bodyM, 0, -0.35, -0.08, 0.05, 0.7, 0.05).rotation.x = 0.25;
  P(tail, G.sphLo, T.spot, 0, -0.75, -0.18, 0.13, 0.18, 0.13);
  P(g, G.cyl, 0xff6f91, 0, 1.6, bl * 0.82, 0.48, 0.12, 0.3).rotation.x = 0.5;
  P(g, G.sph, M(0xffd23f, 0x332200), 0, 1.38, bl * 0.95, 0.16);
  g.scale.setScalar(0.9);
  g.userData.talkY = 3.1;
  return { g, legs, head, tail, bodyM };
}

/* ---------- Sheep ---------- */
const C_DIRT = new THREE.Color(0x8a7760), C_CREAM = new THREE.Color(0xeee3c8), C_WHITE = new THREE.Color(0xffffff);
function fleeceColor(w, out) {
  if (w < 60) out.copy(C_DIRT).lerp(C_CREAM, w / 60); else out.copy(C_CREAM).lerp(C_WHITE, Math.min(1, (w - 60) / 32));
  return out;
}
function makeSheep(breed, golden) {
  const B = BREEDS[breed] || BREEDS.meadow, g = new THREE.Group();
  const fleeceMat = golden ? M(0xfffbea, 0x3a3010) : new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: GRAD });
  const faceM = golden ? M(0xffcf3d, 0x2a1c00) : M(B.face);
  P(g, G.sph, 0xf5c6b8, 0, 1.05, 0, 0.6, 0.52, 0.78);
  const fleece = new THREE.Group(); fleece.position.set(0, 1.1, 0); g.add(fleece);
  for (const [x, y, z, r] of [[0, .28, 0, .75], [.42, .05, .35, .55], [-.42, .05, .35, .55], [.42, .05, -.35, .55], [-.42, .05, -.35, .55], [0, .15, .6, .55], [0, .15, -.62, .55], [0, .55, .15, .5]])
    P(fleece, G.sph, fleeceMat, x, y, z, r);
  const head = new THREE.Group(); head.position.set(0, 1.42, 0.9); g.add(head);
  P(head, G.sph, faceM, 0, 0, 0.05, 0.34, 0.4, 0.38);
  P(head, G.sph, fleeceMat, 0, 0.32, -0.05, 0.28);
  for (const s of [-1, 1]) { const e = P(head, G.sphLo, faceM, s * 0.38, 0.08, 0, 0.22, 0.08, 0.12); e.rotation.z = s * 0.3; }
  eyes(head, 0.15, 0.08, 0.36, 0.07, true);
  const legs = legSet(g, [[-.32, .45], [.32, .45], [-.32, -.45], [.32, -.45]], 0.78, 0.78, 0.11, 0x3a3238, 0x241e22);
  P(g, G.sph, fleeceMat, 0, 1.2, -0.92, 0.2);
  const halo = new THREE.Mesh(G.torus, MB(0xffe27a)); halo.rotation.x = Math.PI / 2; halo.position.set(0, 2.25, 0.85); halo.scale.setScalar(0.36); halo.visible = !!golden; g.add(halo);
  g.scale.setScalar(0.85);
  g.userData.talkY = 2.6;
  return { g, legs, head, fleece, fleeceMat, halo };
}

/* ---------- Kitten ---------- */
const _eyeMats = {};
function makeKitten(type) {
  const K = KITTENS[type], g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const cm = M(K.color), sm = M(K.stripe);
  P(body, G.sph, cm, 0, 0.62, -0.05, 0.48, 0.42, 0.62);
  P(body, G.sph, 0xfff3ea, 0, 0.52, 0.2, 0.32, 0.28, 0.38);
  if (type !== 'shadow') for (let i = 0; i < 3; i++) P(body, G.box, sm, 0, 0.99, -0.35 + i * 0.25, 0.5, 0.07, 0.09);
  const head = new THREE.Group(); head.position.set(0, 1.08, 0.52); body.add(head);
  P(head, G.sph, cm, 0, 0, 0, 0.46, 0.4, 0.42);
  if (type === 'siamese') P(head, G.sph, sm, 0, -0.08, 0.2, 0.3, 0.26, 0.26);
  const eyeM = _eyeMats[K.eye] || (_eyeMats[K.eye] = new THREE.MeshBasicMaterial({ color: K.eye }));
  for (const s of [-1, 1]) {
    const e = P(head, G.cone, cm, s * 0.26, 0.38, -0.02, 0.16, 0.32, 0.12); e.rotation.z = -s * 0.35;
    const ei = P(head, G.cone, 0xffa7c4, s * 0.25, 0.36, 0.05, 0.08, 0.18, 0.05); ei.rotation.z = -s * 0.35;
    P(head, G.sph, eyeM, s * 0.17, 0.05, 0.34, 0.11, 0.13, 0.07).castShadow = false;
    P(head, G.box, 0x111111, s * 0.17, 0.05, 0.405, 0.03, 0.15, 0.02).castShadow = false;
    const b = P(head, G.box, 0x2a1c1c, s * 0.17, 0.21, 0.37, 0.18, 0.045, 0.04); b.rotation.z = s * 0.45; b.castShadow = false;
    for (let j = 0; j < 2; j++) { const w = P(head, G.box, 0xffffff, s * 0.4, -0.08 + j * 0.07, 0.3, 0.3, 0.015, 0.015); w.rotation.z = s * (j ? 0.15 : -0.15); w.castShadow = false; }
    P(head, G.sphLo, 0xff9fbf, s * 0.27, -0.1, 0.32, 0.07, 0.04, 0.03).castShadow = false;
  }
  P(head, G.sphLo, 0xff7aa8, 0, -0.05, 0.42, 0.06, 0.045, 0.04);
  const legs = legSet(body, [[-.25, .35], [.25, .35], [-.25, -.4], [.25, -.4]], 0.4, 0.4, 0.11, cm, M(0xfff3ea));
  const tail = new THREE.Group(); tail.position.set(0, 0.75, -0.62); body.add(tail);
  [[0, .12, -.12, .12], [0, .34, -.24, .11], [0, .58, -.22, .1], [0, .76, -.1, .1]].forEach(([x, y, z, r], i) => P(tail, G.sphLo, i === 3 ? sm : cm, x, y, z, r));
  if (K.crown) {
    const cr = new THREE.Group(); cr.position.set(0, 0.45, 0); head.add(cr);
    P(cr, G.cyl, M(0xffcf3d, 0x332200), 0, 0, 0, 0.22, 0.12, 0.22);
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; P(cr, G.cone, M(0xffcf3d, 0x332200), Math.cos(a) * 0.18, 0.12, Math.sin(a) * 0.18, 0.06, 0.16, 0.06); }
    P(cr, G.sphLo, MB(0xff4fa3), 0, 0.02, 0.22, 0.05);
    const collar = P(body, G.torus, M(type === 'clawdius' ? 0x8a1c3d : 0xff4fa3), 0, 0.92, 0.42, 0.32); collar.rotation.x = Math.PI / 2;
  }
  if (type === 'clawdius') { // royal cape & big angry fangs
    const cape = P(body, G.sph, 0x9b1c4a, 0, 0.75, -0.25, 0.55, 0.45, 0.6); cape.scale.y = 0.48;
    for (const s of [-1, 1]) P(head, G.cone, 0xffffff, s * 0.07, -0.2, 0.38, 0.04, 0.12, 0.04).rotation.x = Math.PI;
  }
  g.scale.setScalar(K.scale);
  g.userData.talkY = 1.9 * K.scale;
  return { g, body, head, legs, tail };
}

/* ---------- Sheep-folk & cow-folk (city NPCs) ---------- */
function makeFolk(o) {
  const g = new THREE.Group(), robeM = M(o.robe), trimM = M(o.trim), faceM = M(o.face || 0x3a3238);
  P(g, G.robe, robeM, 0, 0.85, 0, 1, 1, 1);
  P(g, G.cyl, trimM, 0, 0.12, 0, 0.87, 0.12, 0.87);
  P(g, G.cyl, trimM, 0, 1.25, 0, 0.62, 0.1, 0.62);
  for (const s of [-1, 1]) { P(g, G.sph, robeM, s * 0.62, 1.3, 0.05, 0.2, 0.36, 0.2); P(g, G.sph, faceM, s * 0.66, 0.95, 0.12, 0.13); }
  const head = new THREE.Group(); head.position.set(0, 2.05, 0); g.add(head);
  if (o.species === 'cow') {
    P(head, G.sph, faceM, 0, 0, 0, 0.46, 0.42, 0.46);
    P(head, G.sph, 0xffc4cf, 0, -0.16, 0.36, 0.3, 0.2, 0.18);
    for (const s of [-1, 1]) { P(head, G.cone, 0xfff4d6, s * 0.22, 0.42, 0, 0.07, 0.24, 0.07).rotation.z = -s * 0.3; P(head, G.sphLo, faceM, s * 0.48, 0.08, 0, 0.22, 0.08, 0.12).rotation.z = s * 0.4; }
  } else {
    const wool = M(0xfffdf6);
    P(head, G.sph, faceM, 0, 0, 0.1, 0.34, 0.4, 0.36);
    for (const [x, y, z, r] of [[0, .32, -.05, .3], [.28, .22, -.05, .24], [-.28, .22, -.05, .24], [0, .1, -.25, .34]]) P(head, G.sph, wool, x, y, z, r);
    for (const s of [-1, 1]) P(head, G.sphLo, faceM, s * 0.42, 0.05, 0.05, 0.2, 0.08, 0.12).rotation.z = s * 0.3;
  }
  eyes(head, 0.13, 0.06, 0.4, 0.06, true);
  for (const s of [-1, 1]) P(head, G.sphLo, 0xff9fb8, s * 0.22, -0.08, 0.38, 0.06, 0.04, 0.03).castShadow = false;
  switch (o.hat) {
    case 'bonnet': P(head, G.sph, 0xfff1c1, 0, 0.22, -0.08, 0.5, 0.34, 0.5); P(head, G.box, 0xff8fab, 0, 0.0, 0.3, 0.7, 0.06, 0.06); break;
    case 'cap': P(head, G.cyl, 0x3f6fc9, 0, 0.42, 0, 0.36, 0.18, 0.36); P(head, G.box, 0x3f6fc9, 0, 0.34, 0.32, 0.38, 0.05, 0.3); break;
    case 'mitre': { P(head, G.cone, M(0xffe08a, 0x221800), 0, 0.8, 0, 0.3, 0.8, 0.3); const h = new THREE.Mesh(G.torus, MB(0xffe27a)); h.rotation.x = Math.PI / 2; h.position.y = 1.35; h.scale.setScalar(0.38); head.add(h); break; }
    case 'hood': P(head, G.sph, o.robe, 0, 0.14, -0.14, 0.48, 0.48, 0.44); break;
    case 'helmet': P(head, G.sph, 0xd8dde8, 0, 0.24, -0.02, 0.44, 0.34, 0.44); P(head, G.sph, 0xff6b8a, 0, 0.62, -0.1, 0.1, 0.3, 0.25); break;
    case 'scarf': P(head, G.sph, 0xff9fc0, 0, 0.22, -0.1, 0.5, 0.32, 0.48); break;
  }
  g.userData.talkY = 3.2;
  return { g, head };
}

/* ---------- Humans: Tori and the farmers of Buttercup Hollow ---------- */
function makeHuman(L) {
  const g = new THREE.Group(), skin = M(L.skin), shirt = M(L.shirt), pants = M(L.pants), hairM = M(L.hair);
  const legs = [];
  for (const s of [-1, 1]) {
    const lg = new THREE.Group(); lg.position.set(s * 0.2, 0.85, 0); g.add(lg);
    P(lg, G.cylLo, pants, 0, -0.38, 0, 0.17, 0.76, 0.17);
    P(lg, G.sph, 0x6b4a3a, 0, -0.8, 0.06, 0.2, 0.13, 0.27);
    legs.push(lg);
  }
  P(g, G.sph, L.overalls ? pants : shirt, 0, 1.25, 0, 0.5, 0.55, 0.42);
  P(g, G.sph, shirt, 0, 1.6, 0, 0.5, 0.36, 0.42);
  if (L.overalls) { for (const s of [-1, 1]) P(g, G.box, pants, s * 0.2, 1.62, 0.33, 0.1, 0.4, 0.06); P(g, G.sph, 0xffd23f, 0, 1.45, 0.42, 0.06).castShadow = false; }
  if (L.apron) P(g, G.box, L.apron, 0, 1.25, 0.38, 0.62, 0.8, 0.06);
  const arms = [];
  for (const s of [-1, 1]) {
    const a = new THREE.Group(); a.position.set(s * 0.56, 1.72, 0); g.add(a);
    P(a, G.sph, shirt, 0, -0.3, 0, 0.16, 0.36, 0.16);
    P(a, G.sph, skin, 0, -0.66, 0.02, 0.13);
    arms.push(a);
  }
  const head = new THREE.Group(); head.position.set(0, 2.4, 0); g.add(head);
  P(head, G.sph, skin, 0, 0, 0, 0.52, 0.5, 0.5);
  eyes(head, 0.17, 0.02, 0.44, 0.075, false);
  for (const s of [-1, 1]) P(head, G.sphLo, 0xff9fb0, s * 0.3, -0.13, 0.4, 0.09, 0.05, 0.04).castShadow = false;
  P(head, G.box, 0x9b4a4a, 0, -0.2, 0.48, 0.12, 0.03, 0.02).castShadow = false;
  if (L.freckles) for (const s of [-1, 1]) for (let i = 0; i < 3; i++) P(head, G.sphLo, 0xc97a52, s * (0.22 + i * 0.05), -0.06 + (i % 2) * 0.03, 0.47, 0.018).castShadow = false;
  if (L.glasses) for (const s of [-1, 1]) { const r = P(head, G.torus, 0x3a2e2a, s * 0.17, 0.02, 0.49, 0.12); r.castShadow = false; }
  // hair
  P(head, G.sph, hairM, 0, 0.12, -0.08, 0.55, 0.48, 0.52);
  P(head, G.sph, hairM, 0, 0.3, 0.2, 0.42, 0.18, 0.32);
  switch (L.style) {
    case 'braid': for (let i = 0; i < 4; i++) P(head, G.sph, hairM, 0.32, -0.3 - i * 0.2, -0.25 + i * 0.03, 0.13); P(head, G.sph, 0xff8fab, 0.32, -1.12, -0.16, 0.08); break;
    case 'curly': for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; P(head, G.sph, hairM, Math.cos(a) * 0.42, 0.32 + Math.sin(i) * 0.06, Math.sin(a) * 0.38 - 0.05, 0.17); } break;
    case 'bun': P(head, G.sph, hairM, 0, 0.55, -0.2, 0.24); for (const s of [-1, 1]) P(head, G.sph, hairM, s * 0.42, -0.1, 0.05, 0.12, 0.3, 0.12); break;
    case 'pigtails': for (const s of [-1, 1]) { P(head, G.sph, hairM, s * 0.55, -0.05, -0.1, 0.17, 0.3, 0.17); P(head, G.sph, 0xff6f91, s * 0.5, 0.18, -0.1, 0.07); } break;
    default: break;
  }
  if (L.bandana) { P(head, G.cyl, L.bandana, 0, 0.28, 0, 0.53, 0.12, 0.51); P(head, G.sph, L.bandana, 0, 0.25, -0.55, 0.1); }
  if (L.hat === 'straw') { P(head, G.cyl, 0xf5d27a, 0, 0.42, 0, 0.85, 0.07, 0.85); P(head, G.cyl, 0xf5d27a, 0, 0.6, 0, 0.45, 0.36, 0.45); P(head, G.cyl, 0xff6f91, 0, 0.47, 0, 0.47, 0.09, 0.47); }
  const heart = new THREE.Sprite(new THREE.SpriteMaterial({ map: PTEX.heart, color: 0xff6f9f, depthWrite: false }));
  heart.position.set(0, 3.5, 0); heart.scale.setScalar(0.55); heart.visible = false; g.add(heart);
  g.userData.talkY = 3.4;
  return { g, legs, arms, head, heart };
}

/* ---------- The Great Sheep statue ---------- */
function makeGreatSheep() {
  const s = makeSheep('seraph', true);
  s.g.scale.setScalar(4.2);
  s.halo.scale.setScalar(0.5); s.halo.position.y = 2.4;
  return s;
}

/* ---------- Trees ---------- */
function treeInstances(list, canopyColor, canopy2Color, trunkColor) {
  const n = list.length; if (!n) return;
  const trunks = new THREE.InstancedMesh(G.cylLo, M(trunkColor), n), c1 = new THREE.InstancedMesh(G.sph, M(canopyColor), n), c2 = new THREE.InstancedMesh(G.sph, M(canopy2Color), n);
  const d = new THREE.Object3D();
  list.forEach((t, i) => {
    const s = t.s;
    d.position.set(t.x, 1.4 * s, t.z); d.rotation.set(0, 0, 0); d.scale.set(0.35 * s, 2.8 * s, 0.35 * s); d.updateMatrix(); trunks.setMatrixAt(i, d.matrix);
    d.position.set(t.x, 3.6 * s, t.z); d.scale.set(1.9 * s, 1.7 * s, 1.9 * s); d.updateMatrix(); c1.setMatrixAt(i, d.matrix);
    d.position.set(t.x + 0.3 * s, 4.7 * s, t.z + 0.2 * s); d.scale.set(1.2 * s, 1.1 * s, 1.2 * s); d.updateMatrix(); c2.setMatrixAt(i, d.matrix);
  });
  for (const m of [trunks, c1, c2]) { m.castShadow = true; m.instanceMatrix.needsUpdate = true; scene.add(m); }
}
