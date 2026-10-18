'use strict';
/* ============================================================
   Game logic
   ============================================================ */
const CYCLE = 335, DAY = 225; // 225s of day, 110s of night
const SAVE_KEY = 'tsm.save.v1';
let state = null, running = false, paused = false, elapsed = 0;
const player = {};
const cowEnts = [], sheepEnts = [], kittens = [], projs = [], eprojs = [], folk = [], sacred = [], displayCows = [], telegraphs = [];
const npcEnts = {}, farmerEnts = {}, stations = [];
let raid = { active: false, timer: 0, queue: [], breachedThisRaid: false };
let caveBoss = null, domeFlash = 0, autosaveT = 0;

/* ---------- helpers ---------- */
const stat = (k, n = 1) => { state.stats[k] = (state.stats[k] || 0) + n; };
const maxHearts = () => 5 + Math.floor((state.level - 1) / 3);
const bucketCap = () => UPG.bucket.vals[state.upg.bucket];
const milkTotal = () => MILK_KEYS.reduce((a, k) => a + (state.inv.milk[k] || 0), 0);
const woolTotal = () => state.inv.wool.reduce((a, b) => a + b, 0);
const yarnTotal = () => state.inv.yarn.reduce((a, b) => a + b, 0);
const basketTotal = () => state.spindle.basket.reduce((a, b) => a + b, 0);
const hasSeraph = () => state.sheep.some(sh => sh.breed === 'seraph');
const maxPower = () => 100 + 25 * state.upg.amp + (hasSeraph() ? 100 : 0);
/* Temple blessings only work while the shield stands */
const blessLevel = () => state.flags.breached ? 0 : faithLevel();
/* How dangerous the world is: grows with story progress, herd size and days survived */
const threat = () => state.quest.i + state.cows.length * 0.8 + state.day * 0.6 + (state.flags.endless ? 12 + state.wave * 2.5 : 0);
const faithLevel = () => { let l = 0; FAITH.forEach((f, i) => { if (state.faith >= f) l = i; }); return l; };
const ampMult = () => UPG.amp.vals[state.upg.amp] * (blessLevel() >= 5 ? 1.25 : 1);
const tierOf = w => { let t = 0; TIERS.forEach((T, i) => { if (w >= T.min) t = i; }); return t; };
const isFieldUp = () => state.field.power > 0 && !state.flags.breached;
const animalCap = () => UPG.barn.vals[state.upg.barn];
const udderMax = () => UPG.udder.vals[state.upg.udder];
const hasBuff = b => (player.buffs[b] || 0) > 0;
const xpNeed = l => 30 + l * 28;
const isNight = () => state.t >= DAY;
const px = () => player.g.position.x, pz = () => player.g.position.z;
const inRect = (x, z, p, m = 0) => x > p.x1 + m && x < p.x2 - m && z > p.z1 + m && z < p.z2 - m;
const penRandom = (p, m = 3) => ({ x: rand(p.x1 + m, p.x2 - m), z: rand(p.z1 + m, p.z2 - m) });
const heartsOf = key => Math.floor(state.romance[key].aff / 10);
function freshName(list, used) { const free = list.filter(n => !used.includes(n)); return free.length ? pick(free) : pick(list) + ' ' + randi(2, 99); }
function addMilk(type, n) { const k = Math.min(Math.max(0, bucketCap() - milkTotal()), n); if (k > 0) state.inv.milk[type] = (state.inv.milk[type] || 0) + k; return k; }
function addCoins(n, x, y, z) { state.coins += n; if (x !== undefined) floatText(x, y, z, '+' + n + ' coins', 'coin'); }
function addXP(n) {
  n = Math.round(n * (hasBuff('xp') ? 2 : 1)); state.xp += n; let need;
  while (state.xp >= (need = xpNeed(state.level))) {
    state.xp -= need; state.level++; state.hearts = maxHearts();
    toast(`Level up! Tori is now level ${state.level}.`, 'good'); sfx('level'); burst('sparkle', px(), 2.5, pz(), 22);
  }
}
function turnTo(cur, target, k) { return cur + wrapA(target - cur) * k; }

