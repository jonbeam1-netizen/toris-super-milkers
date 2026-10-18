'use strict';
/* ============================================================
   Tori's Super Milkers — game data
   ============================================================ */
const TAU = Math.PI * 2;

/* Every milk does something different: when you shoot it out of a
   carried cow's udder (shot) and when you drink it (drink). */
const MILK = {
  classic: { name: 'Fresh Milk', short: 'Fresh', color: '#fdfbf2', hex: 0xfdfbf2, price: 5,
    shot: { dmg: 1.1, cd: 0.30, fx: 'none', desc: 'Steady, reliable splash' },
    drink: { heal: 1, desc: '+1 heart' } },
  choc: { name: 'Chocolate Milk', short: 'Choco', color: '#8a5a3b', hex: 0x8a5a3b, price: 9,
    shot: { dmg: 2.4, cd: 0.55, fx: 'heavy', desc: 'Heavy blob with big knockback' },
    drink: { heal: 2, desc: '+2 hearts' } },
  straw: { name: 'Strawberry Milk', short: 'Berry', color: '#ff9fc0', hex: 0xff9fc0, price: 12,
    shot: { dmg: 0.8, cd: 0.28, fx: 'charm', desc: 'Charms kittens so they skip home happy' },
    drink: { heal: 1, buff: 'love', dur: 60, desc: '+1 heart. Gifts to farmers count extra for 60s' } },
  banana: { name: 'Banana Milk', short: 'Banana', color: '#ffe27a', hex: 0xffe27a, price: 14,
    shot: { dmg: 0.9, cd: 0.28, fx: 'slip', desc: 'Kittens slip and spin in a daze' },
    drink: { heal: 1, buff: 'speed', dur: 30, desc: 'Run much faster for 30s' } },
  blueberry: { name: 'Blueberry Milk', short: 'Blue', color: '#7d8cff', hex: 0x7d8cff, price: 15,
    shot: { dmg: 1.0, cd: 0.32, fx: 'bounce', desc: 'Bounces from kitten to kitten' },
    drink: { heal: 2, desc: '+2 hearts' } },
  orange: { name: 'Orange Milk', short: 'Orange', color: '#ffa94d', hex: 0xffa94d, price: 16,
    shot: { dmg: 0.5, cd: 0.11, fx: 'zest', desc: 'Super fast citrus spray' },
    drink: { heal: 1, buff: 'zest', dur: 30, desc: 'Shoot twice as fast for 30s' } },
  mochi: { name: 'Mochi Milk', short: 'Mochi', color: '#f7d3e4', hex: 0xf7d3e4, price: 18,
    shot: { dmg: 0.9, cd: 0.32, fx: 'sticky', desc: 'Gooey splash glues kittens in place' },
    drink: { heal: 1, buff: 'guard', dur: 15, desc: 'Squishy and safe: no damage for 15s' } },
  almond: { name: 'Almond Milk', short: 'Almond', color: '#e8cfa8', hex: 0xe8cfa8, price: 19,
    shot: { dmg: 1.0, cd: 0.34, fx: 'crunch', desc: 'Nutty crunch: triple damage to big kittens and bosses' },
    drink: { heal: 1, buff: 'strong', dur: 30, desc: 'All your shots do double damage for 30s' } },
  mint: { name: 'Mint Milk', short: 'Mint', color: '#9ff0cf', hex: 0x9ff0cf, price: 20,
    shot: { dmg: 1.0, cd: 0.28, fx: 'freeze', desc: 'Chills kittens to a slow crawl' },
    drink: { heal: 1, buff: 'cool', dur: 30, desc: 'Kittens near you move slowly for 30s' } },
  cookie: { name: 'Cookies & Cream Milk', short: 'C&C', color: '#d9d2c6', hex: 0xd9d2c6, price: 25,
    shot: { dmg: 0.9, cd: 0.38, fx: 'spread', desc: 'Fires three splashes in a fan' },
    drink: { heal: 3, desc: '+3 hearts' } },
  moon: { name: 'Moonlight Milk', short: 'Moon', color: '#a9b8ff', hex: 0xa9b8ff, price: 34,
    shot: { dmg: 1.4, cd: 0.34, fx: 'homing', desc: 'Seeks kittens and passes through them' },
    drink: { heal: 1, buff: 'xp', dur: 60, desc: 'Double XP for 60s' } },
  gold: { name: 'Golden Milk', short: 'Gold', color: '#ffcf3d', hex: 0xffcf3d, price: 70,
    shot: { dmg: 2.8, cd: 0.6, fx: 'boom', desc: 'Explodes and splashes everything nearby' },
    drink: { heal: 99, buff: 'guard', dur: 10, desc: 'Full hearts and 10s of safety' } },
};
const MILK_KEYS = Object.keys(MILK);
const SUPER_SHOT = { dmg: 3.4, cd: 0.2, fx: 'super', desc: 'Rainbow blast. The only milk that hurts King Clawdius' };
const SUPER_CHARGES = 45; // seconds of rainbow stream

