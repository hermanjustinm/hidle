const TICK_MS = 200;
const SAVE_KEY = "starlight-foundry-save-v5";

const STARTING_RATE = 0.00001;

const state = {
  flux: 0,
  lifetime: 0,
  playedMs: 0,
  lastTick: Date.now(),
  prestiges: 0,
  fragments: 0,
  generators: [
    { id: "collector", name: "Dust Collector", amount: 0, baseRate: 0.00005, baseCost: 0.00030, growth: 1.16, unlockAt: 0.0, desc: "First passive collector." },
    { id: "refiner", name: "Flux Refiner", amount: 0, baseRate: 0.00030, baseCost: 0.00400, growth: 1.18, unlockAt: 0.00100, desc: "Refines ambient particles." },
    { id: "array", name: "Harmonic Array", amount: 0, baseRate: 0.00180, baseCost: 0.05000, growth: 1.2, unlockAt: 0.01200, desc: "Stabilizes background generation." },
    { id: "reactor", name: "Micro Reactor", amount: 0, baseRate: 0.01000, baseCost: 0.75000, growth: 1.22, unlockAt: 0.12000, desc: "Sustained idle throughput." },
    { id: "matrix", name: "Lattice Matrix", amount: 0, baseRate: 0.05500, baseCost: 8.00000, growth: 1.24, unlockAt: 1.00000, desc: "Mid-run production backbone." },
    { id: "forge", name: "Stellar Forge", amount: 0, baseRate: 0.30000, baseCost: 95.00000, growth: 1.27, unlockAt: 12.00000, desc: "Long-session engine." },
  ],
  boosters: [
    { id: "opt", name: "Process Optimization", level: 0, max: 20, mult: 0.06, baseCost: 0.00300, growth: 1.26, unlockAt: 0.00080, desc: "+6% all production per level." },
    { id: "mesh", name: "Nanite Mesh", level: 0, max: 15, mult: 0.11, baseCost: 0.04000, growth: 1.32, unlockAt: 0.00800, desc: "+11% all production per level." },
    { id: "sync", name: "Temporal Sync", level: 0, max: 12, mult: 0.18, baseCost: 0.60000, growth: 1.4, unlockAt: 0.08000, desc: "+18% all production per level." },
    { id: "core", name: "Singularity Core", level: 0, max: 8, mult: 0.3, baseCost: 7.50000, growth: 1.5, unlockAt: 0.90000, desc: "+30% all production per level." },
  ],
};

const milestones = [
  0.001, 0.005, 0.02, 0.08, 0.3, 1.0, 3.0, 10.0, 40.0, 150.0, 500.0, 2000.0,
];

const el = {
  flux: document.getElementById("fluxValue"),
  perSecond: document.getElementById("perSecond"),
  generators: document.getElementById("generatorList"),
  boosters: document.getElementById("boosterList"),
  milestones: document.getElementById("milestoneList"),
  lifetime: document.getElementById("lifetimeValue"),
  time: document.getElementById("timeValue"),
  prestige: document.getElementById("prestigeValue"),
  fragments: document.getElementById("fragmentsValue"),
  next: document.getElementById("nextUnlockValue"),
};

function fmt(v) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 5,
    maximumFractionDigits: 5,
  }).format(v);
}

function genCost(g, bulk = 1) {
  let total = 0;
  for (let i = 0; i < bulk; i += 1) total += g.baseCost * g.growth ** (g.amount + i);
  return total;
}

function boostCost(b) {
  return b.baseCost * b.growth ** b.level;
}

function prestigeBonus() {
  return 1 + state.fragments * 0.05;
}

function productionMultiplier() {
  const researchMult = state.boosters.reduce((acc, b) => acc * (1 + b.level * b.mult), 1);
  return researchMult * prestigeBonus();
}

function productionPerSecond() {
  const structureRate = state.generators.reduce((acc, g) => acc + g.amount * g.baseRate, 0);
  return STARTING_RATE + structureRate * productionMultiplier();
}

function nextTarget() {
  const goals = [
    ...state.generators.filter((g) => state.lifetime < g.unlockAt).map((g) => g.unlockAt),
    ...state.boosters.filter((b) => state.lifetime < b.unlockAt).map((b) => b.unlockAt),
    ...milestones.filter((m) => state.lifetime < m),
  ].sort((a, b) => a - b);
  return goals[0] ?? null;
}

function canPrestige() {
  return state.lifetime >= 50;
}

function prestigeGain() {
  return Math.max(1, Math.floor(Math.sqrt(state.lifetime / 50)));
}

function itemCard({ title, meta, desc, buttons, locked }) {
  const btns = buttons
    .map(
      (b) =>
        `<button data-action="${b.action}" data-id="${b.id ?? ""}" data-bulk="${b.bulk ?? ""}" ${
          b.disabled ? "disabled" : ""
        }>${b.label}</button>`,
    )
    .join("");
  return `<div class="item ${locked ? "locked" : ""}"><div class="item-head"><strong>${title}</strong><span>${meta}</span></div><p>${desc}</p><div class="item-actions">${btns}</div></div>`;
}

function renderGenerators() {
  el.generators.innerHTML = state.generators
    .map((g) => {
      const unlocked = state.lifetime >= g.unlockAt;
      const c1 = genCost(g, 1);
      const c10 = genCost(g, 10);
      return itemCard({
        title: `${g.name} (${g.amount})`,
        meta: unlocked ? `+${fmt(g.baseRate * productionMultiplier())}/sec each` : `Unlock at ${fmt(g.unlockAt)}`,
        desc: g.desc,
        locked: !unlocked,
        buttons: [
          {
            action: "buy-generator",
            id: g.id,
            bulk: 1,
            label: unlocked ? `Buy 1 (${fmt(c1)})` : "Locked",
            disabled: !unlocked || state.flux < c1,
          },
          {
            action: "buy-generator",
            id: g.id,
            bulk: 10,
            label: unlocked ? `Buy 10 (${fmt(c10)})` : "Locked",
            disabled: !unlocked || state.flux < c10,
          },
        ],
      });
    })
    .join("");
}