/* ---------- state ---------- */
function newState() {
  const romance = {}; for (const k in FARMERS) romance[k] = { aff: 0, p: 0, talkDay: 0, giftDay: 0, gifts: 0, dateDay: 0, met: false, status: '' };
  return {
    v: 1, coins: 40, xp: 0, level: 1, hearts: 5,
    inv: { milk: {}, wool: [0, 0, 0, 0, 0, 0], yarn: [0, 0, 0, 0, 0, 0], hay: 4, clover: 2, goods: {} },
    upg: Object.fromEntries(Object.keys(UPG).map(k => [k, 0])),
    cows: [{ type: 'classic', name: 'Buttercup' }],
    sheep: [{ breed: 'black', name: 'Inky', fleece: 1 }],
    field: { power: 70 }, spindle: { queue: [], prog: 0, basket: [0, 0, 0, 0, 0, 0], momentum: 60 },
    faith: 0, day: 1, t: 8, wave: 0, quest: { i: 0, phase: 'offer', base: 0 }, stats: {}, bounties: [],
    flags: { hayDay: 0, cloverT: 0, breached: false, duchessPending: false, met: {} },
    romance, sweetheart: null, player: { x: SPAWN.x, z: SPAWN.z },
    found: { cows: { classic: 1 }, sheep: { black: 1 } }, wild: {},
  };
}
function mergeState(saved) {
  const s = newState();
  for (const k of Object.keys(saved)) {
    if (s[k] && typeof s[k] === 'object' && !Array.isArray(s[k]) && saved[k] && typeof saved[k] === 'object' && !Array.isArray(saved[k])) s[k] = Object.assign(s[k], saved[k]);
    else s[k] = saved[k];
  }
  for (const k in FARMERS) s.romance[k] = Object.assign({ aff: 0, p: 0, talkDay: 0, giftDay: 0, gifts: 0, dateDay: 0, met: false, status: '' }, s.romance[k] || {});
  for (const k in UPG) if (s.upg[k] == null) s.upg[k] = 0;
  s.found = s.found || {}; s.found.cows = s.found.cows || {}; s.found.sheep = s.found.sheep || {}; s.wild = s.wild || {};
  for (const c of s.cows) s.found.cows[c.type] = 1; for (const sh of s.sheep) s.found.sheep[sh.breed] = 1;
  s.cows = s.cows.filter(c => COWS[c.type]); s.sheep = s.sheep.filter(c => BREEDS[c.breed]);
  return s;
}
function syncPositions() {
  for (const e of cowEnts) { if (!e.carried) { e.d.x = e.g.position.x; e.d.z = e.g.position.z; } }
  for (const e of sheepEnts) { e.d.x = e.g.position.x; e.d.z = e.g.position.z; }
  if (player.inCave) { state.player.x = SPAWN.x; state.player.z = SPAWN.z; } else { state.player.x = px(); state.player.z = pz(); }
}
function serialize() { syncPositions(); return JSON.parse(JSON.stringify(state)); }
function saveGame(quiet) {
  if (!state) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(serialize())); if (!quiet) toast('Game saved.'); } catch (e) { if (!quiet) toast('Could not save in this browser.', 'bad'); }
}
function loadSave() { try { const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }

/* ---------- entities ---------- */
function normCow(c) {
  c.name = c.name || freshName(COW_NAMES, state.cows.map(x => x.name).filter(Boolean));
  if (c.happy == null) c.happy = 70; if (c.cd == null) c.cd = rand(0, 4); c.petCd = 0; c.super = c.super || 0;
  if (c.x == null || !inRect(c.x, c.z, COW_PEN)) { const p = penRandom(COW_PEN); c.x = p.x; c.z = p.z; }
}
function normSheep(s) {
  const B = BREEDS[s.breed];
  s.name = s.name || freshName(SHEEP_NAMES, state.sheep.map(x => x.name).filter(Boolean));
  if (s.white == null) s.white = clamp(B.base + rand(-5, 6), 5, 99); if (s.fleece == null) s.fleece = rand(0.5, 0.95); s.brushCd = 0;
  if (s.x == null || !inRect(s.x, s.z, SHEEP_PEN)) { const p = penRandom(SHEEP_PEN); s.x = p.x; s.z = p.z; }
}
function spawnCowEnt(d) {
  const m = makeCow(d.type); m.g.position.set(d.x, 0, d.z); m.g.rotation.order = 'YXZ'; m.g.rotation.y = rand(0, TAU); scene.add(m.g);
  const ind = new THREE.Sprite(new THREE.SpriteMaterial({ map: PTEX.drop, color: MILK[COWS[d.type].milk].hex, depthWrite: false }));
  ind.scale.setScalar(0.85); ind.position.set(0, 4, 0); m.g.add(ind);
  const e = { d, m, g: m.g, tx: d.x, tz: d.z, timer: rand(0, 4), moving: false, spook: 0, ind, udder: udderMax(), udderIdle: 9, squash: 0, walk: rand(0, 6), carried: false, returning: false, superOn: false };
  e.it = { kind: 'cow', ent: e }; cowEnts.push(e); return e;
}
function spawnSheepEnt(d) {
  const m = makeSheep(d.breed); m.g.position.set(d.x, 0, d.z); m.g.rotation.y = rand(0, TAU); scene.add(m.g);
  const ind = new THREE.Sprite(new THREE.SpriteMaterial({ map: PTEX.puff, color: 0xffffff, depthWrite: false })); ind.scale.setScalar(0.85); ind.position.set(0, 3.3, 0); m.g.add(ind);
  const e = { d, m, g: m.g, tx: d.x, tz: d.z, timer: rand(0, 4), moving: false, ind, walk: rand(0, 6), lastW: -1, lastF: -1 };
  e.it = { kind: 'sheep', ent: e }; sheepEnts.push(e); return e;
}
function clearAnimals() { for (const e of cowEnts) scene.remove(e.g); for (const e of sheepEnts) scene.remove(e.g); cowEnts.length = 0; sheepEnts.length = 0; }
function buildAnimals() {
  clearAnimals();
  state.cows.forEach(normCow); state.sheep.forEach(normSheep);
  state.cows.forEach(spawnCowEnt); state.sheep.forEach(spawnSheepEnt);
}
function addCow(type, near) {
  const c = { type }; state.cows.push(c); normCow(c); if (state.found) state.found.cows[type] = 1;
  if (near) { c.x = near.x; c.z = near.z; }
  const e = spawnCowEnt(c); if (near) e.returning = true; return e;
}

function buildNPCs() {
  for (const key in NPC_DEF) {
    const o = NPC_DEF[key], f = makeFolk(o); f.g.position.set(o.x, 0, o.z); scene.add(f.g);
    const label = textSprite(o.name, { fs: 30, scale: 0.55 }); label.position.y = 3.25; f.g.add(label);
    const mk = new THREE.Sprite(new THREE.SpriteMaterial({ map: badgeTex('!', '#ffc83d'), depthWrite: false })); mk.scale.setScalar(1); mk.position.y = 4.3; mk.visible = false; f.g.add(mk);
    npcEnts[key] = { key, f, g: f.g, marker: mk, mkType: '', it: { kind: 'npc', key }, home: { x: o.x, z: o.z } };
    circC(o.x, o.z, 0.8);
  }
  for (const key in FARMERS) {
    const o = FARMERS[key], h = makeHuman(o.look); h.g.position.set(o.home.x, 0, o.home.z); scene.add(h.g);
    const label = textSprite(o.name, { fs: 30, scale: 0.55, bg: 'rgba(204,60,110,0.85)' }); label.position.y = 3.95; h.g.add(label);
    const mk = new THREE.Sprite(new THREE.SpriteMaterial({ map: badgeTex('♥', '#ff9fc0'), depthWrite: false })); mk.scale.setScalar(1); mk.position.y = 4.9; mk.visible = false; h.g.add(mk);
    farmerEnts[key] = { key, h, g: h.g, marker: mk, tx: o.home.x, tz: o.home.z, timer: rand(1, 4), walk: 0, it: { kind: 'farmer', key } };
  }
  const robes = [0xff9fc0, 0x9fd8ff, 0xfff1a8, 0xc9b0ff, 0xa8f0c6, 0xffc9a8];
  for (let i = 0; i < 14; i++) {
    const f = makeFolk({ species: 'sheep', robe: pick(robes), trim: 0xffffff, face: pick([0x3a3238, 0x5b4636, 0xf2d9c4]), hat: pick(['', '', 'hood', 'cap']) });
    const a = rand(0, TAU), r = rand(9, 24); f.g.position.set(C.x + Math.sin(a) * r, 0, C.z + Math.cos(a) * r); f.g.scale.setScalar(rand(0.8, 1)); scene.add(f.g);
    folk.push({ f, g: f.g, tx: f.g.position.x, tz: f.g.position.z, timer: rand(0, 5), talkT: rand(3, 14) });
  }
  for (let i = 0; i < 0; i++) {
    const m = makeSheep('seraph'); fleeceColor(100, m.fleeceMat.color); m.fleeceMat.emissive.set(0x2a2410); m.halo.visible = true;
    const a = rand(0, TAU), r = rand(10, 21); m.g.position.set(C.x + Math.sin(a) * r, 0, C.z + Math.cos(a) * r); scene.add(m.g);
    const e = { m, g: m.g, tx: m.g.position.x, tz: m.g.position.z, timer: rand(0, 5), petCd: 0, walk: 0 }; e.it = { kind: 'sacred', ent: e }; sacred.push(e);
  }
  ['straw', 'mochi', 'gold', 'blueberry'].forEach(t => {
    const m = makeCow(t); m.g.position.set(MARKET_PEN.x + rand(-2, 2), 0, MARKET_PEN.z + rand(-2, 2)); m.g.scale.setScalar(0.7); scene.add(m.g);
    const e = { m, g: m.g, tx: m.g.position.x, tz: m.g.position.z, timer: rand(0, 4), walk: 0 }; e.it = { kind: 'display', ent: e }; displayCows.push(e);
  });
}
function buildStations() {
  const S = (kind, x, z, r, name) => stations.push({ kind, x, z, r, name, it: { kind } });
  S('spindle', SPINDLE.x, SPINDLE.z, 12); S('heart', C.x, C.z, 6.5); S('temple', TEMPLE.x, TEMPLE.z, 13); S('market', MARKET.x, MARKET.z, 9);
  S('board', BOARD.x, BOARD.z, 4); S('hayloft', BARN.x, BARN.z - 7.5, 5); S('clover', CLOVER.x, CLOVER.z, 3.5); S('home', HOUSE.x, HOUSE.z - 6, 4.5);
  S('creamery', CREAMERY.x - 1, CREAMERY.z - 6.5, 5); S('cave', CAVE_DOOR.x, CAVE_DOOR.z, 7); S('portal', CAVE.x, CAVE.z + 20, 5);
  S('basket', SPINDLE.x + 7, SPINDLE.z + 5, 3); S('crate', CRATE.x, CRATE.z, 4);
}

function initPlayer() {
  const h = makeHuman({ skin: 0xffd9b8, hair: 0x7a4a2a, style: '', shirt: 0xff8fab, pants: 0x4f86e8, overalls: true, hat: 'straw' });
  Object.assign(player, { g: h.g, legs: h.legs, arms: h.arms, head: h.head, heartSpr: h.heart, face: Math.PI, vx: 0, vz: 0, inv: 0, carrying: null, shotCd: 0, buffs: {}, inCave: false, walk: 0, aimT: 0, aimFace: 0, regen: 0 });
  h.g.scale.setScalar(0.95); scene.add(h.g);
  const name = textSprite('Tori', { fs: 32, scale: 0.55, bg: 'rgba(79,134,232,0.85)' }); name.position.set(0, 3.85, 0); h.g.add(name);
}

/* ============================================================
   Farming actions
   ============================================================ */
function milkCow(e) {
  if (e.ko > 0) return;
  const c = e.d, T = COWS[c.type];
  if (e.carried) { toast('Put her down first to milk her into the bucket.'); return; }
  if (c.cd > 0) return;
  if (milkTotal() >= bucketCap()) { toast('Your bucket is full. Sell milk at the Moo Market, mix treats at the Creamery, or drink some.'); return; }
  let n = 1; if (c.happy >= 70) n++; if (blessLevel() >= 4 && Math.random() < 0.4) n++; if (Math.random() < state.level * 0.02) n++;
  const mk = c.type === 'super' ? pick(MILK_KEYS) : T.milk;
  const got = addMilk(mk, n + (c.type === 'super' ? 1 : 0));
  c.cd = T.cd * 0.75 * (c.happy < 25 ? 2 : 1); c.happy = clamp(c.happy - 5, 0, 100);
  stat('milked'); addXP(3 + Math.floor(MILK[mk].price / 8));
  floatText(e.g.position.x, 3, e.g.position.z, `+${got} ${MILK[mk].name}`, 'milk');
  burst('milk', e.g.position.x, 1, e.g.position.z, 10, MILK[mk].hex); sfx('moo'); e.squash = 0.4;
  if (got < n) toast('Bucket full! Some milk spilled.');
}
function feedHay(e) { if (state.inv.hay <= 0) return; state.inv.hay--; e.d.happy = clamp(e.d.happy + 30, 0, 100); burst('heart', e.g.position.x, 2.5, e.g.position.z, 5); floatText(e.g.position.x, 3, e.g.position.z, 'Munch munch!', 'love'); sfx('moo'); }
function petCow(e) { if (e.d.petCd > 0) return; e.d.petCd = 15; e.d.happy = clamp(e.d.happy + 12, 0, 100); burst('heart', e.g.position.x, 2.5, e.g.position.z, 4); sfx('moo'); addXP(1); }
function feedSuper(e) {
  if (!(state.inv.goods.super > 0)) return;
  state.inv.goods.super--; e.d.super = (e.d.super || 0) + SUPER_CHARGES;
  burst('rainbow', e.g.position.x, 2, e.g.position.z, 40); sfx('bless');
  toast(`${e.d.name} is now a SUPER MILKER! Pick her up (C) and squeeze for rainbow blasts.`, 'good');
}
function pickUpCow(e) {
  if (e.ko > 0) { toast(`${e.d.name} is knocked out. Give her a moment!`); return; }
  e.following = false;
  if (player.carrying) putDownCow();
  e.carried = true; e.returning = false; e.moving = false; player.carrying = e; e.g.scale.setScalar(0.62);
  sfx('pickup'); sfx('moo'); floatText(e.g.position.x, 3, e.g.position.z, 'Moo?!', 'milk');
  const spec = e.d.super > 0 ? SUPER_SHOT : MILK[COWS[e.d.type].milk].shot;
  toast(`Holding ${e.d.name}. Hold F or the mouse to squirt: ${spec.desc}.`);
}
function putDownCow() {
  const e = player.carrying; if (!e) return;
  e.carried = false; e.following = false; player.carrying = null; e.g.scale.setScalar(0.9); e.g.rotation.set(0, player.face, 0);
  const x = px() + Math.sin(player.face) * 2.2, z = pz() + Math.cos(player.face) * 2.2; e.g.position.set(x, 0, z);
  if (player.inCave || !inRect(x, z, COW_PEN)) { e.returning = true; if (!player.inCave) floatText(x, 3, z, 'Heading home!', 'milk'); }
  if (player.inCave) { e.g.position.set(SPAWN.x - 10, 0, SPAWN.z - 30); }
}
function shearSheep(e) {
  if (e.ko > 0) return;
  const s = e.d; if (s.fleece < 1) return;
  const tier = tierOf(s.white), n = UPG.shears.vals[state.upg.shears];
  state.inv.wool[tier] += n; s.fleece = 0; stat('sheared'); if (tier >= 4) stat('snowShear');
  addXP(4 + tier * 3);
  floatText(e.g.position.x, 2.6, e.g.position.z, `+${n} ${TIERS[tier].name} wool`, 'wool');
  burst('wool', e.g.position.x, 1.4, e.g.position.z, 14, fleeceColor(s.white, new THREE.Color()).getHex()); sfx('baa');
  if (tier === 5) { burst('sparkle', e.g.position.x, 2, e.g.position.z, 20); toast('Radiant wool! It glows like the first morning.', 'good'); }
}
function brushSheep(e) {
  if (e.ko > 0) return;
  const s = e.d; if (s.brushCd > 0) return;
  const amt = UPG.brush.vals[state.upg.brush], gain = amt * (1 - (s.white / 100) * 0.62);
  s.white = clamp(s.white + gain, 0, 100); s.brushCd = 10; stat('brushed'); addXP(1);
  burst('sparkle', e.g.position.x, 1.6, e.g.position.z, 8); sfx('baa');
  floatText(e.g.position.x, 2.6, e.g.position.z, `Whiteness ${Math.floor(s.white)}`, 'wool');
}
function cloverSheep(e) {
  if (state.inv.clover <= 0) return; state.inv.clover--;
  e.d.white = clamp(e.d.white + 3, 0, 100); e.d.fleece = Math.min(1, e.d.fleece + 0.4);
  burst('heart', e.g.position.x, 2, e.g.position.z, 5); sfx('baa');
}
function takeHay() { if (state.flags.hayDay === state.day) return; state.flags.hayDay = state.day; state.inv.hay += 3; toast('+3 hay from the loft.'); sfx('click'); }
function pickClover() { if (state.flags.cloverT > 0) return; state.flags.cloverT = 25; state.inv.clover++; floatText(CLOVER.x, 1.5, CLOVER.z, '+1 clover', 'wool'); burst('sparkle', CLOVER.x, 0.8, CLOVER.z, 6, 0x9fffb0); }
function crateValue(kind) {
  if (kind === 'milk') return MILK_KEYS.reduce((a, k) => a + (state.inv.milk[k] || 0) * MILK[k].price, 0);
  if (kind === 'wool') return state.inv.wool.reduce((a, c, t) => a + c * TIERS[t].sell, 0);
  return RECIPES.reduce((a, r) => a + (r.sell ? (state.inv.goods[r.key] || 0) * r.sell : 0), 0);
}
function shipAll(kind) {
  const v = crateValue(kind); if (!v) return;
  if (kind === 'milk') MILK_KEYS.forEach(k => state.inv.milk[k] = 0);
  else if (kind === 'wool') state.inv.wool = [0, 0, 0, 0, 0, 0];
  else RECIPES.forEach(r => { if (r.sell) state.inv.goods[r.key] = 0; });
  addCoins(v, CRATE.x, 2.5, CRATE.z); stat('sold'); sfx('coin'); burst('coin', CRATE.x, 1.5, CRATE.z, 10);
}
function waitForNight() {
  if (state.t >= DAY - 5) return;
  fadeScreen(() => { state.t = DAY - 5; state.hearts = maxHearts(); toast('Tori naps until evening. The sun is setting...'); });
}
function sleepTillMorning() {
  if (raid.active && (raid.queue.length || kittens.some(k => !k.cave && k.state === 'move'))) { toast("You can't sleep with kittens on the loose!", 'bad'); return; }
  fadeScreen(() => { state.t = CYCLE - 0.5; state.hearts = maxHearts(); saveGame(true); });
}
function restAtHome() {
  if (player.restCd > 0) { toast('You just rested. Try again in a bit.'); return; }
  player.restCd = 60; state.hearts = maxHearts(); saveGame(true); toast('Tori naps on the porch. Hearts restored and game saved.', 'good'); burst('heart', px(), 2.5, pz(), 6);
}

/* ---------- Spindle, shield, temple ---------- */
function feedSpindle() {
  let n = 0; for (let t = 5; t >= 0; t--) while (state.inv.wool[t] > 0) { state.inv.wool[t]--; state.spindle.queue.push(t); n++; }
  if (!n) return; state.spindle.momentum = clamp(state.spindle.momentum + 10 * n, 0, 100); stat('woolSpun', n); addXP(2 * n);
  floatText(SPINDLE.x, 6, SPINDLE.z, `+${n} wool to the Spindle`, 'wool'); sfx('spin'); burst('wool', SPINDLE.x, 4, SPINDLE.z, 16);
}
function collectYarn() {
  let n = 0; state.spindle.basket.forEach((c, t) => { state.inv.yarn[t] += c; n += c; state.spindle.basket[t] = 0; });
  if (n) { floatText(SPINDLE.x + 7, 2.5, SPINDLE.z + 5, `+${n} yarn`, 'wool'); sfx('coin'); }
}
function autoWeave(t) {
  stat('yarnWoven');
  if (state.field.power >= maxPower() - 0.5) { state.spindle.basket[t]++; burst('sparkle', SPINDLE.x + 7, 2, SPINDLE.z + 5, 5); return; }
  const g = TIERS[t].power * ampMult();
  state.field.power = Math.min(maxPower(), state.field.power + g); domeFlash = Math.max(domeFlash, 0.4);
  burst('zap', C.x, 5, C.z, 8); burst('sparkle', SPINDLE.x, 9, SPINDLE.z, 6);
  if (!player.inCave && dist2(px(), pz(), C.x, C.z) < 75) floatText(C.x, 7, C.z, `${TIERS[t].name} yarn: shield +${Math.round(g)}`, 'shield', 1.3);
  if (state.flags.breached && state.field.power >= 25) { state.flags.breached = false; toast('The shield is back up! Any kittens inside get zapped out.', 'good'); }
}
function weaveYarn() {
  let n = 0, gained = 0;
  for (let t = 5; t >= 0; t--) while (state.inv.yarn[t] > 0 && state.field.power < maxPower()) { state.inv.yarn[t]--; const g = TIERS[t].power * ampMult(); state.field.power = Math.min(maxPower(), state.field.power + g); gained += g; n++; }
  if (!n) { if (yarnTotal()) toast('The shield is already full.'); return; }
  stat('yarnWoven', n); addXP(3 * n); domeFlash = 1; sfx('zap'); burst('zap', C.x, 5, C.z, 24);
  floatText(C.x, 7, C.z, `Shield +${Math.round(gained)}`, 'shield');
  if (state.flags.breached && state.field.power >= 25) { state.flags.breached = false; toast('The shield is back up! Any kittens inside get zapped out.', 'good'); }
}
function offerWool(all) {
  let gained = 0, n = 0;
  for (let t = 5; t >= 0; t--) while (state.inv.wool[t] > 0) { state.inv.wool[t]--; gained += TIERS[t].faith; n++; if (!all) break; }
  if (!all && n === 0) return;
  addFaith(gained, n + ' wool');
}
function offerMilk() {
  let g = 0, n = 0; for (const k of MILK_KEYS) { const c = state.inv.milk[k] || 0; g += c * Math.max(1, Math.round(MILK[k].price / 12)); n += c; state.inv.milk[k] = 0; }
  if (n) addFaith(g, n + ' milk');
}
function addFaith(g, what) {
  if (!g) return; const before = faithLevel(); state.faith += g; stat('offered'); addXP(Math.ceil(g / 2));
  floatText(TEMPLE.x, 8, TEMPLE.z, `+${g} faith for ${what}`, 'shield'); burst('sparkle', TEMPLE.x, 6, TEMPLE.z, 24); sfx('bless');
  const after = faithLevel(); if (after > before) toast(`Faith level ${after}! ${BLESS[after]}`, 'good');
}
function petSacred(e) { if (e.petCd > 0) return; e.petCd = 25; state.faith += 1; burst('sparkle', e.g.position.x, 2, e.g.position.z, 8); floatText(e.g.position.x, 2.5, e.g.position.z, '+1 faith', 'shield'); sfx('baa'); }

/* ---------- Creamery ---------- */
function canMix(r) { return Object.entries(r.need).every(([k, n]) => (state.inv.milk[k] || 0) >= n); }
function mix(r) {
  if (!canMix(r)) return;
  for (const [k, n] of Object.entries(r.need)) state.inv.milk[k] -= n;
  state.inv.goods[r.key] = (state.inv.goods[r.key] || 0) + 1;
  stat('mixed'); addXP(r.key === 'super' ? 60 : 8);
  if (r.key === 'super') { stat('superMixed'); burst('rainbow', CREAMERY.x - 2, 3, CREAMERY.z - 6, 60); sfx('bless'); toast('SUPER MILKER MILK! Feed it to a cow from her card.', 'good'); }
  else { burst('sparkle', CREAMERY.x - 2, 3, CREAMERY.z - 6, 14); sfx('coin'); }
  W.churn.userData.spin = 2;
}
function drink(kind, key) {
  let d, name;
  if (kind === 'milk') { if (!(state.inv.milk[key] > 0)) return; state.inv.milk[key]--; d = MILK[key].drink; name = MILK[key].name; }
  else { if (!(state.inv.goods[key] > 0)) return; state.inv.goods[key]--; d = GOODS[key].drink; name = GOODS[key].name; }
  state.hearts = Math.min(maxHearts(), state.hearts + (d.heal || 0));
  if (d.buff) player.buffs[d.buff] = Math.max(player.buffs[d.buff] || 0, d.dur);
  burst('heart', px(), 2.5, pz(), 4); sfx('click');
  toast(`Tori drinks ${name}. ${d.desc || GOODS[key]?.desc || ''}`);
}

/* ---------- Romance ---------- */
function problemAvailable(key) { const r = state.romance[key]; return r.met && r.p < 4 && r.aff >= r.p * 20; }
function confessionReady(key) { const r = state.romance[key]; return r.p >= 4 && r.aff >= 100 && !r.status; }
function gainAff(key, n, src) {
  const r = state.romance[key], before = heartsOf(key);
  r.aff = clamp(r.aff + n, 0, 100);
  const fe = farmerEnts[key];
  if (n > 0) { burst('heart', fe.g.position.x, 3, fe.g.position.z, Math.min(10, 2 + n / 2)); floatText(fe.g.position.x, 3.6, fe.g.position.z, `+${n} ♥`, 'love'); }
  else if (n < 0) floatText(fe.g.position.x, 3.6, fe.g.position.z, `${n} ♥`, 'bad');
  const after = heartsOf(key);
  if (after > before && after % 2 === 0) toast(`${FARMERS[key].name} now has ${after} hearts for you!`, 'love');
}
function giftReaction(key, item) {
  const F = FARMERS[key];
  if (item.kind === 'goods') return { n: 12, line: `You made this? A ${GOODS[item.key].name}?! Tori, this is the sweetest thing.` };
  const nm = MILK[item.key].name;
  if (F.loves.includes(item.key)) return { n: 10, line: `${nm}! I LOVE ${nm}! You remembered?` };
  if (F.likes.includes(item.key)) return { n: 6, line: `Oh, ${nm}! Thank you, that's really sweet of you.` };
  if (F.dislikes.includes(item.key)) return { n: -4, line: `Oh... ${nm}. I'll, um, find a use for it.` };
  return { n: 3, line: `Thanks, Tori. That's kind of you.` };
}
function giveGift(key, item) {
  const r = state.romance[key];
  if (r.giftDay !== state.day) { r.giftDay = state.day; r.gifts = 0; }
  if (r.gifts >= 2) { toast(`${FARMERS[key].name} has had enough gifts today. Come back tomorrow!`); return; }
  if (item.kind === 'goods') { if (!(state.inv.goods[item.key] > 0)) return; state.inv.goods[item.key]--; } else { if (!(state.inv.milk[item.key] > 0)) return; state.inv.milk[item.key]--; }
  r.gifts++;
  const re = giftReaction(key, item); let n = re.n; if (n > 0 && hasBuff('love')) n = Math.round(n * 1.5);
  gainAff(key, n); stat('gifts'); addXP(2); sfx(n > 0 ? 'love' : 'click');
  dialog(key, [re.line], null, 'farmer');
}
function solveProblem(key) {
  const r = state.romance[key], pr = FARMERS[key].problems[r.p]; if (!pr) return;
  for (const [k, n] of Object.entries(pr.need)) if ((state.inv.milk[k] || 0) < n) return;
  for (const [k, n] of Object.entries(pr.need)) state.inv.milk[k] -= n;
  r.p++; stat('problems'); addCoins(pr.coins); addXP(30 + r.p * 10); gainAff(key, 18); sfx('love');
  const fe = farmerEnts[key];
  if (pr.gift) {
    if (pr.gift.cow) { const e = addCow(pr.gift.cow, { x: fe.g.position.x + 2, z: fe.g.position.z }); e.d.name = 'Dango'; toast(`${FARMERS[key].name} gave you a ${COWS[pr.gift.cow].name}! She's walking to your pasture.`, 'love'); }
    if (pr.gift.hay) state.inv.hay += pr.gift.hay;
    if (pr.gift.clover) state.inv.clover += pr.gift.clover;
  }
  dialog(key, pr.thanks.concat([`(+${pr.coins} coins)`]), null, 'farmer');
}
function goOnDate(key) {
  const r = state.romance[key]; if (r.dateDay === state.day) return;
  r.dateDay = state.day; const spot = pick(DATE_SPOTS);
  const line = pick(FARMERS[key].dates);
  gainAff(key, state.sweetheart === key ? 6 : 8); stat('dates'); addXP(10); sfx('love');
  burst('heart', px(), 3, pz(), 12);
  dialog(key, [`You and ${FARMERS[key].name.split(' ')[0]} spend the evening at ${spot}.`, line], null, 'farmer');
}
function talkFarmer(key) {
  const F = FARMERS[key], r = state.romance[key];
  if (!r.met) { r.met = true; r.talkDay = state.day; gainAff(key, 5); dialog(key, F.intro.concat(problemAvailable(key) ? ['Actually... could I ask you for a favor? (Press "Help" to see what I need.)'] : []), null, 'farmer'); return; }
  if (confessionReady(key)) {
    if (state.sweetheart && state.sweetheart !== key) {
      r.status = 'friend';
      dialog(key, [`I know your heart belongs to ${FARMERS[state.sweetheart].name.split(' ')[0]}.`, "I'm happy for you, Tori. Really. Let's be best friends forever, okay?"], null, 'farmer'); return;
    }
    dialog(key, F.confess, [
      { label: 'I love you too! ♥', fn: () => { r.status = 'sweet'; state.sweetheart = key; stat('sweethearts'); sfx('love'); burst('heart', px(), 3, pz(), 30); farmerEnts[key].h.heart.visible = true; player.heartSpr.visible = true; toast(`You and ${F.name} are sweethearts! ♥`, 'love'); dialog(key, ['Really?! This is the best day of my life!', 'I\'ll leave you a little gift every morning. Come see me whenever you want.'], null, 'farmer'); } },
      { label: "Let's stay friends", cls: 'ghost', fn: () => { r.status = 'friend'; dialog(key, ["Oh... okay. I understand. Thank you for being honest, Tori.", "Friends it is. The best of friends!"], null, 'farmer'); } }], 'farmer');
    return;
  }
  let line;
  if (r.status === 'sweet') line = pick(F.sweet);
  else { const tier = r.aff >= 70 ? 2 : r.aff >= 30 ? 1 : 0; line = pick(F.chat[tier]); }
  if (r.talkDay !== state.day) { r.talkDay = state.day; gainAff(key, 3); }
  const extra = [];
  if (problemAvailable(key)) extra.push("Oh, and I have a little problem. Could you help? (Press \"Help\".)");
  else if (r.p < 4 && r.met) extra.push(`(Raise ${F.name.split(' ')[0]}'s hearts to ${r.p * 2} to hear their next problem.)`);
  dialog(key, [line].concat(extra), null, 'farmer');
}
function sweetheartGift() {
  const key = state.sweetheart; if (!key) return;
  const F = FARMERS[key], m = pick(F.loves); const got = addMilk(m, 2); state.coins += 30;
  toast(`${F.name.split(' ')[0]} left you a gift: 30 coins${got ? ` and ${got} ${MILK[m].name}` : ''}. ♥`, 'love');
}

/* ---------- Bounties ---------- */
function genBounties() {
  const owned = [...new Set(state.cows.map(c => COWS[c.type].milk))], out = [];
  for (let i = 0; i < 3; i++) {
    const r = Math.random();
    if (r < 0.6) { const m = pick(owned), n = randi(2, 5); out.push({ kind: 'milk', key: m, n, reward: Math.round(MILK[m].price * n * 1.8 + 15), xp: 10 + n * 3 }); }
    else if (r < 0.85) { const tier = clamp(randi(1, 1 + Math.floor(state.level / 2)), 1, 5), n = randi(1, 3); out.push({ kind: 'wool', tier, n, reward: Math.round(TIERS[tier].sell * n * 2 + 20), xp: 12 + tier * 4 }); }
    else { const n = randi(2, 4); out.push({ kind: 'yarn', n, reward: 30 + n * 18, xp: 15 }); }
  }
  state.bounties = out;
}
function bountyHave(b) {
  if (b.kind === 'milk') return (state.inv.milk[b.key] || 0) >= b.n;
  if (b.kind === 'wool') { let c = 0; for (let t = b.tier; t < 6; t++) c += state.inv.wool[t]; return c >= b.n; }
  return yarnTotal() >= b.n;
}
function deliverBounty(i) {
  const b = state.bounties[i]; if (!b || b.done || !bountyHave(b)) return;
  if (b.kind === 'milk') state.inv.milk[b.key] -= b.n;
  else if (b.kind === 'wool') { let left = b.n; for (let t = b.tier; t < 6 && left; t++) { const k = Math.min(left, state.inv.wool[t]); state.inv.wool[t] -= k; left -= k; } }
  else { let left = b.n; for (let t = 0; t < 6 && left; t++) { const k = Math.min(left, state.inv.yarn[t]); state.inv.yarn[t] -= k; left -= k; } }
  b.done = true; state.coins += b.reward; addXP(b.xp); stat('bounties'); sfx('coin'); toast(`Bounty complete! +${b.reward} coins.`, 'good');
}

/* ---------- Quests ---------- */
const curQuest = () => QUESTS[state.quest.i];
function questProgress(q) {
  const st = state.quest; st.base = 0;
  switch (q.kind) {
    case 'stat': { const cur = Math.min(q.n, (state.stats[q.stat] || 0) - st.base); return { cur, n: q.n, done: cur >= q.n, label: `${Math.max(0, cur)}/${q.n}` }; }
    case 'item': { const cur = q.item.type === 'milk' ? (state.inv.milk[q.item.key] || 0) : state.inv.wool[q.item.tier]; return { cur: Math.min(cur, q.n), n: q.n, done: cur >= q.n, label: `${Math.min(cur, q.n)}/${q.n}` }; }
    case 'talk': return { cur: 1, n: 1, done: true, label: '' };
    case 'ownCow': { const done = state.cows.some(c => c.type === q.type); return { cur: +done, n: 1, done, label: done ? '' : 'not home yet' }; }
    case 'ownSheep': { const done = state.sheep.some(sh => BREEDS[sh.breed].base >= q.minBase); return { cur: +done, n: 1, done, label: done ? '' : 'not home yet' }; }
    case 'cowTypes': { const cur = new Set(state.cows.map(c => c.type).filter(t => !COWS[t].special)).size; return { cur: Math.min(cur, q.n), n: q.n, done: cur >= q.n, label: `${Math.min(cur, q.n)}/${q.n} kinds` }; }
    case 'milkTypes': { const cur = MILK_KEYS.filter(k => state.inv.milk[k] > 0).length; return { cur: Math.min(cur, q.n), n: q.n, done: cur >= q.n, label: `${Math.min(cur, q.n)}/${q.n} kinds` }; }
    case 'final': { const fl = faithLevel(), pct = Math.round(state.field.power / maxPower() * 100); return { done: fl >= 5 && pct >= 90, label: `Faith ${fl}/5 · Shield ${pct}%/90%` }; }
  }
}
function acceptQuest() {
  const q = curQuest(); if (!q) return;
  state.quest.phase = 'active'; state.quest.base = 0; // lifetime counts: if you already did it, it's done
  if (q.stat === 'duchess') { state.flags.duchessPending = true; if (raid.active) spawnKitten('duchess', 'field'); }
  toast(`New quest: ${q.title}`, 'good'); sfx('click');
}
function turnInQuest() {
  const q = curQuest(), key = q.turnin || q.giver;
  if (q.kind === 'item') { if (q.item.type === 'milk') state.inv.milk[q.item.key] -= q.n; else state.inv.wool[q.item.tier] -= q.n; }
  const r = q.reward; if (r.cow) { const e = addCow(r.cow, { x: -10, z: 80 }); toast(`${e.d.name} the ${COWS[r.cow].name} joined your farm!`, 'love'); } if (r.coins) state.coins += r.coins; if (r.hay) state.inv.hay += r.hay; if (r.clover) state.inv.clover += r.clover; if (r.faith) state.faith += r.faith;
  addXP(r.xp || 0); sfx('level');
  state.quest.i++; state.quest.phase = 'offer'; state.quest.base = 0;
  const rewardLine = `(Reward: ${[r.cow && 'a ' + COWS[r.cow].name, r.coins && r.coins + ' coins', r.hay && r.hay + ' hay', r.clover && r.clover + ' clover', r.faith && r.faith + ' faith', r.xp && r.xp + ' XP'].filter(Boolean).join(', ')})`;
  const nq = curQuest();
  const next = nq && nq.giver === key ? [{ label: 'What\'s next?', fn: () => dialog(key, nq.talk, [{ label: 'Accept quest', fn: acceptQuest }, { label: 'Not yet', cls: 'ghost' }]) }] : null;
  if (!nq) { burst('rainbow', px(), 3, pz(), 60); state.flags.endlessT = 45; setTimeout(showVictory, 400); }
  if (nq) dialog(key, q.finish.concat([rewardLine]), next);
  saveGame(true);
}
function talkNPC(key) {
  const q = curQuest(), st = state.quest;
  if (q) {
    const turnKey = q.turnin || q.giver;
    if (st.phase === 'offer' && q.giver === key) { dialog(key, q.talk, [{ label: 'Accept quest', fn: acceptQuest }, { label: 'Not yet', cls: 'ghost' }]); return; }
    if (st.phase === 'active' && turnKey === key && questProgress(q).done) { turnInQuest(); return; }
    if (st.phase === 'active' && (q.giver === key || turnKey === key)) { dialog(key, [`Remember: ${q.text}. ${questProgress(q).label ? '(' + questProgress(q).label + ')' : ''}`]); return; }
  }
  const lines = [pick(NPC_DEF[key].chatter)];
  dialog(key, lines, key === 'moolissa' ? [{ label: 'Open the market', fn: () => openMarket('sell') }, { label: 'Bye', cls: 'ghost' }] : null);
}
function questTarget() {
  const q = curQuest(); if (!q) return null; const st = state.quest;
  let key = q.giver;
  if (st.phase === 'active') { if (questProgress(q).done) key = q.turnin || q.giver; else {
    if (q.kind === 'ownCow' || q.kind === 'ownSheep') {
      const fol = followers.some(w => q.kind === 'ownCow' ? w.species === 'cow' && w.type === q.type : w.species === 'sheep' && BREEDS[w.type].base >= q.minBase);
      const pen = q.kind === 'ownSheep' ? SHEEP_PEN : COW_PEN;
      if (fol) return { x: (pen.x1 + pen.x2) / 2, z: (pen.z1 + pen.z2) / 2, name: '' };
      const reg = q.kind === 'ownCow' ? homeOf('cow', q.type) : CLEARINGS.find(c => c.id === 'berry');
      if (reg) return { x: reg.x, z: reg.z, name: '' };
    }
    if (q.kind === 'cowTypes') return null;
    const map = { superFused: CREAMERY, milked: COW_PEN, sheared: SHEEP_PEN, brushed: SHEEP_PEN, snowShear: SHEEP_PEN, woolSpun: SPINDLE, yarnWoven: C, bought: MARKET, superMixed: CREAMERY, clawdius: CAVE_DOOR, problems: FARMERS.hazel.home };
    const t = map[q.stat]; if (t) return { x: t.x1 !== undefined ? (t.x1 + t.x2) / 2 : t.x, z: t.z1 !== undefined ? (t.z1 + t.z2) / 2 : t.z, name: '' };
    if (q.kind === 'item' && q.item.type === 'milk') return { x: -35, z: 53, name: '' };
    if (q.kind === 'item') return { x: 35, z: 53, name: '' };
    return null; } }
  const n = NPC_DEF[key]; return { x: n.x, z: n.z, name: n.name };
}

/* ============================================================
   Combat: udder shots, kittens, raids, the cave
   ============================================================ */
const _dir = new THREE.Vector3();
function currentShot() {
  const cow = player.carrying;
  if (!cow) return null;
  if (cow.d.super > 0 || cow.d.type === 'super') return { spec: SUPER_SHOT, color: 0xffffff, key: 'super' };
  const k = COWS[cow.d.type].milk; return { spec: MILK[k].shot, color: MILK[k].hex, key: k };
}
function liveKittens() { return kittens.filter(k => k.state !== 'sleepy' && k.state !== 'charmed' && k.state !== 'flee'); }
function aimTarget(range = 24, ang = player.face) {
  let best = null, bs = 1e9; const fx = Math.sin(ang), fz = Math.cos(ang);
  for (const k of kittens) {
    if (k.state === 'sleepy' || k.state === 'charmed' || k.state === 'flee') continue;
    const dx = k.g.position.x - px(), dz = k.g.position.z - pz(), d = Math.hypot(dx, dz); if (d > range) continue;
    const s = d - ((dx * fx + dz * fz) / (d || 1)) * 8; if (s < bs) { bs = s; best = k; }
  }
  return best;
}
const STREAM_DT = 0.045;
function shoot() {
  if (!running || paused || player.dead) return;
  const cow = player.carrying;
  if (!cow) { if (player.shotCd <= 0) { player.shotCd = 1.2; floatText(px(), 3.2, pz(), 'Grab a cow first! (C)', 'bad', 1); } return; }
  if (player.shotCd > 0) return;
  const sh = currentShot(), spec = sh.spec, isSuper = sh.key === 'super', legacy = isSuper && cow.d.type !== 'super';
  if (!legacy && cow.udder <= 0.02) { player.shotCd = 0.6; floatText(px(), 3.2, pz(), 'Milk meter empty! Let go to refill', 'bad', 1); return; }
  player.shotCd = STREAM_DT;
  let ang = mouseAiming ? mouseAim : player.face;
  const t = aimTarget(24, ang);
  if (mouseAiming && !t) { player.aimFace = ang; player.aimT = 0.3; }
  if (t) { ang = Math.atan2(t.g.position.x - px(), t.g.position.z - pz()); player.aimFace = ang; player.aimT = 0.4; }
  const ox = px() + Math.sin(ang) * 1.7, oz = pz() + Math.cos(ang) * 1.7, oy = 1.3;
  const angs = spec.fx === 'spread' ? [ang - 0.22, ang, ang + 0.22] : isSuper ? [-0.26, -0.13, 0, 0.13, 0.26].map(o => ang + o) : [ang];
  const dmgScale = STREAM_DT / spec.cd * (hasBuff('zest') ? 2 : 1);
  angs.forEach((a2, li) => spawnProj(ox, oy, oz, a2 + rand(-0.01, 0.01), t, sh, dmgScale, li));
  if (legacy) { cow.d.super = Math.max(0, cow.d.super - STREAM_DT); if (cow.d.super <= 0) { cow.d.super = 0; toast(`${cow.d.name}'s rainbow milk ran out.`, 'bad'); } }
  else cow.udder = Math.max(0, cow.udder - STREAM_DT);
  cow.udderIdle = 0; cow.squash = 0.12;
  sfx('squirt');
  if (Math.random() < 0.01) sfx('moo');
}
function spawnProj(x, y, z, ang, target, sh, dmgScale, lane = 0) {
  const spec = sh.spec, isSuper = sh.key === 'super';
  const size = spec.fx === 'heavy' ? 0.42 : spec.fx === 'boom' ? 0.38 : spec.fx === 'zest' ? 0.24 : isSuper ? 0.4 : 0.3;
  const mat = isSuper ? new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL((elapsed * 1.5) % 1, 0.9, 0.65) }) : MB(sh.color);
  const m = new THREE.Mesh(G.sphLo, mat); m.scale.set(size * 0.28, size * 0.28, size * 3.8); m.position.set(x, y, z); scene.add(m);
  if (Math.random() < 0.5) spawnPart(PTEX.dot, isSuper ? mat.color : sh.color, x, y, z, Math.sin(ang) * rand(3, 7) + rand(-1, 1), rand(0.5, 2), Math.cos(ang) * rand(3, 7) + rand(-1, 1), rand(0.12, 0.25), rand(0.07, 0.12), 10);
  const sp = isSuper ? 46 : spec.fx === 'heavy' ? 22 : spec.fx === 'zest' ? 32 : 27;
  let vy = 2.2;
  if (target) { const d = dist2(x, z, target.g.position.x, target.g.position.z); vy = clamp(d * 0.11, 0.5, 4) + (target.def.scale - 1) * 1.2; }
  if (isSuper) vy = 0.9;
  const link = new THREE.Mesh(G.sphLo, mat); link.visible = false; scene.add(link);
  const q = { m, link, w: size * 0.28, lane, born: elapsed, newer: null, dead: false, vx: Math.sin(ang) * sp, vy, vz: Math.cos(ang) * sp, life: isSuper ? 1.5 : 1.1, spec, key: sh.key, color: sh.color, hit: new Set(), bounces: spec.fx === 'bounce' ? 1 : 0, isSuper, mat, dmgScale: dmgScale || 1 };
  const lp = player.lastProjs || (player.lastProjs = []), prev = lp[lane];
  if (prev && !prev.dead && elapsed - prev.born < 0.15) prev.newer = q;
  lp[lane] = q; q.auto = !!sh.auto; projs.push(q);
}
function shotDamage(p, k) {
  let d = p.spec.dmg * (p.dmgScale || 1) * UPG.splash.vals[state.upg.splash] * (hasBuff('strong') ? 2 : 1);
  if (p.spec.fx === 'crunch' && (k.def.scale >= 1.4 || k.def.boss)) d *= 3;
  if (k.def.cave && !p.isSuper) d = 0;
  return d;
}
function hitKitten(k, p, dirx, dirz) {
  const dmg = shotDamage(p, k);
  if (k.def.cave && dmg === 0) { if (Math.random() < 0.04) floatText(k.g.position.x, 6, k.g.position.z, 'Immune! Only Super Milker milk works!', 'bad', 1.2); burst('milk', p.m.position.x, p.m.position.y, p.m.position.z, 4, p.color); return; }
  if (k.deflectT > 0) { burst('zap', p.m.position.x, p.m.position.y, p.m.position.z, 2, 0xffe27a); if (elapsed - (k.lastFloat || 0) > 0.6) { k.lastFloat = elapsed; floatText(k.g.position.x, 9, k.g.position.z, 'DEFLECTED!', 'bad', 0.8); } return; }
  k.hp -= dmg; k.flash = 0.15; if (k.def.boss) k.hitT = 0.3;
  const kb = (p.spec.fx === 'heavy' ? 14 : 5) * Math.min(1, (p.dmgScale || 1) * 2.5) / (k.def.boss ? 4 : 1); k.kbx += dirx * kb; k.kbz += dirz * kb;
  const fx = p.spec.fx;
  if (!k.def.boss || fx === 'freeze') {
    if (fx === 'slip') k.stun = 1.6;
    if (fx === 'sticky') k.root = 3;
  }
  if (fx === 'freeze') k.slow = 4;
  if (fx === 'charm' && !k.def.boss && Math.random() < 0.3 * (p.dmgScale || 1)) { charmKitten(k); return; }
  burst(p.isSuper ? 'rainbow' : 'milk', k.g.position.x, 1 + k.def.scale * 0.5, k.g.position.z, 2, p.color);
  k.dmgAcc = (k.dmgAcc || 0) + dmg;
  if (elapsed - (k.lastFloat || 0) > 0.35) { k.lastFloat = elapsed; floatText(k.g.position.x, 1.5 + k.def.scale, k.g.position.z, '-' + (Math.round(k.dmgAcc * 10) / 10), 'hit', 0.7); k.dmgAcc = 0; }
  if (k.hp <= 0) defeatKitten(k, true);
}
function charmKitten(k) {
  k.state = 'charmed'; k.st = 0; burst('heart', k.g.position.x, 1.5, k.g.position.z, 10); floatText(k.g.position.x, 2, k.g.position.z, 'Charmed! ♥', 'love');
  stat('kittens'); stat('charmed'); const c = randi(...k.def.coins); addCoins(c); addXP(6); sfx('purr');
}
function defeatKitten(k, byPlayer) {
  if (k.state === 'sleepy') return;
  k.state = 'sleepy'; k.st = 0;
  const c = randi(...k.def.coins); addCoins(c, k.g.position.x, 2 + k.def.scale, k.g.position.z);
  burst('zzz', k.g.position.x, 1.5 * k.def.scale, k.g.position.z, 4); burst('coin', k.g.position.x, 1, k.g.position.z, 6); sfx('meow');
  if (byPlayer) { stat('kittens'); addXP(k.def.boss ? 150 : 6); }
  if (k.type === 'duchess') { stat('duchess'); state.flags.duchessPending = false; hideBoss(); toast('Duchess Whiskerella curls up and naps! The raid loses its queen.', 'good'); }
  if (k.type === 'clawdius') { stat('clawdius'); state.flags.clawdius = true; W.cageBars.visible = false; const sw = wilds.find(w => w.id === 'seraph'); if (sw) sw.caged = false; setTimeout(() => toast('The cage springs open! The Seraph Sheep is free. Befriend it (E) and lead it home to your meadow.', 'love'), 2600); hideBoss(); caveBoss = null; addXP(300); burst('rainbow', k.g.position.x, 4, k.g.position.z, 80); sfx('level'); toast('King Clawdius is defeated! He curls up purring like a tiny kitten.', 'good'); for (const o of kittens) if (o !== k && o.cave) defeatKitten(o, false); }
}
function updateProjs(dt) {
  for (let i = projs.length - 1; i >= 0; i--) {
    const p = projs[i]; p.life -= dt;
    if (p.spec.fx === 'homing') {
      let best = null, bd = 16;
      for (const k of kittens) { if (k.state === 'sleepy' || k.state === 'charmed' || p.hit.has(k)) continue; const d = dist2(k.g.position.x, k.g.position.z, p.m.position.x, p.m.position.z); if (d < bd) { bd = d; best = k; } }
      if (best) { const dx = best.g.position.x - p.m.position.x, dz = best.g.position.z - p.m.position.z, d = Math.hypot(dx, dz) || 1, sp = Math.hypot(p.vx, p.vz); p.vx = lerp(p.vx, dx / d * sp, dt * 6); p.vz = lerp(p.vz, dz / d * sp, dt * 6); p.vy = Math.max(p.vy, 0.5); }
    }
    p.vy -= (p.isSuper ? 0.9 : 6) * dt;
    p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt;
    _dir.set(p.m.position.x + p.vx, p.m.position.y + p.vy, p.m.position.z + p.vz); p.m.lookAt(_dir);
    if (Math.random() < 0.45) spawnPart(PTEX.dot, p.isSuper ? p.mat.color : p.color, p.m.position.x + rand(-0.07, 0.07), p.m.position.y + rand(-0.07, 0.07), p.m.position.z + rand(-0.07, 0.07),
      p.vx * 0.12 + rand(-0.4, 0.4), p.vy * 0.12 + rand(-0.2, 0.5), p.vz * 0.12 + rand(-0.4, 0.4), rand(0.18, 0.34), rand(0.07, 0.13), 9);
    if ((p.isSuper || p.spec.fx === 'boom') && Math.random() < 0.15) burst(p.isSuper ? 'rainbow' : 'sparkle', p.m.position.x, p.m.position.y, p.m.position.z, 1, p.color);
    let remove = false;
    for (const k of kittens) {
      if (k.state === 'sleepy' || k.state === 'charmed' || k.state === 'flee' || p.hit.has(k)) continue;
      const r = 0.85 * k.def.scale + 0.35, kp = k.g.position;
      const dx = p.m.position.x - kp.x, dz = p.m.position.z - kp.z;
      if (dx * dx + dz * dz < r * r && p.m.position.y < kp.y + 1.6 * k.def.scale + 0.6) {
        p.hit.add(k); const sp = Math.hypot(p.vx, p.vz) || 1;
        if (p.spec.fx === 'boom') explode(p, 3.2);
        else hitKitten(k, p, p.vx / sp, p.vz / sp);
        if (Math.random() < 0.35) addPuddle(kp.x + rand(-0.6, 0.6), kp.z + rand(-0.6, 0.6), p);
        if (p.spec.fx === 'homing' || p.isSuper) continue;
        if (p.bounces > 0) {
          p.bounces--; let nx = null, nd = 12;
          for (const o of kittens) { if (p.hit.has(o) || o.state === 'sleepy' || o.state === 'charmed') continue; const d = dist2(o.g.position.x, o.g.position.z, kp.x, kp.z); if (d < nd) { nd = d; nx = o; } }
          if (nx) { const ddx = nx.g.position.x - p.m.position.x, ddz = nx.g.position.z - p.m.position.z, d = Math.hypot(ddx, ddz) || 1; p.vx = ddx / d * 24; p.vz = ddz / d * 24; p.vy = 2.5; p.life = 0.8; burst('sparkle', p.m.position.x, p.m.position.y, p.m.position.z, 4, p.color); continue; }
        }
        remove = true; break;
      }
    }
    if (!remove && !player.inCave) { const t = soakTarget(p.m.position); if (t) { soak(t, p); addPuddle(t.g.position.x + rand(-0.5, 0.5), t.g.position.z + rand(-0.5, 0.5), p); remove = true; } }
    if (!remove && p.m.position.y < 0.05) { burst('milk', p.m.position.x, 0.1, p.m.position.z, 2, p.color); addPuddle(p.m.position.x, p.m.position.z, p); if (p.spec.fx === 'boom') explode(p, 3); remove = true; }
    if (remove || p.life <= 0) { p.dead = true; scene.remove(p.m); scene.remove(p.link); if (p.isSuper) p.mat.dispose(); projs.splice(i, 1); }
  }
}
const _nz = new THREE.Vector3();
function linkStream() {
  const cw = player.carrying;
  if (cw) _nz.set(px() + Math.sin(player.face) * 1.7, 1.3, pz() + Math.cos(player.face) * 1.7);
  for (let i = 0; i < projs.length; i++) {
    const p = projs[i]; let nb = null;
    if (p.newer && !p.newer.dead) nb = p.newer.m.position;
    else if (!p.newer && !p.auto && cw && shootHeld && player.lastProjs && player.lastProjs[p.lane] === p && elapsed - p.born < 0.1) nb = _nz;
    if (!nb) { p.link.visible = false; continue; }
    const a = p.m.position, d = a.distanceTo(nb);
    if (d > 3.4 || d < 0.01) { p.link.visible = false; continue; }
    const w = p.w * (1 + 0.18 * Math.sin(elapsed * 34 + i * 1.7));
    p.link.visible = true; p.link.position.copy(a).add(nb).multiplyScalar(0.5); p.link.lookAt(nb); p.link.scale.set(w, w, d / 2 + w * 0.6);
  }
}
function explode(p, R) {
  const x = p.m.position.x, z = p.m.position.z;
  burst(p.isSuper ? 'rainbow' : 'milk', x, 1, z, 3, p.color); if (Math.random() < 0.2) burst('ring', x, 0.5, z, 1, p.isSuper ? 0xff9fff : p.color);
  if (!p.isSuper) sfx('boom');
  for (const k of kittens) {
    if (k.state === 'sleepy' || k.state === 'charmed' || k.state === 'flee') continue;
    const dx = k.g.position.x - x, dz = k.g.position.z - z, d = Math.hypot(dx, dz);
    if (d < R + k.def.scale * 0.8) hitKitten(k, p, dx / (d || 1), dz / (d || 1));
  }
}

