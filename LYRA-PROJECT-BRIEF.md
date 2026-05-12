# Lyra AI Writing Coach — Project Brief for Cursor

> Paste this into Cursor as context when continuing development on lyra.jsx

---

## What is Lyra?

A mobile-first React JSX app (single file, ~1,384 lines) that teaches English writing through AI coaching. Runs as a Claude artifact (api.anthropic.com) or can be deployed standalone on Vercel with Gemini Flash.

**Core philosophy:** "We won't write it for you. But we'll make you scary good at it." The AI never writes for the student — it guides through Socratic questioning, structural frameworks, grammar correction with explanations, and vocabulary elevation.

---

## Tech Stack

- **Single-file React component** with hooks (useState, useRef, useEffect, useCallback)
- **API:** Claude Sonnet 4.6 (`claude-sonnet-4-6`) via `api.anthropic.com/v1/messages` — $3/$15 per million tokens
- **Web search:** `web_search_20250305` tool enabled on demand
- **Storage:** `window.storage` API (Claude artifact) — swap to `localStorage` for standalone deploy
- **No external UI libs** — all CSS-in-JS inline styles
- **Viewport:** mobile-first, max-width 430px, 100vh

---

## Visual Design

- **Fonts:** Courier Prime (body), Special Elite (main title only)
- **Palette:** warm parchment (#F7F5F2, #F4F1EE, #EDE9E5), taupe accents (#9E9A96, #B8B4AF), heading (#3A3530)
- **Logo:** Custom SVG feather quill (near-black #3A3530) with ink drops and magic swirl beneath nib
- **Animations:** fadeIn, fadeUp, slideUp, bounce, shimmer, blink, typewriter cursor, featherWrite (quill gliding), inkTrail, slideLeft (sidebar)
- **No emojis** in UI chrome (except mini-lesson cards which use 💡 and occasional fun emoji from AI)

---

## App Structure

### Onboarding (3 gated steps)

1. **Topic input:** Textarea with 12 rotating humorous placeholders + photo upload (camera/gallery) with OCR via Claude
2. **Writing type:** 6 cards with custom SVG icons — Complaint Letter, Business Email, Exam Essay, Story/Narrative, Report, Persuasive Writing
3. **Word count goal:** Pills — 50/100/150/200/300/400/500/600+

Session summary card → Confirm → Enter main app.

### Main App (2 tabs)

**Tab 1: Chat (Ask Lyra)**
- Header: feather avatar + writing type + word target + API call counter + "New" button
- Quick-action chips: "Outline structure", "Brainstorm ideas", "Search for facts" (web search)
- Chat bubbles with typewriter effect (~18ms/char) for AI responses
- Loading: 3 bouncing dots → replaced by typewriter
- **Message actions:** Tap any message → Edit / Delete / Resend (user msgs only)
- Inline edit textarea with Save/Cancel

**Tab 2: Preview (Writing Editor)**
- Editable title field + live word count progress bar
- **Ghost text:** 4-9 word predictions, 950ms after pause, "Accept →" button (mobile-friendly)
- **Structural suggestions:** Auto-fires 2.5s after paragraph completion, 3 technique cards (relative clauses, participial phrases, appositives, etc.), "Apply" button rewrites in-place
- **Proofread panel:** Grammar (up to 4 issues with examples) / Style (2 observations) / Vocabulary (3 upgrades)
- **Floating bar:** "Ask Lyra →" sends draft to chat

### Sidebar (projects/writings)
- Left-slide panel, 82% width, max 340px
- Projects with collapsible writing lists, rename/delete, move between projects
- Auto-save 2s after typing stops, persists via storage API
- Accessible from onboarding (☰ top-left) and main app (☰ bottom nav)

### Grammar Log
- Full-screen overlay from ··· button (bottom nav, red badge count)
- Auto-saves grammar issues from proofreads with: rule, phrase, correction, explanation, examples, date, source
- Grouped by date, individual delete, "Clear all"
- **"Teach me this" button** → fetches mini-lesson via API:
  - RULE / WHAT IT IS / THE TRICK (💡) / 3 funny EXAMPLES (✗/✓) / REMEMBER
  - Under 150 words, absurd/relatable scenarios, cool-teacher tone
- **"Ask Lyra about this" button** → sends rule+mistake to chat for live tutoring
- Mini-lessons also available on proofread panel grammar cards

### Bottom Navigation
- ☰ (sidebar) | Chat/Preview pill switcher (blue dot on Preview when draft exists) | ··· (grammar log)

---

## Key System Prompts

### 1. Coach prompt (buildCoachPrompt)
Dynamic with topic/type/wordcount. IRON RULES: never write for student, never complete sentences, never rewrite — describe what to fix via Socratic questions. Teaching toolkit: INTRO (hook→context→thesis), BODY (PEEL method), CONCLUSION (restate→summarise→broaden). Under 200 words unless teaching structure.

### 2. Ghost text prompt
Returns ONLY 4-9 word natural continuation, no explanation, no quotes.

### 3. Structural analysis prompt (buildStructuralPrompt)
Returns JSON with 3 technique suggestions. Formality-aware (formal types flag informal words). CRITICAL: preserve student's exact meaning/arguments, never add ideas, only restructure HOW it's written.

### 4. Proofread prompt (buildProofreadPrompt)
Returns JSON with grammar (with example_wrong/example_correct), style, vocabulary. Formality-aware. Receives appliedSuggestions array to avoid contradicting previous improvements.

### 5. Mini-lesson prompt (in fetchMiniLesson)
Brief concept card: RULE/WHAT IT IS/THE TRICK/3 funny EXAMPLES/REMEMBER. Max 150 words, funny, relatable to young people.

---

## State Variables (key ones)

```
step (0-3), topic, writingType, wordCount, tab ("chat"/"preview")
messages[], chatInput, chatLoading, typingMsg, editingMsgIdx, editingMsgText, activeMsgIdx
draft, docTitle, ghostText, showGhostHint, suggestions[], showSuggestions, appliedSuggestions[]
proofread, proofLoading, proofTab, showProofread
grammarLog[], showGrammarLog, checkFlash
miniLesson {} (entryId → {loading, content})
projects[], activeProjectId, activeWritingId, sidebarOpen
photoPreview, scanning, apiCalls
```

---

## API Integration

```javascript
// Text calls
callAI(systemPrompt, userMessage, useSearch = false)
→ POST api.anthropic.com/v1/messages
→ model: "claude-sonnet-4-6", max_tokens: 1000
→ tools: web_search_20250305 when useSearch=true

// Image calls (photo upload OCR)
→ Same endpoint, content array with image base64 + text prompt
```

---

## Important Design Decisions

1. **No Tab key on mobile** → "Accept →" button for ghost text, with e.preventDefault() + setTimeout focus trick to keep keyboard open
2. **Applied suggestions tracking** → proofread prompt receives list to avoid contradicting previous improvements
3. **Formality split** → Formal types (Complaint, Business, Exam, Report, Persuasive) flag informal language; Creative types (Story) accept it
4. **Typewriter on ALL AI responses** including welcome message (100ms delay)
5. **Green flash reward** on Proofread button + grammar badge when issues saved
6. **Auto-close suggestions panel** after applying improvement
7. **Feather writing animation** for loading states (proofread, photo scan, mini-lessons)

---

## Deployment (Vercel)

A separate `lyra-app/` Next.js project was created with:
- `/app/api/ai/route.js` — Gemini Flash proxy (keeps API key server-side)
- `/app/lyra-component.js` — the component with localStorage instead of window.storage
- `/app/page.js` + `/app/layout.js`
- Switch to Gemini 2.5 Flash ($0.15/$0.60) for 10-20x cost savings

---

## What to tell Cursor

When asking Cursor to modify lyra.jsx, remind it:
- Single-file React component, no imports except React hooks
- All styles inline (CSS-in-JS objects), no external CSS
- COLORS object at top defines the palette
- Mobile-first (430px max-width)
- API calls go through `callAI()` function
- `trackCall()` must be called before each API call for the counter
- All animations defined in the `<style>` tag inside the component's return
- Storage uses `window.storage.get/set` (Claude artifact) — NOT localStorage
