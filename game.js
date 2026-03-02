'use strict';

// ============================================================
// CONSTANTS
// ============================================================

const BASE_RATE          = 1e-10;   // W/s baseline
const PRESTIGE_THRESHOLD = 1e12;    // Minimum run warmth to prestige
const OFFLINE_CAP_BASE   = 28800;   // 8 hours default offline cap
const AUTOSAVE_MS        = 30000;   // 30 seconds
const TICK_MS            = 200;     // UI update rate

// ============================================================
// GENERATOR DEFINITIONS
// ============================================================
// baseCost: starting purchase cost
// baseRate: warmth/sec per unit
// costMult: cost multiplier per unit owned

const GEN_DEFS = [
  { id: 'hearth',  name: 'Hearth',      desc: 'A small fire, barely alive.',           baseCost: 1.5e-8, baseRate: 3e-11,  costMult: 1.15 },
  { id: 'forge',   name: 'Forge',        desc: 'Coals endure where flames fail.',       baseCost: 2e-6,   baseRate: 2e-9,   costMult: 1.15 },
  { id: 'mill',    name: 'Mill',          desc: 'Grinding slowly through the cold.',    baseCost: 3e-4,   baseRate: 1.5e-7, costMult: 1.15 },
  { id: 'furnace', name: 'Furnace',      desc: 'Industrial heat — slow, relentless.',   baseCost: 0.05,   baseRate: 1e-5,   costMult: 1.15 },
  { id: 'kiln',    name: 'Kiln',          desc: 'Firing clay into civilization.',       baseCost: 8,      baseRate: 7e-4,   costMult: 1.15 },
  { id: 'smelter', name: 'Smelter',      desc: 'Metal born from sustained fire.',       baseCost: 1500,   baseRate: 0.05,   costMult: 1.15 },
  { id: 'foundry', name: 'Foundry',      desc: 'Where raw ore becomes empire.',         baseCost: 3e5,    baseRate: 4,      costMult: 1.15 },
  { id: 'reactor', name: 'Reactor',      desc: 'Controlled nuclear fire.',              baseCost: 7e7,    baseRate: 300,    costMult: 1.15 },
  { id: 'suncore', name: 'Sun Core',     desc: 'A miniature star, contained.',          baseCost: 2e10,   baseRate: 25000,  costMult: 1.15 },
  { id: 'stellar', name: 'Star Engine',  desc: 'Harnessing the light of creation.',     baseCost: 6e12,   baseRate: 2e6,    costMult: 1.15 },
];

// Milestone bonuses: [count_threshold, multiplier]
// The highest applicable milestone applies (they don't stack)
const MILESTONES = [[10, 2], [25, 4], [50, 8], [100, 15], [200, 30]];

// ============================================================
// UPGRADE DEFINITIONS
// gen: generator id to multiply, or null for global
// req: { generatorId: minCount } to display/unlock
// ============================================================