const COWS = {
  classic: { name: 'Classic Cow', milk: 'classic', body: 0xfafaf5, spot: 0x2d2a32, snout: 0xffb3c1, price: 60, lvl: 1, cd: 26 },
  choc:    { name: 'Chocolate Cow', milk: 'choc', body: 0x9b6640, spot: 0x5a3520, snout: 0xf2a6a0, price: 120, lvl: 2, cd: 28 },
  straw:   { name: 'Strawberry Cow', milk: 'straw', body: 0xffbfd3, spot: 0xff5f8f, snout: 0xfff0f4, price: 180, lvl: 2, cd: 30, seeds: true, leaf: true },
  banana:  { name: 'Banana Cow', milk: 'banana', body: 0xffe37a, spot: 0x7a5a24, snout: 0xffc9a8, price: 240, lvl: 3, cd: 32, stem: true },
  blueberry: { name: 'Blueberry Cow', milk: 'blueberry', body: 0x8f9cff, spot: 0x4b3fa8, snout: 0xd9d4ff, price: 220, lvl: 3, cd: 31, berries: true, leaf: true },
  orange:  { name: 'Orange Cow', milk: 'orange', body: 0xffa94d, spot: 0xffe0b8, snout: 0xffd2b0, price: 280, lvl: 4, cd: 32, leaf: true },
  almond:  { name: 'Almond Cow', milk: 'almond', body: 0xe3c398, spot: 0x8a5a33, snout: 0xf5d9c2, price: 360, lvl: 4, cd: 35 },
  mochi:   { name: 'Mochi Cow', milk: 'mochi', body: 0xfff2f6, spot: 0xffb3cc, spot2: 0xbfe3a6, snout: 0xffd6e2, price: 320, lvl: 5, cd: 34, round: true },
  mint:    { name: 'Mint Chip Cow', milk: 'mint', body: 0xb8f5dc, spot: 0x4a3326, snout: 0xffc1cc, price: 400, lvl: 5, cd: 36, chips: true },
  cookie:  { name: 'Cookies & Cream Cow', milk: 'cookie', body: 0xf3efe8, spot: 0x3b302c, snout: 0xffc1cc, price: 500, lvl: 6, cd: 38, chips: true },
  moon:    { name: 'Moon Cow', milk: 'moon', body: 0x6d7fe0, spot: 0xfff2a8, snout: 0xc9b8ff, price: 750, lvl: 7, cd: 42, glow: 0x141a48, stars: true },
  super:   { name: 'Super Milker Cow', milk: 'classic', body: 0xfffaff, spot: 0xff7ad9, snout: 0xffd6f0, price: 0, lvl: 99, cd: 18, rainbow: true, special: true },
  gold:    { name: 'Golden Cow', milk: 'gold', body: 0xffd23f, spot: 0xfff1b0, snout: 0xffb38a, price: 1000, lvl: 8, cd: 50, glow: 0x4a3500 },
};

const BREEDS = {
  black:  { name: 'Black Sheep', base: 8, face: 0x2a2228, price: 30, lvl: 1 },
  mud:    { name: 'Mudwool Sheep', base: 28, face: 0x5b4636, price: 50, lvl: 1 },
  meadow: { name: 'Meadow Sheep', base: 48, face: 0x3a3a44, price: 100, lvl: 1 },
  cloud:  { name: 'Cloudfluff Sheep', base: 64, face: 0xf2d9c4, price: 220, lvl: 2 },
  snow:   { name: 'Snowpuff Sheep', base: 80, face: 0x2f2f3a, price: 450, lvl: 4 },
  seraph: { name: 'Seraph Sheep', base: 92, face: 0xfff0d6, price: 1100, lvl: 7 },
};

/* The whiter the fleece, the better the sheep. */
const TIERS = [
  { name: 'Dingy',   min: 0,  color: '#9c8b74', power: 3,  sell: 4,  faith: 1 },
  { name: 'Grey',    min: 35, color: '#b9b3a8', power: 5,  sell: 7,  faith: 2 },
  { name: 'Cream',   min: 55, color: '#efe3c4', power: 8,  sell: 11, faith: 4 },
  { name: 'White',   min: 70, color: '#f7f7f2', power: 12, sell: 17, faith: 7 },
  { name: 'Snow',    min: 85, color: '#ffffff', power: 18, sell: 28, faith: 12 },
  { name: 'Radiant', min: 97, color: '#fff3b8', power: 30, sell: 65, faith: 30 },
];

const UPG = {
  bucket: { name: 'Milk Bucket', desc: 'Carry more milk', costs: [80, 220, 520, 900], vals: [14, 26, 42, 70, 110], unit: ' milk' },
  shears: { name: 'Shears', desc: 'More wool per shear', costs: [150, 480], vals: [1, 2, 3], unit: ' wool' },
  brush:  { name: 'Fleece Brush', desc: 'Whitens fleece more per brush', costs: [120, 420], vals: [7, 11, 16], unit: ' whiteness' },
  splash: { name: 'Udder Nozzle', desc: 'All milk shots hit harder', costs: [100, 320, 750], vals: [1, 1.4, 1.9, 2.6], unit: 'x damage' },
  udder:  { name: 'Cow Harness', desc: 'Bigger milk meter: squirt longer before refilling', costs: [140, 420], vals: [5, 7.5, 11], unit: 's of milk' },
  boots:  { name: 'Comfy Boots', desc: 'Walk faster', costs: [120, 360], vals: [9, 10.5, 12], unit: ' speed' },
  amp:    { name: 'Shield Amplifier', desc: '+25 max shield, yarn powers more', costs: [250, 650, 1300], vals: [1, 1.25, 1.5, 1.8], unit: 'x yarn' },
  gears:  { name: 'Spindle Gears', desc: 'Great Spindle spins faster', costs: [200, 600], vals: [6, 4, 2.5], unit: 's per wool' },
  barn:   { name: 'Barn & Meadow', desc: 'Room for 4 more cows and sheep', costs: [200, 500, 1000], vals: [8, 12, 16, 20], unit: ' each' },
};

