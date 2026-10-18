'use strict';
/* ============================================================
   World building
   ============================================================ */
const W = { flames: [], clouds: [], bees: [], caveCrystals: [], lamps: [] };
const _d = new THREE.Object3D();

function inst(geo, mat, mats, shadow = true) {
  if (!mats.length) return null;
  const m = new THREE.InstancedMesh(geo, mat, mats.length);
  mats.forEach((mx, i) => m.setMatrixAt(i, mx)); m.instanceMatrix.needsUpdate = true; m.castShadow = shadow; scene.add(m); return m;
}
function mtx(x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0) { _d.position.set(x, y, z); _d.rotation.set(rx, ry, rz); _d.scale.set(sx, sy, sz); _d.updateMatrix(); return _d.matrix.clone(); }

/* ---------- Fences ---------- */
const fencePosts = [], fenceRails = [];
function fenceLine(ax, az, bx, bz) {
  const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / 3)), ry = -Math.atan2(bz - az, bx - ax);
  for (let i = 0; i <= n; i++) { const t = i / n; fencePosts.push(mtx(lerp(ax, bx, t), 0.7, lerp(az, bz, t), 0.16, 1.4, 0.16)); }
  for (const y of [0.6, 1.15]) fenceRails.push(mtx((ax + bx) / 2, y, (az + bz) / 2, L, 0.14, 0.09, ry));
  segC(ax, az, bx, bz, true);
}
function fenceRect(p, gateSide, gz, gw = 4.5) {
  fenceLine(p.x1, p.z1, p.x2, p.z1); fenceLine(p.x1, p.z2, p.x2, p.z2);
  for (const side of ['w', 'e']) {
    const x = side === 'w' ? p.x1 : p.x2;
    if (side === gateSide) { fenceLine(x, p.z1, x, gz - gw); fenceLine(x, gz + gw, x, p.z2); }
    else fenceLine(x, p.z1, x, p.z2);
  }
}

function sign(x, z, ry, lines, h = 2.2) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
  P(g, G.cylLo, 0x9a6b4f, 0, h / 2, 0, 0.12, h, 0.12);
  const board = new THREE.Mesh(G.box, [M(0xb98a5e), M(0xb98a5e), M(0xb98a5e), M(0xb98a5e), new THREE.MeshToonMaterial({ map: signTex(lines), gradientMap: GRAD }), M(0xb98a5e)]);
  board.position.set(0, h, 0.1); board.scale.set(3, 1.5, 0.15); board.castShadow = true; g.add(board);
  circC(x, z, 0.4);
}
function lamp(x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
  P(g, G.cylLo, 0x5b4a6b, 0, 1.8, 0, 0.1, 3.6, 0.1); P(g, G.sph, lampMat, 0, 3.75, 0, 0.32); P(g, G.cone, 0x5b4a6b, 0, 4.15, 0, 0.36, 0.3, 0.36);
  circC(x, z, 0.3);
}
function house(x, z, ry, wall, roof, opts = {}) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
  const w = opts.w || 6, d = opts.d || 6, h = opts.h || 4.5;
  P(g, G.box, wall, 0, h / 2, 0, w, h, d);
  if (opts.wool) { for (let i = 0; i < 7; i++) P(g, G.sph, 0xfffdf6, rand(-w / 2.6, w / 2.6), h + 0.6 + rand(0, 0.6), rand(-d / 2.6, d / 2.6), rand(1.3, 1.8)); }
  else { const r = new THREE.Mesh(roofGeo(w + 1, 2.8, d + 0.8), M(roof)); r.position.y = h; r.castShadow = true; g.add(r); }
  P(g, G.box, 0x8a5a3b, 0, 1.1, d / 2 + 0.02, 1.2, 2.2, 0.12);
  P(g, G.sphLo, 0xffd23f, 0.4, 1.1, d / 2 + 0.1, 0.07).castShadow = false;
  for (const s of [-1, 1]) { P(g, G.box, winMat, s * w * 0.3, h * 0.6, d / 2 + 0.02, 1.0, 0.9, 0.1); P(g, G.box, 0xffffff, s * w * 0.3, h * 0.6 - 0.55, d / 2 + 0.12, 1.2, 0.15, 0.25); }
  if (opts.flowers) for (const s of [-1, 1]) for (let i = 0; i < 3; i++) P(g, G.sphLo, pick([0xff7aa8, 0xffd23f, 0xb48cf0]), s * w * 0.3 + (i - 1) * 0.35, h * 0.6 - 0.4, d / 2 + 0.2, 0.15);
  circC(x, z, Math.max(w, d) * 0.62);
  return g;
}
function tower(x, z, r, h, roof) {
  P(scene, G.cyl, 0xe2d2bb, x, h / 2, z, r, h, r);
  P(scene, G.cyl, 0xe6d6c0, x, h + 0.4, z, r * 1.12, 0.8, r * 1.12);
  P(scene, G.cone, roof, x, h + 3.2, z, r * 1.25, 5.2, r * 1.25);
  for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + 0.5; P(scene, G.box, winMat, x + Math.sin(a) * r, h * 0.65, z + Math.cos(a) * r, 0.7, 1.1, 0.7).rotation.y = a; }
  P(scene, G.cylLo, 0x8a6a4a, x, h + 6.5, z, 0.05, 1.6, 0.05);
  P(scene, G.box, roof, x + 0.45, h + 6.9, z, 0.8, 0.5, 0.04);
  circC(x, z, r + 0.2);
}