const UPGRADE_DEFS = [
  // Hearth
  { id: 'h1',  name: 'Dry Wood',        desc: 'Hearths produce 2\u00d7 more.',    cost: 5e-7,   gen: 'hearth',   mult: 2,  req: { hearth: 1  } },
  { id: 'h2',  name: 'Bellows',         desc: 'Hearths produce 3\u00d7 more.',    cost: 5e-6,   gen: 'hearth',   mult: 3,  req: { hearth: 10 } },
  { id: 'h3',  name: 'Stone Chimney',   desc: 'Hearths produce 5\u00d7 more.',    cost: 8e-5,   gen: 'hearth',   mult: 5,  req: { hearth: 25 } },
  { id: 'h4',  name: 'Iron Grate',      desc: 'Hearths produce 10\u00d7 more.',   cost: 1e-3,   gen: 'hearth',   mult: 10, req: { hearth: 50 } },
  // Forge
  { id: 'f1',  name: 'Quality Coal',    desc: 'Forges produce 2\u00d7 more.',     cost: 8e-5,   gen: 'forge',    mult: 2,  req: { forge: 1  } },
  { id: 'f2',  name: 'Draft System',    desc: 'Forges produce 3\u00d7 more.',     cost: 8e-4,   gen: 'forge',    mult: 3,  req: { forge: 10 } },
  { id: 'f3',  name: 'Fire Brick',      desc: 'Forges produce 5\u00d7 more.',     cost: 0.012,  gen: 'forge',    mult: 5,  req: { forge: 25 } },
  { id: 'f4',  name: 'Coke Fuel',       desc: 'Forges produce 10\u00d7 more.',    cost: 0.18,   gen: 'forge',    mult: 10, req: { forge: 50 } },
  // Mill
  { id: 'm1',  name: 'Stone Wheels',    desc: 'Mills produce 2\u00d7 more.',      cost: 0.012,  gen: 'mill',     mult: 2,  req: { mill: 1  } },
  { id: 'm2',  name: 'Iron Axles',      desc: 'Mills produce 3\u00d7 more.',      cost: 0.12,   gen: 'mill',     mult: 3,  req: { mill: 10 } },
  { id: 'm3',  name: 'Water Wheel',     desc: 'Mills produce 5\u00d7 more.',      cost: 2,      gen: 'mill',     mult: 5,  req: { mill: 25 } },
  { id: 'm4',  name: 'Steam Mill',      desc: 'Mills produce 10\u00d7 more.',     cost: 30,     gen: 'mill',     mult: 10, req: { mill: 50 } },
  // Furnace
  { id: 'fu1', name: 'Fireclay',        desc: 'Furnaces produce 2\u00d7 more.',   cost: 2,      gen: 'furnace',  mult: 2,  req: { furnace: 1  } },
  { id: 'fu2', name: 'Preheater',       desc: 'Furnaces produce 3\u00d7 more.',   cost: 25,     gen: 'furnace',  mult: 3,  req: { furnace: 10 } },
  { id: 'fu3', name: 'Forced Draft',    desc: 'Furnaces produce 5\u00d7 more.',   cost: 400,    gen: 'furnace',  mult: 5,  req: { furnace: 25 } },
  { id: 'fu4', name: 'Recuperator',     desc: 'Furnaces produce 10\u00d7 more.',  cost: 6000,   gen: 'furnace',  mult: 10, req: { furnace: 50 } },
  // Kiln
  { id: 'k1',  name: 'Insulation',      desc: 'Kilns produce 2\u00d7 more.',      cost: 350,    gen: 'kiln',     mult: 2,  req: { kiln: 1  } },
  { id: 'k2',  name: 'Gas Kiln',        desc: 'Kilns produce 3\u00d7 more.',      cost: 4000,   gen: 'kiln',     mult: 3,  req: { kiln: 10 } },
  { id: 'k3',  name: 'Electric Arc',    desc: 'Kilns produce 5\u00d7 more.',      cost: 6e4,    gen: 'kiln',     mult: 5,  req: { kiln: 25 } },
  { id: 'k4',  name: 'Plasma Kiln',     desc: 'Kilns produce 10\u00d7 more.',     cost: 9e5,    gen: 'kiln',     mult: 10, req: { kiln: 50 } },
  // Smelter
  { id: 's1',  name: 'Flux Agents',     desc: 'Smelters produce 2\u00d7 more.',   cost: 7e4,    gen: 'smelter',  mult: 2,  req: { smelter: 1  } },
  { id: 's2',  name: 'Oxygen Lance',    desc: 'Smelters produce 3\u00d7 more.',   cost: 8e5,    gen: 'smelter',  mult: 3,  req: { smelter: 10 } },
  { id: 's3',  name: 'Arc Furnace',     desc: 'Smelters produce 5\u00d7 more.',   cost: 1.2e7,  gen: 'smelter',  mult: 5,  req: { smelter: 25 } },
  { id: 's4',  name: 'Plasma Torch',    desc: 'Smelters produce 10\u00d7 more.',  cost: 1.8e8,  gen: 'smelter',  mult: 10, req: { smelter: 50 } },
  // Foundry
  { id: 'fo1', name: 'Lost Wax',        desc: 'Foundries produce 2\u00d7 more.',  cost: 1.4e7,  gen: 'foundry',  mult: 2,  req: { foundry: 1  } },
  { id: 'fo2', name: 'Die Casting',     desc: 'Foundries produce 3\u00d7 more.',  cost: 1.5e8,  gen: 'foundry',  mult: 3,  req: { foundry: 10 } },
  { id: 'fo3', name: 'Centrifugal',     desc: 'Foundries produce 5\u00d7 more.',  cost: 2.5e9,  gen: 'foundry',  mult: 5,  req: { foundry: 25 } },
  { id: 'fo4', name: 'Microgravity',    desc: 'Foundries produce 10\u00d7 more.', cost: 4e10,   gen: 'foundry',  mult: 10, req: { foundry: 50 } },
  // Reactor
  { id: 'r1',  name: 'Enriched Fuel',   desc: 'Reactors produce 2\u00d7 more.',   cost: 3e9,    gen: 'reactor',  mult: 2,  req: { reactor: 1  } },
  { id: 'r2',  name: 'Fast Neutrons',   desc: 'Reactors produce 3\u00d7 more.',   cost: 3.5e10, gen: 'reactor',  mult: 3,  req: { reactor: 10 } },
  { id: 'r3',  name: 'Thorium Cycle',   desc: 'Reactors produce 5\u00d7 more.',   cost: 6e11,   gen: 'reactor',  mult: 5,  req: { reactor: 25 } },
  { id: 'r4',  name: 'Fusion Assist',   desc: 'Reactors produce 10\u00d7 more.',  cost: 9e12,   gen: 'reactor',  mult: 10, req: { reactor: 50 } },
  // Sun Core
  { id: 'sc1', name: 'Magnetar Field',  desc: 'Sun Cores produce 2\u00d7 more.',  cost: 8e11,   gen: 'suncore',  mult: 2,  req: { suncore: 1  } },
  { id: 'sc2', name: 'CNO Cycle',       desc: 'Sun Cores produce 3\u00d7 more.',  cost: 9e12,   gen: 'suncore',  mult: 3,  req: { suncore: 10 } },
  { id: 'sc3', name: 'Quark Plasma',    desc: 'Sun Cores produce 5\u00d7 more.',  cost: 1.5e14, gen: 'suncore',  mult: 5,  req: { suncore: 25 } },
  { id: 'sc4', name: 'Dyson Shell',     desc: 'Sun Cores produce 10\u00d7 more.', cost: 2.5e15, gen: 'suncore',  mult: 10, req: { suncore: 50 } },
  // Star Engine
  { id: 'se1', name: 'Hypernova Tap',   desc: 'Star Engines produce 2\u00d7 more.',  cost: 2.5e14, gen: 'stellar', mult: 2,  req: { stellar: 1  } },
  { id: 'se2', name: 'Hawking Drive',   desc: 'Star Engines produce 3\u00d7 more.',  cost: 3e15,   gen: 'stellar', mult: 3,  req: { stellar: 10 } },
  { id: 'se3', name: 'Cosmic String',   desc: 'Star Engines produce 5\u00d7 more.',  cost: 5e16,   gen: 'stellar', mult: 5,  req: { stellar: 25 } },
  { id: 'se4', name: 'Dark Fusion',     desc: 'Star Engines produce 10\u00d7 more.', cost: 8e17,   gen: 'stellar', mult: 10, req: { stellar: 50 } },
  // Global
  { id: 'g1',  name: 'Thermal Theory',  desc: 'All generators \u00d71.5.',        cost: 1e-3,   gen: null, mult: 1.5, req: { forge: 1    } },
  { id: 'g2',  name: 'Combustion Eng.', desc: 'All generators \u00d72.',          cost: 5000,   gen: null, mult: 2,   req: { furnace: 5  } },
  { id: 'g3',  name: 'Thermodynamics',  desc: 'All generators \u00d73.',          cost: 1e8,    gen: null, mult: 3,   req: { smelter: 5  } },
  { id: 'g4',  name: 'Plasma Physics',  desc: 'All generators \u00d75.',          cost: 1e11,   gen: null, mult: 5,   req: { reactor: 5  } },
  { id: 'g5',  name: 'Stellar Dyn.',    desc: 'All generators \u00d710.',         cost: 1e14,   gen: null, mult: 10,  req: { suncore: 5  } },
];