const RECIPES = [
  { key: 'smoothie', name: 'Strawberry Banana Smoothie', need: { straw: 1, banana: 1 }, sell: 42, drink: { heal: 2, buff: 'speed', dur: 40 },
    desc: 'Drink for +2 hearts and a speed boost. Farmers love it as a gift.' },
  { key: 'latte', name: 'Mochi Choco Latte', need: { choc: 1, mochi: 1 }, sell: 48, drink: { heal: 2, buff: 'love', dur: 90 },
    desc: 'Drink before a date. Farmers adore it.' },
  { key: 'sunrise', name: 'Blueberry Orange Sunrise', need: { blueberry: 1, orange: 1 }, sell: 50, drink: { heal: 3, buff: 'zest', dur: 45 },
    desc: 'Drink for +3 hearts and rapid-fire udder shots.' },
  { key: 'nutty', name: 'Almond Mochi Milk Tea', need: { almond: 1, mochi: 1 }, sell: 55, drink: { heal: 2, buff: 'strong', dur: 60 },
    desc: 'Drink for a full minute of double-damage shots.' },
  { key: 'tea', name: 'Moon Mint Tea', need: { moon: 1, mint: 1 }, sell: 85, drink: { heal: 2, buff: 'xp', dur: 120 },
    desc: 'Double XP for 2 minutes.' },
  { key: 'float', name: 'Golden Cookie Float', need: { gold: 1, cookie: 1 }, sell: 160, drink: { heal: 99, buff: 'guard', dur: 20 },
    desc: 'A legendary dessert. Full hearts and 20s of safety.' },
];
const GOODS = Object.fromEntries(RECIPES.map(r => [r.key, r]));

const KITTENS = {
  tabby:   { name: 'Tabby Kitten', hp: 3, speed: 4.6, dmg: 0.8, color: 0xf2a65a, stripe: 0xc06a2b, eye: 0x9dff6a, scale: 1, coins: [3, 6] },
  ginger:  { name: 'Zoomie Kitten', hp: 2, speed: 7.6, dmg: 0.6, color: 0xff8a3d, stripe: 0xffd1a3, eye: 0xffe14d, scale: 0.85, coins: [3, 7] },
  chonk:   { name: 'Chonky Kitten', hp: 9, speed: 3, dmg: 2.4, color: 0xa7adbd, stripe: 0x7c8191, eye: 0xff9d3d, scale: 1.55, coins: [8, 14] },
  shadow:  { name: 'Shadow Kitten', hp: 4, speed: 5.2, dmg: 1.8, color: 0x2c2a3c, stripe: 0x14131d, eye: 0xd27bff, scale: 1, coins: [6, 10] },
  siamese: { name: 'Siamese Schemer', hp: 6, speed: 5.6, dmg: 1.4, color: 0xf3e6cf, stripe: 0x5a4034, eye: 0x5fd3ff, scale: 1.1, coins: [7, 12] },
  duchess: { name: 'Duchess Whiskerella', hp: 70, speed: 3.4, dmg: 6, color: 0xf5f0ff, stripe: 0xcfa8ff, eye: 0xff4fa3, scale: 2.7, coins: [250, 300], boss: true, crown: true },
  clawdius:{ name: 'King Clawdius, the Cat-astrophe', hp: 260, speed: 4.2, dmg: 2, color: 0x3d3350, stripe: 0x1f1830, eye: 0xff3b6b, scale: 4.6, coins: [1500, 1500], boss: true, crown: true, cave: true },
};

const FAITH = [0, 15, 50, 120, 250, 450];
const BLESS = ['',
  'Blessing of Growth: fleece grows 25% faster',
  'Blessing of the Shield: the shield fades 30% slower',
  'Blessing of Gentle Glow: fleece whiteness no longer fades',
  'Blessing of Plenty: cows often give extra milk',
  'Blessing of the Eternal Spin: the Spindle spins twice as fast and yarn powers 25% more'];

const COW_NAMES = ['Buttercup','Mocha','Daisy','Truffle','Bessie','Cocoa','Marshmallow','Clover','Fudge','Peaches','Moolan','Brownie','Honey','Pudding','Waffles','Biscuit','Nutmeg','Caramel','Latte','Sprinkles','Toffee','Gelato','Custard','Muffin','Dango','Sakura','Plantain','Berry','Shortcake','Nana'];
const SHEEP_NAMES = ['Fluffington','Woolbert','Cotton','Snowdrop','Baabara','Lambert','Puffball','Nimbus','Marsh','Fleecy','Dolly','Cumulus','Lanolina','Purlie','Tufty','Merino','Skein','Bobbin','Loopy','Cirrus','Tuft','Pillow'];

/* ---------- City & farm NPCs (not dateable) ---------- */
const NPC_DEF = {
  granny: { name: 'Granny Clover', role: 'Moo Meadow Farm', x: -7, z: 95, species: 'cow', robe: 0x8fd07a, trim: 0xfff1c1, hat: 'bonnet', face: 0xfaf3e8,
    chatter: ["Happy cows make extra milk. Feed them hay and give them pets!",
      "Pick up a cow with C and squeeze! Every milk does something different to kittens.",
      "Press G and your cows will follow you around and squirt kittens for you!",
      "Every time you level up, the Moo Market gets fancier cows. Save up for a golden one!",
      "Chocolate cows make chocolate milk. Strawberry cows make strawberry milk. I don't ask questions, dear.",
      "The Creamery by the sheep meadow can mix milks into treats. And maybe something more..."] },
  bo: { name: 'Shepherd Bo', role: 'Sheep Meadow', x: 17, z: 46, species: 'sheep', robe: 0x6aa9ff, trim: 0xffffff, hat: 'cap', face: 0x3a3a44,
    chatter: ["The whiter the fleece, the better the sheep. Brush them often!",
      "Clover makes fleece grow fast and shine a little whiter.",
      "Kittens love rolling my sheep in mud. Rude!",
      "Snow wool starts at 85 whiteness. Radiant at 97. Radiant sheep wear a halo!"] },
  lanolin: { name: 'High Shepherdess Lanolin', role: 'Temple of the Great Sheep', x: 15, z: -106, species: 'sheep', robe: 0xfff3c4, trim: 0xffc83d, hat: 'mitre', face: 0xfff0d6,
    chatter: ["Offer wool to the Great Sheep and you will be blessed.", "The purest fleece pleases the Great Sheep most.", "Baa-lessed be your pasture, Tori."] },
  purl: { name: 'Spinmaster Purl', role: 'Keeper of the Great Spindle', x: -18, z: -95, species: 'sheep', robe: 0xb48cf0, trim: 0xffe08a, hat: 'hood', face: 0x3a3238,
    chatter: ["The Great Spindle must never stop. Wool in, yarn out, forever.", "Whiter wool spins into stronger yarn.", "If the Spindle stops, the shield starves."] },
  fleecewell: { name: 'Captain Fleecewell', role: 'Shield Guard', x: 6, z: -84, species: 'sheep', robe: 0xc9d3e6, trim: 0xff6b8a, hat: 'helmet', face: 0x2f2f3a,
    chatter: ["The shield eats yarn. Snow and Radiant yarn feed it best.", "A strong shield zaps any kitten that scratches it.", "Kittens raid at night. Bring a cow and squeeze!"] },
  moolissa: { name: 'Merchant Moolissa', role: 'Moo Market', x: 22, z: -74, species: 'cow', robe: 0xff9fc0, trim: 0xffffff, hat: 'scarf', face: 0xffc4d6,
    chatter: ["Golden milk? I'd pay a fortune!", "New breeds show up as you level up.", "Buy low, moo high!"] },
};

