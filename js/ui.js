'use strict';
/* ============================================================
   UI: HUD, cards, dialogs, menus, input
   ============================================================ */
let cardActions = [], cardDirty = true, cardSig = '', modalActs = [], currentModal = null;
let shootHeld = false, mouseAim = 0, mouseAiming = false;
const keys = {};
const joy = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };

/* ---------- toasts & effects ---------- */
function toast(msg, kind = '') {
  const box = $('#toasts'); const el = document.createElement('div'); el.className = 'toast ' + kind; el.textContent = msg; box.appendChild(el);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, 4200);
}
function flashHurt() { const h = $('#hurt'); h.classList.remove('on'); void h.offsetWidth; h.classList.add('on'); }
function fadeScreen(mid) { const f = $('#fade'); f.classList.add('on'); setTimeout(() => { mid(); setTimeout(() => f.classList.remove('on'), 120); }, 380); }
function showBoss(name, frac) { const b = $('#bossbar'); if (b.hidden) b.hidden = false; $('#boss-name').textContent = name; $('#boss-fill').style.width = (clamp(frac, 0, 1) * 100).toFixed(1) + '%'; }
function hideBoss() { $('#bossbar').hidden = true; }

/* ---------- modal plumbing ---------- */
function B(label, fn, o = {}) { const i = modalActs.push(fn) - 1; return `<button class="btn ${o.cls || ''}" data-a="${i}" ${o.disabled ? 'disabled' : ''}>${label}</button>`; }
function showModal(builder, kind = '') {
  modalActs = []; currentModal = builder;
  const m = $('#modal'); m.className = kind; $('#modal-body').innerHTML = builder(); m.hidden = false; paused = true; shootHeld = false;
}
function refreshModal() { if (currentModal && !$('#modal').hidden) { const sc = $('#modal-body').scrollTop; showModal(currentModal, $('#modal').className); $('#modal-body').scrollTop = sc; } }
function closeModal() { $('#modal').hidden = true; currentModal = null; paused = false; cardDirty = true; }
const swatch = c => `<i class="sw" style="background:${c}"></i>`;
const heartsRow = (aff) => { let s = ''; for (let i = 0; i < 10; i++) s += `<i class="hrt ${aff >= (i + 1) * 10 ? 'on' : ''}"></i>`; return `<span class="hrow" aria-label="${Math.floor(aff / 10)} of 10 hearts">${s}</span>`; };

function dialog(key, lines, buttons) {
  const isF = !!FARMERS[key], def = isF ? FARMERS[key] : NPC_DEF[key];
  const color = hexStr(isF ? def.look.shirt : def.robe);
  let i = 0;
  showModal(() => {
    const last = i >= lines.length - 1; let btns;
    if (!last) btns = B('Next', () => { i++; refreshModal(); }, { cls: 'primary' });
    else if (buttons && buttons.length) btns = buttons.map(b => B(esc(b.label), () => { closeModal(); b.fn && b.fn(); }, { cls: b.cls || 'primary' })).join('');
    else btns = B('Okay', closeModal, { cls: 'primary' });
    const r = isF ? state.romance[key] : null;
    return `<div class="dlg">
      <div class="dlg-portrait" style="--c:${color}"><span>${esc(def.name[0])}</span></div>
      <div class="dlg-main">
        <div class="dlg-name">${esc(def.name)} <small>${esc(def.role)}</small></div>
        ${r ? `<div class="dlg-hearts">${heartsRow(r.aff)} ${r.status === 'sweet' ? '<b class="tag love">Sweetheart</b>' : r.status === 'friend' ? '<b class="tag">Best friend</b>' : ''}</div>` : ''}
        <p class="dlg-text">${esc(lines[i])}</p>
        <div class="dlg-foot"><span class="dlg-page">${i + 1}/${lines.length}</span><div class="dlg-btns">${btns}</div></div>
      </div></div>`;
  }, 'dialog');
}

