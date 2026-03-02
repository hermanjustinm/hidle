const TICK_MS = 250;
const SAVE_KEY = "just-one-more-tick-save-v2";

const state = {
  momentum: 0,
  lifetime: 0,
  clicks: 0,
  playedMs: 0,
  lastTick: performance.now(),
  rebirths: 0,
  insight: 0,
  generators: [
    { id: "toDo", name: "Tiny To-Do", amount: 0, baseCost: 8, growth: 1.16, baseRate: 0.4, unlockAt: 0, description: "A tiny trickle of productivity." },
    { id: "coffee", name: "Coffee Loop", amount: 0, baseCost: 65, growth: 1.19, baseRate: 2.5, unlockAt: 20, description: "Caffeine that keeps ticks alive." },
    { id: "automation", name: "Micro Automation", amount: 0, baseCost: 420, growth: 1.22, baseRate: 12, unlockAt: 120, description: "Script your way to one-more-task syndrome." },
    { id: "team", name: "Parallel Team", amount: 0, baseCost: 3500, growth: 1.24, baseRate: 55, unlockAt: 1000, description: "More checklists, more momentum." },
    { id: "cluster", name: "Idle Cluster", amount: 0, baseCost: 30000, growth: 1.27, baseRate: 250, unlockAt: 9000, description: "AFK progression machine." },
    { id: "pipeline", name: "Mega Pipeline", amount: 0, baseCost: 250000, growth: 1.31, baseRate: 1300, unlockAt: 80000, description: "Industrialized momentum farming." },
  ],
  boosters: [
    { id: "focus", name: "Focus Sprint", level: 0, maxLevel: 20, baseCost: 30, growth: 1.33, multiplierPerLevel: 0.08, unlockAt: 10, description: "Increase all production by 8% per level." },
    { id: "habit", name: "Atomic Habit", level: 0, maxLevel: 15, baseCost: 220, growth: 1.4, multiplierPerLevel: 0.15, unlockAt: 120, description: "Increase all production by 15% per level." },
    { id: "deepWork", name: "Deep Work Window", level: 0, maxLevel: 10, baseCost: 1800, growth: 1.5, multiplierPerLevel: 0.28, unlockAt: 900, description: "Increase all production by 28% per level." },
    { id: "flow", name: "Flow State", level: 0, maxLevel: 8, baseCost: 18000, growth: 1.65, multiplierPerLevel: 0.5, unlockAt: 10000, description: "Increase all production by 50% per level." },
  ],
};

const milestones = [10, 50, 120, 300, 750, 2_000, 7_000, 25_000, 90_000, 350_000, 1_200_000, 5_000_000, 30_000_000];

const elements = {
  momentum: document.getElementById("momentumValue"),
  perSecond: document.getElementById("perSecond"),
  tapButton: document.getElementById("tapButton"),
  producerList: document.getElementById("producerList"),
  boosterList: document.getElementById("boosterList"),
  milestoneList: document.getElementById("milestoneList"),
  lifetime: document.getElementById("lifetimeValue"),
  clicks: document.getElementById("clicksValue"),
  time: document.getElementById("timeValue"),
  nextUnlock: document.getElementById("nextUnlockValue"),
};

function formatNumber(value) {
  if (value < 1000) return value.toFixed(1).replace(/\.0$/, "");
  const units = ["K", "M", "B", "T", "Qa", "Qi", "Sx"];
  let scaled = value;
  let idx = -1;
  while (scaled >= 1000 && idx < units.length - 1) {
    scaled /= 1000;
    idx += 1;
  }
  return `${scaled.toFixed(2)}${units[idx]}`;
}

function generatorCost(generator, bulk = 1) {
  let total = 0;
  for (let i = 0; i < bulk; i += 1) {
    total += generator.baseCost * generator.growth ** (generator.amount + i);
  }
  return total;
}

function boosterCost(booster) {
  return booster.baseCost * booster.growth ** booster.level;
}

function rebirthBonus() {
  return 1 + state.insight * 0.15;
}

function productionMultiplier() {
  const boostMult = state.boosters.reduce((acc, booster) => acc * (1 + booster.level * booster.multiplierPerLevel), 1);
  return boostMult * rebirthBonus();
}

function productionPerSecond() {
  const base = state.generators.reduce((acc, generator) => acc + generator.amount * generator.baseRate, 0);
  return base * productionMultiplier();
}

function clickPower() {
  return Math.max(1, Math.floor(productionMultiplier()));
}

function nextUnlockTarget() {
  const unlocks = [
    ...state.generators.filter((x) => state.lifetime < x.unlockAt).map((x) => x.unlockAt),
    ...state.boosters.filter((x) => state.lifetime < x.unlockAt).map((x) => x.unlockAt),
    ...milestones.filter((x) => state.lifetime < x),
  ].sort((a, b) => a - b);

  return unlocks[0] ?? null;
}

function canRebirth() {
  return state.lifetime >= 250_000;
}

function rebirthGain() {
  return Math.floor(Math.sqrt(state.lifetime / 250_000));
}

function makeItem({ title, meta, description, actions }) {
  const wrap = document.createElement("div");
  wrap.className = "item";
  const head = document.createElement("div");
  head.className = "item-head";
  head.innerHTML = `<strong>${title}</strong><span>${meta}</span>`;
  const p = document.createElement("p");
  p.textContent = description;
  wrap.appendChild(head);
  wrap.appendChild(p);
  actions.forEach((action) => {
    const btn = document.createElement("button");
    btn.textContent = action.label;
    btn.disabled = !!action.disabled;
    btn.addEventListener("click", action.onClick);
    wrap.appendChild(btn);
  });
  return wrap;
}