// ============================================================
// PRESTIGE UPGRADE DEFINITIONS
// type: globalMult | baseMult | startGen | ecBonus | offlineCap | synergy | upgradeMult | unlockVoid
// ============================================================

const PRESTIGE_DEF = [
  { id: 'p1',  name: 'Ancestral Flame',   cost: 3,   desc: 'Global production \u00d71.5 permanently.',             type: 'globalMult', val: 1.5 },
  { id: 'p2',  name: 'Ember Memory',      cost: 5,   desc: 'Start each run with 5 Hearths already built.',        type: 'startGen',   genId: 'hearth',   val: 5 },
  { id: 'p3',  name: 'Smoldering Dawn',   cost: 8,   desc: 'Base warmth generation \u00d75.',                     type: 'baseMult',   val: 5 },
  { id: 'p4',  name: 'Forge Legacy',      cost: 10,  desc: 'Start each run with 2 Forges already built.',         type: 'startGen',   genId: 'forge',    val: 2 },
  { id: 'p5',  name: 'Double Embers',     cost: 12,  desc: 'Global production \u00d72 permanently.',              type: 'globalMult', val: 2 },
  { id: 'p6',  name: 'Prestige Rush',     cost: 15,  desc: 'Gain 15% more Ember Cores when prestiging.',          type: 'ecBonus',    val: 0.15 },
  { id: 'p7',  name: 'Quickening',        cost: 20,  desc: 'Offline progress cap extended to 12 hours.',          type: 'offlineCap', val: 43200 },
  { id: 'p8',  name: 'Thermal Cascade',   cost: 25,  desc: 'Each generator type you own adds 0.5% to all output.', type: 'synergy',  val: 0.005 },
  { id: 'p9',  name: 'Phoenix Protocol',  cost: 30,  desc: 'Base warmth generation \u00d750.',                    type: 'baseMult',   val: 50 },
  { id: 'p10', name: 'Mill Heritage',     cost: 35,  desc: 'Start each run with 1 Mill already built.',           type: 'startGen',   genId: 'mill',     val: 1 },
  { id: 'p11', name: 'Ember Storm',       cost: 50,  desc: 'Global production \u00d73 permanently.',              type: 'globalMult', val: 3 },
  { id: 'p12', name: 'Infinite Patience', cost: 75,  desc: 'All upgrade costs reduced by 25%.',                   type: 'upgradeMult',val: 0.75 },
  { id: 'p13', name: 'Void Touched',      cost: 100, desc: 'Unlock the Void Nexus \u2014 scales with all EC ever earned.', type: 'unlockVoid', val: 1 },
  { id: 'p14', name: 'Star Heritage',     cost: 150, desc: 'Start each run with 1 Foundry already built.',        type: 'startGen',   genId: 'foundry',  val: 1 },
  { id: 'p15', name: 'Convergence',       cost: 200, desc: 'Global production \u00d75 permanently.',              type: 'globalMult', val: 5 },
  { id: 'p16', name: 'The Long Burn',     cost: 500, desc: 'Global production \u00d710 permanently.',             type: 'globalMult', val: 10 },
];

