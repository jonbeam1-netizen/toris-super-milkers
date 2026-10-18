'use strict';
/* ============================================================
   Exploring: wild cows & sheep, bramble locks, followers,
   forest kittens, the Super Milker fusion and endless raids
   ============================================================ */
const wilds = [], followers = [];
const COW_TYPES = Object.keys(COWS).filter(k => !COWS[k].special);
const SHEEP_TYPES = Object.keys(BREEDS);
let roamT = 0, fusion = null, unlockT = 0;

const wildId = (c, i) => c.id + '-' + i;
function homeOf(species, type) {
  for (const c of CLEARINGS) if (c.animals.some(a => (species === 'cow' ? a.c : a.s) === type)) return c;
  return null;
}
/* ---------- Discovery order ---------- */
function unlockReq(species, type) { return (UNLOCKS[species] || {})[type] || {}; }
function isUnlocked(species, type) {
  const r = unlockReq(species, type);
  if (r.quest !== undefined && state.quest.i < r.quest) return false;
  if (r.after && !(species === 'cow' ? state.found.cows[r.after] : state.found.sheep[r.after])) return false;
  return true;
}
function lockReason(species, type) {
  const r = unlockReq(species, type), parts = [];
  if (r.after && !(species === 'cow' ? state.found.cows[r.after] : state.found.sheep[r.after])) parts.push(`Find the ${species === 'cow' ? COWS[r.after].name : BREEDS[r.after].name} first`);
  if (r.quest !== undefined && state.quest.i < r.quest) parts.push(`${parts.length ? 'and reach' : 'Reach'} the quest "${QUESTS[r.quest].title}"`);
  return parts.join(' ');
}
function nextCowGoal() {
  for (const t of COW_ORDER) if (!state.found.cows[t]) {
    const home = homeOf('cow', t);
    return { type: t, name: COWS[t].name, open: isUnlocked('cow', t), where: home ? home.where : 'somewhere in the woods', why: lockReason('cow', t) };
  }
  return null;
}

