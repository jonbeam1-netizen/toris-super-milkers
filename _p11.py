def rep(s, a, b):
    assert a in s, 'MISSING: ' + a[:110]
    return s.replace(a, b, 1)

# ---------- world.js: small pocket only, so trees don't sit on top of animals ----------
p = 'js/world.js'; s = open(p, encoding='utf-8').read()
s = rep(s, "  for (const p of _wildSpots) { const dx = (x - p.x) / 9, dz = (z - p.z) / (z > p.z ? 16 : 8); if (dx * dx + dz * dz < 1) return true; }",
           "  for (const p of _wildSpots) { const dx = (x - p.x) / 4.6, dz = (z - p.z) / (z > p.z ? 7.5 : 3.8); if (dx * dx + dz * dz < 1) return true; }")
s = rep(s, "/* Keep a wide-open glade around every wild animal so trees never hide it, with extra room on the camera side (south) */",
           "/* Keep a small pocket around every wild animal so no tree sits on top of it, with a little extra room on the camera side (south) */")
open(p, 'w', encoding='utf-8').write(s)

# ---------- explore.js: spread out, guarded, respawning ----------
p = 'js/explore.js'; s = open(p, encoding='utf-8').read()
a = s.index('function wildSpot(id, c) {'); b = s.index('function makeWild(species, type, id, home) {')
s = s[:a] + """let _spotCache = null;
function computeWildSpots() {
  _spotCache = {}; const placed = [];
  for (const c of CLEARINGS) c.animals.forEach((an, i) => {
    const id = wildId(c, i);
    let h = 2166136261; for (const ch of id) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    const rnd = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return (h >>> 0) / 4294967296; };
    let best = null;
    for (let t = 0; t < 1200 && !best; t++) {
      const minSep = t < 400 ? 36 : t < 800 ? 26 : 16;
      const a = rnd() * TAU, r = 12 + rnd() * 40, x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
      if (x < -186 || x > 186 || z < -170 || z > 130) continue;
      if (Math.abs(c.x) < 70 && Math.sign(x) !== Math.sign(c.x)) continue; // stay on the side of the road the hint says
      if (!forestFree(x, z, 3)) continue;
      if (placed.some(p => dist2(p.x, p.z, x, z) < minSep)) continue;
      best = { x, z };
    }
    best = best || { x: c.x, z: c.z }; placed.push(best); _spotCache[id] = best;
  });
}
/* Each wild animal hides alone at its own spot, far from the others. The spot is seeded by its id, so it stays put. */
function wildSpot(id, c) { if (!_spotCache) computeWildSpots(); return _spotCache[id] || { x: c.x, z: c.z }; }
""" + s[b:]
a = s.index('function spawnGuardsFor(w) {'); b = s.index('function spawnForestKittens() {')
s = s[:a] + """/* Every free wild animal is guarded; rarer ones by more and tougher kittens */
function guardCount(w) {
  if (w.species === 'sheep') return { mud: 1, meadow: 1, cloud: 2, snow: 3 }[w.type] || 0;
  return 1 + Math.floor(Math.max(0, COW_ORDER.indexOf(w.type)) / 2);
}
function guardType(w) {
  const c = CLEARINGS.find(c => w.id.startsWith(c.id + '-'));
  if (c && c.guardTypes && Math.random() < 0.6) return pick(c.guardTypes);
  const tier = w.species === 'cow' ? COW_ORDER.indexOf(w.type) : SHEEP_TYPES.indexOf(w.type) * 2;
  return kittenType(3 + tier * 3);
}
function spawnGuardsFor(w, n) {
  if (w.cave) return;
  n = n === undefined ? guardCount(w) : n;
  for (let j = 0; j < n; j++) { const a = rand(0, TAU), r = rand(3.5, 6.5); spawnForestKitten(guardType(w), w.home.x + Math.cos(a) * r, w.home.z + Math.sin(a) * r, true).cid = w.id; }
}
""" + s[b:]
s = rep(s, "function updateForestKittens(dt) {\n  roamT -= dt;", """let guardT = 0;
function updateForestKittens(dt) {
  // guards creep back to their posts while you're away
  guardT -= dt;
  if (guardT <= 0) {
    guardT = 5;
    for (const w of wilds) {
      if (w.locked || w.follow || w.cave) continue;
      w.respawnT = (w.respawnT || 0) - 5;
      if (w.respawnT > 0 || dist2(px(), pz(), w.home.x, w.home.z) < 45) continue;
      if (kittens.filter(k => k.guard && k.state === 'move' && k.cid === w.id).length >= guardCount(w)) continue;
      w.respawnT = 40; spawnGuardsFor(w, 1);
    }
  }
  roamT -= dt;""")
open(p, 'w', encoding='utf-8').write(s)

# ---------- data.js: learn to squirt on the first rescue ----------
p = 'js/data.js'; s = open(p, encoding='utf-8').read()
s = rep(s, "hint: 'Search the woods west of the castle road (follow the arrow). Press E on her, then walk her into your pasture.',",
           "hint: 'Search the woods west of the castle road (follow the arrow). A kitten guards her: pick up Buttercup (C) and hold F to squirt it. Then press E on the cow and lead her home.',")
s = rep(s, '"Walk up to her and press E to befriend her. She\'ll follow you. Lead her into your cow pasture and she\'s yours!"],',
           '"Careful, dear: a naughty kitten guards her. Pick up Buttercup with C and hold F to squirt milk at it. Kittens HATE milk!", "Then walk up to the chocolate cow and press E to befriend her. She\'ll follow you. Lead her into your cow pasture and she\'s yours!"],')
s = rep(s, '"Whiter sheep hide wild in the forest. Try the woods east of the castle road.", "Watch out, kittens guard some of them. Carry a cow (press C) and squirt them!",',
           '"Whiter sheep hide wild in the forest. Try the woods east of the castle road.", "Kittens guard every wild animal, and they come back if you leave. Carry a cow (press C) and squirt them!",')
open(p, 'w', encoding='utf-8').write(s)

p = 'index.html'; s = open(p, encoding='utf-8').read(); s = s.replace('?v=27"', '?v=28"'); open(p, 'w', encoding='utf-8').write(s)
print('ok')
