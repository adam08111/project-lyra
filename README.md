# Lyra Dev — Live Preview for Cursor

> Edit `src/lyra.jsx` in Cursor → browser refreshes instantly. Just like Claude artifacts.

## Setup (2 minutes)

### Step 1: Install
```bash
npm install
```

### Step 2: Add your API key
```bash
cp .env.example .env
```
Edit `.env` and paste your Anthropic API key:
```
ANTHROPIC_API_KEY=sk-ant-api03-...
```

### Step 3: Run
```bash
npm run dev
```

Open **http://localhost:3000** in your browser. Done.

---

## How it works

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────┐
│   Cursor     │────▶│  Vite (3000) │────▶│  Browser preview │
│  edits JSX   │     │  hot reload  │     │  updates <1 sec  │
└─────────────┘     └──────┬───────┘     └──────────────────┘
                           │ /api/anthropic
                    ┌──────▼───────┐
                    │ Proxy (3001) │
                    │ adds API key │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │  Anthropic   │
                    │   API        │
                    └──────────────┘
```

- **`src/lyra.jsx`** — the app (edit this in Cursor)
- **`src/storage-shim.js`** — makes `window.storage` work with localStorage
- **`src/api-patch.js`** — routes API calls through local proxy (no CORS issues)
- **`server/proxy.js`** — adds your API key server-side, forwards to Anthropic
- **`.cursorrules`** — auto-loaded by Cursor Agent Mode for project context

## Tips

- Open browser on one half of screen, Cursor on the other
- Every time you save in Cursor, browser updates in <1 second
- Phone preview: open `http://YOUR_LOCAL_IP:3000` on your phone (same WiFi)
- The `.cursorrules` file is auto-read by Cursor — it knows the project architecture
- Reference `@LYRA-PROJECT-BRIEF.md` in Composer for full context on prompts & design