function spawnWilds() {
  for (const w of wilds) { scene.remove(w.g); if (w.bramble) scene.remove(w.bramble); if (w.col) w.col[2] = 0; if (w.bubbleEl) w.bubbleEl.remove(); }
  wilds.length = 0; followers.length = 0;
  for (const c of CLEARINGS) c.animals.forEach((a, i) => {
    const id = wildId(c, i); if (state.wild[id]) return;
    const sp = wildSpot(id, c), w = makeWild(a.c ? 'cow' : 'sheep', a.c || a.s, id, { x: sp.x, z: sp.z, r: 2.5, cid: id });
    if (!isUnlocked(w.species, w.type)) lockWild(w);
  });
  if (!state.wild.seraph) {
    const w = makeWild('sheep', 'seraph', 'seraph', { x: W.cage.position.x, z: W.cage.position.z, r: 1.4 });
    w.cave = true; w.caged = !state.flags.clawdius;
  }
  W.cageBars.visible = !state.flags.clawdius;
}
/* A locked animal is visible but trapped, with a bubble saying what to do before you can rescue it */
const TRAPS = ['vines', 'cage', 'yarn', 'mud', 'net', 'ice'];
const TRAP_TEXT = { vines: 'tangled in thorny vines', cage: 'locked in a kitten cage', yarn: 'wrapped in a giant yarn ball', mud: 'stuck in sticky mud', net: 'caught under a kitten net', ice: 'frozen in a block of milk ice' };
const _thorn = new THREE.ConeGeometry(0.1, 0.5, 5);
function trapFor(w) { const i = w.species === 'cow' ? COW_ORDER.indexOf(w.type) : SHEEP_TYPES.indexOf(w.type) + 3; return TRAPS[(i + TRAPS.length) % TRAPS.length]; }
function buildTrap(kind, x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
  if (kind === 'vines') {
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, s = rand(0.8, 1.2); const b = P(g, G.sphLo, pick([0x3d5a3a, 0x4a3a5a]), Math.cos(a) * 2.6, s * 0.6, Math.sin(a) * 2.6, s, s * 0.8, s); for (let j = 0; j < 3; j++) { const t = new THREE.Mesh(_thorn, M(0xe9dcc6)); t.position.set(rand(-0.6, 0.6), rand(0, 0.7), rand(-0.6, 0.6)); t.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3)); b.add(t); } }
    for (let i = 0; i < 3; i++) { const v = P(g, G.torus, 0x3f7a3a, 0, 0.2, 0, 2.6, 2.6, 6); v.rotation.set(0, i * 1.05, Math.PI / 2); }
  } else if (kind === 'cage') {
    P(g, G.cyl, 0x8a5e44, 0, 0.12, 0, 2.6, 0.24, 2.6); P(g, G.cyl, 0x8a5e44, 0, 3.7, 0, 2.6, 0.24, 2.6); P(g, G.cone, 0xb04a4a, 0, 4.5, 0, 2.9, 1.4, 2.9);
    for (let i = 0; i < 14; i++) { const a = i / 14 * TAU; P(g, G.cylLo, 0x6b4a33, Math.cos(a) * 2.5, 1.9, Math.sin(a) * 2.5, 0.09, 3.6, 0.09); }
    P(g, G.box, 0xffd23f, 0, 1.9, 2.6, 0.5, 0.6, 0.2);
  } else if (kind === 'yarn') {
    for (let i = 0; i < 5; i++) { const t = P(g, G.torus, pick([0xff9fc0, 0xc9b0ff, 0xff7ad9]), 0, 1.6, 0, 2.3, 2.3, 4); t.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3)); }
    P(g, G.sph, 0xff9fc0, 2.4, 0.7, 1.6, 0.7);
  } else if (kind === 'mud') {
    const m = new THREE.Mesh(G.circle, M(0x6b4a2e)); m.rotation.x = -Math.PI / 2; m.position.y = 0.06; m.scale.setScalar(3.2); m.receiveShadow = true; g.add(m);
    for (let i = 0; i < 9; i++) P(g, G.sphLo, 0x7d5a3a, rand(-2.4, 2.4), 0.1, rand(-2.4, 2.4), rand(0.15, 0.35), 0.12, rand(0.15, 0.35)).castShadow = false;
  } else if (kind === 'net') {
    const net = new THREE.Mesh(new THREE.SphereGeometry(2.9, 12, 6, 0, TAU, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x8a6a4a, wireframe: true })); g.add(net);
    for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + 0.4; P(g, G.cylLo, 0x6b4a33, Math.cos(a) * 2.9, 0.4, Math.sin(a) * 2.9, 0.1, 0.8, 0.1); }
  } else if (kind === 'ice') {
    const ice = new THREE.Mesh(G.box, new THREE.MeshToonMaterial({ color: 0xcff4ff, gradientMap: GRAD, transparent: true, opacity: 0.5, emissive: 0x1a3a44 })); ice.position.y = 1.6; ice.scale.set(3.6, 3.3, 4.6); g.add(ice);
    for (let i = 0; i < 6; i++) P(g, G.oct, M(0xe6fbff, 0x1a3a44), rand(-2, 2), 0.3, rand(-2.6, 2.6), 0.4, 0.6, 0.4);
  }
  return g;
}
function lockWild(w) {
  w.locked = true; w.trap = trapFor(w);
  w.g.position.set(w.home.x, w.trap === 'mud' ? -0.7 : 0, w.home.z);
  w.bramble = buildTrap(w.trap, w.home.x, w.home.z); circs.push(w.col = [w.home.x, w.home.z, 3.1]);
  w.mk.visible = false;
  const el = document.createElement('div'); el.className = 'bubble trapb'; floaters.appendChild(el); w.bubbleEl = el;
  w.it = { kind: 'trapped', ent: w };
}
function unlockWild(w) {
  w.locked = false; w.g.position.y = 0; if (w.col) w.col[2] = 0;
  w.it = { kind: 'wild', ent: w };
  if (w.bubbleEl) { w.bubbleEl.remove(); w.bubbleEl = null; }
  const br = w.bramble; w.bramble = null;
  if (br) { burst('sparkle', w.home.x, 2, w.home.z, 24, 0xd9ffb0); let t = 0; const shrink = () => { t += 0.05; br.scale.setScalar(Math.max(0.01, 1 - t)); if (t < 1) setTimeout(shrink, 30); else scene.remove(br); }; shrink(); }
  spawnGuardsFor(w);
}
function refreshUnlocks() {
  const opened = {};
  for (const w of wilds) if (w.locked && isUnlocked(w.species, w.type)) { unlockWild(w); opened[w.species + ':' + w.type] = w; }
  for (const k in opened) {
    const w = opened[k], home = homeOf(w.species, w.type);
    toast(`The ${wildName(w)} broke free of its trap! It's waiting ${home ? home.where : 'in the woods'}.`, 'love'); sfx('bless');
  }
}
/* Bubbles over trapped animals: what you must do before you can rescue them */
function updateTrapBubbles() {
  for (const w of wilds) {
    if (!w.locked || !w.bubbleEl) continue;
    const pos = w.g.position, d = dist2(px(), pz(), pos.x, pos.z);
    if (player.inCave || !$('#modal').hidden || d > 34) { w.bubbleEl.style.opacity = 0; continue; }
    const text = `${wildName(w)} is ${TRAP_TEXT[w.trap]}! ${lockReason(w.species, w.type)} to rescue it.`;
    if (w.bubbleEl.textContent !== text) w.bubbleEl.textContent = text;
    _v.set(pos.x, (w.species === 'cow' ? 4.6 : 3.6) + (w.trap === 'cage' ? 1.2 : 0), pos.z).project(camera);
    w.bubbleEl.style.transform = `translate(${((_v.x * 0.5 + 0.5) * innerWidth).toFixed(0)}px,${((-_v.y * 0.5 + 0.5) * innerHeight).toFixed(0)}px) translate(-50%,-100%)`;
    w.bubbleEl.style.opacity = _v.z > 1 ? 0 : 1;
  }
}
/* Each wild animal hides at its own spot deep among the trees, somewhere in its region.
   The spot is seeded by its id, so it stays put between visits. */