function hexTexture() {
  const r = 16, cols = 4, rows = 7, w = Math.round(3 * r * cols), h = Math.round(Math.sqrt(3) * r * rows);
  return mkTex((x) => {
    x.clearRect(0, 0, w, h); x.strokeStyle = 'rgba(255,255,255,0.95)'; x.lineWidth = 2.2; x.fillStyle = 'rgba(255,255,255,0.07)';
    for (let cx = -1; cx <= cols * 2 + 1; cx++) for (let cy = -1; cy <= rows + 1; cy++) {
      const px = cx * 1.5 * r, py = cy * Math.sqrt(3) * r + (cx % 2 ? Math.sqrt(3) * r / 2 : 0);
      x.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; x.lineTo(px + Math.cos(a) * (r - 1.5), py + Math.sin(a) * (r - 1.5)); } x.closePath(); x.fill(); x.stroke();
    }
  }, w, h);
}
function bannerTex(bg, fg) {
  return mkTex((x, w, h) => {
    x.fillStyle = bg; x.fillRect(0, 0, w, h);
    x.fillStyle = '#ffc83d'; x.fillRect(0, 0, w, 12); x.beginPath(); x.moveTo(0, h - 24); x.lineTo(w / 2, h); x.lineTo(w, h - 24); x.lineTo(w, h); x.lineTo(0, h); x.fill();
    // the Great Sheep: fluffy wool, cocoa face, ears, sparkly eyes, golden halo
    x.strokeStyle = '#ffe27a'; x.lineWidth = 6; x.beginPath(); x.ellipse(64, 30, 30, 9, 0, 0, TAU); x.stroke();
    x.fillStyle = fg; [[64, 64, 30], [38, 72, 18], [90, 72, 18], [44, 52, 17], [84, 52, 17], [64, 44, 18]].forEach(([a, b, r]) => { x.beginPath(); x.arc(a, b, r, 0, TAU); x.fill(); });
    x.fillStyle = '#4a2f27';
    x.beginPath(); x.ellipse(30, 86, 14, 7, -0.5, 0, TAU); x.fill(); x.beginPath(); x.ellipse(98, 86, 14, 7, 0.5, 0, TAU); x.fill();
    x.beginPath(); x.ellipse(64, 92, 22, 27, 0, 0, TAU); x.fill();
    x.fillStyle = '#fff'; x.beginPath(); x.arc(55, 88, 6, 0, TAU); x.arc(73, 88, 6, 0, TAU); x.fill();
    x.fillStyle = '#4a2f27'; x.beginPath(); x.arc(56, 89, 3, 0, TAU); x.arc(74, 89, 3, 0, TAU); x.fill();
    x.fillStyle = '#ff9fc0'; x.beginPath(); x.arc(50, 101, 4, 0, TAU); x.arc(78, 101, 4, 0, TAU); x.fill();
    x.fillStyle = '#4a2f27'; x.font = '700 15px Fredoka, Nunito, sans-serif'; x.textAlign = 'center'; x.fillStyle = '#fffaf0'; x.fillText('GREAT SHEEP', 64, 136);
  }, 128, 160);
}
function stripeTex(a, b) { return mkTex((x, w, h) => { for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? a : b; x.fillRect(i * w / 8, 0, w / 8, h); } }, 128, 32); }

/* ============================================================ */
function buildWorld() {
  // ground
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), M(0x8fcf6c)); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  for (let i = 0; i < 40; i++) disc(rand(-190, 190), rand(-170, 130), rand(4, 12), pick([0x95d472, 0xa8e284]), 0.01);
  flat((COW_PEN.x1 + COW_PEN.x2) / 2, (COW_PEN.z1 + COW_PEN.z2) / 2, COW_PEN.x2 - COW_PEN.x1, COW_PEN.z2 - COW_PEN.z1, 0xb4e68c, 0.02);
  flat((SHEEP_PEN.x1 + SHEEP_PEN.x2) / 2, (SHEEP_PEN.z1 + SHEEP_PEN.z2) / 2, SHEEP_PEN.x2 - SHEEP_PEN.x1, SHEEP_PEN.z2 - SHEEP_PEN.z1, 0xc2eda0, 0.02);
  // roads
  flat(0, 44, 7, 168, 0xd8c193, 0.05);
  flat(-6, 86, 90, 6, 0xd8c193, 0.05);
  flat(-90, 80, 60, 5, 0xd8c193, 0.05);
  flat(-104, 76, 5, 50, 0xd8c193, 0.05);
  flat(85, -20, 150, 5, 0xd1bd8f, 0.05);
  disc(C.x, C.z, 49, 0xcbb48c, 0.08);
  disc(C.x, C.z, 9, 0xb7a6e0, 0.1); disc(C.x, C.z, 7, 0xcbb48c, 0.11);
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; flat(C.x + Math.sin(a) * 22, C.z + Math.cos(a) * 22, 1.6, 1.6, 0xb7a6e0, 0.1).rotation.z = a; }

  buildFarm();
  buildVillage();
  buildCity();
  buildWoods();
  buildCave();
  buildSky();

  inst(G.cylLo, M(0xfff4e0), fencePosts);
  inst(G.box, M(0xfff4e0), fenceRails);
}