/* ---------- Market ---------- */
function openMarket(tab = 'sell') {
  let t = tab;
  const sellRow = (label, sw, count, price, fn) => `<div class="row"><span class="nm">${sw}${label} <small>×${count}</small></span><span class="pr">${price}c each</span>${B('Sell 1', () => { fn(1); refreshModal(); }, { disabled: !count })}${B('Sell all', () => { fn(count); refreshModal(); }, { disabled: !count, cls: 'ghost' })}</div>`;
  const sold = n => { if (n > 0) { sfx('coin'); stat('sold', 1); } };
  showModal(() => {
    const tabs = ['sell', 'animals', 'supplies', 'upgrades'].map(k => B(k[0].toUpperCase() + k.slice(1), () => { t = k; refreshModal(); }, { cls: 'tab' + (t === k ? ' on' : '') })).join('');
    let body = '';
    if (t === 'sell') {
      let any = false;
      for (const k of MILK_KEYS) { const c = state.inv.milk[k] || 0; if (!c) continue; any = true; body += sellRow(MILK[k].name, swatch(MILK[k].color), c, MILK[k].price, n => { state.inv.milk[k] -= n; state.coins += n * MILK[k].price; sold(n); }); }
      state.inv.wool.forEach((c, i) => { if (!c) return; any = true; body += sellRow(TIERS[i].name + ' wool', swatch(TIERS[i].color), c, TIERS[i].sell, n => { state.inv.wool[i] -= n; state.coins += n * TIERS[i].sell; sold(n); }); });
      state.inv.yarn.forEach((c, i) => { if (!c) return; any = true; const p = Math.round(TIERS[i].sell * 2.2); body += sellRow(TIERS[i].name + ' yarn', swatch(TIERS[i].color), c, p, n => { state.inv.yarn[i] -= n; state.coins += n * p; sold(n); }); });
      for (const r of RECIPES) { const c = state.inv.goods[r.key] || 0; if (!c || !r.sell) continue; any = true; body += sellRow(r.name, swatch('#ffb3d9'), c, r.sell, n => { state.inv.goods[r.key] -= n; state.coins += n * r.sell; sold(n); }); }
      if (!any) body = '<p class="empty">Nothing to sell yet. Milk your cows and shear your sheep, then come back!</p>';
      else body = '<p class="hint">Yarn sells well, but the shield needs it too.</p>' + body;
    } else if (t === 'animals') {
      body += `<h3>Cows <small>${state.cows.length}/${animalCap()} in your pasture</small></h3>`;
      for (const [k, T] of Object.entries(COWS)) {
        const lock = state.level < T.lvl, full = state.cows.length >= animalCap(), M_ = MILK[T.milk];
        body += `<div class="row tall"><span class="nm">${swatch(hexStr(T.body))}${T.name}<small>Makes ${M_.name} · Udder shot: ${M_.shot.desc}</small></span><span class="pr">${lock ? 'Level ' + T.lvl : T.price + 'c'}</span>${B(lock ? 'Locked' : full ? 'Barn full' : 'Buy', () => { state.coins -= T.price; const e = addCow(k); stat('bought'); toast(`${e.d.name} the ${T.name} joined your farm!`, 'good'); sfx('moo'); refreshModal(); }, { disabled: lock || full || state.coins < T.price })}</div>`;
      }
      body += `<h3>Sheep <small>${state.sheep.length}/${animalCap()} in your meadow</small></h3>`;
      for (const [k, Br] of Object.entries(BREEDS)) {
        const lock = state.level < Br.lvl, full = state.sheep.length >= animalCap();
        body += `<div class="row tall"><span class="nm">${swatch(TIERS[tierOf(Br.base)].color)}${Br.name}<small>Natural whiteness ${Br.base} (${TIERS[tierOf(Br.base)].name})</small></span><span class="pr">${lock ? 'Level ' + Br.lvl : Br.price + 'c'}</span>${B(lock ? 'Locked' : full ? 'Meadow full' : 'Buy', () => { state.coins -= Br.price; const s = { breed: k }; state.sheep.push(s); normSheep(s); spawnSheepEnt(s); stat('bought'); toast(`${s.name} the ${Br.name} joined your meadow!`, 'good'); sfx('baa'); refreshModal(); }, { disabled: lock || full || state.coins < Br.price })}</div>`;
      }
    } else if (t === 'supplies') {
      body += `<div class="row tall"><span class="nm">${swatch('#f2cf6b')}Hay bundle ×5<small>Feed cows to make them happy. Happy cows give extra milk. You have ${state.inv.hay}.</small></span><span class="pr">12c</span>${B('Buy', () => { state.coins -= 12; state.inv.hay += 5; sfx('coin'); refreshModal(); }, { disabled: state.coins < 12 })}</div>`;
      body += `<div class="row tall"><span class="nm">${swatch('#5fcf6a')}Clover ×3<small>Sheep grow fleece faster and a little whiter. You have ${state.inv.clover}.</small></span><span class="pr">20c</span>${B('Buy', () => { state.coins -= 20; state.inv.clover += 3; sfx('coin'); refreshModal(); }, { disabled: state.coins < 20 })}</div>`;
    } else {
      for (const [k, U] of Object.entries(UPG)) {
        const lv = state.upg[k], max = lv >= U.costs.length, cost = U.costs[lv];
        body += `<div class="row tall"><span class="nm">${U.name} <small>${U.desc}. Now: ${U.vals[lv]}${U.unit}${max ? ' (max)' : ` → ${U.vals[lv + 1]}${U.unit}`}</small></span><span class="pr">${max ? 'Max' : cost + 'c'}</span>${B(max ? 'Done' : 'Upgrade', () => { state.coins -= cost; state.upg[k]++; if (k === 'udder') cowEnts.forEach(e => e.udder = udderMax()); sfx('level'); toast(`${U.name} upgraded!`, 'good'); refreshModal(); }, { disabled: max || state.coins < cost })}</div>`;
      }
    }
    return `<header class="mh"><h2>Moo Market</h2><span class="coins"><i class="coin"></i>${state.coins}</span>${B('Close', closeModal, { cls: 'ghost x' })}</header><nav class="tabs">${tabs}</nav><div class="list">${body}</div>`;
  });
}

/* ---------- Bag ---------- */
function openBag() {
  showModal(() => {
    let milk = '';
    for (const k of MILK_KEYS) { const c = state.inv.milk[k] || 0; if (!c) continue; milk += `<div class="row tall"><span class="nm">${swatch(MILK[k].color)}${MILK[k].name} <small>×${c} · Drink: ${MILK[k].drink.desc} · Shot: ${MILK[k].shot.desc}</small></span>${B('Drink', () => { drink('milk', k); refreshModal(); })}</div>`; }
    let goods = '';
    for (const r of RECIPES) { const c = state.inv.goods[r.key] || 0; if (!c) continue; goods += `<div class="row tall"><span class="nm">${swatch(r.key === 'super' ? 'linear-gradient(90deg,#ff7ad9,#ffe27a,#7fe8ff,#a8f0c6)' : '#ffb3d9')}${r.name} <small>×${c} · ${r.desc}</small></span>${r.key === 'super' ? '<span class="pr">Feed to a cow</span>' : B('Drink', () => { drink('goods', r.key); refreshModal(); })}</div>`; }
    const tierList = (arr, what) => arr.map((c, i) => c ? `<span class="chip">${swatch(TIERS[i].color)}${TIERS[i].name} ${what} ×${c}</span>` : '').join('') || `<span class="muted">No ${what} yet</span>`;
    const buffs = Object.entries(player.buffs).filter(([, v]) => v > 0).map(([b, v]) => `<span class="chip">${BUFF_NAMES[b] || b} ${Math.ceil(v)}s</span>`).join('') || '<span class="muted">None</span>';
    const rom = Object.keys(FARMERS).map(k => { const r = state.romance[k]; return `<div class="row"><span class="nm">${FARMERS[k].name}<small>${r.met ? `Problems solved ${r.p}/4` : 'Not met yet'}</small></span>${heartsRow(r.aff)}</div>`; }).join('');
    const s = state.stats;
    return `<header class="mh"><h2>Tori's Bag</h2><span class="coins"><i class="coin"></i>${state.coins}</span>${B('Close', closeModal, { cls: 'ghost x' })}</header>
      <div class="list">
      <h3>Milk <small>${milkTotal()}/${bucketCap()} in your bucket</small></h3>${milk || '<p class="empty">Your bucket is empty.</p>'}
      ${goods ? '<h3>Treats from the Creamery</h3>' + goods : ''}
      <h3>Wool & yarn</h3><div class="chips">${tierList(state.inv.wool, 'wool')}</div><div class="chips">${tierList(state.inv.yarn, 'yarn')}</div>
      <h3>Supplies</h3><div class="chips"><span class="chip">${swatch('#f2cf6b')}Hay ×${state.inv.hay}</span><span class="chip">${swatch('#5fcf6a')}Clover ×${state.inv.clover}</span></div>
      <h3>Active effects</h3><div class="chips">${buffs}</div>
      <h3>Buttercup Hollow</h3>${rom}
      <h3>Farm records</h3><div class="chips"><span class="chip">Milked ${s.milked || 0}</span><span class="chip">Sheared ${s.sheared || 0}</span><span class="chip">Kittens bonked ${s.kittens || 0}</span><span class="chip">Charmed ${s.charmed || 0}</span><span class="chip">Faith ${state.faith} (level ${faithLevel()})</span><span class="chip">Raids survived ${Math.max(0, state.wave - (raid.active ? 1 : 0))}</span></div>
      <div class="foot">${B('Save game', () => saveGame())}</div></div>`;
  });
}
const BUFF_NAMES = { speed: 'Zoomies', guard: 'Squishy guard', love: 'Lovestruck', cool: 'Minty aura', xp: 'Double XP', zest: 'Rapid fire', strong: 'Nut power' };

