import http from "node:http";
import { createReadStream, readFileSync } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(appDir, "..");
const sessionsDir = path.join(appDir, "sessions");

loadRootEnv();

const port = Number(process.env.PORT || 4176);
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

    if (req.method === "POST" && url.pathname === "/capture") {
      await saveCapture(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/clip-plan") {
      await createClipPlan(req, res);
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
  console.log(`Prototype 6 running at http://${host}:${port}`);
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

async function saveCapture(req, res) {
  const form = await readFormData(req);
  const metadata = parseJsonField(form.get("metadata"), {});
  const transcriptSegments = parseJsonField(form.get("transcript"), []);
  const questions = parseJsonField(form.get("questions"), []);
  const events = parseJsonField(form.get("events"), []);
  const recording = form.get("recording");

  const folderName = makeSessionFolderName(metadata.sessionStartedAt, metadata.sessionId);
  const folderPath = path.join(sessionsDir, folderName);
  await mkdir(folderPath, { recursive: true });

  const transcriptText = formatTranscriptText(transcriptSegments);
  const savedAt = new Date().toISOString();
  const normalizedMetadata = {
    ...metadata,
    savedAt,
    folderName,
    transcriptSegmentCount: Array.isArray(transcriptSegments) ? transcriptSegments.length : 0,
    questionEventCount: Array.isArray(questions) ? questions.length : 0,
    eventCount: Array.isArray(events) ? events.length : 0,
  };

  await writeJson(path.join(folderPath, "metadata.json"), normalizedMetadata);
  await writeJson(path.join(folderPath, "transcript.json"), transcriptSegments);
  await writeFile(path.join(folderPath, "transcript.txt"), transcriptText || "No transcript captured yet.\n", "utf8");
  await writeJson(path.join(folderPath, "questions.json"), questions);
  await writeJson(path.join(folderPath, "events.json"), events);

  let recordingFile = null;
  if (recording && typeof recording.arrayBuffer === "function" && recording.size > 0) {
    const extension = extensionForMime(recording.type) || extensionFromName(recording.name) || ".webm";
    const filename = `recording${extension}`;
    const buffer = Buffer.from(await recording.arrayBuffer());
    await writeFile(path.join(folderPath, filename), buffer);
    recordingFile = {
      filename,
      mimeType: recording.type || "application/octet-stream",
      size: recording.size,
      url: `/sessions/${encodeURIComponent(folderName)}/${encodeURIComponent(filename)}`,
    };
  }

  sendJson(res, 201, {
    ok: true,
    folderName,
    folderPath,
    transcriptText,
    recording: recordingFile,
    files: [
      "metadata.json",
      "transcript.json",
      "transcript.txt",
      "questions.json",
      "events.json",
      recordingFile?.filename,
    ].filter(Boolean),
  });
}

async function createClipPlan(req, res) {
  const payload = JSON.parse(await readRequestText(req, 5_000_000) || "{}");
  const folderName = safePathSegment(payload.folderName || "");
  if (!folderName) {
    sendJson(res, 400, { error: "folderName is required" });
    return;
  }

  const folderPath = path.join(sessionsDir, folderName);
  if (!folderPath.startsWith(sessionsDir)) {
    sendJson(res, 403, { error: "Invalid session folder" });
    return;
  }

  const transcriptSegments = Array.isArray(payload.transcriptSegments) ? payload.transcriptSegments : [];
  const transcriptText = payload.transcriptText || formatTranscriptText(transcriptSegments);
  const durationSeconds = Number(payload.durationSeconds || 0);
  const requestedAt = new Date().toISOString();
  await mkdir(folderPath, { recursive: true });
  await writeJson(path.join(folderPath, "clip-plan-request.json"), {
    requestedAt,
    durationSeconds,
    transcriptSegments,
    transcriptText,
  });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const fallback = createFallbackClipPlan({ transcriptSegments, durationSeconds });
    await writeJson(path.join(folderPath, "clip-plan.json"), fallback);
    sendJson(res, 200, {
      ok: true,
      source: "local-fallback",
      warning: "OPENAI_API_KEY is missing, so a local fallback clip plan was used.",
      clipPlan: fallback,
    });
    return;
  }

  try {
    const conversation = await openaiJson("/conversations", apiKey, {
      metadata: {
        prototype: "6",
        session_id: String(payload.sessionId || ""),
        session_folder: folderName,
        purpose: "interview_clip_selection",
      },
      items: [
        {
          type: "message",
          role: "user",
          content: [
            "Full interview transcript with approximate timestamps.",
            "Use this as source material for selecting a 30 second cutdown.",
            "",
            transcriptText || "No transcript text was captured.",
          ].join("\n"),
        },
      ],
    });

    await writeJson(path.join(folderPath, "openai-conversation.json"), conversation);

    const response = await openaiJson("/responses", apiKey, {
      model: process.env.OPENAI_CLIP_MODEL || "gpt-5.4",
      conversation: conversation.id,
      instructions:
        "You are a sharp interview video editor. Select only the moments that communicate the problem, the candidate's idea, and the decisions or tradeoffs. Exclude greetings, filler, repetition, setup, and vague commentary.",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                "Return a 30 second cut plan as JSON.",
                "Use approximate source timestamps from the transcript.",
                "Pick 2 to 5 sections whose combined duration is at most 30 seconds.",
                "Prefer sections in this order: problem, idea, decisions/tradeoffs.",
                `Source duration: ${durationSeconds || "unknown"} seconds.`,
              ].join("\n"),
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "interview_clip_plan",
          strict: true,
          schema: clipPlanSchema,
        },
      },
      store: true,
      max_output_tokens: 1400,
    });

    await writeJson(path.join(folderPath, "openai-response.json"), response);

    const rawPlan = JSON.parse(extractOutputText(response));
    const clipPlan = normalizeClipPlan(rawPlan, { transcriptSegments, durationSeconds });
    await writeJson(path.join(folderPath, "clip-plan.json"), clipPlan);

    sendJson(res, 200, {
      ok: true,
      source: "openai",
      conversationId: conversation.id,
      responseId: response.id,
      clipPlan,
    });
  } catch (error) {
    console.error(error);
    const fallback = createFallbackClipPlan({ transcriptSegments, durationSeconds });
    await writeJson(path.join(folderPath, "clip-plan-error.json"), {
      message: error.message,
      stack: error.stack,
    });
    await writeJson(path.join(folderPath, "clip-plan.json"), fallback);

    sendJson(res, 200, {
      ok: true,
      source: "local-fallback",
      warning: `OpenAI clip planning failed: ${error.message}`,
      clipPlan: fallback,
    });
  }
}

const clipPlanSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "summary", "targetDurationSeconds", "sections", "skipStrategy"],
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    targetDurationSeconds: { type: "number" },
    skipStrategy: { type: "string" },
    sections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "startSeconds", "endSeconds", "reason", "transcriptQuote"],
        properties: {
          label: { type: "string" },
          startSeconds: { type: "number" },
          endSeconds: { type: "number" },
          reason: { type: "string" },
          transcriptQuote: { type: "string" },
        },
      },
    },
  },
};

async function readFormData(req) {
  const request = new Request(`http://${req.headers.host || "localhost"}${req.url || "/"}`, {
    method: req.method,
    headers: req.headers,
    body: req,
    duplex: "half",
  });
  return request.formData();
}

async function openaiJson(pathname, apiKey, payload) {
  const response = await fetch(`https://api.openai.com/v1${pathname}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  if (!response.ok) {
    throw new Error(json.error?.message || text || `OpenAI request failed with ${response.status}`);
  }

  return json;
}

function extractOutputText(response) {
  const chunks = [];
  for (const item of response?.output || []) {
    if (item.type !== "message") continue;
    for (const part of item.content || []) {
      if (part.type === "output_text" || part.type === "text") chunks.push(part.text || "");
    }
  }
  const text = chunks.join("").trim();
  if (!text) throw new Error("OpenAI response did not include output text");
  return text;
}

function normalizeClipPlan(plan, context = {}) {
  const durationSeconds = Number(context.durationSeconds || 0);
  const sections = Array.isArray(plan.sections) ? plan.sections : [];
  let used = 0;
  const normalizedSections = [];

  for (const section of sections) {
    const rawStart = Number(section.startSeconds || 0);
    const rawEnd = Number(section.endSeconds || rawStart + 8);
    const startSeconds = clampSeconds(rawStart, durationSeconds);
    const maxEnd = durationSeconds > 0 ? durationSeconds : rawEnd;
    const requestedEnd = Math.max(startSeconds + 1, rawEnd);
    const remaining = Math.max(1, 30 - used);
    const endSeconds = Math.min(clampSeconds(requestedEnd, maxEnd), startSeconds + remaining);
    if (endSeconds <= startSeconds) continue;

    normalizedSections.push({
      label: String(section.label || `Moment ${normalizedSections.length + 1}`),
      startSeconds,
      endSeconds,
      reason: String(section.reason || "Selected as one of the strongest interview moments."),
      transcriptQuote: String(section.transcriptQuote || ""),
    });

    used += endSeconds - startSeconds;
    if (used >= 30) break;
  }

  const fallback = normalizedSections.length
    ? null
    : createFallbackClipPlan({
        transcriptSegments: context.transcriptSegments || [],
        durationSeconds,
      });

  if (fallback) return fallback;

  return {
    title: String(plan.title || "30 second interview cutdown"),
    summary: String(
      plan.summary ||
        "A tight skip-playback cut that keeps the strongest problem, idea, and decision moments."
    ),
    targetDurationSeconds: Math.min(30, Math.round(used * 10) / 10),
    skipStrategy: String(plan.skipStrategy || "Skip directly between selected timestamps."),
    sections: normalizedSections,
  };
}

function createFallbackClipPlan({ transcriptSegments = [], durationSeconds = 0 }) {
  const candidates = Array.isArray(transcriptSegments) && transcriptSegments.length
    ? transcriptSegments
    : [
        {
          text: "Preview the strongest available portion of the recording.",
          startSeconds: 0,
          endSeconds: durationSeconds || 30,
        },
      ];
  const preferred = rankTranscriptSegments(candidates).slice(0, 3);
  let used = 0;

  const sections = preferred.map((segment, index) => {
    const label = ["Problem", "Idea", "Decisions"][index] || `Moment ${index + 1}`;
    const startSeconds = clampSeconds(Number(segment.startSeconds || 0), durationSeconds);
    const naturalEnd = Number(segment.endSeconds || startSeconds + 10);
    const remaining = Math.max(1, 30 - used);
    const endSeconds = Math.min(
      clampSeconds(Math.max(startSeconds + 1, naturalEnd), durationSeconds || naturalEnd),
      startSeconds + remaining,
    );
    used += Math.max(0, endSeconds - startSeconds);

    return {
      label,
      startSeconds,
      endSeconds,
      reason: "Fallback selection from the captured transcript timestamps.",
      transcriptQuote: String(segment.text || "").slice(0, 180),
    };
  });

  return {
    title: "30 second interview cutdown",
    summary: "A timestamp-based preview that skips through the strongest captured answers.",
    targetDurationSeconds: Math.min(30, Math.round(used * 10) / 10),
    skipStrategy: "Local fallback chose the highest-signal transcript segments and trims playback to 30 seconds.",
    sections,
  };
}

function rankTranscriptSegments(segments) {
  const patterns = [
    /problem|challenge|hard|failure|incident|debug|pressure/i,
    /idea|approach|solution|designed|built|led|implemented/i,
    /decision|tradeoff|chose|decided|because|why|learned/i,
  ];

  return [...segments].sort((a, b) => scoreSegment(b) - scoreSegment(a));

  function scoreSegment(segment) {
    const text = String(segment.text || "");
    return patterns.reduce((score, pattern) => score + (pattern.test(text) ? 2 : 0), 0) + Math.min(3, text.length / 140);
  }
}

function clampSeconds(value, max) {
  const safe = Number.isFinite(value) ? Math.max(0, Math.round(value * 10) / 10) : 0;
  return max > 0 ? Math.min(safe, max) : safe;
}

function formatTranscriptText(segments) {
  if (!Array.isArray(segments)) return "";
  return segments
    .filter((segment) => String(segment.text || "").trim())
    .map((segment, index) => {
      const start = formatClock(Number(segment.startSeconds || 0));
      const end = formatClock(Number(segment.endSeconds || segment.startSeconds || 0));
      return `[${start} - ${end}] Candidate ${index + 1}: ${String(segment.text).trim()}`;
    })
    .join("\n\n");
}

function formatClock(totalSeconds) {
  const safe = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const minutes = Math.floor(safe / 60).toString().padStart(2, "0");
  const seconds = (safe % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function parseJsonField(value, fallback) {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function makeSessionFolderName(startedAt, sessionId) {
  const date = Number.isNaN(Date.parse(startedAt)) ? new Date() : new Date(startedAt);
  const timestamp = date.toISOString().replace(/[:.]/g, "-");
  const suffix = safePathSegment(sessionId || "session");
  return `${timestamp}-${suffix}`;
}

function safePathSegment(value) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 120);
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function extensionForMime(mimeType = "") {
  if (mimeType.includes("webm")) return ".webm";
  if (mimeType.includes("mp4")) return ".mp4";
  if (mimeType.includes("ogg")) return ".ogg";
  if (mimeType.includes("mpeg")) return ".mp3";
  if (mimeType.includes("wav")) return ".wav";
  return "";
}

function extensionFromName(name = "") {
  const ext = path.extname(name).toLowerCase();
  return /^[a-z0-9.]+$/.test(ext) ? ext : "";
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
  if (ext === ".txt") return "text/plain; charset=utf-8";
  if (ext === ".js" || ext === ".mjs") return "text/javascript; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webm") return "video/webm";
  if (ext === ".mp4") return "video/mp4";
  if (ext === ".ogg") return "audio/ogg";
  if (ext === ".mp3") return "audio/mpeg";
  if (ext === ".wav") return "audio/wav";
  return "application/octet-stream";
}