function buildFarm() {
  fenceRect(COW_PEN, 'e', 50); fenceRect(SHEEP_PEN, 'w', 50);
  sign(-8, 56, 0, ['Cow Pasture', 'Tori\'s Super Milkers']);
  sign(8, 56, 0, ['Sheep Meadow', 'Whiter is better!']);
  sign(5, 24, 0, ['North: Sheep-a-verse', 'West: Buttercup Hollow']);
  sign(14, -18, -Math.PI / 2, ['East: Whisker Woods', 'Beware of kittens!']);

  // Barn
  const b = new THREE.Group(); b.position.set(BARN.x, 0, BARN.z); scene.add(b);
  P(b, G.box, 0xe35d5b, 0, 4, 0, 14, 8, 10);
  const roof = new THREE.Mesh(roofGeo(11.4, 4.6, 15), M(0x8c3b3b)); roof.rotation.y = Math.PI / 2; roof.position.y = 8; roof.castShadow = true; b.add(roof);
  P(b, G.box, 0xffffff, 0, 3, -5.05, 5.4, 6.2, 0.2); P(b, G.box, 0xc94a48, 0, 3, -5.12, 4.6, 5.6, 0.2);
  for (const s of [-1, 1]) P(b, G.box, 0xffffff, 0, 3, -5.2, 0.35, 6.6, 0.12).rotation.z = s * 0.82;
  P(b, G.box, 0xffffff, 0, 8.6, -5.05, 2.4, 1.8, 0.2); P(b, G.box, 0x6b3a2a, 0, 8.6, -5.12, 1.9, 1.3, 0.2);
  P(b, G.box, 0xffffff, 0, 6.6, -5.1, 14.2, 0.35, 0.3);
  boxC(BARN.x, BARN.z, 14, 10);
  for (let i = 0; i < 5; i++) { const hb = P(scene, G.cyl, 0xf2cf6b, BARN.x - 9 + (i % 3) * 2.2, 0.8 + Math.floor(i / 3) * 1.4, BARN.z - 8, 0.9, 1.6, 0.9); hb.rotation.z = Math.PI / 2; }
  circC(BARN.x - 7, BARN.z - 8, 3);
  // Farmhouse
  house(HOUSE.x, HOUSE.z, Math.PI, 0xfff1d6, 0x6f9be8, { w: 10, d: 8, h: 5, flowers: true });
  P(scene, G.box, 0xffffff, HOUSE.x, 1.3, HOUSE.z - 4.05, 0.1, 0.1, 0.1);
  // Shipping crate
  const cr = new THREE.Group(); cr.position.set(CRATE.x, 0, CRATE.z); scene.add(cr);
  P(cr, G.box, 0xc89b6d, 0, 0.7, 0, 2.6, 1.4, 1.8); P(cr, G.box, 0x9a6b4f, 0, 1.45, -0.2, 2.8, 0.15, 2.0).rotation.x = -0.35;
  for (const y of [0.35, 1.05]) P(cr, G.box, 0x9a6b4f, 0, y, 0.92, 2.65, 0.14, 0.06);
  for (let i = 0; i < 4; i++) P(cr, G.cyl, [0xfdfbf2, 0x8a5a3b, 0xff9fc0, 0xffe27a][i], -0.8 + i * 0.5, 1.6, 0.3, 0.14, 0.55, 0.14);
  boxC(CRATE.x, CRATE.z, 2.8, 2);
  sign(CRATE.x + 3.4, CRATE.z + 0.5, 0, ['Shipping Crate', 'Sell here!'], 1.6);
  // Creamery
  house(CREAMERY.x, CREAMERY.z, Math.PI, 0xffe3ef, 0xff8fb3, { w: 9, d: 7, h: 5 });
  sign(CREAMERY.x + 6, CREAMERY.z - 5, 0, ['Creamery', 'Milk Mixer']);
  const churn = new THREE.Group(); churn.position.set(CREAMERY.x - 2, 0, CREAMERY.z - 6); scene.add(churn);
  P(churn, G.cyl, 0xb98a5e, 0, 1, 0, 0.9, 2, 0.9); P(churn, G.cyl, 0x8a5a3b, 0, 2.1, 0, 0.95, 0.2, 0.95); P(churn, G.cylLo, 0x8a5a3b, 0, 2.8, 0, 0.08, 1.4, 0.08);
  for (const [k, i] of MILK_KEYS.map((k, i) => [k, i])) P(scene, G.cyl, MILK[k].hex, CREAMERY.x + 0.5 + (i % 6) * 0.55, 0.35, CREAMERY.z - 5.5 - Math.floor(i / 6) * 0.6, 0.18, 0.7, 0.18);
  W.churn = churn; circC(CREAMERY.x - 2, CREAMERY.z - 6, 1.1);
  // pond
  disc(POND.x, POND.z, 9, 0x7fd3ff, 0.06); disc(POND.x, POND.z, 6, 0x9fe2ff, 0.07);
  for (let i = 0; i < 5; i++) { const a = rand(0, TAU); disc(POND.x + Math.cos(a) * 5, POND.z + Math.sin(a) * 5, 0.8, 0x6cc96a, 0.09); P(scene, G.sphLo, 0xff9fc0, POND.x + Math.cos(a) * 5, 0.2, POND.z + Math.sin(a) * 5, 0.2); }
  circC(POND.x, POND.z, 8.5);
  // clover patch
  for (let i = 0; i < 26; i++) { const a = rand(0, TAU), r = rand(0, 2.6); P(scene, G.sphLo, i % 5 ? 0x5fcf6a : 0xffffff, CLOVER.x + Math.cos(a) * r, 0.18, CLOVER.z + Math.sin(a) * r, 0.25, 0.15, 0.25); }
  W.clover = new THREE.Group(); W.clover.position.set(CLOVER.x, 0, CLOVER.z); scene.add(W.clover);
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; P(W.clover, G.sphLo, 0xff9fd2, Math.cos(a) * 1.2, 0.45, Math.sin(a) * 1.2, 0.18); }
  // water troughs
  P(scene, G.box, 0x8a6a4a, -20, 0.5, 36, 3, 1, 1.2); flat(-20, 36, 2.6, 0.9, 0x7fd3ff, 1.02); boxC(-20, 36, 3, 1.2);
}

function buildVillage() {
  sign(-62, 82, Math.PI / 2, ['Buttercup Hollow', 'Population: sweet']);
  // Hazel's Cheese Hut
  house(FARMERS.hazel.home.x, FARMERS.hazel.home.z + 6, Math.PI, 0xfff3a8, 0xffb347, { w: 7, d: 6, flowers: true });
  for (let i = 0; i < 4; i++) { const w = P(scene, G.cyl, 0xffd65a, FARMERS.hazel.home.x + 4 + (i % 2) * 1.6, 0.35 + Math.floor(i / 2) * 0.7, FARMERS.hazel.home.z + (i % 2), 0.7, 0.6, 0.7); }
  circC(FARMERS.hazel.home.x + 4.8, FARMERS.hazel.home.z + 0.5, 1.6);
  // Rowan's strawberry patch
  const rh = FARMERS.rowan.home;
  house(rh.x - 9, rh.z, Math.PI / 2, 0xffd6d6, 0xd94a4a, { w: 6, d: 6 });
  for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) {
    const x = rh.x + 2 + c * 1.6, z = rh.z - 4 + r * 2.6;
    P(scene, G.sphLo, 0x4fae4a, x, 0.3, z, 0.45, 0.3, 0.45);
    P(scene, G.sph, 0xff4f6f, x + 0.15, 0.32, z + 0.25, 0.2, 0.24, 0.2);
  }
  // Theo's mochi bakery
  const th = FARMERS.theo.home;
  house(th.x, th.z + 6, Math.PI, 0xe6f4ff, 0xff9fc0, { w: 8, d: 6, flowers: true });
  const aw = new THREE.Mesh(G.box, new THREE.MeshToonMaterial({ map: stripeTex('#ff9fc0', '#ffffff'), gradientMap: GRAD })); aw.position.set(th.x, 3.3, th.z + 2.6); aw.scale.set(8.4, 0.3, 1.6); aw.rotation.x = -0.3; aw.castShadow = true; scene.add(aw);
  for (let i = 0; i < 3; i++) for (const [c, y] of [[0xffb3cc, 0.5], [0xffffff, 0.85], [0xbfe3a6, 1.2]]) P(scene, G.sphLo, c, th.x + 5 + i * 0.8, y, th.z + 1, 0.18);
  sign(th.x - 5, th.z + 1, 0, ['Mochi House', 'Fresh daily']);
  // June's beehives
  const jh = FARMERS.june.home;
  house(jh.x - 8, jh.z - 2, Math.PI / 2, 0xfff0c2, 0x8a6bd1, { w: 6, d: 6, flowers: true });
  for (let i = 0; i < 4; i++) {
    const x = jh.x + 3 + (i % 2) * 3, z = jh.z - 3 + Math.floor(i / 2) * 3.4;
    for (let k = 0; k < 3; k++) P(scene, G.box, k % 2 ? 0xffd23f : 0xffe58a, x, 0.4 + k * 0.6, z, 1.4 - k * 0.12, 0.55, 1.2);
    circC(x, z, 0.9);
  }
  for (let i = 0; i < 14; i++) { const s = P(scene, G.sphLo, 0xffd23f, jh.x + 4, 1.5, jh.z, 0.09); s.castShadow = false; W.bees.push({ m: s, cx: jh.x + 4.5, cz: jh.z - 1, ph: rand(0, TAU), r: rand(1.5, 4) }); }
  for (let i = 0; i < 12; i++) { const x = jh.x + rand(-6, 12), z = jh.z + rand(5, 10); P(scene, G.cylLo, 0x4fae4a, x, 1.2, z, 0.07, 2.4, 0.07); P(scene, G.cyl, 0xffc83d, x, 2.5, z, 0.5, 0.12, 0.5).rotation.x = 0.4; P(scene, G.sphLo, 0x6b4a22, x, 2.5, z + 0.05, 0.22, 0.1, 0.22); }
  for (let i = 0; i < 6; i++) lamp(-70 - i * 9, 77);
}