function wildSpot(id, c) {
  let h = 2166136261; for (const ch of id) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  const rnd = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return (h >>> 0) / 4294967296; };
  for (let t = 0; t < 400; t++) {
    const a = rnd() * TAU, r = 14 + rnd() * 42, x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
    if (x < -188 || x > 188 || z < -172 || z > 132) continue;
    if (forestFree(x, z, 2)) return { x, z };
  }
  return { x: c.x, z: c.z };
}
function makeWild(species, type, id, home) {
  const m = species === 'cow' ? makeCow(type) : makeSheep(type);
  if (species === 'sheep') {
    const base = BREEDS[type].base; fleeceColor(base, m.fleeceMat.color); m.fleece.scale.setScalar(1);
    m.halo.visible = base >= 92; if (base >= 80) m.fleeceMat.emissive.setHex(0x141414);
  }
  const a = rand(0, TAU), r = rand(0, home.r);
  m.g.position.set(home.x + Math.cos(a) * r, 0, home.z + Math.sin(a) * r); m.g.rotation.order = 'YXZ'; scene.add(m.g);
  const isNew = species === 'cow' ? !state.found.cows[type] : !state.found.sheep[type];
  const mk = new THREE.Sprite(new THREE.SpriteMaterial({ map: badgeTex(isNew ? '?' : '+', isNew ? '#ffc83d' : '#bfe8ff'), depthWrite: false }));
  mk.scale.setScalar(0.9); mk.position.y = species === 'cow' ? 4.6 : 3.6; m.g.add(mk);
  const w = { id, species, type, m, g: m.g, home, tx: m.g.position.x, tz: m.g.position.z, timer: rand(0, 4), walk: rand(0, 6), moving: false, follow: false, mk, cave: false, caged: false, warnT: 0, locked: false };
  w.it = { kind: 'wild', ent: w }; wilds.push(w); return w;
}
const wildName = w => w.species === 'cow' ? COWS[w.type].name : BREEDS[w.type].name;
function guardsAt(w) { return w.home.cid ? kittens.filter(k => k.guard && k.state === 'move' && k.cid === w.home.cid).length : 0; }
function befriend(w) {
  if (w.locked) return;
  if (w.caged) { toast('The cage is locked tight. Only defeating King Clawdius will open it.'); return; }
  const g = guardsAt(w);
  if (g) { toast(`${g} guard kitten${g > 1 ? 's are' : ' is'} watching this one! Bonk ${g > 1 ? 'them' : 'it'} with a cow first.`, 'bad'); return; }
  if (followers.length >= 4) { toast('Four animals are already following you. Take them home first!'); return; }
  w.follow = true; followers.push(w); w.mk.visible = false;
  burst('heart', w.g.position.x, 2.5, w.g.position.z, 8); sfx(w.species === 'cow' ? 'moo' : 'baa');
  toast(`The ${wildName(w)} is following you! Lead it into your ${w.species === 'cow' ? 'cow pasture' : 'sheep meadow'}.`, 'love');
}
function stopFollow(w) {
  w.follow = false; followers.splice(followers.indexOf(w), 1); w.mk.visible = true;
  w.home = { x: w.g.position.x, z: w.g.position.z, r: 3 };
}
function joinFarm(w) {
  const list = w.species === 'cow' ? state.cows : state.sheep;
  if (list.length >= animalCap()) { if (w.warnT <= 0) { w.warnT = 6; toast(`Your ${w.species === 'cow' ? 'pasture' : 'meadow'} is full! Buy the "Barn & Meadow" upgrade at the Moo Market.`, 'bad'); } return; }
  const x = w.g.position.x, z = w.g.position.z, isNew = w.species === 'cow' ? !state.found.cows[w.type] : !state.found.sheep[w.type];
  if (w.type === 'seraph') setTimeout(() => toast('The Seraph Sheep is home! Its holy fleece wraps the city in a golden shield: +100 max power, and it barely needs any yarn now.', 'good'), 1500);
  if (w.species === 'cow') { const d = { type: w.type, x, z }; state.cows.push(d); normCow(d); spawnCowEnt(d); state.found.cows[w.type] = 1; }
  else { const d = { breed: w.type, x, z, fleece: 0.6 }; state.sheep.push(d); normSheep(d); spawnSheepEnt(d); state.found.sheep[w.type] = 1; }
  state.wild[w.id] = true; scene.remove(w.g); wilds.splice(wilds.indexOf(w), 1); followers.splice(followers.indexOf(w), 1);
  stat('tamed'); addXP(isNew ? 45 : 20); sfx('love'); burst('sparkle', x, 2, z, 20);
  toast(isNew ? `NEW BREED! The ${wildName(w)} joined your farm. Check your Herd Book!` : `The ${wildName(w)} joined your farm!`, 'love');
  for (const o of wilds) if (o.type === w.type && o.species === w.species) o.mk.material.map = badgeTex('+', '#bfe8ff');
  refreshUnlocks();
}
function updateWild(dt) {
  unlockT -= dt; if (unlockT <= 0) { unlockT = 1; refreshUnlocks(); }
  const spd = UPG.boots.vals[state.upg.boots] * 1.15;
  for (let i = wilds.length - 1; i >= 0; i--) {
    const w = wilds[i], pos = w.g.position; w.warnT -= dt;
    if (w.locked) continue;
    w.mk.position.y = (w.species === 'cow' ? 4.6 : 3.6) + Math.sin(elapsed * 3 + w.walk) * 0.15;
    w.mk.visible = !w.follow && dist2(pos.x, pos.z, px(), pz()) < 12;
    if (w.follow) {
      const idx = followers.indexOf(w), want = 2.8 + idx * 2, d = dist2(pos.x, pos.z, px(), pz());
      if (d > 70) { pos.set(px() - Math.sin(player.face) * want, 0, pz() - Math.cos(player.face) * want); continue; }
      let mv = false;
      if (d > want) { const k = Math.min(spd * (d > want + 6 ? 1.3 : 1), d * 3) * dt; pos.x += (px() - pos.x) / d * k; pos.z += (pz() - pos.z) / d * k; mv = true; w.g.rotation.y = turnTo(w.g.rotation.y, Math.atan2(px() - pos.x, pz() - pos.z), Math.min(1, dt * 8)); }
      w.walk += mv ? dt * 10 : 0; const s = mv ? Math.sin(w.walk) * 0.5 : 0; w.m.legs.forEach((L, j) => L.rotation.x = (j === 0 || j === 3) ? s : -s);
      pos.y = mv ? Math.abs(Math.sin(w.walk)) * 0.15 : 0;
      if (!player.inCave && !w.cave && inRect(pos.x, pos.z, w.species === 'cow' ? COW_PEN : SHEEP_PEN, 1.5)) joinFarm(w);
      continue;
    }
    if (w.cave !== player.inCave && w.cave) continue;
    wander(w, dt, () => { const a = rand(0, TAU), r = rand(0, w.home.r); return { x: w.home.x + Math.cos(a) * r, z: w.home.z + Math.sin(a) * r }; }, 1.1, w.m.legs);
  }
}
function moveFollowersTo(x, z, inCave) {
  followers.forEach((w, i) => { w.cave = inCave; w.g.position.set(x + rand(-2, 2), 0, z + 3 + i * 2); });
  for (const e of cowEnts) if (e.following) e.g.position.set(x + rand(-4, 4), 0, z + 4 + rand(0, 4));
}

