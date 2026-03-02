const state = {
  momentum: 0,
  lifetime: 0,
  clicks: 0,
  playedMs: 0,
  lastTick: performance.now(),
  producers: [
    {
      id: "toDo",
      name: "Tiny To-Do",
      amount: 0,
      baseCost: 8,
      growth: 1.16,
      baseRate: 0.4,
      description: "A tiny trickle of productivity.",
    },
    {
      id: "coffee",
      name: "Coffee Loop",
      amount: 0,
      baseCost: 65,
      growth: 1.19,
      baseRate: 2.5,
      description: "Caffeine that keeps the ticks alive.",
    },
    {
      id: "automation",
      name: "Micro Automation",
      amount: 0,
      baseCost: 420,
      growth: 1.22,
      baseRate: 12,
      description: "Script your way to one-more-task syndrome.",
    },
    {
      id: "team",
      name: "Parallel Team",
      amount: 0,
      baseCost: 3500,
      growth: 1.24,
      baseRate: 55,
      description: "More people, more checklists, more momentum.",
    },
    {
      id: "cluster",
      name: "Idle Cluster",
      amount: 0,
      baseCost: 30000,
      growth: 1.27,
      baseRate: 250,
      description: "AFK progression machine.",
    },
  ],
  boosters: [
    {
      id: "focus",
      name: "Focus Sprint",
      level: 0,
      maxLevel: 20,
      baseCost: 30,
      growth: 1.33,
      multiplierPerLevel: 0.08,
      description: "Increase all production by 8% per level.",
    },
    {
      id: "habit",
      name: "Atomic Habit",
      level: 0,
      maxLevel: 15,
      baseCost: 220,
      growth: 1.4,
      multiplierPerLevel: 0.15,
      description: "Increase all production by 15% per level.",
    },
    {
      id: "deepWork",
      name: "Deep Work Window",
      level: 0,
      maxLevel: 10,
      baseCost: 1800,
      growth: 1.5,
      multiplierPerLevel: 0.28,
      description: "Increase all production by 28% per level.",
    },
  ],
};

const milestones = [10, 50, 120, 300, 750, 2_000, 7_000, 25_000, 90_000, 350_000, 1_200_000, 5_000_000];

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
  const units = ["K", "M", "B", "T", "Qa", "Qi"];
  let scaled = value;
  let idx = -1;
  while (scaled >= 1000 && idx < units.length - 1) {
    scaled /= 1000;
    idx += 1;
  }
  return `${scaled.toFixed(2)}${units[idx]}`;
}

function producerCost(producer) {
  return producer.baseCost * producer.growth ** producer.amount;
}

function boosterCost(booster) {
  return booster.baseCost * booster.growth ** booster.level;
}

function productionMultiplier() {
  return state.boosters.reduce((acc, booster) => acc * (1 + booster.level * booster.multiplierPerLevel), 1);
}

function productionPerSecond() {
  const base = state.producers.reduce((acc, producer) => acc + producer.amount * producer.baseRate, 0);
  return base * productionMultiplier();
}

function nextUnlockTarget() {
  const found = milestones.find((value) => value > state.lifetime);
  return found ?? "Legendary grind tier reached";
}

function renderProducers() {
  elements.producerList.innerHTML = "";
  state.producers.forEach((producer) => {
    const cost = producerCost(producer);
    const canBuy = state.momentum >= cost;

    const wrap = document.createElement("div");
    wrap.className = "item";
    wrap.innerHTML = `
      <div class="item-head">
        <strong>${producer.name} (${producer.amount})</strong>
        <span>+${formatNumber(producer.baseRate * productionMultiplier())}/s</span>
      </div>
      <p>${producer.description}</p>
      <button ${canBuy ? "" : "disabled"}>Buy for ${formatNumber(cost)} Momentum</button>
    `;

    wrap.querySelector("button").addEventListener("click", () => {
      if (state.momentum < cost) return;
      state.momentum -= cost;
      producer.amount += 1;
      renderAll();
    });

    elements.producerList.appendChild(wrap);
  });
}

function renderBoosters() {
  elements.boosterList.innerHTML = "";
  state.boosters.forEach((booster) => {
    const cost = boosterCost(booster);
    const available = booster.level < booster.maxLevel;
    const canBuy = available && state.momentum >= cost;

    const wrap = document.createElement("div");
    wrap.className = "item";
    wrap.innerHTML = `
      <div class="item-head">
        <strong>${booster.name} (Lv ${booster.level}/${booster.maxLevel})</strong>
        <span>x${(1 + booster.level * booster.multiplierPerLevel).toFixed(2)}</span>
      </div>
      <p>${booster.description}</p>
      <button ${canBuy ? "" : "disabled"}>${available ? `Upgrade for ${formatNumber(cost)} Momentum` : "MAXED"}</button>
    `;

    wrap.querySelector("button").addEventListener("click", () => {
      if (!available || state.momentum < cost) return;
      state.momentum -= cost;
      booster.level += 1;
      renderAll();
    });

    elements.boosterList.appendChild(wrap);
  });
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

function renderAll() {
  const pps = productionPerSecond();

  elements.momentum.textContent = formatNumber(state.momentum);
  elements.perSecond.textContent = `+${formatNumber(pps)} / sec`;
  elements.lifetime.textContent = formatNumber(state.lifetime);
  elements.clicks.textContent = String(state.clicks);
  elements.time.textContent = `${Math.floor(state.playedMs / 1000)}s`;

  const next = nextUnlockTarget();
  elements.nextUnlock.textContent = typeof next === "number" ? formatNumber(next) : next;

  renderProducers();
  renderBoosters();
  renderMilestones();
}

function gameTick(now) {
  const elapsedSeconds = Math.min((now - state.lastTick) / 1000, 1.5);
  state.lastTick = now;
  state.playedMs += elapsedSeconds * 1000;

  const gain = productionPerSecond() * elapsedSeconds;
  if (gain > 0) {
    state.momentum += gain;
    state.lifetime += gain;
  }

  renderAll();
  requestAnimationFrame(gameTick);
}

elements.tapButton.addEventListener("click", () => {
  state.momentum += 1;
  state.lifetime += 1;
  state.clicks += 1;
  renderAll();
});

renderAll();
requestAnimationFrame(gameTick);
