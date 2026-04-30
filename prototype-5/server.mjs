import http from "node:http";
import { createReadStream, readFileSync } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(appDir, "..");

loadRootEnv();

const port = Number(process.env.PORT || 4175);
const host = process.env.HOST || "127.0.0.1";

const realtimeSession = {
  type: "realtime",
  model: process.env.OPENAI_REALTIME_MODEL || "gpt-realtime",
  instructions:
    "You are a live interview copilot. Listen to the candidate and return exactly one concise, useful follow-up question after each meaningful answer. Do not score, rank, or make hiring decisions.",
  output_modalities: ["text"],
  max_output_tokens: 180,
  audio: {
    input: {
      noise_reduction: { type: "near_field" },
      transcription: {
        model: process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe",
        language: "en",
        prompt:
          "Software engineering candidate interview. Preserve product, architecture, incident, and implementation terminology.",
      },
      turn_detection: {
        type: "server_vad",
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 650,
        interrupt_response: false,
        create_response: true,
      },
    },
  },
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (req.method === "GET" && url.pathname === "/health") {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "POST" && url.pathname === "/session") {
      await createRealtimeCall(req, res);
      return;
    }

    if (req.method === "GET" || req.method === "HEAD") {
      await serveStatic(url.pathname, req, res);
      return;
    }

    sendText(res, 405, "Method not allowed");
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: "Prototype server error" });
  }
});

server.listen(port, host, () => {
  console.log(`Prototype 5 running at http://${host}:${port}`);
});

async function createRealtimeCall(req, res) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    sendJson(res, 500, { error: "OPENAI_API_KEY is missing from the repo root .env file" });
    return;
  }

  const sdp = await readRequestText(req, 1_000_000);
  if (!sdp.includes("v=0")) {
    sendJson(res, 400, { error: "Expected a WebRTC SDP offer" });
    return;
  }

  const form = new FormData();
  form.set("sdp", sdp);
  form.set("session", JSON.stringify(realtimeSession));

  const upstream = await fetch("https://api.openai.com/v1/realtime/calls", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });

  const body = await upstream.text();
  if (!upstream.ok) {
    sendJson(res, upstream.status, {
      error: "OpenAI Realtime call failed",
      details: body.slice(0, 1200),
    });
    return;
  }

  res.writeHead(201, {
    "Content-Type": "application/sdp",
    "Cache-Control": "no-store",
  });
  res.end(body);
}

async function serveStatic(pathname, req, res) {
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const safePath = path.normalize(decodeURIComponent(requestedPath)).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(appDir, safePath);

  if (!filePath.startsWith(appDir)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  const info = await stat(filePath).catch(() => null);
  if (!info?.isFile()) {
    sendText(res, 404, "Not found");
    return;
  }

  res.writeHead(200, {
    "Content-Type": contentType(filePath),
    "Cache-Control": "no-store",
  });

  if (req.method === "HEAD") {
    res.end();
    return;
  }

  createReadStream(filePath).pipe(res);
}

function readRequestText(req, maxBytes) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > maxBytes) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function loadRootEnv() {
  const envPath = path.join(repoRoot, ".env");
  let raw = "";
  try {
    raw = readFileSync(envPath, "utf8");
  } catch {
    return;
  }

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const normalized = trimmed.startsWith("export ") ? trimmed.slice(7).trim() : trimmed;
    const equals = normalized.indexOf("=");
    if (equals === -1) continue;

    const key = normalized.slice(0, equals).trim();
    let value = normalized.slice(equals + 1).trim();
    if (!key || process.env[key]) continue;

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
}

function sendText(res, status, text) {
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(text);
}

function contentType(filePath) {
  const ext = path.extname(filePath);
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".js" || ext === ".mjs") return "text/javascript; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  return "application/octet-stream";
}