/* Kittens sneak in from just past the bottom, left or right edge of the screen, never from the castle side */
function edgeSpawn(forceSide) {
  const side = forceSide || pick(['left', 'right', 'bottom']), zz = zoom;
  let x, z;
  if (player.inCave) { // Tori is underground: use the edges of the overworld instead
    if (side === 'left') { x = -188; z = rand(-40, 120); } else if (side === 'right') { x = 188; z = rand(-40, 120); } else { x = rand(-150, 150); z = 136; }
  } else {
    const ox = px(), oz = pz();
    if (side === 'left') { x = ox - rand(28, 34) * zz; z = oz + rand(-12, 18) * zz; }
    else if (side === 'right') { x = ox + rand(28, 34) * zz; z = oz + rand(-12, 18) * zz; }
    else { x = ox + rand(-24, 24) * zz; z = oz + rand(22, 28) * zz; }
  }
  const dx = x - C.x, dz = z - C.z, d = Math.hypot(dx, dz) || 1;
  if (d < DOME_R + 8) { x = C.x + dx / d * (DOME_R + 10); z = C.z + dz / d * (DOME_R + 10); }
  return { x: clamp(x, -192, 192), z: clamp(z, -176, 137) };
}
function spawnKitten(type, goal, at) {
  const m = makeKitten(type), K = KITTENS[type];
  let x, z;
  if (at) { x = at.x; z = at.z; } else ({ x, z } = edgeSpawn());
  m.g.position.set(x, 0, z); scene.add(m.g);
  const fxm = new THREE.Mesh(G.sphLo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false })); fxm.position.y = 0.6; fxm.scale.set(0.9, 0.7, 1.1); fxm.visible = false; m.g.add(fxm);
  const k = { m, g: m.g, type, def: K, hp: K.hp * (K.cave ? 1 : K.boss ? 1 + state.wave * 0.05 : 1 + threat() * 0.03), max: 0, goal, state: 'move', cd: rand(0, 1), t: 0, seed: rand(0, 10), kbx: 0, kbz: 0, stun: 0, root: 0, slow: 0, flash: 0, face: -Math.PI / 2, tgt: null, harass: 0, summonT: 8, fxm, cave: false };
  k.max = k.hp; kittens.push(k);
  if (K.boss) { showBoss(K.name, 1); if (type === 'duchess') { toast('Duchess Whiskerella has joined the raid!', 'bad'); sfx('roar'); } }
  return k;
}
function kittenType(T) {
  const pool = ['tabby', 'tabby', 'tabby'];
  if (T >= 6) pool.push('ginger', 'ginger');
  if (T >= 10) pool.push('chonk');
  if (T >= 14) pool.push('shadow', 'shadow');
  if (T >= 19) pool.push('siamese', 'siamese', 'chonk');
  if (T >= 30) pool.push('shadow', 'siamese', 'chonk');
  return pick(pool);
}
function waveList(n) {
  const T = threat(), endless = state.flags.endless, L = [];
  const total = Math.min(Math.round(4 + T * 1.15 + n * 1.0), endless ? 170 : 75);
  const span = endless ? 45 + Math.min(70, n * 5) : 90;           // kittens trickle in over this many seconds
  let t = 3, pack = 0;
  while (L.length < total) {
    const size = Math.min(total - L.length, randi(2, 3 + Math.floor(T / 7)));
    const edge = pick(['left', 'right', 'bottom']);
    for (let j = 0; j < size; j++) L.push({ t: kittenType(T), at: t + j * 0.5, goal: 'field', edge, pack });
    pack++; t += span * size / total * rand(0.6, 1.4);
  }
  const farmN = Math.min(3, 1 + Math.floor((n - 1) / 3));
  for (let i = 0; i < farmN; i++) L.push({ t: T >= 6 && Math.random() < 0.4 ? 'ginger' : 'tabby', at: rand(4, 40), goal: 'farm', edge: pick(['left', 'right', 'bottom']), pack: 'f' + i });
  if (state.flags.duchessPending || (!endless && n % 5 === 0) || (endless && n % 3 === 0)) L.push({ t: 'duchess', at: span * 0.5, goal: 'field', edge: 'bottom', pack: 'd' });
  return L.sort((a, b) => a.at - b.at);
}
function startRaid() {
  state.wave++; raid = { active: true, timer: 0, queue: waveList(state.wave), breachedThisRaid: false, packs: {} };
  toast(state.flags.endless ? `ENDLESS WAVE ${state.wave}! Here they come!` : `Night ${state.day}: kittens are attacking the shield around the castle! Grab a cow and squirt them.`, 'bad'); sfx('alarm');
}
function endRaid() {
  if (!raid.active) return; raid.active = false;
  for (const k of kittens) if (!k.cave && !k.guard && !k.roamer && k.state !== 'sleepy' && k.state !== 'charmed') k.state = 'flee';
  hideBoss();
  if (!raid.breachedThisRaid) { state.coins += 20 + state.wave * 5; toast(`Dawn! The kittens retreat. The shield held: +${20 + state.wave * 5} coins.`, 'good'); }
  else toast('Dawn! The kittens retreat to Whisker Woods.');
}
function breach() {
  state.flags.breached = true; raid.breachedThisRaid = true; state.field.power = 0;
  toast('The shield has FALLEN! Kittens are pouring into the city. The Moo Market is closed and temple blessings are paused until you restart it. Feed the Spindle wool (25 power restarts it).', 'bad'); sfx('alarm');
}
function scratchField(k) {
  state.field.power -= k.def.dmg; domeFlash = Math.max(domeFlash, 0.5); sfx('zap');
  burst('zap', k.g.position.x, 1.5, k.g.position.z, 5);
  if (state.field.power <= 0) { breach(); return; }
  const zap = 0.6 * ampMult() * (state.field.power / maxPower());
  k.hp -= zap; const dx = k.g.position.x - C.x, dz = k.g.position.z - C.z, d = Math.hypot(dx, dz) || 1; k.kbx += dx / d * 6; k.kbz += dz / d * 6;
  if (k.hp <= 0) defeatKitten(k, false);
}
function harass(k, e) {
  if (!e || e.ko > 0) return;
  e.ko = 25; e.moving = false; e.following = false; e.spook = 0;
  floatText(e.g.position.x, 3, e.g.position.z, 'Knocked out!', 'bad'); burst('zzz', e.g.position.x, 2, e.g.position.z, 4);
  sfx(e.d.white !== undefined ? 'baa' : 'moo'); sfx('meow');
}
function hurtPlayer(n, src) {
  if (player.inv > 0 || hasBuff('guard') || player.dead) return;
  state.hearts -= n; player.inv = 1.1; sfx('hurt'); flashHurt();
  if (src) { const dx = px() - src.g.position.x, dz = pz() - src.g.position.z, d = Math.hypot(dx, dz) || 1; player.vx += dx / d * 14; player.vz += dz / d * 14; }
  if (state.hearts <= 0) faint();
}
function faint() {
  if (player.dead) return;
  player.dead = true; shootHeld = false;
  fadeScreen(() => {
    if (player.carrying) putDownCow();
    if (player.inCave) leaveCave(true);
    player.g.position.set(SPAWN.x, 0, SPAWN.z); player.vx = player.vz = 0; player.inv = 3; player.dead = false; state.hearts = maxHearts();
    if (!state.flags.endless) state.t = CYCLE - 0.05;   // wake up the next morning
    for (const e of cowEnts) { if (e.fusing) continue; e.following = false; e.returning = false; const p = penRandom(COW_PEN); e.g.position.set(p.x, 0, p.z); e.ko = 25; }
    for (const e of sheepEnts) e.ko = 25;
    toast('Tori fainted... and woke up the next morning. The kittens knocked out your whole herd while you slept!', 'bad');
  });
}