// ============================================================
// VOID NEXUS (post-prestige unlockable generator)
// ============================================================
const VOID_NEXUS = {
  id: 'void', name: 'Void Nexus', desc: 'Draws warmth from accumulated Ember Core resonance.',
  baseCost: 1e10, costMult: 1.20,
};

// ============================================================
// GAME STATE
// ============================================================

function freshState() {
  return {
    warmth:          0,
    runWarmth:       0,   // total earned THIS prestige run (monotone)
    allTimeWarmth:   0,   // total earned across all runs
    prestigeCount:   0,
    emberCores:      0,   // spendable
    totalECEarned:   0,   // lifetime, never decreases
    genCounts:       new Array(GEN_DEFS.length).fill(0),
    voidCount:       0,
    upgrades:        [],  // array of purchased upgrade ids
    prestigeUpgrades:[],  // array of purchased prestige upgrade ids
    sessionStart:    Date.now(),
    lastTick:        Date.now(),
  };
}

let state = freshState();
let upgradeSet = new Set();
let prestigeSet = new Set();

// Rebuild Set caches from state arrays (call after any load/purchase)
function syncSets() {
  upgradeSet  = new Set(state.upgrades);
  prestigeSet = new Set(state.prestigeUpgrades);
}

// ============================================================
// NUMBER FORMATTING
// ============================================================

const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'De', 'Ud', 'Du', 'Tr'];

function formatNum(n) {
  if (!isFinite(n) || isNaN(n)) return '0';
  if (n === 0) return '0';
  const neg = n < 0;
  n = Math.abs(n);

  if (n < 1e-3) {
    // Scientific notation for tiny numbers
    const exp = Math.floor(Math.log10(n));
    const coeff = n / Math.pow(10, exp);
    return (neg ? '-' : '') + coeff.toFixed(2) + 'e' + (exp >= 0 ? '+' : '') + exp;
  }
  if (n < 1000) {
    const decimals = n < 10 ? 3 : n < 100 ? 2 : 1;
    return (neg ? '-' : '') + n.toFixed(decimals);
  }
  const tier = Math.min(Math.floor(Math.log10(n) / 3), SUFFIXES.length - 1);
  if (tier < SUFFIXES.length && SUFFIXES[tier] !== undefined) {
    const scaled = n / Math.pow(1000, tier);
    return (neg ? '-' : '') + scaled.toFixed(2) + SUFFIXES[tier];
  }
  // Fall back to e-notation for astronomical numbers
  const exp = Math.floor(Math.log10(n));
  const coeff = n / Math.pow(10, exp);
  return (neg ? '-' : '') + coeff.toFixed(2) + 'e+' + exp;
}

function formatTime(seconds) {
  seconds = Math.floor(seconds);
  if (seconds < 60)  return seconds + 's';
  if (seconds < 3600) return Math.floor(seconds/60) + 'm ' + (seconds%60) + 's';
  if (seconds < 86400) {
    const h = Math.floor(seconds/3600);
    const m = Math.floor((seconds%3600)/60);
    return h + 'h ' + m + 'm';
  }
  const d = Math.floor(seconds/86400);
  const h = Math.floor((seconds%86400)/3600);
  return d + 'd ' + h + 'h';
}

// ============================================================
// COMPUTATION
// ============================================================

function getGenCount(genId) {
  const idx = GEN_DEFS.findIndex(g => g.id === genId);
  return idx >= 0 ? state.genCounts[idx] : 0;
}

function getGenCost(idx) {
  const def = GEN_DEFS[idx];
  return def.baseCost * Math.pow(def.costMult, state.genCounts[idx]);
}

function getVoidCost() {
  return VOID_NEXUS.baseCost * Math.pow(VOID_NEXUS.costMult, state.voidCount);
}

function getMilestoneMult(count) {
  let mult = 1;
  for (const [threshold, bonus] of MILESTONES) {
    if (count >= threshold) mult = bonus;
  }
  return mult;
}

function getUpgradeMultForGen(genId) {
  let mult = 1;
  for (const u of UPGRADE_DEFS) {
    if (u.gen === genId && upgradeSet.has(u.id)) mult *= u.mult;
  }
  return mult;
}