function buildCity() {
  const wallMat = M(0xe2d2bb), N = 60, wallM = [], merM = [];
  for (let i = 0; i < N; i++) {
    const a0 = i / N * TAU, a1 = (i + 1) / N * TAU, am = (a0 + a1) / 2;
    if (Math.abs(wrapA(am)) < 0.15) continue;
    const x0 = C.x + Math.sin(a0) * WALL_R, z0 = C.z + Math.cos(a0) * WALL_R, x1 = C.x + Math.sin(a1) * WALL_R, z1 = C.z + Math.cos(a1) * WALL_R;
    const L = Math.hypot(x1 - x0, z1 - z0) + 0.4, ry = -Math.atan2(z1 - z0, x1 - x0);
    wallM.push(mtx((x0 + x1) / 2, 4, (z0 + z1) / 2, L, 8, 2.4, ry));
    for (let j = 0; j < 3; j++) { const t = (j + 0.5) / 3; merM.push(mtx(lerp(x0, x1, t), 8.6, lerp(z0, z1, t), 1.2, 1.2, 2.6, ry)); }
    segC(x0, z0, x1, z1);
  }
  inst(G.box, wallMat, wallM); inst(G.box, M(0xd4c2a8), merM);
  for (let i = 3; i < N; i += 6) { const a = i / N * TAU; if (Math.abs(wrapA(a)) < 0.3) continue; tower(C.x + Math.sin(a) * WALL_R, C.z + Math.cos(a) * WALL_R, 2.8, 12, i % 12 === 3 ? M(0xff9fbf) : M(0x8fc6ff)); }
  const ga = 0.112, gz = C.z + Math.cos(ga) * WALL_R, gx = Math.sin(ga) * WALL_R;
  tower(-gx, gz, 3.4, 14, M(0xff9fbf)); tower(gx, gz, 3.4, 14, M(0xff9fbf));
  P(scene, G.box, wallMat, 0, 12, gz, gx * 2, 3, 2.8);
  const bm = new THREE.MeshToonMaterial({ map: bannerTex('#ff8fb3', '#ffffff'), gradientMap: GRAD, side: THREE.DoubleSide });
  for (const s of [-1, 1]) { const bn = new THREE.Mesh(G.plane, bm); bn.position.set(s * 2.4, 8.6, gz + 1.5); bn.scale.set(2.2, 3.4, 1); scene.add(bn); }
  sign(6, -28, 0, ['The Sheep-a-verse', 'Praise the Great Spindle']);

  // Houses with wool roofs around the ring
  const avoid = [[SPINDLE, 15], [TEMPLE, 17], [MARKET, 15], [KEEP, 19], [BOARD, 7], [MARKET_PEN, 9]];
  let hi = 0;
  for (let ring = 0; ring < 2; ring++) for (let i = 0; i < 22; i++) {
    const a = (i + ring * 0.5) / 22 * TAU, r = ring ? 41 : 33;
    if (Math.abs(wrapA(a)) < 0.42) continue;
    const x = C.x + Math.sin(a) * r, z = C.z + Math.cos(a) * r;
    if (avoid.some(([p, rr]) => dist2(x, z, p.x, p.z) < rr)) continue;
    house(x, z, a + Math.PI, pick([0xffe3ef, 0xe6f4ff, 0xfff3c4, 0xe9ffe6, 0xf1e6ff]), pick([0xff9fbf, 0x8fc6ff, 0xb48cf0]), { wool: hi++ % 2 === 0, w: 5.5, d: 5.5, h: 4, flowers: Math.random() < 0.5 });
  }
  for (let i = 0; i < 12; i++) { const a = (i + 0.5) / 12 * TAU; lamp(C.x + Math.sin(a) * 27, C.z + Math.cos(a) * 27); }
  for (let z = 20; z >= -30; z -= 12) { lamp(-5, z); lamp(5, z); }

  // Castle keep
  const k = new THREE.Group(); k.position.set(KEEP.x, 0, KEEP.z); scene.add(k);
  P(k, G.box, 0xcfc0ec, 0, 7, 0, 22, 14, 13);
  P(k, G.box, 0x8a5a3b, 0, 2.6, 6.55, 4, 5.2, 0.2);
  for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) P(k, G.box, winMat, -8 + i * 4, 6 + j * 4.5, 6.55, 1.2, 1.8, 0.15);
  for (const [x, z] of [[-11, -6.5], [11, -6.5], [-11, 6.5], [11, 6.5]]) { P(k, G.cyl, 0xe2d2bb, x, 10, z, 3.2, 20, 3.2); P(k, G.cone, 0xff9fbf, x, 23.5, z, 4, 7, 4); }
  P(k, G.cyl, 0xe2d2bb, 0, 17, -1, 4.2, 34, 4.2); P(k, G.cone, 0x8fc6ff, 0, 38, -1, 5.2, 9, 5.2);
  P(k, G.cylLo, 0x8a6a4a, 0, 44, -1, 0.1, 4, 0.1);
  const fl = new THREE.Mesh(G.plane, bm); fl.position.set(1.6, 45, -1); fl.scale.set(3, 2.2, 1); k.add(fl); W.flag = fl;
  boxC(KEEP.x, KEEP.z, 22, 13); for (const [x, z] of [[-11, -6.5], [11, -6.5], [-11, 6.5], [11, 6.5]]) circC(KEEP.x + x, KEEP.z + z, 3.3);

  // Temple of the Great Sheep
  const t = new THREE.Group(); t.position.set(TEMPLE.x, 0, TEMPLE.z); scene.add(t);
  P(t, G.cyl, 0xbdb09a, 0, 0.5, 0, 11, 1, 11); P(t, G.cyl, 0xc9bda7, 0, 1.5, 0, 9.5, 1, 9.5); P(t, G.cyl, 0xd4c9b3, 0, 2.5, 0, 8, 1, 8);
  for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; P(t, G.cyl, 0xd8cdb6, Math.sin(a) * 8.6, 6, Math.cos(a) * 8.6, 0.6, 8, 0.6); P(t, G.box, M(0xffd23f, 0x221800), Math.sin(a) * 8.6, 10.2, Math.cos(a) * 8.6, 1.5, 0.5, 1.5); circC(TEMPLE.x + Math.sin(a) * 8.6, TEMPLE.z + Math.cos(a) * 8.6, 0.8); }
  const tr = P(t, G.torus, M(0xe8b830, 0x000000), 0, 10.6, 0, 8.6, 8.6, 8.6); tr.rotation.x = Math.PI / 2; tr.scale.set(8.6, 8.6, 30);
  const gs = makeGreatSheep(); gs.g.position.set(0, 3, 0); gs.g.rotation.y = Math.atan2(C.x - TEMPLE.x, C.z - TEMPLE.z); t.add(gs.g); W.greatSheep = gs;
  for (const s of [-1, 1]) {
    const bx = Math.sin(gs.g.rotation.y + s * 0.6) * 11.5, bz = Math.cos(gs.g.rotation.y + s * 0.6) * 11.5;
    P(t, G.cyl, 0x8a7a9a, bx, 1, bz, 0.7, 2, 0.7);
    const f = P(t, G.cone, M(0xffa53d, 0xff6a00), bx, 2.6, bz, 0.5, 1.4, 0.5); f.castShadow = false; W.flames.push(f);
    circC(TEMPLE.x + bx, TEMPLE.z + bz, 0.9);
  }
  circC(TEMPLE.x, TEMPLE.z, 7.5);

  // The Great Spindle
  const sp = new THREE.Group(); sp.position.set(SPINDLE.x, 0, SPINDLE.z); sp.rotation.y = Math.atan2(C.x - SPINDLE.x, C.z - SPINDLE.z) + Math.PI / 2; scene.add(sp);
  P(sp, G.cyl, 0xb9a6dc, 0, 0.6, 0, 7.5, 1.2, 7.5);
  for (const s of [-1, 1]) P(sp, G.box, 0xb98a5e, 0, 5.5, -2 + s * 0.9, 0.7, 10, 0.4);
  const wheel = new THREE.Group(); wheel.position.set(0, 7, -2); sp.add(wheel);
  P(wheel, G.torus, 0xb98a5e, 0, 0, 0, 5, 5, 5);
  for (let i = 0; i < 8; i++) P(wheel, G.box, 0xd9a876, 0, 0, 0, 9.8, 0.25, 0.25).rotation.z = i / 8 * Math.PI;
  P(wheel, G.sph, M(0xffd23f, 0x221800), 0, 0, 0, 0.6);
  W.spWheel = wheel;
  const spinner = new THREE.Group(); spinner.position.set(0, 1.2, 3.2); sp.add(spinner);
  P(spinner, G.cyl, 0xc89b6d, 0, 7, 0, 0.28, 14, 0.28);
  P(spinner, G.cyl, 0xb98a5e, 0, 1.6, 0, 2.2, 0.4, 2.2);
  W.cop = P(spinner, G.sph, M(0xfff6fb, 0x1a1418), 0, 6.5, 0, 1.6, 3.2, 1.6);
  for (let i = 0; i < 5; i++) { const r = P(spinner, G.torus, 0xff9fc0, 0, 4.5 + i * 1, 0, 1.5, 1.5, 1.5); r.rotation.x = Math.PI / 2; r.scale.set(1.62 - Math.abs(i - 2) * 0.12, 1.62 - Math.abs(i - 2) * 0.12, 3); }
  W.spinner = spinner;
  const ring = P(sp, G.torus, M(0xffd23f, 0x332200), 0, 16, 1, 3, 3, 3); ring.rotation.x = Math.PI / 2; ring.scale.set(3, 3, 8); W.spRing = ring;
  const band = P(sp, G.cylLo, 0xfff6fb, 0, 9.7, 0.6, 0.05, 6.6, 0.05); band.rotation.x = 0.95;
  for (let i = 0; i < 9; i++) { const a = rand(0, TAU), r = rand(8.5, 11); const yb = P(scene, G.sph, pick([0xff9fc0, 0x9fd8ff, 0xfff1a8, 0xc9b0ff, 0xffffff]), SPINDLE.x + Math.cos(a) * r, 0.6, SPINDLE.z + Math.sin(a) * r, 0.6); }
  circC(SPINDLE.x, SPINDLE.z, 7.6);
  const basket = new THREE.Group(); basket.position.set(SPINDLE.x + 7, 0, SPINDLE.z + 5); scene.add(basket);
  P(basket, G.cyl, 0xc89b6d, 0, 0.6, 0, 1.2, 1.2, 1.2); W.basketYarn = P(basket, G.sph, 0xff9fc0, 0, 1.2, 0, 0.9, 0.5, 0.9); circC(basket.position.x, basket.position.z, 1.3);

  // Heart of the Shield
  P(scene, G.cyl, 0xd9ccff, C.x, 0.6, C.z, 2.6, 1.2, 2.6); P(scene, G.cyl, 0xb9a6ff, C.x, 1.6, C.z, 1.6, 0.8, 1.6);
  W.crystal = P(scene, G.oct, M(0x7fe8ff, 0x1f6f8a), C.x, 4.5, C.z, 1.4, 2.1, 1.4);
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; const y = P(scene, G.cylLo, 0xff9fc0, C.x + Math.cos(a) * 1.6, 2.7, C.z + Math.sin(a) * 1.6, 0.06, 2.6, 0.06); y.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4); }
  circC(C.x, C.z, 2.8);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 58, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0x7fe8ff, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beam.position.set(C.x, 33, C.z); scene.add(beam); W.beam = beam;
  // Dome force field
  const hex = hexTexture(); hex.wrapS = hex.wrapT = THREE.RepeatWrapping; hex.repeat.set(12, 4);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(DOME_R, 72, 24, 0, TAU, 0, Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: hex, color: 0x6fe3ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false, fog: false }));
  dome.position.set(C.x, 0, C.z); dome.renderOrder = 2; scene.add(dome); W.dome = dome;
  const dr = new THREE.Mesh(new THREE.RingGeometry(DOME_R - 0.6, DOME_R + 0.6, 128), new THREE.MeshBasicMaterial({ color: 0x7fe8ff, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  dr.rotation.x = -Math.PI / 2; dr.position.set(C.x, 0.2, C.z); scene.add(dr); W.domeRing = dr;

  // Moo Market
  const awnTex = [stripeTex('#ff9fc0', '#fffaf0'), stripeTex('#9fd8ff', '#fffaf0'), stripeTex('#ffe27a', '#fffaf0')];
  const facing = Math.atan2(C.x - MARKET.x, C.z - MARKET.z);
  for (let i = 0; i < 3; i++) {
    const a = facing + Math.PI + (i - 1) * 0.75, x = MARKET.x + Math.sin(a) * 6.5, z = MARKET.z + Math.cos(a) * 6.5;
    const st = new THREE.Group(); st.position.set(x, 0, z); st.rotation.y = a + Math.PI; scene.add(st);
    for (const [px, pz] of [[-1.8, -1.2], [1.8, -1.2], [-1.8, 1.2], [1.8, 1.2]]) P(st, G.cylLo, 0xb98a5e, px, 1.6, pz, 0.12, 3.2, 0.12);
    P(st, G.box, 0xd9a876, 0, 0.8, 1.0, 4, 1.6, 0.9);
    const aw = new THREE.Mesh(G.box, new THREE.MeshToonMaterial({ map: awnTex[i], gradientMap: GRAD })); aw.position.set(0, 3.4, 0); aw.scale.set(4.6, 0.3, 3.2); aw.castShadow = true; st.add(aw);
    for (let j = 0; j < 8; j++) P(st, G.cyl, MILK[MILK_KEYS[(i * 4 + j) % MILK_KEYS.length]].hex, -1.5 + j * 0.42, 1.85, 1.0, 0.13, 0.5, 0.13);
    circC(x, z, 2.4);
  }
  // display pen
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; P(scene, G.cylLo, 0xfff4e0, MARKET_PEN.x + Math.cos(a) * 5, 0.7, MARKET_PEN.z + Math.sin(a) * 5, 0.14, 1.4, 0.14); }
  const pr = P(scene, G.torus, 0xfff4e0, MARKET_PEN.x, 1.1, MARKET_PEN.z, 5, 5, 5); pr.rotation.x = Math.PI / 2; pr.scale.set(5, 5, 1.5);
  circC(MARKET_PEN.x, MARKET_PEN.z, 5.2);
  // Quest board
  const qb = new THREE.Group(); qb.position.set(BOARD.x, 0, BOARD.z); scene.add(qb);
  for (const s of [-1, 1]) P(qb, G.cylLo, 0x8a5a3b, s * 1.6, 1.4, 0, 0.12, 2.8, 0.12);
  P(qb, G.box, 0xb98a5e, 0, 2.2, 0, 3.6, 2, 0.2); P(qb, G.cone4, 0x8c3b3b, 0, 3.6, 0, 2.6, 0.9, 0.5).rotation.y = Math.PI / 4;
  for (let i = 0; i < 5; i++) P(qb, G.box, 0xfffaf0, -1.2 + i * 0.6, 2.2 + (i % 2) * 0.3, 0.12, 0.45, 0.6, 0.02);
  circC(BOARD.x, BOARD.z, 1.8);
}

function segDist(x, z, ax, az, bx, bz) {
  const vx = bx - ax, vz = bz - az, L = vx * vx + vz * vz; let t = L ? ((x - ax) * vx + (z - az) * vz) / L : 0; t = clamp(t, 0, 1);
  return Math.hypot(x - (ax + vx * t), z - (az + vz * t));
}
function nearPolyline(x, z, pts, pad) { for (let i = 0; i < pts.length - 1; i++) if (segDist(x, z, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]) < pad) return true; return false; }
const STREAM = [[-196, -42], [-170, -36], [-150, -26], [-128, -12], [-108, -2], [-88, 6], [-70, 9], [-58, 8]];
function forestFree(x, z, pad = 0) {
  if (x > -66 - pad && x < 70 + pad && z > 18 - pad && z < 120) return false;           // farm
  if (x > -136 - pad && x < -58 + pad && z > 28 - pad && z < 120) return false;          // Buttercup Hollow
  if (Math.abs(x) < 9 + pad && z > -45 && z < 120) return false;                          // main road
  if (dist2(x, z, C.x, C.z) < DOME_R + 7 + pad) return false;                              // castle & shield
  if (Math.abs(z + 20) < 5 + pad && x > 8 && x < 165) return false;                        // Whisker Woods road
  if (dist2(x, z, CAVE_DOOR.x + 8, CAVE_DOOR.z) < 22 + pad) return false;                  // cave mountain
  if (dist2(x, z, POND.x, POND.z) < 12 + pad) return false;
  for (const c of CLEARINGS) if (dist2(x, z, c.x, c.z) < c.r + 3 + pad) return false;
  for (const t of FOREST_TRAILS) if (nearPolyline(x, z, t, 4.2 + pad)) return false;
  if (nearPolyline(x, z, STREAM, 4 + pad)) return false;
  return true;
}
function buildWoods() {
  const round = [], pine = [], birch = [], purple = [], bush1 = [], bush2 = [], grass = [], rocks = [], boulders = [], moss = [], stumps = [], logs = [], logEnds = [], capsR = [], capsB = [], stems = [];
  const flowers = { 0xff7aa8: [], 0xffe27a: [], 0xffffff: [], 0xc9a8ff: [], 0xff9f5a: [] }, fkeys = Object.keys(flowers);
  // trees on a jittered grid so the forest is thick but walkable between trunks
  const S = 5.4;
  for (let gx = -194; gx <= 194; gx += S) for (let gz = -177; gz <= 137; gz += S) {
    const x = gx + rand(-1.8, 1.8), z = gz + rand(-1.8, 1.8);
    if (!forestFree(x, z) || Math.random() < 0.12) continue;
    const s = rand(0.85, 1.5);
    if (x > 118) purple.push({ x, z, s });
    else { const r = Math.random(); (r < 0.52 ? round : r < 0.85 ? pine : birch).push({ x, z, s }); }
    circC(x, z, 0.55 * s);
    if (Math.random() < 0.55) (Math.random() < 0.5 ? bush1 : bush2).push(mtx(x + rand(-2.6, 2.6), 0.35, z + rand(-2.6, 2.6), rand(0.7, 1.3), rand(0.55, 0.9), rand(0.7, 1.3)));
    if (Math.random() < 0.9) grass.push(mtx(x + rand(-2.7, 2.7), 0.25, z + rand(-2.7, 2.7), 0.18, rand(0.4, 0.7), 0.18, rand(0, 3)));
    if (Math.random() < 0.35) flowers[pick(fkeys)].push(mtx(x + rand(-2.7, 2.7), 0.16, z + rand(-2.7, 2.7), 0.16, 0.12, 0.16));
  }
  W.treePts = round.concat(pine, birch).map(t => [t.x, t.z]); W.purplePts = purple.map(t => [t.x, t.z]);
  // trees
  treeInstances(round, 0x5fbf62, 0x86d97e, 0x8a5e44);
  treeInstances(purple, 0x9a7bd9, 0xbba2ef, 0x5e4470);
  const pineM = [], pineM2 = [], pineTrunk = [];
  for (const t of pine) { pineTrunk.push(mtx(t.x, 1.1 * t.s, t.z, 0.3 * t.s, 2.2 * t.s, 0.3 * t.s)); pineM.push(mtx(t.x, 3.2 * t.s, t.z, 2.0 * t.s, 3.4 * t.s, 2.0 * t.s)); pineM2.push(mtx(t.x, 5.2 * t.s, t.z, 1.4 * t.s, 2.8 * t.s, 1.4 * t.s)); }
  const cone8 = new THREE.ConeGeometry(1, 1, 8);
  inst(G.cylLo, M(0x7a5038), pineTrunk); inst(cone8, M(0x3f9f63), pineM); inst(cone8, M(0x4fb571), pineM2);
  const bT = [], bC = [];
  for (const t of birch) { bT.push(mtx(t.x, 1.8 * t.s, t.z, 0.24 * t.s, 3.6 * t.s, 0.24 * t.s)); bC.push(mtx(t.x, 4.3 * t.s, t.z, 1.5 * t.s, 1.9 * t.s, 1.5 * t.s)); }
  inst(G.cylLo, M(0xf1ece2), bT); inst(G.sphLo, M(0xa8de7a), bC);
  // undergrowth
  inst(G.sphLo, M(0x56b05a), bush1, false); inst(G.sphLo, M(0x6fc565), bush2, false);
  inst(G.cone4, M(0x5aa94f), grass, false);
  // rocks, boulders, stumps, fallen logs, mushrooms scattered through the woods
  const spot = (pad = 0) => { for (let i = 0; i < 40; i++) { const x = rand(-192, 192), z = rand(-176, 136); if (forestFree(x, z, pad)) return { x, z }; } return null; };
  for (let i = 0; i < 260; i++) { const p = spot(); if (p) rocks.push(mtx(p.x, 0.25, p.z, rand(0.35, 0.9), rand(0.25, 0.6), rand(0.35, 0.9), rand(0, 3), rand(0, 1))); }
  for (let i = 0; i < 70; i++) {
    const p = spot(1); if (!p) continue; const s = rand(1.6, 3.4);
    boulders.push(mtx(p.x, s * 0.55, p.z, s, s * rand(0.75, 1.05), s * rand(0.85, 1.15), rand(0, 3), rand(0, 0.4)));
    if (Math.random() < 0.6) moss.push(mtx(p.x, s * 1.05, p.z, s * 0.75, s * 0.25, s * 0.7, rand(0, 3)));
    circC(p.x, p.z, s * 0.95);
  }
  for (let i = 0; i < 70; i++) { const p = spot(); if (!p) continue; const r = rand(0.45, 0.8); stumps.push(mtx(p.x, 0.35, p.z, r, 0.7, r)); circC(p.x, p.z, r); }
  for (let i = 0; i < 80; i++) {
    const p = spot(1); if (!p) continue; const L = rand(3, 6.5), r = rand(0.38, 0.6), ry = rand(0, Math.PI);
    logs.push(mtx(p.x, r, p.z, r, L, r, ry, 0, Math.PI / 2));
    const dx = Math.cos(ry) * L / 2, dz = -Math.sin(ry) * L / 2;
    for (const sgn of [-1, 1]) logEnds.push(mtx(p.x + dx * sgn * 1.01, r, p.z + dz * sgn * 1.01, r * 0.92, 0.05, r * 0.92, ry, 0, Math.PI / 2));
    segC(p.x - dx, p.z - dz, p.x + dx, p.z + dz, true); // low: hop over logs with Space
  }
  for (let i = 0; i < 90; i++) {
    const p = spot(); if (!p) continue; const n = randi(3, 7);
    for (let j = 0; j < n; j++) {
      const a = j / n * TAU, rr = rand(0.6, 1.4), x = p.x + Math.cos(a) * rr, z = p.z + Math.sin(a) * rr, s = rand(0.7, 1.3);
      stems.push(mtx(x, 0.2 * s, z, 0.07 * s, 0.4 * s, 0.07 * s));
      (Math.random() < 0.6 ? capsR : capsB).push(mtx(x, 0.42 * s, z, 0.26 * s, 0.15 * s, 0.26 * s));
    }
  }
  inst(G.dodec, M(0x9a96a8), rocks); inst(G.dodec, M(0x8e8aa0), boulders); inst(G.sphLo, M(0x6fae5a), moss, false);
  inst(G.cylLo, M(0x8a5e44), stumps); inst(G.cylLo, M(0x7a5038), logs); inst(G.cylLo, M(0xd9b48a), logEnds, false);
  inst(G.cylLo, M(0xfff4e0), stems, false); inst(G.sphLo, M(0xff5d6c), capsR, false); inst(G.sphLo, M(0xc9935a), capsB, false);
  // meadow flowers everywhere outside the city
  for (let i = 0; i < 900; i++) { const x = rand(-192, 192), z = rand(-176, 136); if (dist2(x, z, C.x, C.z) < 52) continue; flowers[pick(fkeys)].push(mtx(x, 0.15, z, 0.17, 0.12, 0.17)); }
  // the stream: shallow and walkable
  for (let i = 0; i < STREAM.length - 1; i++) {
    const [ax, az] = STREAM[i], [bx, bz] = STREAM[i + 1], n = Math.ceil(Math.hypot(bx - ax, bz - az) / 1.8);
    for (let j = 0; j < n; j++) { const t = j / n, x = lerp(ax, bx, t), z = lerp(az, bz, t); disc(x, z, rand(2.8, 3.3), 0x8fd3a0, 0.025); disc(x, z, rand(2.1, 2.5), 0x6fc3ee, 0.04); }
  }
  disc(-58, 8, 6, 0x8fd3a0, 0.025); disc(-58, 8, 5, 0x6fc3ee, 0.04);
  W.stream = STREAM;
  // forest trails and clearings
  for (const t of FOREST_TRAILS) for (let i = 0; i < t.length - 1; i++) {
    const [ax, az] = t[i], [bx, bz] = t[i + 1], L = Math.hypot(bx - ax, bz - az);
    const m = flat((ax + bx) / 2, (az + bz) / 2, 4, L + 3, 0xc9ab7a, 0.045); m.rotation.z = Math.atan2(bx - ax, bz - az);
  }
  for (const c of CLEARINGS) {
    disc(c.x, c.z, c.r + 2, 0xa6dc84, 0.03);
    for (let i = 0; i < 40; i++) { const a = rand(0, TAU), r = rand(c.r - 2, c.r + 1.5); flowers[pick(fkeys)].push(mtx(c.x + Math.cos(a) * r, 0.16, c.z + Math.sin(a) * r, 0.2, 0.14, 0.2)); }
  }
  for (const k of fkeys) inst(G.sphLo, M(+k), flowers[k], false);
  disc(150, -20, 50, 0x9cc292, 0.015);
  // Catnap Cavern: the mountain sits behind the entrance so the archway faces the road and the camera
  const mx = CAVE_DOOR.x + 2, mz = CAVE_DOOR.z - 17;
  const mt = new THREE.Group(); mt.position.set(mx, 0, mz); scene.add(mt);
  for (let i = 0; i < 16; i++) {
    const a = rand(0, TAU), r = rand(5, 13), x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (z > 5 && Math.abs(x) < 9) continue; // keep the front clear
    const sz = rand(5, 9); const rk = P(mt, G.dodec, pick([0x8a7f9e, 0x7a6f8e, 0x9a90ad]), x, sz * 0.55, z - 2, sz, sz * rand(0.9, 1.4), sz); rk.rotation.set(rand(0, 3), rand(0, 3), 0);
  }
  P(mt, G.dodec, 0x8a7f9e, 0, 13, -5, 13, 16, 12).rotation.set(0.3, 0.6, 0);
  P(mt, G.dodec, 0x9a90ad, 0, 4, 3, 9, 6, 6).rotation.set(0, 0.4, 0);
  // stone archway and dark mouth facing south
  const arch = new THREE.Group(); arch.position.set(CAVE_DOOR.x, 0, CAVE_DOOR.z - 7.2); scene.add(arch);
  const mouth = new THREE.Mesh(new THREE.CircleGeometry(4.2, 32, 0, Math.PI), MB(0x120c1a)); mouth.position.set(0, 0.02, 0.25); arch.add(mouth);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(4.4, 0.75, 10, 24, Math.PI), M(0x6e6482)); ring.position.set(0, 0, 0.3); ring.castShadow = true; arch.add(ring);
  for (const s of [-1, 1]) P(arch, G.box, 0x6e6482, s * 4.4, 0.4, 0.3, 1.6, 0.8, 1.6);
  P(arch, G.box, 0x5a4b78, 0, 0.03, 2.4, 6.5, 0.06, 5).castShadow = false; // dark path into the cave
  for (const s of [-1, 1]) {
    P(arch, G.cylLo, 0x5b4a3a, s * 6, 1.4, 1.2, 0.14, 2.8, 0.14);
    const fl = P(arch, G.cone, M(0xffa53d, 0xff6a00), s * 6, 3.15, 1.2, 0.35, 0.9, 0.35); fl.castShadow = false; W.flames.push(fl);
  }
  W.caveEyes = mt;
  circC(mx, mz, 12); circC(mx - 9, mz + 3, 6); circC(mx + 9, mz + 3, 6);
  circC(CAVE_DOOR.x - 5.4, CAVE_DOOR.z - 6.9, 1.2); circC(CAVE_DOOR.x + 5.4, CAVE_DOOR.z - 6.9, 1.2);
  sign(CAVE_DOOR.x + 8, CAVE_DOOR.z - 1, 0, ['Catnap Cavern', 'Do NOT wake the King']);
}