/* ---------- Quest log ---------- */
function openQuests() {
  showModal(() => {
    const q = curQuest(); let cur = '';
    if (q) {
      const pr = state.quest.phase === 'active' ? questProgress(q) : null;
      cur = `<div class="qcard"><div class="eyebrow">Quest ${state.quest.i + 1} of ${QUESTS.length}</div><h3>${q.title}</h3><p>${q.text}</p>
        <p class="muted">${state.quest.phase === 'offer' ? `Talk to ${NPC_DEF[q.giver].name} to begin.` : pr.done ? `Done! Return to ${NPC_DEF[q.turnin || q.giver].name}.` : `Progress: ${pr.label}`}</p></div>`;
    } else cur = `<div class="qcard"><h3>Hero of the Sheep-a-verse</h3><p>The story is complete. Keep farming, keep the shield strong, and check the bounty board each morning.</p></div>`;
    const done = QUESTS.slice(0, state.quest.i).map(x => `<li>${x.title}</li>`).join('');
    const rom = Object.keys(FARMERS).map(k => { const r = state.romance[k], F = FARMERS[k]; const pr = F.problems[r.p];
      const need = pr ? Object.entries(pr.need).map(([m, n]) => `${n} ${MILK[m].name}`).join(' + ') : '';
      return `<div class="row tall"><span class="nm">${F.name} <small>${!r.met ? `Visit ${F.name.split(' ')[0]} in Buttercup Hollow.` : r.status === 'sweet' ? 'Your sweetheart ♥' : r.status === 'friend' ? 'Best friends' : pr ? (r.aff >= r.p * 20 ? `Needs: ${need}` : `Next problem at ${r.p * 2} hearts`) : r.aff >= 100 ? 'Has something to tell you...' : 'Raise hearts to 10 with gifts, talks and dates'}</small></span>${heartsRow(r.aff)}</div>`; }).join('');
    return `<header class="mh"><h2>Quests</h2>${B('Close', closeModal, { cls: 'ghost x' })}</header><div class="list">${cur}
      <h3>Farmers' problems & romance</h3>${rom}
      ${done ? `<h3>Completed</h3><ol class="done">${done}</ol>` : ''}</div>`;
  });
}

/* ---------- Bounty board ---------- */
function openBoard() {
  showModal(() => {
    const rows = state.bounties.map((b, i) => {
      const what = b.kind === 'milk' ? `${b.n} ${MILK[b.key].name}` : b.kind === 'wool' ? `${b.n} ${TIERS[b.tier].name}-or-better wool` : `${b.n} yarn (any)`;
      const sw = b.kind === 'milk' ? MILK[b.key].color : b.kind === 'wool' ? TIERS[b.tier].color : '#ff9fc0';
      return `<div class="row tall"><span class="nm">${swatch(sw)}${what}<small>${b.done ? 'Delivered!' : `Reward ${b.reward} coins + ${b.xp} XP`}</small></span>${B(b.done ? 'Done' : 'Deliver', () => { deliverBounty(i); refreshModal(); }, { disabled: b.done || !bountyHave(b) })}</div>`;
    }).join('');
    return `<header class="mh"><h2>Bounty Board</h2>${B('Close', closeModal, { cls: 'ghost x' })}</header><div class="list"><p class="hint">Townsfolk post new requests every morning.</p>${rows}</div>`;
  });
}

/* ---------- Creamery ---------- */
function openMixer() {
  showModal(() => {
    const rows = RECIPES.map(r => {
      const need = Object.entries(r.need).map(([k, n]) => { const h = state.inv.milk[k] || 0; return `<span class="chip ${h >= n ? 'ok' : 'no'}">${swatch(MILK[k].color)}${MILK[k].short} ${Math.min(h, n)}/${n}</span>`; }).join('');
      return `<div class="recipe ${r.key === 'super' ? 'super' : ''}"><div class="rtop"><b>${r.name}</b>${B('Mix', () => { mix(r); refreshModal(); }, { disabled: !canMix(r), cls: r.key === 'super' ? 'primary' : '' })}</div><p>${r.desc}${r.sell ? ` Sells for ${r.sell}c.` : ''}</p><div class="chips">${need}</div></div>`;
    }).join('');
    return `<header class="mh"><h2>Creamery Milk Mixer</h2>${B('Close', closeModal, { cls: 'ghost x' })}</header><div class="list"><p class="hint">Churn milks together into treats. You own ${state.inv.goods.super || 0} Super Milker Milk.</p>${rows}</div>`;
  });
}