function getGlobalUpgradeMult() {
  let mult = 1;
  for (const u of UPGRADE_DEFS) {
    if (u.gen === null && upgradeSet.has(u.id)) mult *= u.mult;
  }
  return mult;
}

function getPrestigeGlobalMult() {
  let mult = 1;
  for (const p of PRESTIGE_DEF) {
    if (p.type === 'globalMult' && prestigeSet.has(p.id)) mult *= p.val;
  }
  return mult;
}

function getPrestigeBaseMult() {
  let mult = 1;
  for (const p of PRESTIGE_DEF) {
    if (p.type === 'baseMult' && prestigeSet.has(p.id)) mult *= p.val;
  }
  return mult;
}

function getSynergyMult() {
  if (!prestigeSet.has('p8')) return 1;
  let types = 0;
  for (let i = 0; i < state.genCounts.length; i++) {
    if (state.genCounts[i] > 0) types++;
  }
  if (state.voidCount > 0) types++;
  return 1 + types * 0.005;
}

function getUpgradeCostDiscount() {
  return prestigeSet.has('p12') ? 0.75 : 1;
}

function getOfflineCap() {
  return prestigeSet.has('p7') ? 43200 : OFFLINE_CAP_BASE;
}

// Full multiplier shared by all sources (global upgrades × prestige global × synergy)
function getSharedMult() {
  return getGlobalUpgradeMult() * getPrestigeGlobalMult() * getSynergyMult();
}

function getGenRate(idx) {
  const count = state.genCounts[idx];
  if (count === 0) return 0;
  const def = GEN_DEFS[idx];
  return count * def.baseRate * getMilestoneMult(count) * getUpgradeMultForGen(def.id) * getSharedMult();
}

function getVoidRate() {
  if (!prestigeSet.has('p13') || state.voidCount === 0) return 0;
  const ecPower = Math.max(1, state.totalECEarned);
  return state.voidCount * 1e-8 * Math.sqrt(ecPower) * getSharedMult();
}

function getTotalRate() {
  let rate = BASE_RATE * getPrestigeBaseMult() * getSharedMult();
  for (let i = 0; i < GEN_DEFS.length; i++) rate += getGenRate(i);
  rate += getVoidRate();
  return rate;
}

// ============================================================
// PRESTIGE CALCULATION
// ============================================================

function calcECGained() {
  if (state.runWarmth < PRESTIGE_THRESHOLD) return 0;
  let bonus = 1;
  if (prestigeSet.has('p6')) bonus += 0.15;
  return Math.max(1, Math.floor(Math.sqrt(state.runWarmth / 1e10) * bonus));
}

// ============================================================
// PURCHASE FUNCTIONS
// ============================================================

function buyGenerator(idx) {
  const cost = getGenCost(idx);
  if (state.warmth < cost) return;
  state.warmth -= cost;
  state.genCounts[idx]++;
  updateUI();
}

function buyVoidNexus() {
  if (!prestigeSet.has('p13')) return;
  const cost = getVoidCost();
  if (state.warmth < cost) return;
  state.warmth -= cost;
  state.voidCount++;
  updateUI();
}

function buyUpgrade(id) {
  const def = UPGRADE_DEFS.find(u => u.id === id);
  if (!def || upgradeSet.has(id)) return;
  const actualCost = def.cost * getUpgradeCostDiscount();
  if (state.warmth < actualCost) return;
  state.warmth -= actualCost;
  state.upgrades.push(id);
  upgradeSet.add(id);
  updateUI();
}

function buyPrestigeUpgrade(id) {
  const def = PRESTIGE_DEF.find(p => p.id === id);
  if (!def || prestigeSet.has(id)) return;
  if (state.emberCores < def.cost) return;
  state.emberCores -= def.cost;
  state.prestigeUpgrades.push(id);
  prestigeSet.add(id);
  showNotification('Unlocked: ' + def.name, true);
  updateUI();
}

// ============================================================
// PRESTIGE
// ============================================================

function openPrestigeModal() {
  const ec = calcECGained();
  document.getElementById('modal-ec').textContent = formatNum(ec) + ' Ember Core' + (ec !== 1 ? 's' : '');
  document.getElementById('overlay').classList.remove('hidden');
  document.getElementById('modal').classList.remove('hidden');
}

function cancelPrestige() {
  document.getElementById('overlay').classList.add('hidden');
  document.getElementById('modal').classList.add('hidden');
}

function executePrestige() {
  cancelPrestige();
  const ec = calcECGained();
  if (ec <= 0) return;

  state.emberCores    += ec;
  state.totalECEarned += ec;
  state.prestigeCount++;

  // Reset run
  state.warmth     = 0;
  state.runWarmth  = 0;
  state.genCounts  = new Array(GEN_DEFS.length).fill(0);
  state.voidCount  = 0;
  state.upgrades   = [];
  upgradeSet.clear();

  // Apply "start with X generators" prestige perks
  for (const p of PRESTIGE_DEF) {
    if (p.type === 'startGen' && prestigeSet.has(p.id)) {
      const idx = GEN_DEFS.findIndex(g => g.id === p.genId);
      if (idx >= 0) state.genCounts[idx] = Math.max(state.genCounts[idx], p.val);
    }
  }

  showNotification('Prestige #' + state.prestigeCount + '! Gained ' + ec + ' Ember Core' + (ec !== 1 ? 's' : '') + '.', true);
  updateUI();
}

