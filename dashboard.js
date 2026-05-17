const BASE_LIMIT = 3;
const LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;
const LIMIT_VERSION_KEY = "aiva-limit-version";
const LEGACY_COUNT_KEY = "aiva-generation-count";
const LIMIT_STATE_KEY = "aiva-limit-state";
const THEME_KEY = "aiva-theme";

const usedCount = document.querySelector("#usedCount");
const leftCount = document.querySelector("#leftCount");
const historyCount = document.querySelector("#historyCount");
const historyGrid = document.querySelector("#historyGrid");
const themeToggle = document.querySelector("#themeToggle");

function readLimitState() {
  const now = Date.now();
  if (window.localStorage.getItem(LIMIT_VERSION_KEY) !== "3") {
    window.localStorage.setItem(LIMIT_VERSION_KEY, "3");
    window.localStorage.removeItem(LIMIT_STATE_KEY);
    window.localStorage.setItem(LEGACY_COUNT_KEY, "0");
  }

  const rawState = window.localStorage.getItem(LIMIT_STATE_KEY);

  try {
    const current = JSON.parse(rawState || "null");
    if (current && now - current.startedAt < LIMIT_WINDOW_MS) {
      return {
        startedAt: current.startedAt,
        used: Math.min(BASE_LIMIT, Number(current.used) || 0),
        bonus: 0
      };
    }
  } catch {
    // Rebuild below.
  }

  const legacyUsed = rawState
    ? 0
    : Number.parseInt(window.localStorage.getItem(LEGACY_COUNT_KEY) || "0", 10);
  const next = {
    startedAt: now,
    used: Number.isFinite(legacyUsed) ? legacyUsed : 0,
    bonus: 0
  };
  saveLimitState(next);
  return next;
}

function saveLimitState(next) {
  const clean = {
    startedAt: next.startedAt,
    used: Math.min(BASE_LIMIT, Number(next.used) || 0),
    bonus: 0
  };
  window.localStorage.setItem(LIMIT_STATE_KEY, JSON.stringify(clean));
  window.localStorage.setItem(LEGACY_COUNT_KEY, String(clean.used));
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  window.localStorage.setItem(THEME_KEY, theme);
  themeToggle.checked = theme === "dark";
}

function renderStats(history) {
  const limit = readLimitState();
  const total = BASE_LIMIT;
  usedCount.textContent = String(limit.used);
  leftCount.textContent = String(Math.max(0, total - limit.used));
  historyCount.textContent = String(history.length);
}

function downloadImage(item) {
  const link = document.createElement("a");
  link.href = item.image;
  link.download = `aiva-${item.id || Date.now()}.png`;
  document.body.append(link);
  link.click();
  link.remove();
}

async function shareImage(item) {
  const shareData = {
    title: "AIVA Image Studio",
    text: item.prompt || "Созданное изображение",
    url: item.image
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
      return;
    } catch {
      // Fall back to clipboard.
    }
  }

  await navigator.clipboard.writeText(item.image);
}

function renderHistory(history) {
  if (!history.length) {
    return;
  }

  historyGrid.innerHTML = "";

  history.forEach((item) => {
    const card = document.createElement("article");
    card.className = "historyCard";

    const image = document.createElement("img");
    image.alt = item.prompt || "История изображения";
    image.src = item.image;

    const body = document.createElement("div");
    const title = document.createElement("strong");
    const meta = document.createElement("small");
    const actions = document.createElement("div");
    const downloadButton = document.createElement("button");
    const shareButton = document.createElement("button");

    title.textContent = item.prompt || "Без названия";
    meta.textContent = `${item.style || "Studio"} · ${item.ratio || "1:1"}`;
    actions.className = "historyActions";
    downloadButton.type = "button";
    downloadButton.textContent = "Скачать";
    shareButton.type = "button";
    shareButton.textContent = "Поделиться";

    downloadButton.addEventListener("click", () => downloadImage(item));
    shareButton.addEventListener("click", () => shareImage(item));

    actions.append(downloadButton, shareButton);
    body.append(title, meta, actions);
    card.append(image, body);
    historyGrid.append(card);
  });
}

(async function initDashboard() {
  const history = await window.AivaStore.getHistory();
  applyTheme(window.localStorage.getItem(THEME_KEY) || "light");
  saveLimitState(readLimitState());
  renderStats(history);
  renderHistory(history);
})();

themeToggle.addEventListener("change", () => {
  applyTheme(themeToggle.checked ? "dark" : "light");
  window.AivaStore.getHistory().then(renderStats);
});