/* ---------- Farmer menus ---------- */
function openGift(key) {
  const F = FARMERS[key], r = state.romance[key];
  showModal(() => {
    const left = r.giftDay === state.day ? 2 - r.gifts : 2;
    let rows = '';
    for (const k of MILK_KEYS) { const c = state.inv.milk[k] || 0; if (!c) continue; rows += `<div class="row"><span class="nm">${swatch(MILK[k].color)}${MILK[k].name} <small>×${c}</small></span>${B('Give', () => { closeModal(); giveGift(key, { kind: 'milk', key: k }); }, { disabled: left <= 0 })}</div>`; }
    for (const rc of RECIPES) { const c = state.inv.goods[rc.key] || 0; if (!c || rc.key === 'super') continue; rows += `<div class="row"><span class="nm">${swatch('#ffb3d9')}${rc.name} <small>×${c} · everyone loves treats</small></span>${B('Give', () => { closeModal(); giveGift(key, { kind: 'goods', key: rc.key }); }, { disabled: left <= 0 })}</div>`; }
    const prefs = r.aff >= 20 ? `<p class="hint">${F.name.split(' ')[0]} loves ${F.loves.map(k => MILK[k].name).join(' and ')}, and likes ${F.likes.map(k => MILK[k].name).join(' and ')}.</p>` : `<p class="hint">Get to 2 hearts to learn ${F.name.split(' ')[0]}'s favorite milks.</p>`;
    return `<header class="mh"><h2>Gift for ${F.name.split(' ')[0]}</h2>${B('Close', closeModal, { cls: 'ghost x' })}</header><div class="list">${heartsRow(r.aff)}${prefs}<p class="muted">${left > 0 ? `${left} gift${left > 1 ? 's' : ''} left today.` : 'No more gifts today.'}</p>${rows || '<p class="empty">You have nothing to give. Bring milk or treats!</p>'}</div>`;
  });
}
function openProblem(key) {
  const F = FARMERS[key], r = state.romance[key], pr = F.problems[r.p]; if (!pr) return;
  const have = Object.entries(pr.need).every(([k, n]) => (state.inv.milk[k] || 0) >= n);
  const need = Object.entries(pr.need).map(([k, n]) => `${n} ${MILK[k].name} (you have ${state.inv.milk[k] || 0})`).join(', ');
  dialog(key, pr.lines.concat([`Needs: ${need}.`]), [have ? { label: 'Give the milk', fn: () => solveProblem(key) } : { label: "I'll be back with it", cls: 'ghost' }]);
}
function askDate(key) {
  const F = FARMERS[key];
  dialog(key, [state.romance[key].status === 'sweet' ? `Date night? With you? Always!` : `A date? With me? Oh! Um. Yes! Yes, I'd love to.`], [{ label: 'Go on the date', fn: () => goOnDate(key) }, { label: 'Maybe later', cls: 'ghost' }]);
}

/* ---------- Help ---------- */
function openHelp() {
  showModal(() => {
    const shots = MILK_KEYS.map(k => `<div class="row"><span class="nm">${swatch(MILK[k].color)}${MILK[k].name}</span><span class="pr wide">${MILK[k].shot.desc}</span></div>`).join('');
    return `<header class="mh"><h2>How to play</h2>${B('Close', closeModal, { cls: 'ghost x' })}</header><div class="list">
      <h3>Controls</h3>
      <div class="keys"><span><kbd>WASD</kbd> or arrows: walk (<kbd>Shift</kbd> to run)</span><span><kbd>E</kbd> or <kbd>Space</kbd>: main action</span><span><kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd>: other actions on the card</span>
      <span><kbd>C</kbd>: pick up or put down a cow</span><span><kbd>F</kbd> or click: squeeze the udder (hold to keep squirting)</span><span><kbd>I</kbd> bag · <kbd>Q</kbd> quests · <kbd>H</kbd> help · <kbd>M</kbd> sound</span><span>Mouse wheel: zoom</span></div>
      <h3>Your day</h3>
      <p>Milk cows for milk, shear sheep for wool. The whiter the fleece, the better the sheep: brush them and feed clover to raise whiteness. Sell at the Moo Market in the Sheep-a-verse.</p>
      <p>Feed wool to the Great Spindle to spin yarn. Weave yarn into the Heart of the Shield to power the force field that protects the castle city.</p>
      <p>At 20:00 evil kittens raid from Whisker Woods. Pick up a cow, carry her into battle, and squeeze. Every milk does something different:</p>
      ${shots}
      <h3>Love in Buttercup Hollow</h3>
      <p>Hazel, Rowan, Theo and June live west of your farm. Talk to them daily, give milk they love, solve their problems with milk, and go on dates. At 10 hearts with all four problems solved, they may confess their feelings.</p>
      <h3>The Super Milker</h3>
      <p>King Clawdius sleeps in Catnap Cavern in the far east. Only Super Milker Milk can hurt him: churn one of every milk at the Creamery, feed it to a cow, carry her inside and squeeze!</p></div>`;
  });
}

