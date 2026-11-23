# Kent

Standalone AI chat assistant with an animated 3D-style mascot. Next.js 16, no database, no accounts.

## Features

- Streaming chat (NDJSON) against any OpenAI-compatible `/chat/completions` endpoint
- Reasoning modes Ultra → Low (`reasoning_effort` + tool rounds), optional model per mode
- Tools: `web_search` (Tavily) with source cards, `read_web_page` (tables as Markdown, SSRF-safe fetch)
- Attachments: images (sent as image input), PDF (read on the server), HTML, ZIP, CSV, TXT, MD, JSON; pasted tables become Markdown
- Slash commands: `/summarize`, `/rewrite`, `/translate`, `/research`
- Clickable options and next-step suggestions (Tab to use), message queue while answering, edit last message (↑), stop, retry
- Chat history in the browser (localStorage): search, pin, rename (double-click), delete
- Kent mascot: idle/think/research/write/done/fail expressions, cursor follow, drag with spring, appearance studio (shape, colours, eyes, mouth, face, accessory)

## Run

```bash
pnpm install
cp .env.example .env.local   # set AI_API_KEY
pnpm dev
```

Open http://localhost:3000.

## Structure

- `src/app/api/chat/route.ts` — agent loop: system prompt, history trimming, tool calls, stream events
- `src/app/api/pdf/route.ts` — PDF text extraction
- `src/lib/ai/` — model client, events, modes, prompt, tools, web search, safe fetch
- `src/components/kent/` — app shell, composer, thread, history store, mascot (`KentMark`, `kent-rig`, `kent-shapes`, `kent-motion`, `kent-look`, `KentGrab`)
- `src/styles/kent/` — component styles; tokens and layout in `src/app/globals.scss`

## Notes

- There is no authentication. Put it behind your own auth or a private network before exposing it, since anyone with the URL can spend your API key.
- Chat history stays in each browser; clearing site data removes it.
