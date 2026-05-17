document.documentElement.dataset.theme = window.localStorage.getItem("aiva-theme") || "light";

(async function renderHomeHistory() {
  const history = await window.AivaStore.getHistory();

  document.querySelectorAll(".homePoster").forEach((poster, index) => {
    const item = history[index];
    const image = poster.querySelector("img");
    const label = poster.querySelector("span");

    if (!item || !image || !label) {
      return;
    }

    image.src = item.image;
    image.classList.remove("hidden");
    label.textContent = item.prompt && item.prompt.length > 18 ? `${item.prompt.slice(0, 18)}...` : item.prompt || item.style;
  });
})();