function updateKittens(dt) {
  const up = isFieldUp();
  for (let i = kittens.length - 1; i >= 0; i--) {
    const k = kittens[i], p = k.g.position; k.t += dt; k.cd -= dt; k.flash -= dt;
    if (k.state === 'sleepy') { k.st += dt; p.y += dt * 1.4; k.g.rotation.y += dt * 2; k.g.scale.setScalar(k.def.scale * Math.max(0.01, 1 - k.st / 2.2)); if (Math.random() < dt * 4) burst('zzz', p.x, p.y + k.def.scale, p.z, 1); if (k.st > 2.2) { scene.remove(k.g); kittens.splice(i, 1); } continue; }
    if (k.state === 'charmed' || k.state === 'flee') {
      k.st = (k.st || 0) + dt; const sp = k.def.speed * 1.3;
      const tx = k.cave ? CAVE.x : p.x, tz = k.cave ? CAVE.z - 40 : 160;
      const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz) || 1; p.x += dx / d * sp * dt; p.z += dz / d * sp * dt; k.face = Math.atan2(dx, dz);
      p.y = Math.abs(Math.sin(k.t * 12)) * 0.4; k.g.rotation.y = turnTo(k.g.rotation.y, k.face, 0.2);
      if (k.state === 'charmed' && Math.random() < dt * 3) burst('heart', p.x, 1.6, p.z, 1);
      if (p.z > 145 || (k.cave && k.st > 3) || k.st > 14) { scene.remove(k.g); kittens.splice(i, 1); }
      continue;
    }
    k.stun -= dt; k.root -= dt; k.slow -= dt;
    p.x += k.kbx * dt; p.z += k.kbz * dt; const damp = Math.pow(0.02, dt); k.kbx *= damp; k.kbz *= damp;
    // status visuals
    const fxOn = k.root > 0 ? 0xffb3d9 : k.slow > 0 ? 0xbff4ff : k.stun > 0 ? 0xffe27a : null;
    k.fxm.visible = !!fxOn; if (fxOn) k.fxm.material.color.setHex(fxOn);
    let speed = k.def.speed * (k.slow > 0 ? 0.35 : 1);
    if (hasBuff('cool') && dist2(p.x, p.z, px(), pz()) < 9) speed *= 0.5;
    let tx = p.x, tz = p.z, arrive = 0.5, scratching = false;
    const dp = dist2(p.x, p.z, px(), pz());
    if (k.type === 'clawdius') { updateClawdius(k, dt, dp); continue; }
    if (k.stun > 0) { k.g.rotation.y += dt * 14; p.y = 0; continue; }
    const aggro = k.def.boss ? 10 : 4.5;
    if (k.goal === 'guard') { const gb = guardBrain(k, dt, dp); tx = gb[0]; tz = gb[1]; arrive = gb[2]; speed *= gb[3]; }
    else if (k.goal === 'player' || (dp < aggro && !player.dead && k.cave === player.inCave)) {
      tx = px(); tz = pz(); arrive = 0.9 * k.def.scale + 0.4;
      if (dp < 1.3 * k.def.scale + 0.6 && k.cd <= 0) { k.cd = 1.2; hurtPlayer(k.def.boss ? 2 : 1, k); }
    } else if (k.goal === 'farm') {
      if (!k.tgt || k.tgtT <= 0) { const all = cowEnts.filter(e => !e.carried && !e.following && !e.fusing && !(e.ko > 0) && inRect(e.g.position.x, e.g.position.z, COW_PEN)).concat(sheepEnts.filter(e => !(e.ko > 0))); k.tgt = all.length ? pick(all) : null; k.tgtT = 10; }
      k.tgtT -= dt;
      if (k.tgt) { tx = k.tgt.g.position.x; tz = k.tgt.g.position.z; arrive = 1.6; if (dist2(p.x, p.z, tx, tz) < 2.2 && k.cd <= 0) { k.cd = 3; harass(k, k.tgt); k.tgt = null; if (++k.harass >= 3) k.goal = 'field'; } }
      else k.goal = 'field';
    } else {
      const dc = dist2(p.x, p.z, C.x, C.z);
      if (up) {
        if (dc < DOME_R - 2.5) { defeatKitten(k, false); floatText(p.x, 2, p.z, 'Zapped out!', 'shield'); continue; }
        if (dc <= DOME_R + 1.0 * k.def.scale + 0.3) { scratching = true; if (k.cd <= 0) { k.cd = 1.5; scratchField(k); } }
        else { tx = C.x; tz = C.z; }
      } else {
        tx = SPINDLE.x; tz = SPINDLE.z; arrive = 8;
        if (dist2(p.x, p.z, SPINDLE.x, SPINDLE.z) < 9.5 && k.cd <= 0) { k.cd = 1.8; state.spindle.momentum = Math.max(0, state.spindle.momentum - 4); const t = state.spindle.basket.findIndex(c => c > 0); if (t >= 0) state.spindle.basket[t]--; burst('wool', p.x, 1, p.z, 4); }
      }
    }
    if (k.def.boss && k.type === 'duchess') { k.summonT -= dt; if (k.summonT <= 0) { k.summonT = 12; for (let j = 0; j < 2; j++) spawnKitten('tabby', 'field', { x: p.x + rand(-3, 3), z: p.z + rand(-3, 3) }); burst('sparkle', p.x, 3, p.z, 10, 0xff4fa3); } }
    let moving = false;
    if (!scratching && k.root <= 0) {
      const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
      if (d > arrive) { p.x += dx / d * speed * dt; p.z += dz / d * speed * dt; k.face = Math.atan2(dx, dz); moving = true; }
    } else if (scratching) k.face = Math.atan2(C.x - p.x, C.z - p.z);
    if (up && !k.cave && k.goal !== 'player') { const dx = p.x - C.x, dz = p.z - C.z, d = Math.hypot(dx, dz); if (d < DOME_R + 0.5 && d > DOME_R - 2.5) { p.x = C.x + dx / d * (DOME_R + 0.5); p.z = C.z + dz / d * (DOME_R + 0.5); } }
    if (k.cave) { const dx = p.x - CAVE.x, dz = p.z - CAVE.z, d = Math.hypot(dx, dz); if (d > CAVE.r - 1) { p.x = CAVE.x + dx / d * (CAVE.r - 1); p.z = CAVE.z + dz / d * (CAVE.r - 1); } }
    k.g.rotation.y = turnTo(k.g.rotation.y, k.face, Math.min(1, dt * 10));
    p.y = moving ? Math.abs(Math.sin(k.t * 12)) * 0.32 : scratching ? Math.abs(Math.sin(k.t * 9)) * 0.15 : 0;
    const sw = moving ? Math.sin(k.t * 14) * 0.6 : 0; k.m.legs.forEach((L, j) => L.rotation.x = (j % 2 ? sw : -sw));
    k.m.tail.rotation.z = Math.sin(k.t * 4 + k.seed) * 0.4;
    if (scratching) k.m.head.rotation.x = Math.sin(k.t * 16) * 0.15;
    k.m.body.scale.setScalar(k.flash > 0 ? 1.12 : 1);
    if (k.def.boss) showBoss(k.def.name, k.hp / k.max);
  }
}