function renderBoosters() {
  const researchCards = state.boosters
    .map((b) => {
      const unlocked = state.lifetime >= b.unlockAt;
      const available = b.level < b.max;
      const cost = boostCost(b);
      return itemCard({
        title: `${b.name} (Lv ${b.level}/${b.max})`,
        meta: unlocked ? `x${(1 + b.level * b.mult).toFixed(5)}` : `Unlock at ${fmt(b.unlockAt)}`,
        desc: b.desc,
        locked: !unlocked,
        buttons: [
          {
            action: "buy-booster",
            id: b.id,
            label: unlocked ? (available ? `Upgrade (${fmt(cost)})` : "MAXED") : "Locked",
            disabled: !unlocked || !available || state.flux < cost,
          },
        ],
      });
    })
    .join("");

  const prestigeCard = itemCard({
    title: `Stellar Prestige (${state.prestiges})`,
    meta: `Fragments: ${fmt(state.fragments)}`,
    desc: `Reset all structures/research for permanent scaling. Current multiplier: x${prestigeBonus().toFixed(5)}.`,
    locked: !canPrestige(),
    buttons: [
      {
        action: "prestige",
        label: canPrestige() ? `Prestige for +${fmt(prestigeGain())} Fragments` : "Need 50.00000 total Flux",
        disabled: !canPrestige(),
      },
    ],
  });

  el.boosters.innerHTML = researchCards + prestigeCard;
}

function renderMilestones() {
  el.milestones.innerHTML = milestones
    .map(
      (m) =>
        `<li class="${state.lifetime >= m ? "done" : ""}">${state.lifetime >= m ? "✓" : "○"} Reach ${fmt(
          m,
        )} total Flux</li>`,
    )
    .join("");
}

function renderStats() {
  const pps = productionPerSecond();
  el.flux.textContent = fmt(state.flux);
  el.perSecond.textContent = `+${fmt(pps)} / sec`;
  el.lifetime.textContent = fmt(state.lifetime);
  el.time.textContent = `${Math.floor(state.playedMs / 1000)}s`;
  el.prestige.textContent = String(state.prestiges);
  el.fragments.textContent = fmt(state.fragments);
  const next = nextTarget();
  el.next.textContent = next ? fmt(next) : "All milestone tracks complete";
}

function renderAll() {
  renderStats();
  renderGenerators();
  renderBoosters();
  renderMilestones();
}

function buyGenerator(id, bulk) {
  const g = state.generators.find((x) => x.id === id);
  if (!g || state.lifetime < g.unlockAt) return;
  const cost = genCost(g, bulk);
  if (state.flux < cost) return;
  state.flux -= cost;
  g.amount += bulk;
}

function buyBooster(id) {
  const b = state.boosters.find((x) => x.id === id);
  if (!b || state.lifetime < b.unlockAt || b.level >= b.max) return;
  const cost = boostCost(b);
  if (state.flux < cost) return;
  state.flux -= cost;
  b.level += 1;
}

function doPrestige() {
  if (!canPrestige()) return;
  state.fragments += prestigeGain();
  state.prestiges += 1;
  state.flux = 0;
  state.generators.forEach((g) => {
    g.amount = 0;
  });
  state.boosters.forEach((b) => {
    b.level = 0;
  });
}

function save() {
  const payload = {
    flux: state.flux,
    lifetime: state.lifetime,
    playedMs: state.playedMs,
    prestiges: state.prestiges,
    fragments: state.fragments,
    generators: state.generators.map((g) => ({ id: g.id, amount: g.amount })),
    boosters: state.boosters.map((b) => ({ id: b.id, level: b.level })),
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
}

function load() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return;
  try {
    const p = JSON.parse(raw);
    state.flux = p.flux ?? state.flux;
    state.lifetime = p.lifetime ?? state.lifetime;
    state.playedMs = p.playedMs ?? state.playedMs;
    state.prestiges = p.prestiges ?? state.prestiges;
    state.fragments = p.fragments ?? state.fragments;
    p.generators?.forEach((x) => {
      const g = state.generators.find((y) => y.id === x.id);
      if (g) g.amount = x.amount;
    });
    p.boosters?.forEach((x) => {
      const b = state.boosters.find((y) => y.id === x.id);
      if (b) b.level = x.level;
    });
  } catch {
    localStorage.removeItem(SAVE_KEY);
  }
}

function handleActionClick(e) {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  if (btn.dataset.action === "buy-generator") buyGenerator(btn.dataset.id, Number(btn.dataset.bulk));
  if (btn.dataset.action === "buy-booster") buyBooster(btn.dataset.id);
  if (btn.dataset.action === "prestige") doPrestige();
  renderAll();
}

el.generators.addEventListener("click", handleActionClick);
el.boosters.addEventListener("click", handleActionClick);

function tick() {
  const now = Date.now();
  const dt = Math.min((now - state.lastTick) / 1000, 2);
  state.lastTick = now;
  state.playedMs += dt * 1000;

  const gain = productionPerSecond() * dt;
  state.flux += gain;
  state.lifetime += gain;

  renderAll();
  save();
}

load();
renderAll();
setInterval(tick, TICK_MS);