/* ---------- Context card ---------- */
function cardFor(it) {
  const N = (s) => s;
  switch (it.kind) {
    case 'cow': {
      const e = it.ent, c = e.d, T = COWS[c.type], mk = T.milk, ready = c.cd <= 0, full = milkTotal() >= bucketCap();
      const spec = c.super > 0 ? SUPER_SHOT : MILK[mk].shot;
      const acts = [
        { key: 'E', label: 'Milk', fn: () => milkCow(e), disabled: !ready || full },
        { key: 'C', label: 'Pick up', fn: () => pickUpCow(e) },
        { key: '1', label: `Feed hay (${state.inv.hay})`, fn: () => feedHay(e), disabled: state.inv.hay <= 0 || c.happy >= 98 },
        { key: '2', label: 'Pet', fn: () => petCow(e), disabled: c.petCd > 0 }];
      if (state.inv.goods.super > 0) acts.push({ key: '3', label: 'Feed Super Milk', fn: () => feedSuper(e), cls: 'rainbow' });
      return { title: c.name + (c.super > 0 ? ' · SUPER MILKER' : ''), sub: `${T.name} · makes ${MILK[mk].name}`, sw: MILK[mk].color,
        bars: [{ label: 'Happiness', v: c.happy / 100, cls: 'berry' }],
        lines: [ready ? (full ? 'Bucket full! Sell or drink some milk.' : 'Ready to milk!') : `Milk ready in ${Math.ceil(c.cd)}s`, `Udder shot: ${spec.desc}${c.super > 0 ? ` (${c.super} left)` : ''}`], acts };
    }
    case 'sheep': {
      const e = it.ent, s = e.d, tier = tierOf(s.white);
      return { title: s.name, sub: `${BREEDS[s.breed].name}`, sw: TIERS[tier].color,
        bars: [{ label: `Whiteness ${Math.floor(s.white)} · ${TIERS[tier].name}`, v: s.white / 100, cls: 'wool' }, { label: s.fleece >= 1 ? 'Fleece fully grown' : 'Fleece growing', v: s.fleece, cls: 'mint' }],
        lines: [`${'★'.repeat(tier + 1)}${'☆'.repeat(5 - tier)} The whiter the fleece, the better the sheep.`],
        acts: [{ key: 'E', label: 'Shear', fn: () => shearSheep(e), disabled: s.fleece < 1 },
          { key: '1', label: s.brushCd > 0 ? `Brush (${Math.ceil(s.brushCd)}s)` : 'Brush', fn: () => brushSheep(e), disabled: s.brushCd > 0 || s.white >= 100 },
          { key: '2', label: `Feed clover (${state.inv.clover})`, fn: () => cloverSheep(e), disabled: state.inv.clover <= 0 }] };
    }
    case 'npc': {
      const d = NPC_DEF[it.key], n = npcEnts[it.key];
      return { title: d.name, sub: d.role, sw: hexStr(d.robe), lines: [n.mkType === '!' ? 'Has a quest for you!' : n.mkType === '?' ? 'Ready to hear your news!' : 'Say hello.'],
        acts: [{ key: 'E', label: 'Talk', fn: () => talkNPC(it.key) }].concat(it.key === 'moolissa' ? [{ key: '1', label: 'Open market', fn: () => openMarket('sell') }] : []) };
    }
    case 'farmer': {
      const k = it.key, F = FARMERS[k], r = state.romance[k];
      const acts = [{ key: 'E', label: confessionReady(k) ? 'Talk ♥' : 'Talk', fn: () => talkFarmer(k) }];
      if (r.met) {
        acts.push({ key: '1', label: 'Give a gift', fn: () => openGift(k) });
        if (problemAvailable(k)) acts.push({ key: '2', label: 'Help with problem', fn: () => openProblem(k) });
        if (r.aff >= 40) acts.push({ key: '3', label: r.dateDay === state.day ? 'Dated today' : 'Ask on a date', fn: () => askDate(k), disabled: r.dateDay === state.day });
      }
      return { title: F.name, sub: F.role + (r.status === 'sweet' ? ' · your sweetheart' : ''), sw: hexStr(F.look.shirt), hearts: r.aff,
        lines: [!r.met ? 'You haven\'t met yet. Say hi!' : confessionReady(k) ? 'They look nervous... they want to tell you something.' : problemAvailable(k) ? 'Has a problem only milk can fix.' : r.p < 4 ? `Next problem unlocks at ${r.p * 2} hearts.` : 'Spend time together to grow closer.'], acts };
    }
    case 'sacred': return { title: 'Sacred Sheep', sub: 'Blessed flock of the Great Sheep', sw: '#fff6c9', lines: ['Perfectly white. Petting one brings a little faith.'], acts: [{ key: 'E', label: 'Pet', fn: () => petSacred(it.ent), disabled: it.ent.petCd > 0 }] };
    case 'display': return { title: 'Cow for sale', sub: 'Moo Market display pen', sw: '#ff9fc0', lines: ['Moolissa has many breeds in stock.'], acts: [{ key: 'E', label: 'Open market', fn: () => openMarket('animals') }] };
    case 'spindle': {
      const sp = state.spindle, on = sp.momentum > 0;
      return { title: 'The Great Spindle', sub: on ? (sp.queue.length ? 'Spinning wool into yarn' : 'Turning slowly, waiting for wool') : 'STOPPED! Feed it wool', sw: '#c9b0ff',
        bars: [{ label: 'Momentum', v: sp.momentum / 100, cls: 'lilac' }], lines: [`In the queue: ${sp.queue.length} wool · In the basket: ${basketTotal()} yarn`],
        acts: [{ key: 'E', label: `Feed all wool (${woolTotal()})`, fn: feedSpindle, disabled: !woolTotal() }, { key: '1', label: `Collect yarn (${basketTotal()})`, fn: collectYarn, disabled: !basketTotal() }] };
    }
    case 'basket': return { title: 'Yarn Basket', sub: 'Fresh from the Great Spindle', sw: '#ff9fc0', lines: [`${basketTotal()} yarn waiting`], acts: [{ key: 'E', label: 'Collect yarn', fn: collectYarn, disabled: !basketTotal() }] };
    case 'heart': return { title: 'Heart of the Shield', sub: 'Powers the force field around the city', sw: '#7fe8ff',
      bars: [{ label: `Shield ${Math.round(state.field.power)}/${maxPower()}`, v: state.field.power / maxPower(), cls: 'shield' }],
      lines: [state.flags.breached ? 'The shield is DOWN. Weave yarn to reach 25 power and restart it.' : 'Whiter yarn adds more power. A strong shield zaps kittens.'],
      acts: [{ key: 'E', label: `Weave all yarn (${yarnTotal()})`, fn: weaveYarn, disabled: !yarnTotal() }] };
    case 'temple': {
      const fl = faithLevel(), next = FAITH[fl + 1];
      return { title: 'Temple of the Great Sheep', sub: `Faith level ${fl} · ${state.faith} faith`, sw: '#ffe27a',
        bars: next ? [{ label: `Next blessing at ${next}`, v: (state.faith - FAITH[fl]) / (next - FAITH[fl]), cls: 'gold' }] : [],
        lines: [next ? `Next: ${BLESS[fl + 1]}` : 'All blessings granted. The Great Sheep smiles on you.'],
        acts: [{ key: 'E', label: 'Offer best wool', fn: () => offerWool(false), disabled: !woolTotal() }, { key: '1', label: 'Offer all wool', fn: () => offerWool(true), disabled: !woolTotal() }, { key: '2', label: `Offer all milk (${milkTotal()})`, fn: offerMilk, disabled: !milkTotal() }] };
    }
    case 'market': return { title: 'Moo Market', sub: 'Buy, sell, upgrade', sw: '#ff9fc0', lines: ['Sell milk, wool, yarn and treats. Buy cows, sheep and upgrades.'], acts: [{ key: 'E', label: 'Open market', fn: () => openMarket('sell') }, { key: '1', label: 'Buy animals', fn: () => openMarket('animals') }, { key: '2', label: 'Upgrades', fn: () => openMarket('upgrades') }] };
    case 'board': return { title: 'Bounty Board', sub: 'Requests from the townsfolk', sw: '#b98a5e', lines: [`${state.bounties.filter(b => !b.done).length} open bounties`], acts: [{ key: 'E', label: 'Read bounties', fn: openBoard }] };
    case 'hayloft': return { title: 'Hay Loft', sub: 'Free hay once a day', sw: '#f2cf6b', lines: [state.flags.hayDay === state.day ? 'Come back tomorrow for more.' : '3 bundles of hay are waiting.'], acts: [{ key: 'E', label: 'Take hay', fn: takeHay, disabled: state.flags.hayDay === state.day }] };
    case 'clover': return { title: 'Clover Patch', sub: 'Sheep snacks', sw: '#5fcf6a', lines: [state.flags.cloverT > 0 ? `Regrowing: ${Math.ceil(state.flags.cloverT)}s` : 'A lucky clover is ready.'], acts: [{ key: 'E', label: 'Pick clover', fn: pickClover, disabled: state.flags.cloverT > 0 }] };
    case 'home': return { title: "Tori's Farmhouse", sub: 'Home sweet home', sw: '#6f9be8', lines: ['Rest to restore your hearts and save.'], acts: [{ key: 'E', label: 'Rest & save', fn: restAtHome }] };
    case 'creamery': return { title: 'Creamery', sub: 'Milk Mixer', sw: '#ffb3d9', lines: [`Super Milker Milk owned: ${state.inv.goods.super || 0}`], acts: [{ key: 'E', label: 'Open Milk Mixer', fn: openMixer }] };
    case 'cave': {
      const sc = player.carrying && player.carrying.d.super > 0;
      return { title: 'Catnap Cavern', sub: state.flags.clawdius ? 'King Clawdius is napping peacefully' : 'Lair of King Clawdius, the Cat-astrophe', sw: '#3d3350',
        lines: [state.flags.clawdius ? 'Safe to visit now.' : sc ? 'Your Super Milker cow is ready. Go get him!' : 'Warning: only a carried Super Milker cow can hurt the King.'], acts: [{ key: 'E', label: 'Enter the cavern', fn: enterCave }] };
    }
    case 'portal': return { title: 'Cavern Exit', sub: 'Back to Whisker Woods', sw: '#7fe8ff', lines: ['Step through to leave.'], acts: [{ key: 'E', label: 'Leave the cavern', fn: () => leaveCave() }] };
  }
  return null;
}
function renderCard(it) {
  const el = $('#card');
  const c = it ? cardFor(it) : null;
  cardDirty = false;
  if (!c) { cardActions = []; if (!el.hidden) { el.hidden = true; cardSig = ''; } return; }
  cardActions = c.acts;
  const sig = JSON.stringify([c.title, c.sub, c.lines, (c.bars || []).map(b => [b.label, Math.round(b.v * 50)]), c.acts.map(a => [a.label, !!a.disabled]), c.hearts]);
  if (sig === cardSig && !el.hidden) return;
  cardSig = sig; el.hidden = false;
  const bars = (c.bars || []).map(b => `<div class="cbar"><span>${esc(b.label)}</span><div class="bar ${b.cls}"><i style="width:${(clamp(b.v, 0, 1) * 100).toFixed(1)}%"></i></div></div>`).join('');
  el.innerHTML = `<div class="ctop"><i class="sw big" style="background:${c.sw}"></i><div><b>${esc(c.title)}</b><small>${esc(c.sub)}</small></div></div>
    ${c.hearts !== undefined ? heartsRow(c.hearts) : ''}${bars}${c.lines.map(l => `<p>${esc(l)}</p>`).join('')}
    <div class="cacts">${c.acts.map((a, i) => `<button class="btn ${i === 0 ? 'primary' : ''} ${a.cls || ''}" data-c="${i}" ${a.disabled ? 'disabled' : ''}>${isTouch ? '' : `<kbd>${a.key}</kbd>`}${esc(a.label)}</button>`).join('')}</div>`;
}