// ============================================================
// SAVE / LOAD / RESET
// ============================================================

function saveGame() {
  try {
    const save = Object.assign({}, state, { lastTick: Date.now() });
    localStorage.setItem('epoch_v1', JSON.stringify(save));
  } catch(e) { console.error('Save failed', e); }
}

function loadGame() {
  try {
    const raw = localStorage.getItem('epoch_v1');
    if (!raw) return false;
    const d = JSON.parse(raw);

    state.warmth          = d.warmth          || 0;
    state.runWarmth       = d.runWarmth        || 0;
    state.allTimeWarmth   = d.allTimeWarmth    || 0;
    state.prestigeCount   = d.prestigeCount    || 0;
    state.emberCores      = d.emberCores       || 0;
    state.totalECEarned   = d.totalECEarned    || 0;
    state.genCounts       = d.genCounts        || new Array(GEN_DEFS.length).fill(0);
    state.voidCount       = d.voidCount        || 0;
    state.upgrades        = d.upgrades         || [];
    state.prestigeUpgrades= d.prestigeUpgrades || [];
    state.sessionStart    = Date.now();
    syncSets();

    // Offline progress
    if (d.lastTick) {
      const offSec = Math.min((Date.now() - d.lastTick) / 1000, getOfflineCap());
      if (offSec > 2) {
        const earned = getTotalRate() * offSec;
        state.warmth        += earned;
        state.runWarmth     += earned;
        state.allTimeWarmth += earned;
        if (offSec > 60) showOfflineMsg(offSec, earned);
      }
    }
    return true;
  } catch(e) {
    console.error('Load failed', e);
    return false;
  }
}

function confirmReset() {
  if (confirm('Hard reset all progress? This cannot be undone.')) {
    localStorage.removeItem('epoch_v1');
    state = freshState();
    syncSets();
    buildGeneratorUI();
    buildUpgradeUI();
    buildPrestigeUpgradeUI();
    updateUI();
    showNotification('Game reset.');
  }
}

function showOfflineMsg(seconds, earned) {
  showNotification('Welcome back! Earned ' + formatNum(earned) + ' W in ' + formatTime(seconds) + ' offline.');
}

// ============================================================
// NOTIFICATION
// ============================================================

let notifTimer = null;
function showNotification(msg, isEmber) {
  const el = document.getElementById('notification');
  el.textContent = msg;
  el.className = 'notification' + (isEmber ? ' ember-note' : '');
  if (notifTimer) clearTimeout(notifTimer);
  notifTimer = setTimeout(() => { el.classList.add('hidden'); }, 4000);
}

// ============================================================
// UI — STATIC BUILDERS (called once or on prestige)
// ============================================================

function buildGeneratorUI() {
  const list = document.getElementById('gen-list');
  list.innerHTML = '';
  GEN_DEFS.forEach((def, idx) => {
    const card = document.createElement('div');
    card.className = 'gen-card locked';
    card.id = 'gen-card-' + idx;
    card.innerHTML = `
      <div class="gen-name">${def.name}</div>
      <div class="gen-count" id="gc-count-${idx}">0</div>
      <div class="gen-desc">${def.desc}</div>
      <div class="gen-contrib" id="gc-contrib-${idx}">+0/s</div>
      <div class="gen-cost">Next: <span class="cost-val" id="gc-cost-${idx}">-</span></div>
      <div class="gen-buy">
        <button class="btn-buy" id="gc-btn-${idx}" onclick="buyGenerator(${idx})" disabled>Buy</button>
      </div>`;
    list.appendChild(card);
  });

  // Void Nexus card
  const vn = document.getElementById('void-nexus-item');
  vn.innerHTML = `
    <div class="gen-card" id="gen-card-void">
      <div class="gen-name">${VOID_NEXUS.name}</div>
      <div class="gen-count" id="gc-count-void">0</div>
      <div class="gen-desc">${VOID_NEXUS.desc}</div>
      <div class="gen-contrib" id="gc-contrib-void">+0/s</div>
      <div class="gen-cost">Next: <span class="cost-val" id="gc-cost-void">-</span></div>
      <div class="gen-buy">
        <button class="btn-buy" id="gc-btn-void" onclick="buyVoidNexus()">Buy</button>
      </div>
    </div>`;
}