/* ---------- Dateable farmers of Buttercup Hollow ---------- */
const DATE_SPOTS = ['the lily pond', 'the Great Spindle at sunset', 'the Temple steps', 'the strawberry patch', 'the top of the castle wall', 'the beehive meadow', 'the hay loft'];
const FARMERS = {
  hazel: { name: 'Hazel Butterworth', role: 'Cheesemaker', home: { x: -86, z: 104 },
    look: { skin: 0xffd9bf, hair: 0xd9622b, style: 'braid', shirt: 0xfff3c4, pants: 0x7a9e5a, apron: 0xffffff, freckles: true },
    loves: ['classic', 'cookie'], likes: ['choc', 'mochi'], dislikes: ['mint'],
    intro: ["Oh! Hi! Sorry, I'm covered in curds. I'm Hazel. I make the cheese here in Buttercup Hollow.",
      "You're the new milker on Granny's farm? Tori, right? Everyone's been talking about you."],
    chat: [["Cheese is just milk that believed in itself.", "Do you think the Great Sheep likes cheese? I leave a little wedge at the temple. Just in case."],
      ["I caught myself humming while I stirred the curds. It was your name. I mean, a song. A song about... milk.", "You always smell like fresh hay. It's nice. Is that weird? That's weird."],
      ["Every wheel I make, I carve a tiny heart in the rind now. Don't tell anyone.", "When you walk in, the whole hut feels warmer. And it's a cheese hut. It's supposed to be cool!"]],
    problems: [
      { need: { classic: 3 }, lines: ["Disaster! My cheese wheels won't set, and the Spindle monks ordered ten by Friday.", "If I had 3 Fresh Milk I could start a new batch. Could you help me?"],
        thanks: ["You saved my whole batch! You're kind of amazing, you know that?"], coins: 50 },
      { need: { choc: 2, straw: 1 }, lines: ["The castle wants a chocolate strawberry cheesecake for the Captain's birthday.", "I need 2 Chocolate Milk and 1 Strawberry Milk. Please? I'll owe you forever."],
        thanks: ["It's gorgeous! The Captain cried. Real tears! Thank you, Tori."], coins: 80 },
      { need: { banana: 1, mochi: 2 }, lines: ["I'm entering the Hollow Fair with a mochi banana brie. Don't laugh!", "I need 2 Mochi Milk and 1 Banana Milk."],
        thanks: ["It's perfect. You're perfect. I mean, the brie is perfect. Ahem."], coins: 120 },
      { need: { cookie: 2, moon: 1 }, lines: ["Can I tell you a secret? I want to make a cheese that tastes like the night sky.", "2 Cookies & Cream and 1 Moonlight Milk... and maybe the courage to say something after."],
        thanks: ["It worked... Tori, can I be honest? Every cheese I make lately, I'm thinking of you."], coins: 200 } ],
    dates: ["Hazel packs a picnic of tiny cheeses and names each one after a sheep. She laughs so hard she snorts, then turns bright red.",
      "You share one big bowl of fondue. Hazel keeps 'accidentally' bumping her fork into yours.",
      "Hazel shows you the stars and points out one she named 'Tori'. She says it's the brightest."],
    confess: ["Tori... I made this. It's a cheese wheel shaped like a heart. It's for you.", "I think I've been falling for you since the day you saved my curds. Will you be my sweetheart?"],
    sweet: ["My sweetheart! I saved you the best slice.", "Every cheese tastes better when you're around.", "I told the whole Hollow about us. Sorry. Not sorry!"] },

  rowan: { name: 'Rowan Oakley', role: 'Strawberry Farmer', home: { x: -108, z: 62 },
    look: { skin: 0xc68a5e, hair: 0x4a2c1d, style: 'curly', shirt: 0xff7f7f, pants: 0x4f9e6a, overalls: true },
    loves: ['straw', 'mint'], likes: ['banana', 'classic'], dislikes: ['choc'],
    intro: ["Oh. Uh. Hi. I'm Rowan. I grow strawberries. Big ones. Well, usually.", "You're Tori from Granny's farm... I've seen you milking. You're really good at it. Sorry, that's a strange thing to say."],
    chat: [["Strawberries are like people. They need sunshine and patience.", "I talk to my plants. They're good listeners."],
      ["I named the biggest strawberry after you. It's doing great. Thriving, even.", "You make me less shy. Is that a milk thing?"],
      ["When I see you coming up the path, my heart does this little hop.", "I planted a heart-shaped row of strawberries. You can see it from the castle wall."]],
    problems: [
      { need: { straw: 2 }, lines: ["My strawberries are coming in pale and sad. Old trick: a splash of strawberry milk in the soil.", "Could you spare 2 Strawberry Milk?"],
        thanks: ["Look! They're blushing again! Uh... like me, right now. Thanks, Tori."], coins: 50, gift: { clover: 4 } },
      { need: { mint: 2 }, lines: ["I'm supposed to sing at the barn dance, and my throat is scratchy.", "Mint milk always helps. I need 2."],
        thanks: ["I sang! Everyone clapped! I looked for you the whole time."], coins: 90 },
      { need: { banana: 2, classic: 2 }, lines: ["The scarecrow fell over and the crows ate half my patch.", "2 Banana Milk and 2 Fresh Milk would make enough fertilizer to save the rest."],
        thanks: ["Saved again. I think you might be my good luck charm."], coins: 130, gift: { hay: 6 } },
      { need: { moon: 1, straw: 2 }, lines: ["I want to give someone special a moonlit strawberry. It needs 1 Moonlight Milk and 2 Strawberry Milk.", "...The someone special is you. I'm going to go stand behind that tree now."],
        thanks: ["Here. The first moonberry. It glows a little. Like how I feel when you're here."], coins: 200 } ],
    dates: ["Rowan takes you strawberry picking. Every perfect berry ends up in your basket, not his.",
      "You sit on a fence together watching the sunset. Rowan finally works up the nerve to hold your hand.",
      "Rowan sings you the barn dance song, very quietly, only for you."],
    confess: ["Tori, I'm really bad at words. So I grew them.", "Look at the patch. The berries spell 'BE MINE?' ...Will you be my sweetheart?"],
    sweet: ["Hi, sweetheart. I saved you the reddest berry.", "My plants grow better when you visit. Science.", "You're my favorite thing that's ever grown here."] },

  theo: { name: 'Theo Puddington', role: 'Mochi Baker', home: { x: -122, z: 96 },
    look: { skin: 0xf2c9a0, hair: 0x1d1d26, style: 'short', shirt: 0xa7d8ff, pants: 0x55576b, apron: 0xffe3ef, glasses: true },
    loves: ['mochi', 'banana'], likes: ['straw', 'gold'], dislikes: ['classic'],
    intro: ["Welcome to Puddington's Mochi House! Oh, you're not a customer, you're Tori! The milker!", "I'm Theo. I bake mochi, buns, and the occasional disaster."],
    chat: [["Mochi is a hug you can eat.", "Flour on my glasses again. Occupational hazard."],
      ["I made a mochi that looks like you. Then I couldn't eat it. It's in the window.", "You're the best part of my day. And I make dessert all day!"],
      ["I've been practicing a new recipe. It's called 'Tori Sweet Bun'. It's very sweet. Like you. Oh no, I said that out loud."]],
    problems: [
      { need: { banana: 2 }, lines: ["Banana bread emergency! The oven is hot and I'm out of banana milk!", "Bring me 2 Banana Milk and I'll give you something you'll love."],
        thanks: ["You saved the bread! Here, take my spare Mochi Cow, Dango. She likes you already."], coins: 40, gift: { cow: 'mochi' } },
      { need: { mochi: 3 }, lines: ["The Mochi Moon Festival is tomorrow and I need a mountain of mochi.", "3 Mochi Milk, please! Your Mochi Cow should help."],
        thanks: ["A mochi mountain! The whole Hollow is talking. Mostly about you, though."], coins: 90 },
      { need: { choc: 2, cookie: 1 }, lines: ["I want to win the castle bake-off with a cookie choco bun.", "2 Chocolate Milk and 1 Cookies & Cream Milk."],
        thanks: ["First place! I put your name on the trophy too. Right next to mine. In a little heart."], coins: 140 },
      { need: { gold: 1, mochi: 1 }, lines: ["There's a legend of the Golden Mochi. Whoever shares one is bound together.", "It needs 1 Golden Milk and 1 Mochi Milk. I want to make one. For us."],
        thanks: ["It's golden and squishy and perfect. Half is yours. Like my heart. All of my heart, actually."], coins: 220 } ],
    dates: ["Theo teaches you to pound mochi. You both end up covered in rice flour, laughing.",
      "Theo brings a basket of buns shaped like cows. He made one of every breed.",
      "You split a giant milk bun. Theo gives you the bigger half without saying anything."],
    confess: ["I baked something for you. Open the box.", "It's a mochi that says 'I love you'. I've been trying to say it for weeks. Will you be my sweetheart?"],
    sweet: ["Sweetheart! Fresh buns, just for you.", "I tell every customer about you. Some of them leave without buying anything.", "You make my heart rise like dough."] },

  june: { name: 'June Skye', role: 'Beekeeper', home: { x: -92, z: 44 },
    look: { skin: 0x8d5a3b, hair: 0x9b6bff, style: 'bun', shirt: 0xffd166, pants: 0x3f5f8a, bandana: 0xff7aa8 },
    loves: ['gold', 'moon'], likes: ['mint', 'cookie'], dislikes: ['banana'],
    intro: ["Hey, careful, the bees are napping. I'm June. I keep the bees and the sunflowers.", "You're Tori, right? The bees buzz differently when you're around. Happy buzzing."],
    chat: [["Bees dance to tell each other where the flowers are. I dance to tell people where the snacks are.", "Honey and milk. Best friends since forever."],
      ["The queen bee likes you. She doesn't like anyone. Except me. And now you.", "I keep finding excuses to walk past your farm. Wait, don't write that down."],
      ["I wrote you a song on the honeycomb. You have to hold it up to the light to read it.", "My bees made heart-shaped honeycomb this week. I think they know."]],
    problems: [
      { need: { classic: 2, choc: 1 }, lines: ["The bees are grumpy. A warm milk tea at the hive door calms them down.", "2 Fresh Milk and 1 Chocolate Milk, please."],
        thanks: ["Buzzing happily again! You're a natural bee whisperer."], coins: 50 },
      { need: { mint: 2 }, lines: ["It's so hot the hives are melting. Minty milk cools the honeycomb.", "Could you bring 2 Mint Milk?"],
        thanks: ["Cool hives, happy bees, happy June. Here, have some hay I traded for."], coins: 90, gift: { hay: 5 } },
      { need: { moon: 1, cookie: 1 }, lines: ["I'm breeding night bees that glow. They need a moonlit milk nectar.", "1 Moonlight Milk and 1 Cookies & Cream Milk."],
        thanks: ["Look at them glow! It's like a sky full of tiny stars. You're the brightest one though."], coins: 150 },
      { need: { gold: 1, straw: 1 }, lines: ["The queen is getting old. Golden milk royal jelly would make her strong again.", "1 Golden Milk and 1 Strawberry Milk. And then... I have something to ask you."],
        thanks: ["The queen is dancing! Tori, I've been dancing too. Inside. Every time I see you."], coins: 220 } ],
    dates: ["June takes you to a sunflower field taller than both of you. You get lost together on purpose.",
      "You taste a dozen honeys. June feeds you the last spoonful and grins.",
      "June teaches you the bee dance. You're terrible at it. June says it's adorable."],
    confess: ["The bees and I talked it over. We all agree.", "Tori, I'm in love with you. Will you be my sweetheart?"],
    sweet: ["Hey, sweetheart. The bees saved you honey.", "You're my favorite flower. Don't tell the sunflowers.", "Every day with you is a sunny day."] },
};

