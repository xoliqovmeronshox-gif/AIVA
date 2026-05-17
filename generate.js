const BASE_LIMIT = 3;
const LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;
const LIMIT_VERSION_KEY = "aiva-limit-version";
const LEGACY_COUNT_KEY = "aiva-generation-count";
const LIMIT_STATE_KEY = "aiva-limit-state";
const LAST_IMAGE_KEY = "aiva-last-image";
const LAST_PROMPT_KEY = "aiva-last-prompt";

const styleNames = {
  pro: "Studio Pro",
  flex: "Studio Flex",
  vector: "Studio Vector"
};

const state = {
  style: "pro",
  ratio: "1:1",
  limit: readLimitState()
};

const promptInput = document.querySelector("#prompt");
const limitBadge = document.querySelector("#limitBadge");
const generateButton = document.querySelector("#generateButton");
const errorText = document.querySelector("#errorText");
const successText = document.querySelector("#successText");
const resultImage = document.querySelector("#resultImage");
const emptyPreview = document.querySelector("#emptyPreview");
const exportLink = document.querySelector("#exportLink");

function applyTheme() {
  document.documentElement.dataset.theme = window.localStorage.getItem("aiva-theme") || "light";
}

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
    // Ignore broken state and rebuild below.
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

function getTotalLimit() {
  return BASE_LIMIT;
}

function getRemaining() {
  return Math.max(0, getTotalLimit() - state.limit.used);
}

function setMessage(element, message) {
  element.textContent = message;
  element.classList.toggle("hidden", !message);
}

function updateLimit() {
  const remaining = getRemaining();
  limitBadge.textContent = `${remaining} из ${getTotalLimit()} осталось`;
  generateButton.disabled = remaining <= 0;
}

function updatePreviewLabel() {
  emptyPreview.querySelector("strong").textContent = styleNames[state.style];
  emptyPreview.querySelector("span").textContent = state.ratio;
}

async function saveHistory(image, prompt) {
  const item = {
    id: String(Date.now()),
    image,
    prompt: prompt.slice(0, 220),
    style: styleNames[state.style],
    ratio: state.ratio,
    createdAt: new Date().toISOString()
  };

  try {
    await window.AivaStore.saveImage(item);
  } catch {
    // Keep generation usable even if browser storage is blocked.
  }

  try {
    window.localStorage.setItem(LAST_IMAGE_KEY, image);
  } catch {
    // Large images may exceed localStorage; IndexedDB above is the source of truth.
  }

  window.localStorage.setItem(LAST_PROMPT_KEY, item.prompt);
}

document.querySelectorAll(".modelButton").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".modelButton").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    state.style = button.dataset.style;
    updatePreviewLabel();
  });
});

document.querySelectorAll(".ratioButton").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".ratioButton").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    state.ratio = button.dataset.ratio;
    updatePreviewLabel();
  });
});

generateButton.addEventListener("click", async () => {
  const prompt = promptInput.value.trim();
  setMessage(errorText, "");
  setMessage(successText, "");

  if (!prompt) {
    setMessage(errorText, "Введите промпт для генерации.");
    return;
  }

  if (getRemaining() <= 0) {
    setMessage(errorText, "Лимит на 24 часа уже использован.");
    return;
  }

  generateButton.disabled = true;
  generateButton.textContent = "Генерация...";

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        style: state.style,
        aspectRatio: state.ratio
      })
    });

    const data = await response.json();

    if (!response.ok || !data.image) {
      throw new Error(data.error || "Не удалось создать изображение.");
    }

    state.limit.used += 1;
    saveLimitState(state.limit);
    await saveHistory(data.image, prompt);
    resultImage.src = data.image;
    exportLink.href = data.image;
    exportLink.classList.remove("disabled");
    resultImage.classList.remove("hidden");
    emptyPreview.classList.add("hidden");
    setMessage(successText, `Готово: ${styleNames[state.style]}`);
  } catch (error) {
    setMessage(errorText, error.message || "Неизвестная ошибка генерации.");
  } finally {
    generateButton.textContent = "Сгенерировать";
    updateLimit();
  }
});

applyTheme();
saveLimitState(state.limit);
updateLimit();
updatePreviewLabel();