/* ---------- Kittens of the forest: they chase you, then give up and go home ---------- */
function spawnForestKitten(type, x, z, guard) {
  const k = spawnKitten(type, 'guard', { x, z });
  k.home = { x, z }; k.guard = !!guard; k.roamer = !guard; k.roamR = guard ? 6 : 10;
  k.leash = guard ? 22 : 20; k.aggro = guard ? 12 : 9; k.wx = x; k.wz = z; k.wt = 0;
  return k;
}
function spawnGuardsFor(w) {
  const c = CLEARINGS.find(c => w.id.startsWith(c.id + '-')); if (!c || !c.guards) return;
  const per = Math.ceil(c.guards / c.animals.length);
  for (let j = 0; j < per; j++) spawnForestKitten(c.guardTypes ? pick(c.guardTypes) : pick(['tabby', 'tabby', 'ginger']), w.home.x + rand(-4, 4), w.home.z + rand(-4, 4), true).cid = w.id;
}
function spawnForestKittens() {
  for (const w of wilds) if (!w.locked && !w.cave) spawnGuardsFor(w);
  for (let i = 0; i < 24; i++) spawnRoamer(false);
}
function spawnRoamer(farFromPlayer) {
  for (let t = 0; t < 40; t++) {
    const x = rand(-188, 188), z = rand(-172, 132);
    if (!forestFree(x, z, 2)) continue;
    if (farFromPlayer && dist2(x, z, px(), pz()) < 45) continue;
    if (state.quest.i < 5 && dist2(x, z, 0, 40) < 110) continue; // keep the starter woods calm until Bo teaches squirting
    const far = dist2(x, z, 0, 60);
    const type = kittenType(threat() + (far > 110 ? 6 : 0) + (far > 170 ? 8 : 0));
    return spawnForestKitten(type, x, z, false);
  }
}
function updateForestKittens(dt) {
  roamT -= dt;
  if (roamT <= 0) { roamT = 14; if (kittens.filter(k => k.roamer && k.state === 'move').length < 20 + state.quest.i + (state.flags.endless ? 20 : 0)) spawnRoamer(true); }
}
/* called from updateKittens for goal === 'guard'; returns [tx, tz, arrive, speedMul] */
function guardBrain(k, dt, dp) {
  const p = k.g.position, dh = dist2(p.x, p.z, k.home.x, k.home.z);
  if (k.returning) {
    k.hp = Math.min(k.max, k.hp + dt * 2);
    if (dh < 2) k.returning = false;
    return [k.home.x, k.home.z, 1, 1.4];
  }
  if (!player.inCave && !player.dead && dp < k.aggro && dh < k.leash) {
    if (!k.alerted) { k.alerted = true; floatText(p.x, 2.2 * k.def.scale, p.z, '!', 'bad', 0.9); sfx('meow'); }
    if (dp < 1.3 * k.def.scale + 0.6 && k.cd <= 0) { k.cd = 1.2; hurtPlayer(1, k); }
    return [px(), pz(), 0.9 * k.def.scale + 0.4, 1];
  }
  if (dh >= k.leash) { k.returning = true; k.alerted = false; floatText(p.x, 2.2 * k.def.scale, p.z, 'Hmph!', 'hit', 1); return [k.home.x, k.home.z, 1, 1.4]; }
  k.alerted = false; k.wt -= dt;
  if (k.wt <= 0) { k.wt = rand(2, 6); const a = rand(0, TAU), r = rand(0, k.roamR); k.wx = k.home.x + Math.cos(a) * r; k.wz = k.home.z + Math.sin(a) * r; }
  return [k.wx, k.wz, 0.6, 0.35];
}

