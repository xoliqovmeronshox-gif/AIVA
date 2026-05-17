const AIVA_DB_NAME = "aiva-image-store";
const AIVA_DB_VERSION = 1;
const AIVA_STORE_NAME = "images";

function openAivaDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(AIVA_DB_NAME, AIVA_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(AIVA_STORE_NAME)) {
        db.createObjectStore(AIVA_STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withAivaStore(mode, callback) {
  const db = await openAivaDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(AIVA_STORE_NAME, mode);
    const store = transaction.objectStore(AIVA_STORE_NAME);
    const result = callback(store);

    transaction.oncomplete = () => {
      db.close();
      resolve(result);
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

async function saveAivaImage(item) {
  await withAivaStore("readwrite", (store) => {
    store.put(item);
  });
}

async function getAivaHistory() {
  const db = await openAivaDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(AIVA_STORE_NAME, "readonly");
    const store = transaction.objectStore(AIVA_STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      db.close();
      resolve(
        request.result.sort((a, b) => {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        })
      );
    };

    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

async function migrateAivaHistory() {
  const marker = "aiva-history-migrated-v1";
  if (window.localStorage.getItem(marker)) {
    return;
  }

  try {
    const history = JSON.parse(window.localStorage.getItem("aiva-history") || "[]");
    if (Array.isArray(history)) {
      for (const item of history) {
        if (item?.image) {
          await saveAivaImage({
            id: item.id || String(Date.now() + Math.random()),
            image: item.image,
            prompt: item.prompt || "",
            style: item.style || "Studio",
            ratio: item.ratio || "1:1",
            createdAt: item.createdAt || new Date().toISOString()
          });
        }
      }
    }
  } catch {
    // Ignore old broken localStorage history.
  }

  window.localStorage.setItem(marker, "1");
}

window.AivaStore = {
  getHistory: async () => {
    await migrateAivaHistory();
    return getAivaHistory();
  },
  saveImage: saveAivaImage
};