function buildUpgradeUI() {
  const list = document.getElementById('upgrade-list');
  list.innerHTML = '';
  UPGRADE_DEFS.forEach(def => {
    const card = document.createElement('div');
    card.className = 'upgrade-card';
    card.id = 'up-card-' + def.id;
    card.innerHTML = `
      <div class="up-name" id="up-name-${def.id}">${def.name}</div>
      <div class="up-cost" id="up-cost-${def.id}">${formatNum(def.cost)} W</div>
      <div class="up-desc">${def.desc}</div>
      <div class="up-buy">
        <button class="btn-buy" id="up-btn-${def.id}" onclick="buyUpgrade('${def.id}')">Buy</button>
      </div>`;
    list.appendChild(card);
  });
}

function buildPrestigeUpgradeUI() {
  const list = document.getElementById('prestige-upgrade-list');
  list.innerHTML = '';
  PRESTIGE_DEF.forEach(def => {
    const card = document.createElement('div');
    card.className = 'pu-card';
    card.id = 'pu-card-' + def.id;
    card.innerHTML = `
      <div class="pu-name" id="pu-name-${def.id}">${def.name}</div>
      <div class="pu-ec"  id="pu-ec-${def.id}">${def.cost} EC</div>
      <div class="pu-desc">${def.desc}</div>
      <div class="pu-buy">
        <button class="btn-buy ember-btn" id="pu-btn-${def.id}" onclick="buyPrestigeUpgrade('${def.id}')">Buy</button>
      </div>`;
    list.appendChild(card);
  });
}

// ============================================================
// UI — DYNAMIC UPDATES (called every tick)
// ============================================================

// Track which generators have been "seen" (unlocked display)
const seenGens = new Set();

function updateUI() {
  const rate = getTotalRate();
  const warmth = state.warmth;

  // Topbar
  document.getElementById('warmth-val').textContent = formatNum(warmth) + ' W';
  document.getElementById('rate-val').textContent   = formatNum(rate) + '/s';
  if (state.prestigeCount > 0 || state.emberCores > 0) {
    document.getElementById('ec-block').classList.remove('hidden');
    document.getElementById('ec-val').textContent = formatNum(state.emberCores);
  }

  // Generators panel
  updateGenerators(warmth, rate);

  // Right panel (active tab only for perf)
  const activeTab = document.querySelector('.tab-btn.active');
  const tabId = activeTab ? activeTab.dataset.tab : 'upgrades';

  if (tabId === 'upgrades') updateUpgrades(warmth);
  if (tabId === 'prestige') updatePrestigeTab(warmth);
  if (tabId === 'stats')    updateStats(rate);
}

function updateGenerators(warmth, totalRate) {
  GEN_DEFS.forEach((def, idx) => {
    const count = state.genCounts[idx];
    const cost  = getGenCost(idx);
    const contrib = getGenRate(idx);

    // Show generator once previous tier has been purchased
    const isVisible = idx === 0 || state.genCounts[idx - 1] > 0 || count > 0;
    if (isVisible && !seenGens.has(idx)) seenGens.add(idx);
    const visible = seenGens.has(idx);

    const card = document.getElementById('gen-card-' + idx);
    if (!card) return;

    if (!visible) {
      card.classList.add('locked');
      return;
    }
    card.classList.remove('locked');

    const canAfford = warmth >= cost;
    card.classList.toggle('affordable', canAfford);

    document.getElementById('gc-count-'  + idx).textContent = count;
    document.getElementById('gc-contrib-'+ idx).textContent = '+' + formatNum(contrib) + '/s';
    document.getElementById('gc-cost-'   + idx).textContent = formatNum(cost) + ' W';

    const btn = document.getElementById('gc-btn-' + idx);
    btn.disabled = !canAfford;
  });

  // Void Nexus
  const voidVisible = prestigeSet.has('p13');
  const vnSection = document.getElementById('void-nexus-section');
  if (voidVisible) {
    vnSection.classList.remove('hidden');
    const vCost    = getVoidCost();
    const vContrib = getVoidRate();
    const canAfford = warmth >= vCost;
    const vCard = document.getElementById('gen-card-void');
    if (vCard) vCard.classList.toggle('affordable', canAfford);
    document.getElementById('gc-count-void').textContent   = state.voidCount;
    document.getElementById('gc-contrib-void').textContent = '+' + formatNum(vContrib) + '/s';
    document.getElementById('gc-cost-void').textContent    = formatNum(vCost) + ' W';
    const vBtn = document.getElementById('gc-btn-void');
    if (vBtn) vBtn.disabled = !canAfford;
  } else {
    vnSection.classList.add('hidden');
  }
}