/* ---------- Forest clearings: where wild cows and sheep live ---------- */
const CLEARINGS = [
  { id: 'cocoa', name: 'Cocoa Glade', x: -42, z: 2, r: 11, where: 'west of the road between your farm and the castle', animals: [{ c: 'choc' }, { c: 'choc' }, { s: 'mud' }], guards: 0 },
  { id: 'berry', name: 'Berry Thicket', x: 44, z: 4, r: 11, where: 'east of the road between your farm and the castle', animals: [{ c: 'straw' }, { c: 'blueberry' }, { s: 'meadow' }], guards: 1 },
  { id: 'banana', name: 'Banana Bend', x: -162, z: 22, r: 11, where: 'far west, past Buttercup Hollow', animals: [{ c: 'banana' }, { c: 'classic' }, { s: 'meadow' }], guards: 2 },
  { id: 'orchard', name: 'Sunny Orchard', x: -165, z: 124, r: 10, where: 'in the far south-west corner', animals: [{ c: 'orange' }, { s: 'mud' }], guards: 2 },
  { id: 'almond', name: 'Almond Hollow', x: -112, z: -62, r: 11, where: 'in the woods west of the castle', animals: [{ c: 'almond' }, { s: 'cloud' }], guards: 2 },
  { id: 'cookie', name: 'Cookie Crumble Clearing', x: 105, z: 70, r: 11, where: 'south-east, past the lily pond', animals: [{ c: 'cookie' }, { s: 'cloud' }], guards: 3 },
  { id: 'mochi', name: 'Mochi Meadow', x: -95, z: -150, r: 12, where: 'deep in the north-west woods behind the castle', animals: [{ c: 'mochi' }, { s: 'cloud' }], guards: 3 },
  { id: 'mint', name: 'Mint Grove', x: 95, z: -150, r: 12, where: 'deep in the north-east woods behind the castle', animals: [{ c: 'mint' }, { s: 'snow' }], guards: 4 },
  { id: 'moon', name: 'Moonlit Clearing', x: 172, z: -140, r: 12, where: 'in the darkest corner of Whisker Woods', animals: [{ c: 'moon' }, { s: 'snow' }], guards: 5, guardTypes: ['shadow', 'siamese', 'tabby'] },
  { id: 'gold', name: 'Golden Glen', x: -176, z: -166, r: 12, where: 'at the very end of the north-west trail', animals: [{ c: 'gold' }], guards: 6, guardTypes: ['chonk', 'siamese', 'shadow'] },
];
const FOREST_TRAILS = [
  [[0, 2], [-42, 2]], [[0, 4], [44, 4]],
  [[-118, 80], [-140, 50], [-162, 22]], [[-118, 80], [-145, 105], [-165, 124]],
  [[-3, -24], [-60, -28], [-112, -62]], [[-112, -62], [-100, -110], [-95, -150]], [[-112, -62], [-150, -120], [-176, -166]],
  [[85, -20], [92, -90], [95, -150]], [[85, -20], [95, 30], [105, 70]], [[150, -20], [165, -80], [172, -140]],
];