function buildCave() {
  const cx = CAVE.x, cz = CAVE.z;
  disc(cx, cz, 40, 0x3a3150, 0.04); disc(cx, cz, 30, 0x4a3f63, 0.05); disc(cx, cz, 8, 0x5a4b78, 0.06);
  for (let i = 0; i < 40; i++) { const a = i / 40 * TAU; const r = CAVE.r + rand(1, 4); const south = Math.cos(a) > 0.2; const s = south ? rand(1.5, 2.5) : rand(4, 8); const rk = P(scene, G.dodec, pick([0x4a3f63, 0x3a3150, 0x5a4b78]), cx + Math.sin(a) * r, s * 0.5, cz + Math.cos(a) * r, s, south ? s : s * rand(1, 2), s); rk.rotation.set(rand(0, 3), rand(0, 3), 0); }
  for (let i = 0; i < 18; i++) {
    const a = rand(0, TAU), r = rand(10, CAVE.r - 3);
    const col = pick([0xff7ad9, 0x7fe8ff, 0xc9a8ff, 0xffe27a]);
    const cr = P(scene, G.oct, M(col, col & 0x7f7f7f), cx + Math.sin(a) * r, 1, cz + Math.cos(a) * r, 0.6, rand(1.2, 2.4), 0.6);
    cr.rotation.z = rand(-0.4, 0.4); W.caveCrystals.push(cr); circC(cr.position.x, cr.position.z, 0.7);
  }
  // royal cushion & yarn hoard
  P(scene, G.sph, 0x9b1c4a, cx, 0.8, cz - 22, 7, 1.4, 5); P(scene, G.sph, 0xffcf3d, cx, 1.6, cz - 22, 6.2, 0.4, 4.4);
  for (let i = 0; i < 16; i++) P(scene, G.sph, pick([0xff9fc0, 0x9fd8ff, 0xfff1a8, 0xc9b0ff]), cx + rand(-14, 14), 0.7, cz - rand(20, 30), rand(0.6, 1.1));
  for (let i = 0; i < 8; i++) { const fb = P(scene, G.box, 0xd9d4e8, cx + rand(-20, 20), 0.1, cz + rand(-20, 20), 1.6, 0.1, 0.25); fb.rotation.y = rand(0, 3); }
  // the Seraph Sheep's cage
  const cage = new THREE.Group(); cage.position.set(cx + 16, 0, cz - 12); scene.add(cage);
  P(cage, G.cyl, 0x5a4b78, 0, 0.25, 0, 3.4, 0.5, 3.4); P(cage, G.cyl, M(0xffcf3d, 0x221800), 0, 5.2, 0, 3.4, 0.3, 3.4);
  P(cage, G.cone, M(0xffcf3d, 0x221800), 0, 6.2, 0, 3.6, 1.8, 3.6);
  const bars = new THREE.Group(); cage.add(bars);
  for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; P(bars, G.cylLo, 0xffd23f, Math.cos(a) * 3.2, 2.7, Math.sin(a) * 3.2, 0.1, 5, 0.1); }
  W.cageBars = bars; W.cage = cage; circC(cage.position.x, cage.position.z, 3.6);
  // exit portal
  const portal = new THREE.Mesh(G.torus, MB(0x7fe8ff)); portal.position.set(cx, 2.5, cz + 20); portal.scale.setScalar(2.4); scene.add(portal); W.portal = portal;
  const pf = new THREE.Mesh(G.circle, new THREE.MeshBasicMaterial({ color: 0xbff4ff, transparent: true, opacity: 0.45, side: THREE.DoubleSide })); pf.position.copy(portal.position); pf.scale.setScalar(2.3); scene.add(pf);
  const cl = new THREE.PointLight(0xc9a8ff, 0, 90, 1.5); cl.position.set(cx, 18, cz); scene.add(cl); W.caveLight = cl;
}

function buildSky() {
  for (let i = 0; i < 14; i++) {
    const g = new THREE.Group(); g.position.set(rand(-220, 220), rand(45, 70), rand(-200, 150)); scene.add(g);
    for (let j = 0; j < 5; j++) { const m = P(g, G.sphLo, M(0xffffff, 0x303030), rand(-6, 6), rand(-1, 1.5), rand(-3, 3), rand(3, 5.5)); m.castShadow = false; }
    W.clouds.push({ g, v: rand(1, 3) });
  }
  const sp = []; for (let i = 0; i < 500; i++) { const a = rand(0, TAU), b = rand(0.1, 1.4); sp.push(Math.cos(a) * Math.cos(b) * 420, Math.sin(b) * 420, Math.sin(a) * Math.cos(b) * 420); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  W.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  scene.add(W.stars);
}
