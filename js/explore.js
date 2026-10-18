'use strict';
/* ============================================================
   Exploring: wild cows & sheep, followers, forest kittens,
   the Super Milker fusion and endless raids
   ============================================================ */
const wilds = [], followers = [];
const COW_TYPES = Object.keys(COWS).filter(k => !COWS[k].special);
const SHEEP_TYPES = Object.keys(BREEDS);
let roamT = 0, fusion = null;

const wildId = (c, i) => c.id + '-' + i;
function homeOf(species, type) {
  for (const c of CLEARINGS) if (c.animals.some(a => (species === 'cow' ? a.c : a.s) === type)) return c;
  return null;
}
function spawnWilds() {
  for (const w of wilds) scene.remove(w.g);
  wilds.length = 0; followers.length = 0;
  for (const c of CLEARINGS) c.animals.forEach((a, i) => {
    const id = wildId(c, i); if (state.wild[id]) return;
    makeWild(a.c ? 'cow' : 'sheep', a.c || a.s, id, { x: c.x, z: c.z, r: c.r - 3, cid: c.id });
  });
  if (!state.wild.seraph) {
    const w = makeWild('sheep', 'seraph', 'seraph', { x: W.cage.position.x, z: W.cage.position.z, r: 1.4 });
    w.cave = true; w.caged = !state.flags.clawdius;
  }
  W.cageBars.visible = !state.flags.clawdius;
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
  const w = { id, species, type, m, g: m.g, home, tx: m.g.position.x, tz: m.g.position.z, timer: rand(0, 4), walk: rand(0, 6), moving: false, follow: false, mk, cave: false, caged: false, warnT: 0 };
  w.it = { kind: 'wild', ent: w }; wilds.push(w); return w;
}
const wildName = w => w.species === 'cow' ? COWS[w.type].name : BREEDS[w.type].name;
function guardsAt(w) { return w.home.cid ? kittens.filter(k => k.guard && k.state === 'move' && k.cid === w.home.cid).length : 0; }
function befriend(w) {
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
  if (list.length >= animalCap()) { if (w.warnT <= 0) { w.warnT = 6; toast(`Your ${w.species === 'cow' ? 'pasture' : 'meadow'} is full! Upgrade "Barn & Meadow" at the Moo Market.`, 'bad'); } return; }
  const x = w.g.position.x, z = w.g.position.z, isNew = w.species === 'cow' ? !state.found.cows[w.type] : !state.found.sheep[w.type];
  if (w.species === 'cow') { const d = { type: w.type, x, z }; state.cows.push(d); normCow(d); spawnCowEnt(d); state.found.cows[w.type] = 1; }
  else { const d = { breed: w.type, x, z, fleece: 0.6 }; state.sheep.push(d); normSheep(d); spawnSheepEnt(d); state.found.sheep[w.type] = 1; }
  state.wild[w.id] = true; scene.remove(w.g); wilds.splice(wilds.indexOf(w), 1); followers.splice(followers.indexOf(w), 1);
  stat('tamed'); addXP(isNew ? 45 : 20); sfx('love'); burst('sparkle', x, 2, z, 20);
  toast(isNew ? `NEW BREED! The ${wildName(w)} joined your farm. Check your Herd Book!` : `The ${wildName(w)} joined your farm!`, 'love');
  for (const o of wilds) if (o.type === w.type && o.species === w.species) o.mk.material.map = badgeTex('+', '#bfe8ff');
}
function updateWild(dt) {
  const spd = UPG.boots.vals[state.upg.boots] * 1.15;
  for (let i = wilds.length - 1; i >= 0; i--) {
    const w = wilds[i], pos = w.g.position; w.warnT -= dt;
    w.mk.position.y = (w.species === 'cow' ? 4.6 : 3.6) + Math.sin(elapsed * 3 + w.walk) * 0.15;
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
}

/* ---------- Kittens of the forest: they chase you, then give up and go home ---------- */
function spawnForestKitten(type, x, z, guard) {
  const k = spawnKitten(type, 'guard', { x, z });
  k.home = { x, z }; k.guard = !!guard; k.roamer = !guard; k.roamR = guard ? 6 : 10;
  k.leash = guard ? 22 : 20; k.aggro = guard ? 12 : 9; k.wx = x; k.wz = z; k.wt = 0;
  return k;
}
function spawnForestKittens() {
  for (const c of CLEARINGS) {
    if (c.animals.every((a, i) => state.wild[wildId(c, i)])) continue;
    for (let i = 0; i < c.guards; i++) spawnForestKitten(c.guardTypes ? pick(c.guardTypes) : pick(['tabby', 'tabby', 'ginger']), c.x + rand(-5, 5), c.z + rand(-5, 5), true).cid = c.id;
  }
  for (let i = 0; i < 24; i++) spawnRoamer(false);
}
function spawnRoamer(farFromPlayer) {
  for (let t = 0; t < 40; t++) {
    const x = rand(-188, 188), z = rand(-172, 132);
    if (!forestFree(x, z, 2)) continue;
    if (farFromPlayer && dist2(x, z, px(), pz()) < 45) continue;
    if (state.quest.i < 5 && dist2(x, z, 0, 40) < 110) continue; // keep the starter woods calm until Bo teaches squirting
    const far = dist2(x, z, 0, 60);
    const type = far < 110 ? pick(['tabby', 'tabby', 'ginger']) : far < 170 ? pick(['tabby', 'ginger', 'chonk', 'shadow']) : pick(['chonk', 'shadow', 'siamese', 'ginger']);
    return spawnForestKitten(type, x, z, false);
  }
}
function updateForestKittens(dt) {
  roamT -= dt;
  if (roamT <= 0) { roamT = 14; if (kittens.filter(k => k.roamer && k.state === 'move').length < 24) spawnRoamer(true); }
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

/* ---------- The Super Milker: all 12 cows become one ---------- */
function fusionCandidates() {
  const picks = {};
  for (const e of cowEnts) if (!e.carried && !e.returning && !e.fusing && COWS[e.d.type] && !COWS[e.d.type].special && !picks[e.d.type]) picks[e.d.type] = e;
  return picks;
}
function canFuse() { const p = fusionCandidates(); return COW_TYPES.every(t => p[t]) && !fusion && !state.cows.some(c => c.type === 'super'); }
function startFusion() {
  if (!canFuse()) return;
  const p = fusionCandidates(), ents = COW_TYPES.map(t => p[t]);
  const cx = (COW_PEN.x1 + COW_PEN.x2) / 2, cz = (COW_PEN.z1 + COW_PEN.z2) / 2;
  ents.forEach((e, i) => { e.fusing = true; e.f0 = e.g.position.clone(); e.fa = i / ents.length * TAU; });
  fusion = { t: 0, ents, cx, cz };
  toast('All twelve cows rise into the sky... something AMAZING is happening!', 'love'); sfx('bless');
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
    for (const e of f.ents) { scene.remove(e.g); cowEnts.splice(cowEnts.indexOf(e), 1); state.cows.splice(state.cows.indexOf(e.d), 1); }
    const d = { type: 'super', name: 'Prisma', x: f.cx, z: f.cz, happy: 100 }; state.cows.push(d); normCow(d); spawnCowEnt(d);
    burst('rainbow', f.cx, 4, f.cz, 90); burst('ring', f.cx, 1, f.cz, 1, 0xff9fff); sfx('level'); sfx('boom');
    stat('superFused'); addXP(150); fusion = null; saveGame(true);
    toast('Behold PRISMA, the SUPER MILKER COW! Pick her up (C): her rainbow stream is the only thing that hurts King Clawdius.', 'good');
  }
}

/* ---------- Endless raids after King Clawdius falls ---------- */
function updateEndless(dt) {
  const f = state.flags;
  if (f.endlessT > 0) { f.endlessT -= dt; if (f.endlessT <= 0) { f.endless = true; f.nextWaveT = 3; toast('ENDLESS RAIDS! Every kitten in the land wants revenge. How many waves can you survive?', 'bad'); sfx('alarm'); } }
  if (!f.endless) return;
  if (raid.active) {
    const alive = raid.queue.length + kittens.filter(k => !k.cave && !k.guard && !k.roamer && k.state === 'move').length;
    if (!alive) { raid.active = false; f.nextWaveT = 12; const bonus = 25 + state.wave * 10; state.coins += bonus; state.stats.bestWave = Math.max(state.stats.bestWave || 0, state.wave); toast(`Wave ${state.wave} cleared! +${bonus} coins. Next wave in 12 seconds...`, 'good'); }
  } else { f.nextWaveT -= dt; if (f.nextWaveT <= 0) startRaid(); }
}