/* ---------- HUD ---------- */
function updateHUD() {
  if (!state) return;
  const night = state.t >= DAY;
  $('#clock').textContent = `Day ${state.day} · ${clockStr()}`;
  const ph = $('#phase'); ph.textContent = player.inCave ? 'Cavern' : raid.active ? 'Raid!' : night ? 'Night' : 'Day'; ph.className = 'pill ' + (player.inCave ? 'cave' : raid.active ? 'raid' : night ? 'night' : 'day');
  $('#coins').textContent = state.coins; $('#lvl').textContent = state.level;
  $('#xpbar').style.width = (state.xp / xpNeed(state.level) * 100).toFixed(1) + '%';
  let h = ''; for (let i = 0; i < maxHearts(); i++) h += `<i class="hrt big ${i < state.hearts ? 'on' : ''}"></i>`; $('#hearts').innerHTML = h;
  const bf = Object.entries(player.buffs).filter(([, v]) => v > 0).map(([b, v]) => `<span class="chip sm">${BUFF_NAMES[b]} ${Math.ceil(v)}</span>`).join(''); $('#buffs').innerHTML = bf;
  const pr = state.field.power / maxPower();
  $('#shield-fill').style.width = (pr * 100).toFixed(1) + '%'; $('#shield-txt').textContent = state.flags.breached ? 'Shield DOWN' : `Shield ${Math.round(pr * 100)}%`;
  $('#shield-row').classList.toggle('low', pr < 0.3 || state.flags.breached);
  $('#spin-fill').style.width = state.spindle.momentum.toFixed(1) + '%'; $('#spin-txt').textContent = state.spindle.momentum > 0 ? `Spindle ${state.spindle.queue.length ? 'spinning' : 'idle'}` : 'Spindle STOPPED';
  $('#spin-row').classList.toggle('low', state.spindle.momentum < 15);
  const alive = kittens.filter(k => !k.cave && (k.state === 'move')).length + raid.queue.length;
  $('#raid').textContent = raid.active ? `Raid ${state.wave}: ${alive} kitten${alive === 1 ? '' : 's'} left` : `Next raid at 20:00`;
  // quest tracker
  const q = curQuest(), tk = $('#tracker');
  let line, title;
  if (!q) { title = 'Hero of the Sheep-a-verse'; line = 'Story complete! Keep farming and fill the bounty board.'; }
  else { title = q.title; const st = state.quest; if (st.phase === 'offer') line = `Talk to ${NPC_DEF[q.giver].name}`; else { const p = questProgress(q); line = p.done ? `Return to ${NPC_DEF[q.turnin || q.giver].name}` : `${q.text}${p.label ? ' · ' + p.label : ''}`; } }
  const tgt = q && !player.inCave ? questTarget() : null; let arrow = '';
  if (tgt) { const dx = tgt.x - px(), dz = tgt.z - pz(), d = Math.hypot(dx, dz); if (d > 8) arrow = `<span class="arrow" style="transform:rotate(${Math.atan2(dx, -dz)}rad)">➤</span><small>${Math.round(d)}m</small>`; }
  tk.innerHTML = `<div class="eyebrow">${q ? `Quest ${state.quest.i + 1}/${QUESTS.length}` : 'Free play'}</div><b>${esc(title)}</b><div class="tline">${arrow}<span>${esc(line)}</span></div>`;
  const cw = player.carrying;
  $('#b-cow').classList.toggle('on', !!cw);
}

