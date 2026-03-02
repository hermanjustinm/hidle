const TICK_MS = 250;
const SAVE_KEY = "starlight-foundry-save-v4";

const state = {
  flux: 0,
  lifetime: 0,
  clicks: 0,
  playedMs: 0,
  lastTick: Date.now(),
  prestiges: 0,
  fragments: 0,
  generators: [
    { id: "drone", name: "Collector Drone", amount: 0, baseRate: 0.2, baseCost: 12, growth: 1.17, unlockAt: 0, desc: "Entry-level passive collection." },
    { id: "reactor", name: "Spark Reactor", amount: 0, baseRate: 1.1, baseCost: 140, growth: 1.2, unlockAt: 80, desc: "Stable but slower scaling." },
    { id: "array", name: "Solar Array", amount: 0, baseRate: 5.5, baseCost: 1200, growth: 1.23, unlockAt: 600, desc: "Consistent mid-game production." },
    { id: "lab", name: "Quantum Lab", amount: 0, baseRate: 24, baseCost: 9800, growth: 1.25, unlockAt: 4000, desc: "Research-driven throughput." },
    { id: "forge", name: "Orbital Forge", amount: 0, baseRate: 110, baseCost: 85000, growth: 1.28, unlockAt: 30000, desc: "Strong long-session AFK gains." },
    { id: "rift", name: "Rift Harvester", amount: 0, baseRate: 450, baseCost: 700000, growth: 1.31, unlockAt: 200000, desc: "Late-game specialization." },
  ],
  boosters: [
    { id: "alg", name: "Optimization Algorithms", level: 0, max: 20, mult: 0.05, baseCost: 70, growth: 1.34, unlockAt: 60, desc: "+5% all production per level." },
    { id: "mesh", name: "Nanite Mesh", level: 0, max: 15, mult: 0.1, baseCost: 650, growth: 1.42, unlockAt: 500, desc: "+10% all production per level." },
    { id: "sync", name: "Temporal Sync", level: 0, max: 10, mult: 0.18, baseCost: 6200, growth: 1.52, unlockAt: 3500, desc: "+18% all production per level." },
    { id: "sing", name: "Singularity Core", level: 0, max: 7, mult: 0.32, baseCost: 58000, growth: 1.64, unlockAt: 28000, desc: "+32% all production per level." },
  ],
};

const milestones = [10, 30, 80, 200, 600, 1500, 5000, 15000, 60000, 250000, 900000, 4_000_000];

const el = {
  flux: document.getElementById("fluxValue"),
  perSecond: document.getElementById("perSecond"),
  tap: document.getElementById("tapButton"),
  generators: document.getElementById("generatorList"),
  boosters: document.getElementById("boosterList"),
  milestones: document.getElementById("milestoneList"),
  lifetime: document.getElementById("lifetimeValue"),
  clicks: document.getElementById("clicksValue"),
  time: document.getElementById("timeValue"),
  prestige: document.getElementById("prestigeValue"),
  fragments: document.getElementById("fragmentsValue"),
  next: document.getElementById("nextUnlockValue"),
};

function fmt(v) {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v);
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
  return 1 + state.fragments * 0.08;
}

function productionMultiplier() {
  const boosterMult = state.boosters.reduce((a, b) => a * (1 + b.level * b.mult), 1);
  return boosterMult * prestigeBonus();
}

function productionPerSecond() {
  const baseline = 0.25;
  const structureBase = state.generators.reduce((a, g) => a + g.amount * g.baseRate, 0);
  return baseline + structureBase * productionMultiplier();
}

function clickPower() {
  return Math.max(1, Math.floor(1 + Math.sqrt(Math.max(0, state.fragments))));
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
  return state.lifetime >= 500_000;
}

function prestigeGain() {
  return Math.max(1, Math.floor(Math.sqrt(state.lifetime / 500_000)));
}

function itemCard({ title, meta, desc, buttons, locked }) {
  const btns = buttons
    .map((b) => `<button data-action="${b.action}" data-id="${b.id ?? ""}" data-bulk="${b.bulk ?? ""}" ${b.disabled ? "disabled" : ""}>${b.label}</button>`)
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
        meta: unlocked ? `+${fmt(g.baseRate * productionMultiplier())}/s each` : `Unlock at ${fmt(g.unlockAt)} Flux`,
        desc: g.desc,
        locked: !unlocked,
        buttons: [
          { action: "buy-generator", id: g.id, bulk: 1, label: unlocked ? `Buy 1 (${fmt(c1)})` : "Locked", disabled: !unlocked || state.flux < c1 },
          { action: "buy-generator", id: g.id, bulk: 10, label: unlocked ? `Buy 10 (${fmt(c10)})` : "Locked", disabled: !unlocked || state.flux < c10 },
        ],
      });
    })
    .join("");
}

function renderBoosters() {
  const cards = state.boosters
    .map((b) => {
      const unlocked = state.lifetime >= b.unlockAt;
      const cost = boostCost(b);
      const available = b.level < b.max;
      return itemCard({
        title: `${b.name} (Lv ${b.level}/${b.max})`,
        meta: unlocked ? `x${(1 + b.level * b.mult).toFixed(2)}` : `Unlock at ${fmt(b.unlockAt)} Flux`,
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

  const prestige = itemCard({
    title: `Stellar Prestige (${state.prestiges})`,
    meta: `Fragments: ${fmt(state.fragments)}`,
    desc: `Reset structures and research for permanent gains. Current multiplier: x${prestigeBonus().toFixed(2)}.`,
    locked: !canPrestige(),
    buttons: [
      {
        action: "prestige",
        label: canPrestige() ? `Prestige for +${fmt(prestigeGain())} Fragments` : "Need 500,000 total Flux",
        disabled: !canPrestige(),
      },
    ],
  });

  el.boosters.innerHTML = cards + prestige;
}

function renderMilestones() {
  el.milestones.innerHTML = milestones
    .map((m) => `<li class="${state.lifetime >= m ? "done" : ""}">${state.lifetime >= m ? "✓" : "○"} Reach ${fmt(m)} total Flux</li>`)
    .join("");
}

function renderStats() {
  const pps = productionPerSecond();
  el.flux.textContent = fmt(state.flux);
  el.perSecond.textContent = `+${fmt(pps)} / sec (gather +${fmt(clickPower())})`;
  el.lifetime.textContent = fmt(state.lifetime);
  el.clicks.textContent = String(state.clicks);
  el.time.textContent = `${Math.floor(state.playedMs / 1000)}s`;
  el.prestige.textContent = String(state.prestiges);
  el.fragments.textContent = fmt(state.fragments);
  const next = nextTarget();
  el.next.textContent = next ? fmt(next) : "All milestones reached";
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
  state.generators.forEach((g) => (g.amount = 0));
  state.boosters.forEach((b) => (b.level = 0));
}

function save() {
  const payload = {
    flux: state.flux,
    lifetime: state.lifetime,
    clicks: state.clicks,
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
    state.clicks = p.clicks ?? state.clicks;
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

el.tap.addEventListener("click", () => {
  const gain = clickPower();
  state.flux += gain;
  state.lifetime += gain;
  state.clicks += 1;
  renderAll();
});

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