/* ---------- Soaking townsfolk, just for fun ---------- */
let soakList = [];
function rebuildSoakList() {
  soakList = [];
  for (const k in npcEnts) soakList.push({ ent: npcEnts[k], g: npcEnts[k].g, type: NPC_DEF[k].species === 'cow' ? 'cow' : 'sheep', h: 2.8 });
  for (const k in farmerEnts) soakList.push({ ent: farmerEnts[k], g: farmerEnts[k].g, type: 'farmer', h: 3 });
  for (const f of folk) soakList.push({ ent: f, g: f.g, type: 'sheep', h: 2.6 });
  for (const e of sacred) soakList.push({ ent: e, g: e.g, type: 'sacred', h: 1.8 });
}
function soakTarget(pos) {
  if (!soakList.length) rebuildSoakList();
  for (const t of soakList) { const g = t.g.position, dx = pos.x - g.x, dz = pos.z - g.z; if (dx * dx + dz * dz < 0.85 && pos.y < g.y + t.h) return t; }
  return null;
}
function soak(t, p) {
  const e = t.ent, g = t.g;
  burst(p.isSuper ? 'rainbow' : 'milk', g.position.x, g.position.y + t.h * 0.7, g.position.z, 4, p.color);
  if ((e.mad || 0) > 0.6 && (e.hopY || 0) > 0) { e.mad = Math.max(e.mad, 1.6); return; }
  const first = !(e.mad > 0); e.mad = 2.2; e.hopV = 7; e.hopY = Math.max(0.01, e.hopY || 0); e.hops = 3; e.moving = false;
  if (first || Math.random() < 0.25) { bubble(g, pick(SOAK_LINES[t.type]), 2.2, 'mad'); stat('soaked'); if (t.type !== 'sacred' && Math.random() < 0.5) sfx(t.type === 'cow' ? 'moo' : t.type === 'farmer' ? 'hurt' : 'baa'); }
}
function updateSoaked(dt) {
  for (const t of soakList) {
    const e = t.ent, g = t.g; if (!(e.mad > 0) && !(e.hopY > 0)) continue;
    e.mad = Math.max(0, (e.mad || 0) - dt);
    if (e.hopY > 0 || e.hopV > 0) { e.hopV -= 32 * dt; e.hopY = Math.max(0, e.hopY + e.hopV * dt); if (e.hopY === 0) { if (--e.hops > 0 && e.mad > 0) e.hopV = 5.5; else e.hopV = 0; } }
    g.position.y = e.hopY || 0;
    if (e.mad > 0) { g.rotation.y = turnTo(g.rotation.y, Math.atan2(px() - g.position.x, pz() - g.position.z), Math.min(1, dt * 10)); g.rotation.z = Math.sin(elapsed * 38) * 0.12 * Math.min(1, e.mad); e.moving = false; if (Math.random() < dt * 3) burst('sparkle', g.position.x, g.position.y + t.h + 0.3, g.position.z, 1, 0xff5d6c); }
    else g.rotation.z = 0;
  }
}

/* ---------- Milk puddles: every squirt leaves a mess ---------- */
const puddles = [], _pmats = {};
const RAINBOW = [0xff7ad9, 0xffe27a, 0x7fe8ff, 0xa8f0c6, 0xc9a8ff];
function puddleMat(c) { return _pmats[c] || (_pmats[c] = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.88, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); }
function addPuddle(x, z, p) {
  const key = p.key, color = p.isSuper ? pick(RAINBOW) : p.color;
  for (const q of puddles) if (q.key === key && Math.abs(q.x - x) < 1 && Math.abs(q.z - z) < 1) { q.r = Math.min(2.6, q.r + 0.05); q.t = Math.min(q.t, 4); q.m.scale.set(q.r * q.sx, q.r * q.sz, 1); return; }
  const m = new THREE.Mesh(G.circle, puddleMat(color));
  m.rotation.x = -Math.PI / 2; m.rotation.z = rand(0, TAU); m.renderOrder = 1;
  m.position.set(x, 0.14 + (puddles.length % 12) * 0.004, z);
  for (let j = 0; j < 3; j++) { const d = new THREE.Mesh(G.circle, m.material); const a = rand(0, TAU), r = rand(0.9, 1.4); d.position.set(Math.cos(a) * r, Math.sin(a) * r, 0.001); d.scale.setScalar(rand(0.18, 0.38)); m.add(d); }
  const q = { m, x, z, key, r: rand(0.35, 0.55), sx: rand(0.8, 1.2), sz: rand(0.8, 1.2), t: 0 };
  m.scale.set(q.r * q.sx, q.r * q.sz, 1); scene.add(m); puddles.push(q);
  if (puddles.length > 140) { const o = puddles.shift(); scene.remove(o.m); }
}
function updatePuddles(dt) {
  for (let i = puddles.length - 1; i >= 0; i--) {
    const q = puddles[i]; q.t += dt;
    if (q.t > 26) { const k = Math.max(0, 1 - (q.t - 26) / 4); q.m.scale.set(q.r * q.sx * k, q.r * q.sz * k, 1); if (k <= 0) { scene.remove(q.m); puddles.splice(i, 1); continue; } }
    if (q.key !== 'banana' && q.key !== 'mochi') continue;
    for (const k of kittens) {
      if (k.state !== 'move' || k.def.boss) continue;
      const dx = k.g.position.x - q.x, dz = k.g.position.z - q.z, rr = q.r * 1.1;
      if (dx * dx + dz * dz < rr * rr) {
        if (q.key === 'banana' && (k.slipCd || 0) <= elapsed) { k.stun = Math.max(k.stun, 1.1); k.slipCd = elapsed + 2.5; floatText(k.g.position.x, 2, k.g.position.z, 'Whoops!', 'hit', 0.8); }
        if (q.key === 'mochi') k.root = Math.max(k.root, 0.4);
      }
    }
  }
}