/* ---------- Milk meter ---------- */
let weaponSig = '';
function updateWeapon() {
  const cw = player.carrying, wp = $('#weapon');
  const key = cw ? (cw.d.super > 0 ? 'super' : COWS[cw.d.type].milk) : 'none';
  const sig = (cw ? cw.d.name : '') + '|' + key;
  if (sig !== weaponSig) {
    weaponSig = sig; wp.hidden = false; wp.classList.toggle('empty', !cw);
    if (!cw) wp.innerHTML = `<div class="eyebrow">Milk meter</div><b class="wname">No cow in your arms</b><small>Walk up to a cow and press <kbd>C</kbd> to pick her up, then hold <kbd>F</kbd> or the mouse to squirt.</small>`;
    else {
      const sh = currentShot(), name = key === 'super' ? 'Super Milker rainbow milk' : MILK[key].name;
      const fill = key === 'super' ? 'linear-gradient(90deg,#ff7ad9,#ffe27a,#7fe8ff,#a8f0c6,#ff7ad9)' : `linear-gradient(180deg,#fff 0%,${MILK[key].color} 35%,${MILK[key].color} 100%)`;
      wp.innerHTML = `<div class="eyebrow">Milk meter</div><b class="wname">${esc(cw.d.name)} · ${esc(name)}</b><small>${esc(sh.spec.desc)}</small>
        <div class="meter"><i id="meter-fill" style="background:${fill}"></i><span id="meter-pct"></span></div>`;
    }
  }
  if (cw) {
    const amt = clamp(key === 'super' ? cw.d.super / SUPER_CHARGES : cw.udder / udderMax(), 0, 1);
    const f = $('#meter-fill'), t = $('#meter-pct');
    if (f) { f.style.width = (amt * 100).toFixed(1) + '%'; t.textContent = key === 'super' ? `${Math.ceil(cw.d.super)}s of rainbow` : amt <= 0.02 ? 'Empty! Let go to refill' : Math.round(amt * 100) + '%'; wp.classList.toggle('low', amt < 0.2); }
  }
}

/* ---------- Minimap ---------- */
const mm = $('#minimap'), mmx = mm.getContext('2d');
function drawMinimap() {
  const S = mm.width, x = mmx; x.clearRect(0, 0, S, S);
  if (player.inCave) {
    x.fillStyle = '#2a2240'; x.fillRect(0, 0, S, S);
    const sc = S / (CAVE.r * 2.4), tx = v => S / 2 + (v - CAVE.x) * sc, tz = v => S / 2 + (v - CAVE.z) * sc;
    x.fillStyle = '#4a3f63'; x.beginPath(); x.arc(S / 2, S / 2, CAVE.r * sc, 0, TAU); x.fill();
    for (const k of kittens) if (k.cave && k.state === 'move') { x.fillStyle = k.def.boss ? '#ff3b6b' : '#ff9d3d'; x.beginPath(); x.arc(tx(k.g.position.x), tz(k.g.position.z), k.def.boss ? 6 : 3, 0, TAU); x.fill(); }
    x.fillStyle = '#7fe8ff'; x.beginPath(); x.arc(tx(CAVE.x), tz(CAVE.z + 20), 4, 0, TAU); x.fill();
  } else {
    const sc = S / 390, tx = v => (v + 195) * sc, tz = v => (v + 180) * sc;
    x.fillStyle = '#9edb7a'; x.fillRect(0, 0, S, S);
    x.fillStyle = '#b39ce8'; x.beginPath(); x.arc(tx(155), tz(-20), 45 * sc, 0, TAU); x.fill();
    x.fillStyle = '#e3cf9c'; x.fillRect(tx(-3.5), tz(-40), 7 * sc, 160 * sc); x.fillRect(tx(-51), tz(83), 90 * sc, 6 * sc); x.fillRect(tx(-120), tz(78), 60 * sc, 5 * sc);
    x.fillStyle = '#c4ef98'; for (const p of [COW_PEN, SHEEP_PEN]) x.fillRect(tx(p.x1), tz(p.z1), (p.x2 - p.x1) * sc, (p.z2 - p.z1) * sc);
    x.fillStyle = '#efe4d2'; x.beginPath(); x.arc(tx(C.x), tz(C.z), WALL_R * sc, 0, TAU); x.fill();
    x.strokeStyle = state.flags.breached ? '#ff6f91' : '#43c6ff'; x.lineWidth = 2.5; x.globalAlpha = 0.4 + 0.6 * state.field.power / maxPower(); x.beginPath(); x.arc(tx(C.x), tz(C.z), DOME_R * sc, 0, TAU); x.stroke(); x.globalAlpha = 1;
    x.fillStyle = '#3d3350'; x.beginPath(); x.arc(tx(CAVE_DOOR.x + 8), tz(CAVE_DOOR.z), 7, 0, TAU); x.fill();
    for (const e of cowEnts) if (!e.carried) { x.fillStyle = hexStr(COWS[e.d.type].body); x.fillRect(tx(e.g.position.x) - 1.5, tz(e.g.position.z) - 1.5, 3, 3); }
    for (const k in farmerEnts) { const f = farmerEnts[k]; x.fillStyle = '#ff6f9f'; x.beginPath(); x.arc(tx(f.g.position.x), tz(f.g.position.z), 3.2, 0, TAU); x.fill(); }
    for (const k in npcEnts) { const n = npcEnts[k]; if (!n.mkType) continue; x.fillStyle = n.mkType === '!' ? '#ffc83d' : '#3fcf7a'; x.beginPath(); x.arc(tx(n.g.position.x), tz(n.g.position.z), 4, 0, TAU); x.fill(); x.strokeStyle = '#4a2f27'; x.lineWidth = 1.5; x.stroke(); }
    for (const k of kittens) if (!k.cave && k.state === 'move') { x.fillStyle = k.def.boss ? '#ff3b6b' : '#ff7a3d'; x.beginPath(); x.arc(tx(k.g.position.x), tz(k.g.position.z), k.def.boss ? 4.5 : 2.4, 0, TAU); x.fill(); }
    var ppx = tx(px()), ppz = tz(pz());
  }
  const cx = player.inCave ? S / 2 + (px() - CAVE.x) * (S / (CAVE.r * 2.4)) : ppx, cz = player.inCave ? S / 2 + (pz() - CAVE.z) * (S / (CAVE.r * 2.4)) : ppz;
  x.save(); x.translate(cx, cz); x.rotate(-player.face + Math.PI); x.fillStyle = '#fff'; x.strokeStyle = '#4a2f27'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, -7); x.lineTo(5, 5); x.lineTo(-5, 5); x.closePath(); x.fill(); x.stroke(); x.restore();
}

