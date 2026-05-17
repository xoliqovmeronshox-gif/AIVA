const styleModelChains = {
  pro: [
    "black-forest-labs/flux.2-pro",
    "black-forest-labs/flux.2-flex",
    "sourceful/riverflow-v2-standard-preview",
    "google/gemini-2.5-flash-image",
    "google/gemini-3.1-flash-image-preview"
  ],
  flex: [
    "black-forest-labs/flux.2-flex",
    "black-forest-labs/flux.2-pro",
    "sourceful/riverflow-v2-standard-preview",
    "google/gemini-2.5-flash-image",
    "google/gemini-3.1-flash-image-preview"
  ],
  vector: [
    "sourceful/riverflow-v2-standard-preview",
    "black-forest-labs/flux.2-pro",
    "black-forest-labs/flux.2-flex",
    "google/gemini-2.5-flash-image",
    "google/gemini-3.1-flash-image-preview"
  ]
};

const allowedRatios = new Set(["1:1", "16:9", "9:16", "4:3", "3:4"]);

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

function normalizePrompt(prompt, aspectRatio) {
  return [
    prompt.trim(),
    `Required aspect ratio: ${aspectRatio}.`,
    "High quality image, polished composition, coherent details, clean lighting."
  ].join("\n\n");
}

function readImageFromResponse(data) {
  const message = data?.choices?.[0]?.message;
  const images = message?.images || [];
  const image = images[0]?.image_url?.url || images[0]?.imageUrl?.url;

  return {
    image,
    text: typeof message?.content === "string" ? message.content : undefined
  };
}

async function requestModel(apiKey, prompt, model, aspectRatio) {
  const modalitySets = [["image", "text"], ["image"]];
  let lastError = "model failed";

  for (const modalities of modalitySets) {
    try {
      return await requestModelWithModalities(apiKey, prompt, model, aspectRatio, modalities);
    } catch (error) {
      lastError = error instanceof Error ? error.message : "model failed";
    }
  }

  throw new Error(lastError);
}

async function requestModelWithModalities(apiKey, prompt, model, aspectRatio, modalities) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://aiva-image-studio.vercel.app",
      "X-Title": "AIVA Image Studio"
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: normalizePrompt(prompt, aspectRatio)
        }
      ],
      modalities,
      image_config: {
        aspect_ratio: aspectRatio
      },
      stream: false
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "model failed");
  }

  const result = readImageFromResponse(data);

  if (!result.image) {
    throw new Error("empty image response");
  }

  return {
    image: result.image,
    text: result.text,
    model
  };
}

async function generateImage(prompt, style, aspectRatio) {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("Генератор сейчас недоступен.");
  }

  const chain = styleModelChains[style] || styleModelChains.pro;
  const errors = [];

  for (const model of chain) {
    try {
      return await requestModel(apiKey, prompt, model, aspectRatio);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "unknown error");
    }
  }

  throw new Error("Генерация сейчас не прошла. Проверьте баланс ключа и попробуйте ещё раз.");
}

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Метод не поддерживается." });
    return;
  }

  try {
    const body = request.body || {};
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const style = typeof body.style === "string" ? body.style.trim() : "pro";
    const aspectRatio = allowedRatios.has(body.aspectRatio) ? body.aspectRatio : "1:1";

    if (!prompt) {
      sendJson(response, 400, { error: "Промпт обязателен." });
      return;
    }

    if (prompt.length > 2000) {
      sendJson(response, 400, {
        error: "Промпт слишком длинный. Максимум 2000 символов."
      });
      return;
    }

    const result = await generateImage(prompt, style, aspectRatio);
    sendJson(response, 200, result);
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : "Неизвестная ошибка."
    });
  }
};