/* ---------- Main story quests ---------- */
const QUESTS = [
  { giver: 'granny', title: 'Welcome to Moo Meadow', text: 'Milk Buttercup 2 times', kind: 'stat', stat: 'milked', n: 2, reward: { coins: 30, xp: 25, hay: 4 },
    talk: ["Oh! You must be Tori. Welcome to Tori's Super Milkers! It's your farm now, dear.",
      "You're starting small: one good old cow named Buttercup, and Inky, a little black sheep.",
      "Walk up to Buttercup and press E to milk her. Do it twice for me."],
    finish: ["Lovely! Fresh milk smells like sunshine.", "Sell milk in the Shipping Crate by the farmhouse whenever your bucket fills up."] },
  { giver: 'granny', title: 'Wild Cows', text: 'Find a wild Chocolate Cow and lead her into your pasture', kind: 'ownCow', type: 'choc', reward: { coins: 50, xp: 40, hay: 4 },
    talk: ["Here's a secret: the forests around the castle are full of WILD cows. Chocolate, strawberry, banana, even golden ones!",
      "I've heard chocolate cows hiding in the woods just west of the road to the castle. You'll have to search the trees, dear. Your quest arrow points to the area.",
      "Walk up to her and press E to befriend her. She'll follow you. Lead her into your cow pasture and she's yours!"],
    finish: ["A chocolate cow! She makes chocolate milk, dear. Every wild cow you bring home makes a new kind of milk.", "Check your Herd Book to see which cows and sheep are still out there."] },
  { giver: 'granny', title: 'Sweet Discovery', text: 'Bring Granny 3 Chocolate Milk', kind: 'item', item: { type: 'milk', key: 'choc' }, n: 3, reward: { coins: 60, xp: 30, hay: 5 },
    talk: ["Now for the good stuff. Bring me 3 bottles of chocolate milk.", "A cow gives more milk when she's happy. Hay and pets help!"],
    finish: ["Mmm! Just like I remember. Take some hay, dear."] },
  { giver: 'bo', title: 'Shear Joy', text: 'Shear a sheep', kind: 'stat', stat: 'sheared', n: 1, reward: { coins: 40, xp: 30, clover: 3 },
    talk: ["Hey there! I'm Shepherd Bo. That's Inky, your black sheep. Cute, right?", "When a sheep's fleece is fully grown, walk up and shear it with E."],
    finish: ["Nice clean cut! Here's some clover. Sheep love it."] },
  { giver: 'bo', title: 'The Whiter the Fleece', text: 'Brush sheep 4 times', kind: 'stat', stat: 'brushed', n: 4, reward: { coins: 60, xp: 40 },
    talk: ["First rule of shepherding: the whiter the fleece, the better the sheep.", "Brush a sheep (press 1 next to it) to make its fleece whiter. White wool sells for more and spins stronger yarn.",
      "Inky will never be very white, though. Black sheep just aren't."],
    finish: ["Look at that shine! You've got the touch."] },
  { giver: 'bo', title: 'Brighter Sheep', text: 'Find a whiter wild sheep and lead it into your meadow', kind: 'ownSheep', minBase: 40, reward: { coins: 70, xp: 50, clover: 3 },
    talk: ["Whiter sheep hide wild in the forest. Try the woods east of the castle road.", "Watch out, kittens guard some of them. Carry a cow (press C) and squirt them!",
      "Befriend the sheep with E and lead it into the sheep meadow. The deeper in the woods, the whiter the sheep."],
    finish: ["What a lovely fleece! The whitest sheep of all, the Seraph Sheep, is said to be locked away somewhere dark... but that's a story for later."] },
  { giver: 'bo', turnin: 'lanolin', title: 'Pilgrimage to the Sheep-a-verse', text: 'Speak with High Shepherdess Lanolin at the Temple', kind: 'talk', reward: { coins: 50, xp: 50 },
    talk: ["Time you saw the Sheep-a-verse. Follow the road north to the great castle city.", "They worship the Great Sheep there. See the sheep on their flags? And the Great Spindle turns our wool into yarn for the shield.", "Find High Shepherdess Lanolin at the Temple. Tell her Bo sent you."],
    finish: ["Welcome, child of the meadow. The Great Sheep has watched you tend your flock.", "Our city lives behind a shield woven from yarn. Without it, the evil kittens would pounce on us all."] },
  { giver: 'lanolin', turnin: 'purl', title: 'Feed the Great Spindle', text: 'Feed 4 wool to the Great Spindle', kind: 'stat', stat: 'woolSpun', n: 4, reward: { coins: 70, xp: 50 },
    talk: ["The Great Spindle spins day and night. It must never stop.", "Bring wool to Spinmaster Purl, west of the plaza, and feed it to the Spindle."],
    finish: ["Ahh, hear it hum! The Spindle thanks you. Collect your yarn from its basket any time."] },
  { giver: 'purl', turnin: 'fleecewell', title: 'The Shield Must Hold', text: 'Feed the Spindle so 3 yarn flows into the shield', kind: 'stat', stat: 'yarnWoven', n: 3, reward: { coins: 80, xp: 60 },
    talk: ["Every strand the Spindle spins flows straight into the Heart of the Shield, the big crystal in the plaza. You don't have to carry it.", "So your job is simple: keep feeding the Spindle wool. Get 3 yarn into the shield, then report to Captain Fleecewell."],
    finish: ["The field glows brighter! Good work, farmer.", "Whiter yarn gives the field more power. Remember that."] },
  { giver: 'fleecewell', title: 'Kitten Patrol', text: 'Bonk 6 evil kittens', kind: 'stat', stat: 'kittens', n: 6, reward: { coins: 120, xp: 80 },
    talk: ["Here's the danger, Tori. Every night at 20:00, evil kittens sneak out of the woods and RAID us.",
      "Most of them scratch at our yarn force field. If it breaks, they pour into the city and tangle the Great Spindle. A few sneak to your farm to spook your cows and roll your sheep in mud.",
      "Fight back: pick up a cow (C) and squeeze her udder at them (hold F or the mouse). Every milk does something different!", "Press G and your whole herd follows you and squirts kittens too. The more cows you own, the bigger the raids, so build an army! Watch for the red and orange arrows at the edge of your screen: they point to kittens attacking the farm and the city.",
      "The raids start tonight. Nap at your farmhouse if you want to skip ahead. Bonk 6 kittens for me."],
    finish: ["Six sleepy kittens! The Sheep-a-verse sleeps easier tonight."] },
  { giver: 'granny', title: 'Neighbors in Need', text: 'Solve a problem for a farmer in Buttercup Hollow', kind: 'stat', stat: 'problems', n: 1, reward: { coins: 80, xp: 60 },
    talk: ["West of the farm is Buttercup Hollow. Hazel, Rowan, Theo and June live there.", "They always have little troubles a bottle of milk could fix.", "And between you and me, dear, some of them are very sweet on you. Go say hello!"],
    finish: ["I heard you helped out! The Hollow is buzzing about you. Some of them are blushing about you, too."] },
  { giver: 'moolissa', title: "Explorer's Herd", text: 'Own 6 different kinds of cow', kind: 'cowTypes', n: 6, reward: { coins: 150, xp: 90 },
    talk: ["Welcome to the Moo Market! I buy milk, wool and treats, and I sell copies of any breed you've already found in the wild.",
      "The rarest cows hide deep in the woods, guarded by kittens. Bring 6 different kinds of cow home and I'll make it worth your while."],
    finish: ["Six breeds! You're a real cow explorer. Every one of them is in my catalog now."] },
  { giver: 'bo', title: 'Snow White', text: 'Shear Snow wool (whiteness 85+)', kind: 'stat', stat: 'snowShear', n: 1, reward: { coins: 150, xp: 90 },
    talk: ["Ready for a challenge? Shear a fleece with whiteness 85 or more. That's Snow grade.", "Snowpuff Sheep live far north in Mint Grove and Moonlit Clearing. Brush often and keep the kittens off them."],
    finish: ["Snow wool! Purl will weep with joy."] },
  { giver: 'granny', title: 'Rainbow Dairy', text: 'Carry 5 different kinds of milk at once', kind: 'milkTypes', n: 5, reward: { coins: 200, xp: 100 },
    talk: ["I dream of a rainbow dairy. Fresh, chocolate, strawberry, banana, mochi...", "Carry five different kinds of milk in your bucket at the same time and show me."],
    finish: ["A rainbow in a bucket! You're the best farmer this meadow has seen."] },
  { giver: 'lanolin', title: 'The Radiant Offering', text: 'Bring Lanolin 1 Radiant wool (whiteness 97+)', kind: 'item', item: { type: 'wool', tier: 5 }, n: 1, reward: { coins: 300, xp: 150, faith: 60 },
    talk: ["Legend tells of a fleece so white it glows: the Radiant fleece.", "A sheep with whiteness 97 or more wears a halo. Shear it and bring me its wool."],
    finish: ["It glows like the first morning! The Great Sheep is pleased with you."] },
  { giver: 'fleecewell', title: 'The Kitten Queen', text: 'Defeat Duchess Whiskerella in a night raid', kind: 'stat', stat: 'duchess', n: 1, reward: { coins: 400, xp: 200 },
    talk: ["Our scouts saw her: Duchess Whiskerella, Queen of the Kittens. She leads the next raid herself.", "She's big, she's fluffy, and she calls other kittens to help her. Bring your strongest cow!"],
    finish: ["The Duchess is snoring in the woods! But she muttered something about her big brother...", "Talk to Granny. She knows the old stories."] },
  { giver: 'granny', title: 'The Legend of the Super Milker', text: 'Own all 12 kinds of cow, then use the crystal in town to fuse them', kind: 'stat', stat: 'superFused', n: 1, reward: { coins: 200, xp: 150 },
    talk: ["Her big brother... King Clawdius. The Cat-astrophe. He sleeps in Catnap Cavern, in Whisker Woods to the east.", "He keeps the whitest sheep in the world, the Seraph Sheep, locked in a cage. No ordinary milk can hurt him.",
      "But my grandma told me of the Super Milker. Find all twelve kinds of cow in the forest and bring them to your farm.", "Then go to the glowing crystal in the middle of town, the Heart of the Shield. Use it, and the twelve will fuse into ONE cow: the Super Milker. Her udder blasts rainbows!"],
    finish: ["She shimmers like a rainbow! Carry her into that cave and go free the poor Seraph Sheep."] },
  { giver: 'fleecewell', title: 'Into Catnap Cavern', text: 'Defeat King Clawdius with the Super Milker Cow', kind: 'stat', stat: 'clawdius', n: 1, reward: { coins: 600, xp: 300 },
    talk: ["Catnap Cavern is at the end of the Whisker Woods trail. Look for the mountain with glowing eyes.", "Pick up your Super Milker Cow (C) and carry her inside.", "Only rainbow milk can hurt the King. Beat him and the Seraph Sheep's cage will spring open!"],
    finish: ["You did it! King Clawdius is purring like a kitten, and the Seraph Sheep is free!", "But listen... the drums in the woods. Every kitten in the land is coming for revenge. ENDLESS RAIDS, Tori. Hold the line as long as you can!"] },
  { giver: 'purl', title: 'The Eternal Spin', text: 'Reach Faith level 5 and charge the shield to 90%', kind: 'final', reward: { coins: 1000, xp: 300 },
    talk: ["One last task, hero. Earn the highest blessing of the Great Sheep: Faith level 5.", "And fill the shield to at least 90%. Then the Spindle will spin forever."],
    finish: ["The Spindle sings! The shield shines! You are the Hero of the Sheep-a-verse!", "Keep that fleece white and that milk flowing, Tori."] },
];

