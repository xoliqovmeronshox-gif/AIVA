const http = require("http");
const fs = require("fs");
const path = require("path");
const apiHandler = require("./api/generate");

const port = Number(process.env.PORT || 3000);
const root = __dirname;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml"
};

function readEnvFile() {
  const envPath = path.join(root, ".env");

  if (!fs.existsSync(envPath)) {
    return;
  }

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index);
    const value = trimmed.slice(index + 1);
    process.env[key] ||= value;
  }
}

function serveFile(requestPath, response) {
  const routes = {
    "/": "index.html",
    "/dashboard": "dashboard.html",
    "/generate": "generate.html"
  };

  const fileName = routes[requestPath] || requestPath.replace(/^\/+/, "");
  const filePath = path.normalize(path.join(root, fileName));

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    const ext = path.extname(filePath);
    response.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream"
    });
    response.end(content);
  });
}

readEnvFile();

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (url.pathname === "/api/generate") {
    let rawBody = "";
    request.on("data", (chunk) => {
      rawBody += chunk;
    });
    request.on("end", () => {
      try {
        request.body = rawBody ? JSON.parse(rawBody) : {};
      } catch {
        request.body = {};
      }

      apiHandler(request, response);
    });
    return;
  }

  serveFile(url.pathname, response);
});

server.listen(port, () => {
  console.log(`AIVA Image Studio: http://localhost:${port}`);
});