/* ---------- The Super Milker: your 12 cows become one, and can split apart again ---------- */
function fusionCandidates() {
  const picks = {};
  for (const e of cowEnts) if (!e.carried && !e.fusing && !(e.ko > 0) && COWS[e.d.type] && !COWS[e.d.type].special && !picks[e.d.type]) picks[e.d.type] = e;
  return picks;
}
const prismaEnt = () => cowEnts.find(e => e.d.type === 'super');
function canFuse() { const p = fusionCandidates(); return COW_TYPES.every(t => p[t]) && !fusion && !prismaEnt(); }
function canSplit() { const e = prismaEnt(); return !!e && !fusion && !(e.ko > 0); }
function startFusion() {
  if (!canFuse()) return;
  const p = fusionCandidates(), ents = COW_TYPES.map(t => p[t]);
  ents.forEach((e, i) => { e.following = false; e.returning = false; e.fusing = true; e.f0 = e.g.position.clone(); e.fa = i / ents.length * TAU; });
  fusion = { t: 0, ents, cx: C.x, cz: C.z };
  toast('The crystal hums... all twelve cows fly to it and rise into the sky!', 'love'); sfx('bless');
}
function splitSuperMilker() {
  if (!canSplit()) return;
  const e = prismaEnt();
  if (player.carrying === e) putDownCow();
  const kept = e.d.fused && e.d.fused.length ? e.d.fused : COW_TYPES.map(t => ({ type: t }));
  scene.remove(e.g); cowEnts.splice(cowEnts.indexOf(e), 1); state.cows.splice(state.cows.indexOf(e.d), 1);
  kept.forEach((c, i) => {
    const d = Object.assign({}, c); state.cows.push(d); normCow(d); const ne = spawnCowEnt(d);
    const a = i / kept.length * TAU; ne.g.position.set(C.x + Math.cos(a) * 7, 0, C.z + Math.sin(a) * 7); ne.following = true;
  });
  burst('rainbow', C.x, 4, C.z, 70); burst('ring', C.x, 1, C.z, 1, 0xff9fff); sfx('bless');
  toast('The SUPER MILKER splits back into your twelve cows! They\'re following you. Use the crystal again any time to fuse them.', 'love');
  cardDirty = true;
}
function updateFusion(dt) {
  if (!fusion) return;
  const f = fusion; f.t += dt; const u = Math.min(1, f.t / 3);
  f.ents.forEach(e => {
    const a = e.fa + f.t * (1 + u * 6), r = 10 * (1 - u) + 0.3;
    e.g.position.set(lerp(e.f0.x, f.cx + Math.cos(a) * r, Math.min(1, f.t)), Math.sin(Math.min(1, f.t) * Math.PI / 2) * 6 + u * 2, lerp(e.f0.z, f.cz + Math.sin(a) * r, Math.min(1, f.t)));
    e.g.rotation.y += dt * 8; e.g.scale.setScalar(0.9 * (1 - u * 0.7));
    if (Math.random() < 0.3) burst('rainbow', e.g.position.x, e.g.position.y, e.g.position.z, 1);
  });
  if (f.t >= 3) {
    const fused = f.ents.map(e => ({ type: e.d.type, name: e.d.name, happy: e.d.happy }));
    for (const e of f.ents) { scene.remove(e.g); cowEnts.splice(cowEnts.indexOf(e), 1); state.cows.splice(state.cows.indexOf(e.d), 1); }
    const d = { type: 'super', name: 'SUPER MILKER', happy: 100, fused }; state.cows.push(d); normCow(d); const pe = spawnCowEnt(d); pe.g.position.set(f.cx + 4, 0, f.cz + 4); pe.following = true;
    burst('rainbow', f.cx, 4, f.cz, 90); burst('ring', f.cx, 1, f.cz, 1, 0xff9fff); sfx('level'); sfx('boom');
    stat('superFused'); addXP(150); fusion = null; saveGame(true);
    toast('Behold the SUPER MILKER! She follows you. Pick her up (C) for five rainbow streams. Use the crystal again to split her back into your cows.', 'good');
  }
}

/* ---------- Endless raids after you beat the game ---------- */
function updateEndless(dt) {
  const f = state.flags;
  if (f.endlessT > 0) { f.endlessT -= dt; if (f.endlessT <= 0) { f.endless = true; f.nextWaveT = 3; toast('ENDLESS HORDES! Every kitten in the land wants revenge. How many waves can you survive?', 'bad'); sfx('alarm'); } }
  if (!f.endless) return;
  if (raid.active) {
    const alive = raid.queue.length + kittens.filter(k => !k.cave && !k.guard && !k.roamer && k.state === 'move').length;
    if (!alive) { raid.active = false; f.nextWaveT = 10; const bonus = 25 + state.wave * 10; state.coins += bonus; state.stats.bestWave = Math.max(state.stats.bestWave || 0, state.wave); toast(`Wave ${state.wave} cleared! +${bonus} coins. Next wave in 10 seconds...`, 'good'); }
  } else { f.nextWaveT -= dt; if (f.nextWaveT <= 0) startRaid(); }
}