/* ---------- Input ---------- */
function getMoveInput() {
  let x = 0, z = 0;
  if (keys.a || keys.arrowleft) x--; if (keys.d || keys.arrowright) x++; if (keys.w || keys.arrowup) z--; if (keys.s || keys.arrowdown) z++;
  if (joy.active) { x += joy.x; z += joy.y; }
  const l = Math.hypot(x, z); if (l > 1) { x /= l; z /= l; }
  return { x, z, run: !!keys.shift || (joy.active && Math.hypot(joy.x, joy.y) > 0.95) };
}
function runCardKey(k) { const a = cardActions.find(a => a.key === k); if (a && !a.disabled) { a.fn(); cardDirty = true; sfx('click'); return true; } return false; }
function initUI() {
  document.body.classList.toggle('touch', isTouch);
  addEventListener('keydown', e => {
    const k = e.key.toLowerCase(); audioInit();
    if (!$('#modal').hidden) {
      if (k === 'escape') closeModal();
      else if (k === 'enter' || k === 'e' || k === ' ') { const b = $('#modal-body .btn.primary:not([disabled])'); if (b) { e.preventDefault(); b.click(); } }
      return;
    }
    if (!running) return;
    keys[k] = true;
    if (k === ' ' || k.startsWith('arrow')) e.preventDefault();
    if (e.repeat) return;
    if (k === 'e' || k === ' ' || k === 'enter') runCardKey('E');
    else if (k === '1' || k === '2' || k === '3') runCardKey(k);
    else if (k === 'c') toggleCarry();
    else if (k === 'f') shootHeld = true;
    else if (k === 'i') openBag(); else if (k === 'q') openQuests(); else if (k === 'h') openHelp(); else if (k === 'm') toggleMute();
  });
  addEventListener('keyup', e => { const k = e.key.toLowerCase(); keys[k] = false; if (k === 'f') shootHeld = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; shootHeld = false; });
  const cv = renderer.domElement;
  const aimFrom = ev => { const r = cv.getBoundingClientRect(); const v = player.g.position.clone(); v.y = 1.3; v.project(camera); const sx = (v.x * .5 + .5) * r.width + r.left, sy = (-v.y * .5 + .5) * r.height + r.top; mouseAim = Math.atan2(ev.clientX - sx, ev.clientY - sy); };
  cv.addEventListener('pointerdown', ev => { audioInit(); if (!running || ev.pointerType !== 'mouse' || ev.button !== 0) return; aimFrom(ev); mouseAiming = true; shootHeld = true; });
  addEventListener('pointermove', ev => { if (mouseAiming) aimFrom(ev); });
  addEventListener('pointerup', ev => { if (ev.pointerType === 'mouse') { mouseAiming = false; shootHeld = false; } });
  cv.addEventListener('wheel', ev => { zoom = clamp(zoom + Math.sign(ev.deltaY) * 0.08, 0.55, 1.6); ev.preventDefault(); }, { passive: false });
  cv.addEventListener('contextmenu', ev => ev.preventDefault());
  // card & modal clicks
  $('#card').addEventListener('click', ev => { const b = ev.target.closest('[data-c]'); if (b && !b.disabled) { const a = cardActions[+b.dataset.c]; if (a) { a.fn(); cardDirty = true; sfx('click'); } } });
  $('#modal').addEventListener('click', ev => { const b = ev.target.closest('[data-a]'); if (b && !b.disabled) { sfx('click'); modalActs[+b.dataset.a](); } else if (ev.target.id === 'modal' && $('#modal').className !== 'dialog') closeModal(); });
  // menu buttons
  $('#m-bag').onclick = () => { audioInit(); openBag(); }; $('#m-quests').onclick = () => openQuests(); $('#m-help').onclick = () => openHelp(); $('#m-sound').onclick = () => { audioInit(); toggleMute(); };
  updateMuteBtn();
  // touch joystick
  const zone = $('#joyzone'), knob = $('#joy-knob'), base = $('#joy');
  zone.addEventListener('pointerdown', ev => { audioInit(); joy.active = true; joy.id = ev.pointerId; joy.ox = ev.clientX; joy.oy = ev.clientY; joy.x = joy.y = 0; base.style.left = ev.clientX + 'px'; base.style.top = ev.clientY + 'px'; base.hidden = false; knob.style.transform = 'translate(-50%,-50%)'; zone.setPointerCapture(ev.pointerId); });
  zone.addEventListener('pointermove', ev => { if (!joy.active || ev.pointerId !== joy.id) return; let dx = ev.clientX - joy.ox, dy = ev.clientY - joy.oy; const l = Math.hypot(dx, dy), R = 52; if (l > R) { dx *= R / l; dy *= R / l; } joy.x = dx / R; joy.y = dy / R; knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`; });
  const endJoy = ev => { if (ev.pointerId !== joy.id) return; joy.active = false; joy.x = joy.y = 0; base.hidden = true; };
  zone.addEventListener('pointerup', endJoy); zone.addEventListener('pointercancel', endJoy);
  const tb = (id, down, up) => { const el = $(id); el.addEventListener('pointerdown', ev => { ev.preventDefault(); audioInit(); down(); el.classList.add('press'); }); el.addEventListener('pointerup', () => { up && up(); el.classList.remove('press'); }); el.addEventListener('pointerleave', () => { up && up(); el.classList.remove('press'); }); };
  tb('#b-act', () => runCardKey('E')); tb('#b-shoot', () => { shootHeld = true; }, () => { shootHeld = false; }); tb('#b-cow', toggleCarry);
  // title
  $('#t-new').onclick = () => { audioInit(); const ns = $('#t-new'); if (loadSave() && !ns.dataset.sure) { ns.dataset.sure = '1'; ns.textContent = 'Tap again to replace your saved farm'; return; } try { localStorage.removeItem(SAVE_KEY); } catch (e) { } startGame(null); };
  $('#t-cont').onclick = () => { audioInit(); startGame(loadSave()); };
  $('#t-help').onclick = () => { $('#t-howto').hidden = !$('#t-howto').hidden; };
}
function toggleMute() { muted = !muted; try { localStorage.setItem('tsm.mute', muted ? '1' : '0'); } catch (e) { } updateMuteBtn(); }
function updateMuteBtn() { $('#m-sound').textContent = muted ? 'Sound off' : 'Sound on'; $('#m-sound').setAttribute('aria-pressed', String(!muted)); }
function showTitle(hasSave) { $('#title').hidden = false; $('#hud').hidden = true; $('#t-cont').hidden = !hasSave; }
function hideTitle() { $('#title').hidden = true; $('#hud').hidden = false; }
