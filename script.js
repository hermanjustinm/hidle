const TICK_MS = 200;
const SAVE_KEY = "starlight-foundry-save-v3";

const state = {
  flux: 0,
  lifetime: 0,
  clicks: 0,
  playedMs: 0,
  lastTick: Date.now(),
  prestiges: 0,
  fragments: 0,
  overdriveUntil: 0,
  overdriveCooldownUntil: 0,
  generators: [
    { id: "drone", name: "Collector Drone", amount: 0, baseRate: 0.8, baseCost: 6, growth: 1.14, unlockAt: 0, desc: "Cheap starter worker." },
    { id: "reactor", name: "Spark Reactor", amount: 0, baseRate: 4.2, baseCost: 70, growth: 1.18, unlockAt: 25, desc: "Reliable early engine." },
    { id: "array", name: "Solar Array", amount: 0, baseRate: 20, baseCost: 520, growth: 1.22, unlockAt: 200, desc: "Bigger power, bigger climb." },
    { id: "lab", name: "Quantum Lab", amount: 0, baseRate: 95, baseCost: 4300, growth: 1.24, unlockAt: 1400, desc: "High-tech production lane." },
    { id: "forge", name: "Orbital Forge", amount: 0, baseRate: 460, baseCost: 36000, growth: 1.27, unlockAt: 12000, desc: "Serious AFK throughput." },
    { id: "rift", name: "Rift Harvester", amount: 0, baseRate: 2300, baseCost: 320000, growth: 1.31, unlockAt: 100000, desc: "Late game acceleration." },
  ],
  boosters: [
    { id: "alg", name: "Optimization Algorithms", level: 0, max: 25, mult: 0.07, baseCost: 30, growth: 1.31, unlockAt: 10, desc: "+7% all production per level." },
    { id: "mesh", name: "Nanite Mesh", level: 0, max: 18, mult: 0.13, baseCost: 260, growth: 1.39, unlockAt: 160, desc: "+13% all production per level." },
    { id: "sync", name: "Temporal Sync", level: 0, max: 12, mult: 0.25, baseCost: 2200, growth: 1.48, unlockAt: 1300, desc: "+25% all production per level." },
    { id: "sing", name: "Singularity Core", level: 0, max: 8, mult: 0.45, baseCost: 24000, growth: 1.6, unlockAt: 14000, desc: "+45% all production per level." },
  ],
};

const milestones = [10, 30, 80, 200, 600, 1500, 5000, 15000, 60000, 250000, 1_000_000, 6_000_000, 30_000_000];

const el = {
  flux: document.getElementById("fluxValue"),
  perSecond: document.getElementById("perSecond"),
  tap: document.getElementById("tapButton"),
  generators: document.getElementById("generatorList"),
  boosters: document.getElementById("boosterList"),
  abilities: document.getElementById("abilityList"),
  milestones: document.getElementById("milestoneList"),
  lifetime: document.getElementById("lifetimeValue"),
  clicks: document.getElementById("clicksValue"),
  time: document.getElementById("timeValue"),
  prestige: document.getElementById("prestigeValue"),
  fragments: document.getElementById("fragmentsValue"),
  next: document.getElementById("nextUnlockValue"),
};

function fmt(v) {
  if (v < 1000) return v.toFixed(1).replace(/\.0$/, "");
  const units = ["K", "M", "B", "T", "Qa", "Qi", "Sx"];
  let value = v;
  let idx = -1;
  while (value >= 1000 && idx < units.length - 1) {
    value /= 1000;
    idx += 1;
  }
  return `${value.toFixed(2)}${units[idx]}`;
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
  return 1 + state.fragments * 0.12;
}

function overdriveActive() {
  return Date.now() < state.overdriveUntil;
}

function overdriveReady() {
  return Date.now() >= state.overdriveCooldownUntil;
}

function productionMultiplier() {
  const boosterMult = state.boosters.reduce((a, b) => a * (1 + b.level * b.mult), 1);
  const overdriveMult = overdriveActive() ? 3 : 1;
  return boosterMult * prestigeBonus() * overdriveMult;
}

function productionPerSecond() {
  const baseline = 1; // guarantees visible tick-up at least once per second
  const structureBase = state.generators.reduce((a, g) => a + g.amount * g.baseRate, 0);
  return baseline + structureBase * productionMultiplier();
}

function clickPower() {
  const structureWeight = Math.sqrt(Math.max(1, state.generators.reduce((a, g) => a + g.amount, 0)));
  return Math.max(1, Math.floor(structureWeight * prestigeBonus()));
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
  return state.lifetime >= 400_000;
}

function prestigeGain() {
  return Math.max(1, Math.floor(Math.sqrt(state.lifetime / 400_000)));
}

function itemCard(title, meta, desc, buttons) {
  const btns = buttons
    .map(
      (b) => `<button data-action="${b.action}" data-id="${b.id ?? ""}" data-bulk="${b.bulk ?? ""}" ${b.disabled ? "disabled" : ""}>${b.label}</button>`,
    )
    .join("");
  return `<div class="item"><div class="item-head"><strong>${title}</strong><span>${meta}</span></div><p>${desc}</p><div class="item-actions">${btns}</div></div>`;
}