function renderGenerators() {
  elements.producerList.innerHTML = "";
  state.generators.forEach((generator) => {
    if (state.lifetime < generator.unlockAt) return;
    const cost1 = generatorCost(generator, 1);
    const cost10 = generatorCost(generator, 10);

    const card = makeItem({
      title: `${generator.name} (${generator.amount})`,
      meta: `+${formatNumber(generator.baseRate * productionMultiplier())}/s each`,
      description: generator.description,
      actions: [
        {
          label: `Buy 1 (${formatNumber(cost1)})`,
          disabled: state.momentum < cost1,
          onClick: () => {
            if (state.momentum < cost1) return;
            state.momentum -= cost1;
            generator.amount += 1;
            renderAll();
          },
        },
        {
          label: `Buy 10 (${formatNumber(cost10)})`,
          disabled: state.momentum < cost10,
          onClick: () => {
            if (state.momentum < cost10) return;
            state.momentum -= cost10;
            generator.amount += 10;
            renderAll();
          },
        },
      ],
    });
    elements.producerList.appendChild(card);
  });
}

function renderBoosters() {
  elements.boosterList.innerHTML = "";
  state.boosters.forEach((booster) => {
    if (state.lifetime < booster.unlockAt) return;
    const cost = boosterCost(booster);
    const available = booster.level < booster.maxLevel;
    const canBuy = available && state.momentum >= cost;

    const card = makeItem({
      title: `${booster.name} (Lv ${booster.level}/${booster.maxLevel})`,
      meta: `x${(1 + booster.level * booster.multiplierPerLevel).toFixed(2)}`,
      description: booster.description,
      actions: [
        {
          label: available ? `Upgrade (${formatNumber(cost)})` : "MAXED",
          disabled: !canBuy,
          onClick: () => {
            if (!canBuy) return;
            state.momentum -= cost;
            booster.level += 1;
            renderAll();
          },
        },
      ],
    });
    elements.boosterList.appendChild(card);
  });

  const rebirthCard = makeItem({
    title: `Rebirth (${state.rebirths})`,
    meta: `Insight: ${state.insight}`,
    description: `Reset generators/boosters for permanent production bonus. Current bonus: x${rebirthBonus().toFixed(2)}.`,
    actions: [
      {
        label: canRebirth() ? `Rebirth for +${rebirthGain()} Insight` : "Need 250K total momentum",
        disabled: !canRebirth(),
        onClick: () => {
          if (!canRebirth()) return;
          state.insight += rebirthGain();
          state.rebirths += 1;
          state.momentum = 0;
          state.generators.forEach((g) => (g.amount = 0));
          state.boosters.forEach((b) => (b.level = 0));
          renderAll();
        },
      },
    ],
  });
  elements.boosterList.appendChild(rebirthCard);
}

function renderMilestones() {
  elements.milestoneList.innerHTML = "";
  milestones.forEach((goal) => {
    const li = document.createElement("li");
    const done = state.lifetime >= goal;
    li.className = done ? "done" : "";
    li.textContent = `${done ? "✓" : "○"} Reach ${formatNumber(goal)} total Momentum`;
    elements.milestoneList.appendChild(li);
  });
}

function saveGame() {
  const serializable = {
    momentum: state.momentum,
    lifetime: state.lifetime,
    clicks: state.clicks,
    playedMs: state.playedMs,
    rebirths: state.rebirths,
    insight: state.insight,
    generators: state.generators.map((g) => ({ id: g.id, amount: g.amount })),
    boosters: state.boosters.map((b) => ({ id: b.id, level: b.level })),
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(serializable));
}

function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    state.momentum = data.momentum ?? state.momentum;
    state.lifetime = data.lifetime ?? state.lifetime;
    state.clicks = data.clicks ?? state.clicks;
    state.playedMs = data.playedMs ?? state.playedMs;
    state.rebirths = data.rebirths ?? state.rebirths;
    state.insight = data.insight ?? state.insight;

    data.generators?.forEach((saved) => {
      const g = state.generators.find((x) => x.id === saved.id);
      if (g) g.amount = saved.amount;
    });
    data.boosters?.forEach((saved) => {
      const b = state.boosters.find((x) => x.id === saved.id);
      if (b) b.level = saved.level;
    });
  } catch (_) {
    localStorage.removeItem(SAVE_KEY);
  }
}

function renderAll() {
  const pps = productionPerSecond();
  elements.momentum.textContent = formatNumber(state.momentum);
  elements.perSecond.textContent = `+${formatNumber(pps)} / sec (click +${clickPower()})`;
  elements.lifetime.textContent = formatNumber(state.lifetime);
  elements.clicks.textContent = String(state.clicks);
  elements.time.textContent = `${Math.floor(state.playedMs / 1000)}s`;

  const next = nextUnlockTarget();
  elements.nextUnlock.textContent = next ? formatNumber(next) : "All major unlocks cleared";

  renderGenerators();
  renderBoosters();
  renderMilestones();
}

function gameTick() {
  const now = performance.now();
  const elapsedSeconds = Math.min((now - state.lastTick) / 1000, 2);
  state.lastTick = now;
  state.playedMs += elapsedSeconds * 1000;

  const gain = productionPerSecond() * elapsedSeconds;
  if (gain > 0) {
    state.momentum += gain;
    state.lifetime += gain;
  }

  renderAll();
  saveGame();
}

elements.tapButton.addEventListener("click", () => {
  const gain = clickPower();
  state.momentum += gain;
  state.lifetime += gain;
  state.clicks += 1;
  renderAll();
});

loadGame();
renderAll();
setInterval(gameTick, TICK_MS);