function updateUpgrades(warmth) {
  const discount = getUpgradeCostDiscount();
  let anyVisible = false;

  UPGRADE_DEFS.forEach(def => {
    const card = document.getElementById('up-card-' + def.id);
    if (!card) return;

    // Check requirements
    const reqMet = Object.entries(def.req).every(([genId, minCount]) => getGenCount(genId) >= minCount);
    const purchased = upgradeSet.has(def.id);
    const actualCost = def.cost * discount;

    if (!reqMet && !purchased) {
      card.classList.add('hidden');
      return;
    }
    card.classList.remove('hidden');
    anyVisible = true;

    const nameEl = document.getElementById('up-name-' + def.id);
    const costEl = document.getElementById('up-cost-' + def.id);
    const btn    = document.getElementById('up-btn-'  + def.id);

    if (purchased) {
      card.classList.add('purchased');
      card.classList.remove('affordable');
      nameEl.classList.add('purchased-text');
      costEl.classList.add('purchased-text');
      costEl.textContent = 'Purchased';
      btn.disabled = true;
      btn.textContent = '\u2713';
    } else {
      card.classList.remove('purchased');
      nameEl.classList.remove('purchased-text');
      costEl.classList.remove('purchased-text');
      costEl.textContent = formatNum(actualCost) + ' W';
      const canAfford = warmth >= actualCost;
      card.classList.toggle('affordable', canAfford);
      btn.disabled = !canAfford;
      btn.textContent = 'Buy';
    }
  });

  document.getElementById('upgrade-empty').classList.toggle('hidden', anyVisible);
}

function updatePrestigeTab(warmth) {
  const ec      = calcECGained();
  const prog    = Math.min(state.runWarmth / PRESTIGE_THRESHOLD, 1);
  const pct     = (prog * 100).toFixed(2);

  document.getElementById('pi-run').textContent      = formatNum(state.runWarmth) + ' W';
  document.getElementById('pi-threshold').textContent= formatNum(PRESTIGE_THRESHOLD) + ' W';
  document.getElementById('prestige-bar').style.width= pct + '%';
  document.getElementById('pi-pct').textContent      = pct + '%';
  document.getElementById('pi-ec-gain').textContent  = ec + (ec > 0 ? ' EC' : ' EC (need more warmth)');

  const canPrestige = ec > 0;
  document.getElementById('prestige-btn').disabled = !canPrestige;

  // Show prestige upgrades section once player has EC
  const hasSomething = state.emberCores > 0 || state.prestigeCount > 0;
  document.getElementById('prestige-upgrades-section').classList.toggle('hidden', !hasSomething);

  if (hasSomething) updatePrestigeUpgrades();
}

function updatePrestigeUpgrades() {
  PRESTIGE_DEF.forEach(def => {
    const card = document.getElementById('pu-card-' + def.id);
    if (!card) return;

    const purchased = prestigeSet.has(def.id);
    const canAfford = state.emberCores >= def.cost;

    const nameEl = document.getElementById('pu-name-' + def.id);
    const ecEl   = document.getElementById('pu-ec-'   + def.id);
    const btn    = document.getElementById('pu-btn-'  + def.id);

    if (purchased) {
      card.classList.add('purchased');
      card.classList.remove('affordable');
      nameEl.classList.add('purchased-text');
      ecEl.classList.add('purchased-text');
      ecEl.textContent  = 'Owned';
      btn.disabled = true;
      btn.textContent = '\u2713';
    } else {
      card.classList.remove('purchased');
      nameEl.classList.remove('purchased-text');
      ecEl.classList.remove('purchased-text');
      ecEl.textContent = def.cost + ' EC';
      card.classList.toggle('affordable', canAfford);
      btn.disabled = !canAfford;
      btn.textContent = 'Buy';
    }
  });
}

function updateStats(rate) {
  const elapsed = (Date.now() - state.sessionStart) / 1000;
  const totalGens = state.genCounts.reduce((a, b) => a + b, 0) + state.voidCount;

  document.getElementById('st-run').textContent     = formatNum(state.runWarmth) + ' W';
  document.getElementById('st-ever').textContent    = formatNum(state.allTimeWarmth) + ' W';
  document.getElementById('st-rate').textContent    = formatNum(rate) + '/s';
  document.getElementById('st-prestige').textContent= state.prestigeCount;
  document.getElementById('st-ec').textContent      = formatNum(state.emberCores);
  document.getElementById('st-ec-total').textContent= formatNum(state.totalECEarned);
  document.getElementById('st-gens').textContent    = totalGens;
  document.getElementById('st-ups').textContent     = state.upgrades.length;
  document.getElementById('st-session').textContent = formatTime(elapsed);
}

// Tab switching
function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  updateUI();
}

// ============================================================
// GAME LOOP
// ============================================================

let lastTickTime = Date.now();

function tick() {
  const now = Date.now();
  const dt  = Math.min((now - lastTickTime) / 1000, 5); // cap at 5s to avoid spiral
  lastTickTime = now;

  if (dt > 0) {
    const earned = getTotalRate() * dt;
    state.warmth        += earned;
    state.runWarmth     += earned;
    state.allTimeWarmth += earned;
  }

  updateUI();
}

// ============================================================
// INIT
// ============================================================

function init() {
  buildGeneratorUI();
  buildUpgradeUI();
  buildPrestigeUpgradeUI();

  loadGame();
  updateUI();

  setInterval(tick, TICK_MS);
  setInterval(saveGame, AUTOSAVE_MS);
}

init();
