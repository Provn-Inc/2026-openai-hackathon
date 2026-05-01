# 2026-openai-hackathon

Deep Dive interview prototypes for the OpenAI hackathon. The latest prototype combines a realtime OpenAI interviewer, webcam recording, timestamped server-side session saves, and a 30-second skip-playback preview.

## Prerequisites

- Node.js 20+ recommended.
- An OpenAI API key in a repo-root `.env` file:

```sh
OPENAI_API_KEY=sk-...
```

Optional `.env` values:

```sh
OPENAI_REALTIME_MODEL=gpt-realtime
OPENAI_TRANSCRIBE_MODEL=gpt-4o-mini-transcribe
OPENAI_CLIP_MODEL=gpt-5.4
HOST=127.0.0.1
PORT=4176
```

## Build

There is no separate build step. Each prototype is plain HTML plus, for prototypes 4 and newer, a small Node server.

## Run The Latest Prototype

Prototype 6 is the current application.

```sh
cd prototype-6
npm start
```

Open:

```txt
http://127.0.0.1:4176
```

Allow camera and microphone permissions in the browser. When the interview ends, prototype 6 saves the recording, transcript, events, and clip plan under:

```txt
prototype-6/sessions/<timestamp>-<session-id>/
```

The `sessions/` folder is ignored by git because it contains generated interview data and recordings.

## Older Prototypes

- `prototype-1`, `prototype-2`, `prototype-3`: static HTML prototypes. Open `index.html` directly in a browser.
- `prototype-4`: realtime OpenAI prototype on port `4174`.
- `prototype-5`: realtime webcam/recording prototype on port `4175`.
- `prototype-6`: timestamped save + 30-second clip-plan prototype on port `4176`.

Run server-backed prototypes from their folder:

```sh
cd prototype-4 # or prototype-5 / prototype-6
npm start
```

To use a different port:

```sh
PORT=4180 npm start
```

## Quick Verification

From the repo root:

```sh
node --check prototype-6/server.mjs
curl http://127.0.0.1:4176/health
```