/* ---------- Catnap Cavern ---------- */
function enterCave() {
  if (player.inCave) return;
  fadeScreen(() => {
    player.inCave = true; player.g.position.set(CAVE.x, 0, CAVE.z + 12); moveFollowersTo(CAVE.x, CAVE.z + 12, true); player.face = Math.PI; player.vx = player.vz = 0;
    if (!state.flags.clawdius) {
      caveBoss = spawnKitten('clawdius', 'player', { x: CAVE.x, z: CAVE.z - 14 }); caveBoss.cave = true; caveBoss.atk = 4; caveBoss.mode = 'walk';
      sfx('roar'); toast(player.carrying && player.carrying.d.type === 'super' ? 'KING CLAWDIUS: "The Super Milker?! Impossible! GET OUT!"' : 'KING CLAWDIUS: "Who dares wake me?! Without the Super Milker you are NOTHING!"', 'bad');
      const sc = player.carrying && (player.carrying.d.super > 0 || player.carrying.d.type === 'super');
      if (!sc) setTimeout(() => toast('Tip: only the Super Milker Cow can hurt him. Bring all 12 kinds of cow home and fuse them at the Creamery.'), 2500);
    } else {
      toast('King Clawdius snores happily on his cushion. The cavern is peaceful now.');
      if (!W.sleepKing) { const m = makeKitten('clawdius'); m.g.position.set(CAVE.x, 1.2, CAVE.z - 22); m.g.scale.setScalar(3); scene.add(m.g); W.sleepKing = m; }
    }
  });
}
function leaveCave(silent) {
  const go = () => {
    player.inCave = false; player.g.position.set(CAVE_DOOR.x - 8, 0, CAVE_DOOR.z); player.face = -Math.PI / 2; moveFollowersTo(CAVE_DOOR.x - 8, CAVE_DOOR.z, false);
    for (const k of kittens) if (k.cave) { scene.remove(k.g); k.dead = true; }
    for (let i = kittens.length - 1; i >= 0; i--) if (kittens[i].dead) kittens.splice(i, 1);
    for (const t of telegraphs) scene.remove(t.m); telegraphs.length = 0;
    for (const e of eprojs) scene.remove(e.m); eprojs.length = 0;
    for (const w of shockwaves) scene.remove(w.m); shockwaves.length = 0;
    caveBoss = null; hideBoss();
  };
  if (silent) go(); else fadeScreen(go);
}
function updateClawdius(k, dt, dp) {
  const p = k.g.position, frac = k.hp / k.max, phase = frac < 0.34 ? 3 : frac < 0.67 ? 2 : 1;
  const armed = player.carrying && player.carrying.d.type === 'super';
  k.atk -= dt; k.summonT -= dt; k.dodgeCd = (k.dodgeCd || 0) - dt; k.hitT = (k.hitT || 0) - dt; k.deflectT = (k.deflectT || 0) - dt;
  if (!k.shieldM) { k.shieldM = new THREE.Mesh(G.sph, new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })); k.g.add(k.shieldM); k.shieldM.position.y = 1; k.shieldM.scale.setScalar(1.25); }
  k.shieldM.visible = k.deflectT > 0; if (k.deflectT > 0) k.shieldM.material.opacity = 0.25 + Math.sin(k.t * 18) * 0.12;
  if (k.phase !== phase) {
    if (k.phase) { toast(phase === 2 ? 'King Clawdius is getting ANGRY! Faster attacks!' : 'King Clawdius goes FERAL! Everything at once!', 'bad'); sfx('roar'); burst('ring', p.x, 1, p.z, 1, 0xff3b6b); }
    k.phase = phase;
  }
  const anim = () => {
    const sw = Math.sin(k.t * (k.mode === 'dash' ? 20 : 8)) * 0.5; k.m.legs.forEach((L, j) => L.rotation.x = (j % 2 ? sw : -sw));
    k.m.tail.rotation.z = Math.sin(k.t * 3) * 0.5; k.m.body.scale.setScalar(k.flash > 0 ? 1.08 : 1);
    showBoss(k.def.name + (phase > 1 ? (phase === 3 ? ' · FERAL' : ' · ANGRY') : ''), k.hp / k.max);
  };
  const toPx = px() - p.x, toPz = pz() - p.z, d = Math.hypot(toPx, toPz) || 1;
  /* Without the Super Milker in your arms, he just swats you out of his cave */
  if (!armed) {
    k.swatT = (k.swatT === undefined ? 2.5 : k.swatT) - dt;
    k.face = Math.atan2(toPx, toPz); k.g.rotation.y = turnTo(k.g.rotation.y, k.face, Math.min(1, dt * 6));
    if (d > 5) { p.x += toPx / d * 9 * dt; p.z += toPz / d * 9 * dt; }
    p.y = Math.abs(Math.sin(k.t * 5)) * 0.4;
    if ((d < 6 || k.swatT <= 0) && !k.swatting) {
      k.swatting = true; sfx('roar'); burst('ring', px(), 1, pz(), 1, 0xff3b6b); burst('mud', px(), 1.5, pz(), 16);
      floatText(px(), 4, pz(), 'SWAT!', 'bad', 1.2); player.vz += 45;
      setTimeout(() => { if (player.inCave) { leaveCave(); toast('King Clawdius batted you right out of his cave! Only the Super Milker Cow can hurt him. Carry her in your arms (C).', 'bad'); } }, 650);
    }
    anim(); return;
  }
  k.swatT = 2.5; k.swatting = false;
  if (k.mode === 'dash') {
    k.dashT -= dt; p.x += k.dvx * dt; p.z += k.dvz * dt; p.y = 0.3;
    if (Math.random() < 0.7) burst('sparkle', p.x, 2.5, p.z, 1, 0xc9a8ff);
    if (k.dashT <= 0) k.mode = 'walk';
  } else if (k.mode === 'pounce') {
    k.pt += dt; const u = Math.min(1, k.pt / 0.6);
    p.x = lerp(k.px0, k.ptx, u); p.z = lerp(k.pz0, k.ptz, u); p.y = Math.sin(u * Math.PI) * 7;
    if (u >= 1) { k.mode = 'walk'; p.y = 0; burst('ring', p.x, 0.5, p.z, 1, 0xff3b6b); burst('mud', p.x, 0.5, p.z, 20); sfx('boom'); if (dist2(p.x, p.z, px(), pz()) < 4.8) hurtPlayer(2, k); }
  } else {
    // circle at a distance, back off when Tori gets too close
    const want = 9, sp = k.def.speed * (1 + (phase - 1) * 0.3) * (k.slow > 0 ? 0.5 : 1);
    const strafe = Math.sin(k.t * 0.7) > 0 ? 1 : -1;
    let mx = 0, mz = 0;
    if (d > want + 2) { mx = toPx / d; mz = toPz / d; } else if (d < want - 3) { mx = -toPx / d * 0.7; mz = -toPz / d * 0.7; }
    mx += -toPz / d * 0.45 * strafe; mz += toPx / d * 0.45 * strafe;
    p.x += mx * sp * dt; p.z += mz * sp * dt; p.y = Math.abs(Math.sin(k.t * 5)) * 0.4;
    k.face = Math.atan2(toPx, toPz); k.g.rotation.y = turnTo(k.g.rotation.y, k.face, Math.min(1, dt * 6));
    // quick dodge sideways out of the milk streams
    if (k.hitT > 0 && k.dodgeCd <= 0 && Math.random() < 0.3 + phase * 0.15) {
      const a = Math.atan2(toPx, toPz) + (Math.random() < 0.5 ? -1 : 1) * Math.PI / 2, ds = 24 + phase * 5;
      k.dvx = Math.sin(a) * ds; k.dvz = Math.cos(a) * ds; k.dashT = 0.38; k.mode = 'dash'; k.dodgeCd = [3.2, 2.2, 1.4][phase - 1];
      floatText(p.x, 10, p.z, 'Whoosh!', 'hit', 0.7); sfx('meow');
    }
    if (d < 5 && k.cd <= 0) { k.cd = 1.3; hurtPlayer(2, k); burst('mud', px(), 1, pz(), 8); }
    if (k.atk <= 0) {
      k.atk = [4.6, 3.4, 2.4][phase - 1];
      const pool = ['pounce', 'hairball', 'shockwave', 'deflect', 'yarnrain'].concat(phase >= 2 ? ['yarn', 'pounce', 'deflect'] : []).concat(phase >= 3 ? ['shockwave', 'yarn', 'yarnrain', 'hairball'] : []);
      bossMove(k, pick(pool), phase);
    }
  }
  if (k.summonT <= 0) {
    k.summonT = [16, 12, 9][phase - 1];
    if (kittens.filter(o => o.cave && o.state === 'move').length < 8) for (let j = 0; j < phase + 1; j++) { const kk = spawnKitten(pick(['tabby', 'ginger', 'shadow']), 'player', { x: p.x + rand(-6, 6), z: p.z + rand(-6, 6) }); kk.cave = true; }
    floatText(p.x, 10, p.z, 'MINIONS, ATTACK!', 'bad', 1);
  }
  const ax = p.x - CAVE.x, az = p.z - CAVE.z, ad = Math.hypot(ax, az); if (ad > CAVE.r - 4) { p.x = CAVE.x + ax / ad * (CAVE.r - 4); p.z = CAVE.z + az / ad * (CAVE.r - 4); }
  anim();
}
function bossMove(k, move, phase) {
  const p = k.g.position;
  if (move === 'pounce') {
    const t = new THREE.Mesh(new THREE.RingGeometry(3.2, 4.6, 40), new THREE.MeshBasicMaterial({ color: 0xff3b6b, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
    t.rotation.x = -Math.PI / 2; t.position.set(px(), 0.15, pz()); scene.add(t);
    telegraphs.push({ m: t, t: 0, life: phase === 3 ? 0.75 : 1.0, onEnd: () => { k.mode = 'pounce'; k.pt = 0; k.px0 = p.x; k.pz0 = p.z; k.ptx = t.position.x; k.ptz = t.position.z; } });
    floatText(p.x, 10, p.z, 'POUNCE!', 'bad'); sfx('meow');
  } else if (move === 'hairball') {
    const n = [7, 11, 15][phase - 1], base = Math.atan2(px() - p.x, pz() - p.z);
    for (let j = 0; j < n; j++) {
      const a = base + (j - (n - 1) / 2) * 0.15, m = new THREE.Mesh(G.sphLo, M(0x7a8a5a)); m.scale.setScalar(0.55); m.position.set(p.x + Math.sin(a) * 3, 2.2, p.z + Math.cos(a) * 3); scene.add(m);
      eprojs.push({ m, vx: Math.sin(a) * 16, vz: Math.cos(a) * 16, life: 2.2, r: 1.1 });
    }
    floatText(p.x, 10, p.z, 'HACK! HAIRBALLS!', 'bad'); sfx('hurt');
  } else if (move === 'shockwave') {
    const t = new THREE.Mesh(new THREE.RingGeometry(4.5, 5.5, 48), new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
    t.rotation.x = -Math.PI / 2; t.position.set(p.x, 0.15, p.z); scene.add(t);
    k.mode = 'walk'; floatText(p.x, 10, p.z, 'GROUND SLAM! JUMP!', 'bad', 1.2);
    telegraphs.push({ m: t, t: 0, life: 0.9, onEnd: () => {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 64), new THREE.MeshBasicMaterial({ color: 0xff9f3d, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(p.x, 0.3, p.z); scene.add(ring);
      shockwaves.push({ m: ring, x: p.x, z: p.z, r: 3, hit: false }); sfx('boom'); burst('mud', p.x, 0.5, p.z, 24);
    } });
  } else if (move === 'deflect') {
    k.deflectT = [2.5, 3, 3.5][phase - 1];
    floatText(p.x, 10, p.z, 'PAW SHIELD! Milk bounces off!', 'bad', 1.4); sfx('zap');
  } else if (move === 'yarnrain') {
    const n = [6, 9, 13][phase - 1];
    for (let j = 0; j < n; j++) {
      const a = rand(0, TAU), r = j === 0 ? 0 : rand(1.5, 10), x = clamp(px() + Math.cos(a) * r, CAVE.x - CAVE.r + 3, CAVE.x + CAVE.r - 3), z = clamp(pz() + Math.sin(a) * r, CAVE.z - CAVE.r + 3, CAVE.z + CAVE.r - 3);
      const t = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.7, 28), new THREE.MeshBasicMaterial({ color: 0xff3b6b, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
      t.rotation.x = -Math.PI / 2; t.position.set(x, 0.15, z); scene.add(t);
      telegraphs.push({ m: t, t: 0, life: 1.1 + j * 0.06, onEnd: () => {
        const m = new THREE.Mesh(G.sph, M(pick([0xff9fc0, 0x9fd8ff, 0xfff1a8, 0xc9b0ff]))); m.scale.setScalar(1.1); m.position.set(x, 26, z); scene.add(m);
        eprojs.push({ m, vx: 0, vz: 0, vy: -38, life: 3, r: 1.8, fall: true });
      } });
    }
    floatText(p.x, 10, p.z, 'YARN FROM THE CEILING!', 'bad', 1.2); sfx('roar');
  } else if (move === 'yarn') {
    const n = phase === 3 ? 5 : 3;
    for (let j = 0; j < n; j++) {
      const a = rand(0, TAU), m = new THREE.Mesh(G.sph, M(pick([0xff9fc0, 0x9fd8ff, 0xfff1a8, 0xc9b0ff]))); m.scale.setScalar(1.4);
      m.position.set(p.x + Math.sin(a) * 4, 1.4, p.z + Math.cos(a) * 4); scene.add(m);
      eprojs.push({ m, vx: Math.sin(a) * 12, vz: Math.cos(a) * 12, life: 7, r: 1.9, bounce: true });
    }
    floatText(p.x, 10, p.z, 'YARN BOULDERS!', 'bad'); sfx('roar');
  }
}
const shockwaves = [];
function updateCaveFx(dt) {
  for (let i = telegraphs.length - 1; i >= 0; i--) { const t = telegraphs[i]; t.t += dt; t.m.material.opacity = 0.35 + Math.sin(t.t * 20) * 0.3; if (t.t >= t.life) { scene.remove(t.m); telegraphs.splice(i, 1); t.onEnd && t.onEnd(); } }
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const w = shockwaves[i]; w.r += 17 * dt; w.m.scale.setScalar(w.r); w.m.material.opacity = Math.max(0, 0.85 - w.r / 40);
    const d = dist2(px(), pz(), w.x, w.z);
    if (!w.hit && Math.abs(d - w.r) < 1.3 && (player.jy || 0) < 0.6) { w.hit = true; hurtPlayer(1, null); floatText(px(), 3, pz(), 'Jump next time!', 'bad', 1); }
    if (w.r > 34) { scene.remove(w.m); shockwaves.splice(i, 1); }
  }
  for (let i = eprojs.length - 1; i >= 0; i--) {
    const e = eprojs[i]; e.life -= dt;
    if (e.fall) {
      e.m.position.y += e.vy * dt; e.m.rotation.x += dt * 6;
      if (e.m.position.y <= 1.1) { burst('wool', e.m.position.x, 0.8, e.m.position.z, 10, e.m.material.color.getHex()); burst('ring', e.m.position.x, 0.4, e.m.position.z, 1, 0xff9fc0); sfx('boom'); if (dist2(e.m.position.x, e.m.position.z, px(), pz()) < e.r) hurtPlayer(1, null); scene.remove(e.m); eprojs.splice(i, 1); }
      continue;
    }
    e.m.position.x += e.vx * dt; e.m.position.z += e.vz * dt; e.m.rotation.x += dt * 8;
    if (e.bounce) { const dx = e.m.position.x - CAVE.x, dz = e.m.position.z - CAVE.z, d = Math.hypot(dx, dz); if (d > CAVE.r - 2) { const nx = dx / d, nz = dz / d, dot = e.vx * nx + e.vz * nz; e.vx -= 2 * dot * nx; e.vz -= 2 * dot * nz; e.m.position.x = CAVE.x + nx * (CAVE.r - 2.1); e.m.position.z = CAVE.z + nz * (CAVE.r - 2.1); } }
    if (dist2(e.m.position.x, e.m.position.z, px(), pz()) < (e.r || 1.2) && (player.jy || 0) < 1.2) { hurtPlayer(1, null); if (!e.bounce) { e.life = 0; burst('mud', e.m.position.x, 1, e.m.position.z, 8); } }
    if (e.life <= 0) { scene.remove(e.m); eprojs.splice(i, 1); }
  }
}

/* ============================================================
   Per-frame updates
   ============================================================ */
function updatePlayer(dt) {
  const inp = getMoveInput();
  const sp = UPG.boots.vals[state.upg.boots] * (hasBuff('speed') ? 1.5 : 1) * (inp.run ? 1.6 : 1) * (player.carrying ? 0.88 : 1);
  const k = 1 - Math.exp(-12 * dt);
  player.vx = lerp(player.vx, inp.x * sp, k); player.vz = lerp(player.vz, inp.z * sp, k);
  const pos = player.g.position; pos.x += player.vx * dt; pos.z += player.vz * dt;
  player.jvy = (player.jvy || 0) - 26 * dt; player.jy = Math.max(0, (player.jy || 0) + player.jvy * dt); if (player.jy === 0) player.jvy = 0;
  collide(pos, 0.6, player.jy > 0.6);
  for (const e of cowEnts) if (!e.carried) { const dx = pos.x - e.g.position.x, dz = pos.z - e.g.position.z, d = Math.hypot(dx, dz); if (d < 1.5 && d > 0.01) { pos.x = e.g.position.x + dx / d * 1.5; pos.z = e.g.position.z + dz / d * 1.5; } }
  if (player.inCave) { const dx = pos.x - CAVE.x, dz = pos.z - CAVE.z, d = Math.hypot(dx, dz); if (d > CAVE.r - 1.5) { pos.x = CAVE.x + dx / d * (CAVE.r - 1.5); pos.z = CAVE.z + dz / d * (CAVE.r - 1.5); } }
  else { pos.x = clamp(pos.x, -195, 195); pos.z = clamp(pos.z, -178, 138); }
  const moving = Math.hypot(player.vx, player.vz) > 0.6;
  player.aimT -= dt;
  if (player.aimT > 0) player.face = turnTo(player.face, player.aimFace, Math.min(1, dt * 18));
  else if (moving) player.face = turnTo(player.face, Math.atan2(player.vx, player.vz), Math.min(1, dt * 12));
  player.g.rotation.y = player.face;
  if (moving) player.walk += dt * Math.hypot(player.vx, player.vz) * 1.2;
  const sw = moving ? Math.sin(player.walk) * 0.7 : 0;
  player.legs[0].rotation.x = sw; player.legs[1].rotation.x = -sw;
  if (player.carrying) { player.arms.forEach(a => { a.rotation.x = -1.35; a.rotation.z = 0; }); }
  else { player.arms[0].rotation.x = -sw * 0.8; player.arms[1].rotation.x = sw * 0.8; }
  pos.y = player.jy + (moving && player.jy === 0 ? Math.abs(Math.sin(player.walk)) * 0.12 : 0);
  player.g.visible = !(player.inv > 0 && Math.floor(player.inv * 12) % 2 === 0 && player.inv < 1.1);
  player.inv -= dt; player.shotCd -= dt; player.restCd = (player.restCd || 0) - dt;
  for (const b in player.buffs) player.buffs[b] = Math.max(0, player.buffs[b] - dt);
  // carried cow
  const cw = player.carrying;
  if (cw) {
    const F = 2.0, s = 1 + Math.max(0, cw.squash) * 0.6;
    cw.g.position.set(pos.x + Math.sin(player.face) * F, 1.55 + pos.y, pos.z + Math.cos(player.face) * F);
    cw.g.rotation.set(-Math.PI / 2 + Math.sin(elapsed * 3) * 0.08, player.face, Math.sin(elapsed * 2) * 0.05);
    cw.g.scale.set(0.62 * s, 0.62 / s, 0.62 * s);
  }
  if (!isNight() && !player.inCave) { player.regen += dt; if (player.regen > 40) { player.regen = 0; if (state.hearts < maxHearts()) state.hearts++; } }
}
function wander(e, dt, area, speed, legs) {
  e.timer -= dt;
  if (e.timer <= 0) { const p = area(); e.tx = p.x; e.tz = p.z; e.timer = rand(4, 10); e.moving = Math.random() < 0.65; }
  const pos = e.g.position; let mv = false;
  if (e.moving) { const dx = e.tx - pos.x, dz = e.tz - pos.z, d = Math.hypot(dx, dz); if (d < 0.4) e.moving = false; else { pos.x += dx / d * speed * dt; pos.z += dz / d * speed * dt; e.g.rotation.y = turnTo(e.g.rotation.y, Math.atan2(dx, dz), Math.min(1, dt * 5)); mv = true; } }
  if (legs) { e.walk += mv ? dt * speed * 3 : 0; const s = mv ? Math.sin(e.walk) * 0.5 : 0; legs.forEach((L, j) => L.rotation.x = (j === 0 || j === 3) ? s : -s); }
  return mv;
}
function updateCows(dt) {
  for (const e of cowEnts) {
    if (e.fusing) continue;
    const d = e.d;
    d.cd = Math.max(0, d.cd - dt); d.petCd = Math.max(0, d.petCd - dt); d.happy = clamp(d.happy - dt / 14, 0, 100);
    e.udderIdle += dt; if (e.udderIdle > 0.5 && e.udder < udderMax()) e.udder = Math.min(udderMax(), e.udder + dt * udderMax() * 0.28);
    e.squash -= dt;
    if (d.super > 0 || d.type === 'super') { e.m.bodyM.emissive.setHSL((elapsed * 0.4 + e.walk) % 1, 0.9, 0.28); e.superOn = true; }
    else if (e.superOn) { e.superOn = false; e.m.bodyM.emissive.setHex(COWS[d.type].glow || 0); }
    if (e.carried) { e.ind.visible = false; continue; }
    if (e.ko > 0) {
      e.ko -= dt; e.ind.visible = false; e.g.rotation.z = lerp(e.g.rotation.z, Math.PI / 2, Math.min(1, dt * 8)); e.g.position.y = 0.95;
      if (Math.random() < dt * 1.6) burst('zzz', e.g.position.x, 2.4, e.g.position.z, 1);
      if (e.ko <= 0) { e.g.rotation.z = 0; e.g.position.y = 0; floatText(e.g.position.x, 3, e.g.position.z, 'Huh? Moo!', 'milk'); }
      continue;
    }
    if (e.following) { e.ind.visible = d.cd <= 0; herdMove(e, dt); continue; }
    e.ind.visible = d.cd <= 0; e.ind.position.y = 4 + Math.sin(elapsed * 3 + e.walk) * 0.15;
    const pos = e.g.position;
    if (e.returning) {
      const tx = (COW_PEN.x1 + COW_PEN.x2) / 2, tz = (COW_PEN.z1 + COW_PEN.z2) / 2; let gx = tx, gz = tz;
      if (!inRect(pos.x, pos.z, { x1: -70, x2: 0, z1: 20, z2: 90 })) { gx = -5; gz = 50; } else if (!inRect(pos.x, pos.z, COW_PEN, 1) && pos.x > COW_PEN.x2 - 1) { gx = COW_PEN.x2 - 4; gz = 50; }
      const dx = gx - pos.x, dz = gz - pos.z, dd = Math.hypot(dx, dz);
      if (dd > 0.5) { pos.x += dx / dd * 5 * dt; pos.z += dz / dd * 5 * dt; e.g.rotation.y = turnTo(e.g.rotation.y, Math.atan2(dx, dz), Math.min(1, dt * 6)); }
      e.walk += dt * 12; const s = Math.sin(e.walk) * 0.5; e.m.legs.forEach((L, j) => L.rotation.x = (j === 0 || j === 3) ? s : -s);
      if (inRect(pos.x, pos.z, COW_PEN, 3)) e.returning = false;
      continue;
    }
    wander(e, dt, () => penRandom(COW_PEN), e.spook > 0 ? 5 : 1.6, e.m.legs);
    if (e.spook > 0) { e.spook -= dt; if (!e.moving) { e.moving = true; const p = penRandom(COW_PEN); e.tx = p.x; e.tz = p.z; } }
    pos.x = clamp(pos.x, COW_PEN.x1 + 1.5, COW_PEN.x2 - 1.5); pos.z = clamp(pos.z, COW_PEN.z1 + 1.5, COW_PEN.z2 - 1.5);
    e.m.head.rotation.x = e.moving ? Math.sin(elapsed * 4 + e.walk) * 0.05 : Math.sin(elapsed * 0.8 + e.walk) * 0.18 + 0.12;
    e.m.tail.rotation.z = Math.sin(elapsed * 3 + e.walk) * 0.4;
    const sq = Math.max(0, e.squash); e.g.scale.set(0.9 * (1 + sq * 0.3), 0.9 * (1 - sq * 0.3), 0.9);
  }
}
function updateSheep(dt) {
  const glow = blessLevel() >= 3, grow = blessLevel() >= 1 ? 1.25 : 1;
  for (const e of sheepEnts) {
    const s = e.d, B = BREEDS[s.breed];
    s.fleece = Math.min(1, s.fleece + dt / 60 * grow); s.brushCd = Math.max(0, s.brushCd - dt);
    if (s.white > B.base && !glow) s.white = Math.max(B.base, s.white - dt * 0.03);
    else if (s.white < B.base) s.white = Math.min(B.base, s.white + dt * 0.05);
    const wq = Math.floor(s.white), fq = Math.round(s.fleece * 20);
    if (wq !== e.lastW || fq !== e.lastF) {
      e.lastW = wq; e.lastF = fq; fleeceColor(s.white, e.m.fleeceMat.color);
      e.m.fleeceMat.emissive.setHex(s.white >= 97 ? 0x2e2810 : s.white >= 85 ? 0x101010 : 0x000000);
      e.m.fleece.scale.setScalar(0.42 + 0.58 * s.fleece); e.m.halo.visible = s.white >= 97;
      e.ind.material.color.set(TIERS[tierOf(s.white)].color);
    }
    e.ind.visible = s.fleece >= 1; e.ind.position.y = 3.3 + Math.sin(elapsed * 3 + e.walk) * 0.15;
    if (e.m.halo.visible) e.m.halo.rotation.z += dt;
    if (e.ko > 0) {
      e.ko -= dt; e.ind.visible = false; e.g.rotation.z = lerp(e.g.rotation.z, Math.PI / 2, Math.min(1, dt * 8)); e.g.position.y = 0.7;
      if (Math.random() < dt * 1.6) burst('zzz', e.g.position.x, 1.8, e.g.position.z, 1);
      if (e.ko <= 0) { e.g.rotation.z = 0; e.g.position.y = 0; floatText(e.g.position.x, 2.6, e.g.position.z, 'Baa?', 'wool'); }
      continue;
    }
    wander(e, dt, () => penRandom(SHEEP_PEN), 1.4, e.m.legs);
    const pos = e.g.position; pos.x = clamp(pos.x, SHEEP_PEN.x1 + 1.5, SHEEP_PEN.x2 - 1.5); pos.z = clamp(pos.z, SHEEP_PEN.z1 + 1.5, SHEEP_PEN.z2 - 1.5);
    e.m.head.rotation.x = e.moving ? 0 : Math.sin(elapsed + e.walk) * 0.2 + 0.15;
  }
}
function nearestThreat(x, z, r) {
  let b = null, bd = r;
  for (const k of kittens) { if (k.state !== 'move' || k.cave) continue; const d = dist2(x, z, k.g.position.x, k.g.position.z); if (d < bd) { bd = d; b = k; } }
  return b;
}
function panic(e, dt, arms, city) {
  const k = player.inCave ? null : nearestThreat(e.g.position.x, e.g.position.z, 13);
  if (!k) { if (e.panicking) { e.panicking = false; if (arms) arms.forEach(a => a.rotation.set(0, 0, 0)); e.g.position.y = 0; } return false; }
  e.panicking = true; const p = e.g.position, dx = p.x - k.g.position.x, dz = p.z - k.g.position.z, d = Math.hypot(dx, dz) || 1;
  p.x += dx / d * 5.5 * dt; p.z += dz / d * 5.5 * dt;
  if (city) { const cx = p.x - C.x, cz = p.z - C.z, cd = Math.hypot(cx, cz); if (cd > 40) { p.x = C.x + cx / cd * 40; p.z = C.z + cz / cd * 40; } }
  e.g.rotation.y = turnTo(e.g.rotation.y, Math.atan2(dx, dz), Math.min(1, dt * 10));
  p.y = Math.abs(Math.sin(elapsed * 14 + p.x)) * 0.35;
  if (arms) arms.forEach((a, i) => { const sd = a.userData.side || (i ? 1 : -1); a.rotation.z = sd * (2.3 + Math.sin(elapsed * 28 + i * 2) * 0.6); });
  e.moving = false; e.timer = 0.5;
  e.panicT = (e.panicT || 0) - dt;
  if (e.panicT <= 0) { e.panicT = rand(2.5, 5); if (dist2(px(), pz(), p.x, p.z) < 45) bubble(e.g, pick(FOLK_PANIC), 1.6, 'mad'); }
  return true;
}
function updateTownsfolk(dt) {
  const near = !player.inCave && dist2(px(), pz(), C.x, C.z) < 70;
  const lines = state.flags.breached ? FOLK_PANIC : state.spindle.momentum <= 0 ? FOLK_SAD : FOLK_LINES;
  for (const f of folk) {
    if (panic(f, dt, f.f.arms, true)) continue;
    wander(f, dt, () => { const a = rand(0, TAU), r = rand(9, 25); return { x: C.x + Math.sin(a) * r, z: C.z + Math.cos(a) * r }; }, state.flags.breached ? 4 : 1.4);
    f.g.position.y = f.moving ? Math.abs(Math.sin(elapsed * 8 + f.timer)) * 0.12 : 0;
    f.talkT -= dt; if (f.talkT <= 0) { f.talkT = rand(8, 20); if (near && dist2(px(), pz(), f.g.position.x, f.g.position.z) < 30) bubble(f.g, pick(lines)); }
  }
  for (const e of sacred) { e.petCd -= dt; wander(e, dt, () => { const a = rand(0, TAU), r = rand(10, 21); return { x: C.x + Math.sin(a) * r, z: C.z + Math.cos(a) * r }; }, 1.2, e.m.legs); e.m.halo.rotation.z += dt; }
  for (const e of displayCows) wander(e, dt, () => ({ x: MARKET_PEN.x + rand(-3, 3), z: MARKET_PEN.z + rand(-3, 3) }), 1, e.m.legs);
  for (const key in npcEnts) {
    const n = npcEnts[key]; if (panic(n, dt, n.f.arms, false)) continue;
    { const hx = n.home.x - n.g.position.x, hz = n.home.z - n.g.position.z, hd = Math.hypot(hx, hz); if (hd > 0.4) { n.g.position.x += hx / hd * Math.min(hd, 3 * dt); n.g.position.z += hz / hd * Math.min(hd, 3 * dt); } }
    const d = dist2(px(), pz(), n.g.position.x, n.g.position.z);
    if (d < 8) n.g.rotation.y = turnTo(n.g.rotation.y, Math.atan2(px() - n.g.position.x, pz() - n.g.position.z), Math.min(1, dt * 5));
    n.f.head.rotation.z = Math.sin(elapsed * 1.5 + n.home.x) * 0.06;
    n.marker.position.y = 4.3 + Math.sin(elapsed * 4) * 0.15;
  }
  for (const key in farmerEnts) {
    if (panic(farmerEnts[key], dt, farmerEnts[key].h.arms, false)) continue;
    const fe = farmerEnts[key], home = FARMERS[key].home, d = dist2(px(), pz(), fe.g.position.x, fe.g.position.z);
    if (d < 6) { fe.moving = false; fe.g.rotation.y = turnTo(fe.g.rotation.y, Math.atan2(px() - fe.g.position.x, pz() - fe.g.position.z), Math.min(1, dt * 5)); fe.h.legs.forEach(L => L.rotation.x = 0); }
    else { const mv = wander(fe, dt, () => ({ x: home.x + rand(-4, 4), z: home.z + rand(-3, 3) }), 1.5); const s = mv ? Math.sin(elapsed * 8) * 0.6 : 0; fe.h.legs[0].rotation.x = s; fe.h.legs[1].rotation.x = -s; fe.h.arms[0].rotation.x = -s * 0.6; fe.h.arms[1].rotation.x = s * 0.6; }
    fe.marker.position.y = 4.9 + Math.sin(elapsed * 4) * 0.15;
    fe.h.heart.visible = state.romance[key].status === 'sweet'; fe.h.heart.position.y = 3.6 + Math.sin(elapsed * 3) * 0.1;
  }
  player.heartSpr.visible = !!state.sweetheart;
  for (const b of W.bees) { b.ph += dt * 2; b.m.position.set(b.cx + Math.cos(b.ph) * b.r, 1.2 + Math.sin(b.ph * 3) * 0.4, b.cz + Math.sin(b.ph * 1.3) * b.r * 0.6); }
}
function updateMarkers() {
  const q = curQuest(), st = state.quest;
  for (const key in npcEnts) {
    const n = npcEnts[key]; let t = '';
    if (q) { if (st.phase === 'offer' && q.giver === key) t = '!'; else if (st.phase === 'active' && (q.turnin || q.giver) === key && questProgress(q).done) t = '?'; }
    if (t !== n.mkType) { n.mkType = t; n.marker.visible = !!t; if (t) n.marker.material.map = badgeTex(t, t === '!' ? '#ffc83d' : '#7fe8a0'); n.marker.material.needsUpdate = true; }
  }
  for (const key in farmerEnts) farmerEnts[key].marker.visible = !state.romance[key].met || problemAvailable(key) || confessionReady(key);
}
const _gold = new THREE.Color(0xffd86a);
function updateWorld(dt) {
  const sp = state.spindle, spinning = sp.momentum > 0 && sp.queue.length > 0;
  if (sp.momentum > 0 && state.quest.i >= 7) {
    sp.momentum = Math.max(0, sp.momentum - dt * 0.25);
    if (sp.momentum === 0) toast('The Great Spindle has stopped! Feed it wool to keep the yarn coming.', 'bad');
  }
  if (spinning) {
    sp.prog += dt / (UPG.gears.vals[state.upg.gears] / (blessLevel() >= 5 ? 2 : 1));
    if (sp.prog >= 1) { sp.prog = 0; autoWeave(sp.queue.shift()); }
  }
  const wspd = spinning ? 3 : sp.momentum > 0 ? 0.7 : 0;
  W.spWheel.rotation.z -= dt * wspd; W.spinner.rotation.y += dt * wspd * 4; W.spRing.rotation.z += dt * (0.3 + wspd * 0.2);
  W.cop.scale.set(1.2 + sp.momentum / 220, 2.6 + sp.momentum / 120, 1.2 + sp.momentum / 220);
  W.basketYarn.visible = basketTotal() > 0;
  if (state.field.power > 0 && !state.flags.breached && state.quest.i >= 8) state.field.power = Math.max(0, state.field.power - dt * 0.15 * (blessLevel() >= 2 ? 0.7 : 1) * (hasSeraph() ? 0.1 : 1));
  if (hasSeraph()) {
    state.field.power = Math.min(maxPower(), state.field.power + dt * (state.flags.breached ? 1.2 : 0.35));
    if (state.flags.breached && state.field.power >= 25) { state.flags.breached = false; toast("The Seraph Sheep's golden fleece restarts the shield!", 'good'); }
  }
  if (state.field.power <= 0 && !state.flags.breached && raid.active) breach();
  const pr = state.field.power / maxPower(); domeFlash = Math.max(0, domeFlash - dt * 1.5);
  const dm = W.dome.material;
  if (state.flags.breached) { dm.opacity = Math.random() < 0.1 ? 0.15 : 0.02; dm.color.setHex(0xff6f91); }
  else { dm.opacity = 0.12 + pr * 0.32 + domeFlash * 0.35 + (pr < 0.25 ? Math.random() * 0.1 : 0); dm.color.setRGB(lerp(1, 0.44, pr), lerp(0.45, 0.89, pr), lerp(0.6, 1, pr)); if (hasSeraph()) dm.color.lerp(_gold, 0.6); }
  dm.map.offset.x += dt * 0.004; dm.map.offset.y += dt * 0.01;
  W.domeRing.material.opacity = state.flags.breached ? 0.1 : 0.3 + pr * 0.5; W.domeRing.material.color.copy(dm.color);
  W.beam.material.opacity = state.flags.breached ? 0 : 0.08 + pr * 0.25; W.beam.material.color.copy(dm.color);
  W.crystal.rotation.y += dt * (0.6 + pr * 2); W.crystal.position.y = 4.5 + Math.sin(elapsed * 2) * 0.35;
  W.greatSheep.halo.rotation.z += dt * 0.6; W.greatSheep.g.position.y = 3 + Math.sin(elapsed * 0.8) * 0.15;
  W.flames.forEach((f, i) => { f.scale.y = 1.4 + Math.sin(elapsed * 14 + i) * 0.3; });
  W.clouds.forEach(c => { c.g.position.x += c.v * dt; if (c.g.position.x > 240) c.g.position.x = -240; });
  W.flag.rotation.y = Math.sin(elapsed * 2) * 0.3;
  W.portal.rotation.z += dt; W.caveCrystals.forEach((c, i) => c.scale.y = 1.6 + Math.sin(elapsed * 2 + i) * 0.2);
  if (W.churn.userData.spin > 0) { W.churn.userData.spin -= dt; W.churn.rotation.y += dt * 12; }
  W.clover.visible = state.flags.cloverT <= 0; state.flags.cloverT = Math.max(0, state.flags.cloverT - dt);
  if (W.sleepKing && Math.random() < dt * 2) burst('zzz', CAVE.x, 7, CAVE.z - 22, 1);
}

/* ---------- Day & night ---------- */
const SKY_DAY = new THREE.Color(0xa9d8f2), SKY_DUSK = new THREE.Color(0xffbfa0), SKY_NIGHT = new THREE.Color(0x232a55), SKY_CAVE = new THREE.Color(0x1a1428), _sky = new THREE.Color();
function applyLight() {
  const t = state ? state.t : 60; let k;
  if (t < DAY - 30) { k = 1; _sky.copy(SKY_DAY); }
  else if (t < DAY) { const u = (t - (DAY - 30)) / 30; k = 1 - u * 0.72; if (u < 0.5) _sky.copy(SKY_DAY).lerp(SKY_DUSK, u * 2); else _sky.copy(SKY_DUSK).lerp(SKY_NIGHT, (u - 0.5) * 2); }
  else if (t < CYCLE - 20) { k = 0.28; _sky.copy(SKY_NIGHT); }
  else { const u = (t - (CYCLE - 20)) / 20; k = 0.28 + u * 0.72; if (u < 0.5) _sky.copy(SKY_NIGHT).lerp(SKY_DUSK, u * 2); else _sky.copy(SKY_DUSK).lerp(SKY_DAY, (u - 0.5) * 2); }
  if (player.inCave) {
    scene.background.copy(SKY_CAVE); scene.fog.color.copy(SKY_CAVE); scene.fog.near = 30; scene.fog.far = 110;
    hemi.intensity = 0.6; hemi.color.setHex(0xd9c4ff); hemi.groundColor.setHex(0x3a3150); sun.intensity = 0.3; W.caveLight.intensity = 1.3; k = 0.2;
  } else {
    scene.background.copy(_sky); scene.fog.color.copy(_sky); scene.fog.near = 140; scene.fog.far = 380;
    hemi.color.setHex(0xffffff); hemi.groundColor.setHex(0x8fc97a); hemi.intensity = 0.28 + 0.27 * k; sun.intensity = 0.1 + 0.45 * k; W.caveLight.intensity = 0;
    sun.color.setHSL(0.1, 0.6, lerp(0.75, 0.93, k));
  }
  const night = 1 - k;
  lampMat.emissive.setRGB(night, night * 0.85, night * 0.45); winMat.emissive.setRGB(night * 0.9, night * 0.7, night * 0.3);
  W.stars.material.opacity = player.inCave ? 0 : clamp((night - 0.3) * 1.6, 0, 1);
}
function clockStr() {
  const t = state.t; let h = t < DAY ? 6 + 14 * t / DAY : 20 + 10 * (t - DAY) / (CYCLE - DAY); h %= 24;
  const hh = Math.floor(h), mm = Math.floor((h - hh) * 6) * 10; return `${hh}:${String(mm).padStart(2, '0')}`;
}
function updateTime(dt) {
  const before = state.t; state.t += dt;
  if (before < DAY && state.t >= DAY) {
    if (state.flags.endless) { } else if (state.quest.i >= 9) startRaid();
    else toast('Night falls on the meadow. The evil kittens are still napping... for now.');
  }
  if (raid.active) {
    raid.timer += dt;
    const cap = state.flags.endless ? 70 : 45, alive = kittens.filter(k => !k.cave && !k.guard && !k.roamer && k.state === 'move').length;
    raid.packs = raid.packs || {};
    if (alive < cap) while (raid.queue.length && raid.queue[0].at <= raid.timer) {
      const w = raid.queue.shift(); let base = raid.packs[w.pack]; if (!base) base = raid.packs[w.pack] = edgeSpawn(w.edge);
      spawnKitten(w.t, w.goal, { x: base.x + rand(-3, 3), z: base.z + rand(-3, 3) });
    }
  }
  if (state.t >= CYCLE) {
    const held = !state.flags.breached, pct = state.field.power / maxPower();
    state.t -= CYCLE; state.day++; if (!state.flags.endless) endRaid(); genBounties();
    if (state.quest.i >= 8 && held) { const pay = Math.round(pct * (20 + state.day * 4)); if (pay > 0) { state.coins += pay; toast(`The Sheep-a-verse pays you ${pay} coins for keeping the shield at ${Math.round(pct * 100)}%.`, 'good'); } }
    else if (state.quest.i >= 8) toast('The shield is still down: no pay from the city, the Moo Market stays closed and blessings are paused.', 'bad');
    toast(`Good morning! Day ${state.day} on Tori's Super Milkers.`, 'good');
    sweetheartGift(); saveGame(true);
  }
}

/* ---------- Interaction targets ---------- */
function findTarget() {
  let best = null, bd = 1;
  const x0 = px(), z0 = pz();
  const consider = (it, x, z, r) => { const d = dist2(x0, z0, x, z); if (d < r) { const s = d / r; if (s < bd) { bd = s; best = it; } } };
  if (player.inCave) { const s = stations.find(s => s.kind === 'portal'); consider(s.it, s.x, s.z, s.r); for (const w of wilds) if (w.cave) consider(w.it, w.g.position.x, w.g.position.z, 3.6); return best; }
  for (const e of cowEnts) if (!e.carried) consider(e.it, e.g.position.x, e.g.position.z, 3.4);
  for (const e of sheepEnts) consider(e.it, e.g.position.x, e.g.position.z, 2.9);
  for (const w of wilds) if (!w.cave || w.follow) consider(w.it, w.g.position.x, w.g.position.z, w.locked ? 5.5 : 3.4);
  for (const k in npcEnts) consider(npcEnts[k].it, npcEnts[k].g.position.x, npcEnts[k].g.position.z, 3.6);
  for (const k in farmerEnts) consider(farmerEnts[k].it, farmerEnts[k].g.position.x, farmerEnts[k].g.position.z, 3.8);
  for (const e of sacred) consider(e.it, e.g.position.x, e.g.position.z, 2.8);
  for (const e of displayCows) consider(e.it, e.g.position.x, e.g.position.z, 3);
  for (const s of stations) if (s.kind !== 'portal') consider(s.it, s.x, s.z, s.r);
  return best;
}
function interact() { const a = cardActions[0]; if (a && !a.disabled) { a.fn(); cardDirty = true; } }
function jump() {
  if (!running || paused || (player.jy || 0) > 0.05) return;
  player.jvy = 10.5; player.jy = 0.01; sfx('pickup');
  if (player.carrying && Math.random() < 0.3) sfx('moo');
}
const herdFollowers = () => cowEnts.filter(e => e.following);
function toggleHerd() {
  if (!running || paused) return;
  const f = herdFollowers();
  if (f.length) { f.forEach(e => { e.following = false; e.returning = true; }); toast('Your herd is heading home to the pasture.'); sfx('moo'); cardDirty = true; return; }
  const list = cowEnts.filter(e => !e.carried && !e.fusing && !(e.ko > 0));
  if (!list.length) { toast('No cows are free to follow you right now.'); return; }
  list.forEach(e => { e.following = true; e.returning = false; e.moving = false; });
  toast(`Moo! ${list.length} cow${list.length > 1 ? 's are' : ' is'} following you and will squirt any kitten nearby. Press G to send them home.`, 'love'); sfx('moo');
  cardDirty = true;
}
function herdMove(e, dt) {
  const list = herdFollowers(), i = list.indexOf(e), row = Math.floor(i / 4), col = (i % 4) - 1.5;
  const back = 3.4 + row * 2.6, side = col * 2.4, f = player.face;
  const tx = px() - Math.sin(f) * back + Math.cos(f) * side, tz = pz() - Math.cos(f) * back - Math.sin(f) * side;
  const pos = e.g.position, dx = tx - pos.x, dz = tz - pos.z, d = Math.hypot(dx, dz);
  if (d > 70) { pos.set(tx, 0, tz); return; }
  let mv = false;
  if (d > 0.7) { const sp = Math.min(13, d * 2.2) * dt; pos.x += dx / d * sp; pos.z += dz / d * sp; mv = true; if (!(e.streamT > 0)) e.g.rotation.y = turnTo(e.g.rotation.y, Math.atan2(dx, dz), Math.min(1, dt * 8)); }
  e.walk += mv ? dt * 12 : 0; const s = mv ? Math.sin(e.walk) * 0.5 : 0; e.m.legs.forEach((L, j) => L.rotation.x = (j === 0 || j === 3) ? s : -s);
  pos.y = mv ? Math.abs(Math.sin(e.walk)) * 0.12 : 0;
  const sq = Math.max(0, e.squash); e.g.scale.set(0.9 * (1 + sq * 0.3), 0.9 * (1 - sq * 0.3), 0.9);
  // squirt the nearest kitten with a short stream of her own milk
  e.atk = (e.atk || 0) - dt;
  if (e.streamT > 0 && e.target && e.target.state === 'move') {
    e.streamT -= dt; e.shotT = (e.shotT || 0) - dt;
    const k = e.target, ang = Math.atan2(k.g.position.x - pos.x, k.g.position.z - pos.z); e.g.rotation.y = ang;
    if (e.shotT <= 0) {
      e.shotT = STREAM_DT;
      const isSup = e.d.type === 'super' || e.d.super > 0, mk = COWS[e.d.type].milk, spec = isSup ? SUPER_SHOT : MILK[mk].shot;
      spawnProj(pos.x + Math.sin(ang) * 1.6, 1.1, pos.z + Math.cos(ang) * 1.6, ang, k, { spec, color: isSup ? 0xffffff : MILK[mk].hex, key: isSup ? 'super' : mk, auto: true }, STREAM_DT / spec.cd * 0.6, 'herd' + i);
      e.squash = 0.12;
    }
  } else if (e.atk <= 0) {
    let best = null, bd = 15;
    for (const k of kittens) { if (k.state !== 'move' || k.cave !== player.inCave) continue; const kd = dist2(pos.x, pos.z, k.g.position.x, k.g.position.z); if (kd < bd) { bd = kd; best = k; } }
    if (best) { e.target = best; e.streamT = 0.6; e.atk = 1.2 + rand(0, 0.3); } else e.atk = 0.4;
  }
}
function toggleCarry() {
  if (player.carrying) { putDownCow(); cardDirty = true; return; }
  let best = null, bd = 3.6;
  for (const e of cowEnts) { if (e.carried) continue; const d = dist2(px(), pz(), e.g.position.x, e.g.position.z); if (d < bd) { bd = d; best = e; } }
  if (best) pickUpCow(best); else toast('Walk up to one of your cows and press C to pick her up.');
  cardDirty = true;
}

/* ---------- Main loop ---------- */
let last = performance.now(), titleAng = 0, zoom = 1, uiT = 0, mmT = 0, cardT = 0;
const camTarget = new THREE.Vector3();
function update(dt) {
  updateTime(dt); updatePlayer(dt); updateCows(dt); updateSheep(dt); updateTownsfolk(dt); updateSoaked(dt); updateWorld(dt); updateWild(dt); updateForestKittens(dt); updateFusion(dt); updateEndless(dt);
  if (shootHeld) shoot();
  updateKittens(dt); updateProjs(dt); linkStream(); updatePuddles(dt); updateCaveFx(dt);
  autosaveT += dt; if (autosaveT > 25) { autosaveT = 0; saveGame(true); }
}
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now; elapsed += dt;
  if (running && !paused) { try { update(dt); } catch (e) { if (elapsed - (frame.errT || -9) > 2) { frame.errT = elapsed; console.error(e); } } }
  updateParts(dt); updateFloats(dt);
  if (running) {
    applyLight();
    const p = player.g.position;
    camTarget.set(p.x, 21 * zoom + 1, p.z + 17 * zoom);
    camera.position.lerp(camTarget, 1 - Math.pow(0.0015, dt));
    camera.lookAt(p.x, 1.2, p.z - 1.5);
    sun.position.set(p.x + 30, 55, p.z + 22); sun.target.position.set(p.x, 0, p.z);
    updateWeapon(); updateThreats(); updatePersist(); updateTrapBubbles();
    uiT -= dt; if (uiT <= 0) { uiT = 0.2; updateHUD(); updateMarkers(); }
    cardT -= dt; if (cardT <= 0 || cardDirty) { cardT = 0.15; renderCard(findTarget()); }
    mmT -= dt; if (mmT <= 0) { mmT = 0.15; drawMinimap(); }
  } else {
    titleAng += dt * 0.05;
    camera.position.set(Math.sin(titleAng) * 120, 55, -30 + Math.cos(titleAng) * 120); camera.lookAt(0, 0, -40);
    sun.position.set(30, 60, 0); sun.target.position.set(0, 0, -40);
    if (state) applyLight();
    updateWorldIdle(dt);
  }
  renderer.render(scene, camera);
}
function updateWorldIdle(dt) {
  W.spWheel.rotation.z -= dt * 1.5; W.spinner.rotation.y += dt * 5; W.crystal.rotation.y += dt;
  W.clouds.forEach(c => { c.g.position.x += c.v * dt; if (c.g.position.x > 240) c.g.position.x = -240; });
  W.greatSheep.halo.rotation.z += dt * 0.6;
  for (const e of displayCows) wander(e, dt, () => ({ x: MARKET_PEN.x + rand(-3, 3), z: MARKET_PEN.z + rand(-3, 3) }), 1, e.m.legs);
}

/* ---------- Boot ---------- */
function startGame(saved) {
  state = saved ? mergeState(saved) : newState();
  if (!state.bounties.length) genBounties();
  buildAnimals();
  player.g.position.set(state.player.x, 0, state.player.z); player.inCave = false;
  for (const k of kittens) scene.remove(k.g); kittens.length = 0; raid = { active: false, timer: 0, queue: [], breachedThisRaid: false };
  fusion = null; spawnWilds(); spawnForestKittens();
  if (state.t >= DAY) { state.wave = Math.max(0, state.wave - 1); raid.active = false; state.t = DAY - 0.01; }
  running = true; paused = false; hideTitle();
  camera.position.set(px(), 30, pz() + 30);
  if (!saved) setTimeout(() => toast('Welcome to Tori\'s Super Milkers! Walk with WASD or the joystick. Granny Clover (the "!") has your first quest.', 'good'), 400);
  else toast(`Welcome back! Day ${state.day}.`, 'good');
}
function boot(hotData) {
  buildWorld(); buildNPCs(); buildStations(); initPlayer();
  initUI();
  requestAnimationFrame(frame);
  if (hotData && hotData.save) startGame(hotData.save);
  else showTitle(!!loadSave());
}
window.claude?.hot?.snapshot?.(() => ({ save: running ? serialize() : null }));
const _go = () => window.claude?.hot?.ready ? window.claude.hot.ready(boot) : boot(window.claude?.hot?.data ?? {});
if (document.fonts && document.fonts.ready) Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))]).then(_go); else _go();