function renderGenerators() {
  el.generators.innerHTML = state.generators
    .filter((g) => state.lifetime >= g.unlockAt)
    .map((g) => {
      const c1 = genCost(g, 1);
      const c10 = genCost(g, 10);
      return itemCard(
        `${g.name} (${g.amount})`,
        `+${fmt(g.baseRate * productionMultiplier())}/s each`,
        g.desc,
        [
          { action: "buy-generator", id: g.id, bulk: 1, label: `Buy 1 (${fmt(c1)})`, disabled: state.flux < c1 },
          { action: "buy-generator", id: g.id, bulk: 10, label: `Buy 10 (${fmt(c10)})`, disabled: state.flux < c10 },
        ],
      );
    })
    .join("");
}

function renderBoosters() {
  const boosterCards = state.boosters
    .filter((b) => state.lifetime >= b.unlockAt)
    .map((b) => {
      const cost = boostCost(b);
      const available = b.level < b.max;
      return itemCard(
        `${b.name} (Lv ${b.level}/${b.max})`,
        `x${(1 + b.level * b.mult).toFixed(2)}`,
        b.desc,
        [{ action: "buy-booster", id: b.id, label: available ? `Upgrade (${fmt(cost)})` : "MAXED", disabled: !available || state.flux < cost }],
      );
    })
    .join("");

  const prestigeCard = itemCard(
    `Stellar Prestige (${state.prestiges})`,
    `Fragments: ${state.fragments}`,
    `Reset structures/research to gain permanent multiplier. Current bonus: x${prestigeBonus().toFixed(2)}.`,
    [
      {
        action: "prestige",
        label: canPrestige() ? `Prestige for +${prestigeGain()} Fragments` : "Need 400K total Flux",
        disabled: !canPrestige(),
      },
    ],
  );

  el.boosters.innerHTML = boosterCards + prestigeCard;
}

function renderAbilities() {
  const overdriveLeft = Math.max(0, state.overdriveUntil - Date.now());
  const cooldownLeft = Math.max(0, state.overdriveCooldownUntil - Date.now());

  const text = overdriveActive()
    ? `ACTIVE for ${(overdriveLeft / 1000).toFixed(1)}s (x3 production)`
    : overdriveReady()
      ? "Ready"
      : `Cooldown ${(cooldownLeft / 1000).toFixed(1)}s`;

  el.abilities.innerHTML = itemCard(
    "Overdrive Burst",
    text,
    "x3 production for 10 seconds. 45 second cooldown. Great for timed buys.",
    [{ action: "overdrive", label: overdriveReady() ? "Activate" : "Cooling Down", disabled: !overdriveReady() }],
  );
}

function renderMilestones() {
  el.milestones.innerHTML = milestones
    .map((m) => `<li class="${state.lifetime >= m ? "done" : ""}">${state.lifetime >= m ? "✓" : "○"} Reach ${fmt(m)} total Flux</li>`)
    .join("");
}

function renderStats() {
  const pps = productionPerSecond();
  el.flux.textContent = fmt(state.flux);
  el.perSecond.textContent = `+${fmt(pps)} / sec (gather +${clickPower()})`;
  el.lifetime.textContent = fmt(state.lifetime);
  el.clicks.textContent = String(state.clicks);
  el.time.textContent = `${Math.floor(state.playedMs / 1000)}s`;
  el.prestige.textContent = String(state.prestiges);
  el.fragments.textContent = String(state.fragments);
  const next = nextTarget();
  el.next.textContent = next ? fmt(next) : "You are in deep-end scaling now";
}

function renderAll() {
  renderStats();
  renderGenerators();
  renderBoosters();
  renderAbilities();
  renderMilestones();
}

function buyGenerator(id, bulk) {
  const g = state.generators.find((x) => x.id === id);
  if (!g) return;
  const cost = genCost(g, bulk);
  if (state.flux < cost) return;
  state.flux -= cost;
  g.amount += bulk;
}

function buyBooster(id) {
  const b = state.boosters.find((x) => x.id === id);
  if (!b || b.level >= b.max) return;
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

function activateOverdrive() {
  if (!overdriveReady()) return;
  const now = Date.now();
  state.overdriveUntil = now + 10_000;
  state.overdriveCooldownUntil = now + 45_000;
}

function save() {
  const payload = {
    flux: state.flux,
    lifetime: state.lifetime,
    clicks: state.clicks,
    playedMs: state.playedMs,
    prestiges: state.prestiges,
    fragments: state.fragments,
    overdriveUntil: state.overdriveUntil,
    overdriveCooldownUntil: state.overdriveCooldownUntil,
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
    state.overdriveUntil = p.overdriveUntil ?? 0;
    state.overdriveCooldownUntil = p.overdriveCooldownUntil ?? 0;
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
  const action = btn.dataset.action;
  if (action === "buy-generator") buyGenerator(btn.dataset.id, Number(btn.dataset.bulk));
  if (action === "buy-booster") buyBooster(btn.dataset.id);
  if (action === "prestige") doPrestige();
  if (action === "overdrive") activateOverdrive();
  renderAll();
}

el.generators.addEventListener("click", handleActionClick);
el.boosters.addEventListener("click", handleActionClick);
el.abilities.addEventListener("click", handleActionClick);

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