const FOLK_LINES = ["Praise the Great Spindle!", "Baa-lessed be the whitest fleece.", "Have you seen a Radiant fleece? They glow!", "The shield hums when it's fed good yarn.",
  "Kittens nap all day and scheme all night.", "Spin, spin, never stop!", "The Great Sheep watches over us.", "Chocolate milk at the market today!", "May your wool be ever white.",
  "One strand of yarn, one spark of shield.", "Is that Tori? THE Tori?", "I heard Tori squirts kittens with a strawberry cow!", "Baa-utiful day."];
const FOLK_SAD = ["The Spindle is still... I'm scared.", "Who will feed the Spindle?", "Without yarn the shield will fade!"];
const FOLK_PANIC = ["Kittens in the city! Eek!", "Hide the yarn!", "Save us, Tori!"];

/* What people yell when Tori squirts them with milk */
const SOAK_LINES = {
  sheep: ["Baa! RUDE!", "I JUST washed this fleece!", "Hey! Not cool, Tori!", "My robe is RUINED!", "Ugh, now I smell like a milkshake!", "The Great Sheep saw that!", "BAA-D MANNERS!", "Why is it warm?!"],
  cow: ["Well I never!", "Dearie! That's MY milk!", "Moo-ve that cow away from me!", "This is a brand new scarf!"],
  farmer: ["Tori! Seriously?!", "Ack! Cold milk!", "Is this how you flirt?!", "My hair!!", "I'm telling Granny!", "...Okay that was a little funny. STILL MAD."],
  sacred: ["Baaaa!!", "*offended holy baa*", "Blasphemoo!"],
};
