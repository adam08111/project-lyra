# Lyra — Improvements Report

## Current State (After Phase 1 Refactoring)

The monolithic 1,384-line `lyra.jsx` has been split into 13 focused modules. Vitest is installed with 36 passing tests. The proxy server now has rate limiting. An ErrorBoundary protects against crashes. Data export/import is available.

```
Source Code:  1,750 lines across 17 files
Test Code:      300 lines, 36 test cases (3 files)
Components:      10 React components
```

**Overall Code Health: 6.5/10**

---

## Remaining Improvements (Prioritized)

### CRITICAL — Do First

---

#### 1. Reduce State Complexity with useReducer

**Problem:** `lyra.jsx` still has 34 individual `useState` hooks managing tightly coupled state. This makes the component hard to reason about, leads to stale closures, and causes unnecessary re-renders.

**How to achieve:**

Group related state into reducers:

```javascript
// src/reducers/editorReducer.js
const initialEditorState = {
  title: "Untitled",
  draft: "",
  ghostText: "",
  ghostLoading: false,
  cursorPos: 0,
  suggestions: null,
  sugBadge: false,
  appliedSuggestions: [],
};

function editorReducer(state, action) {
  switch (action.type) {
    case "SET_DRAFT":
      return { ...state, draft: action.payload, ghostText: "" };
    case "ACCEPT_GHOST":
      return {
        ...state,
        draft: state.draft.slice(0, state.cursorPos) + action.payload + " " + state.draft.slice(state.cursorPos),
        ghostText: "",
        cursorPos: state.cursorPos + action.payload.length + 1,
      };
    case "SET_SUGGESTIONS":
      return { ...state, suggestions: action.payload, sugBadge: !!action.payload };
    case "APPLY_SUGGESTION":
      return {
        ...state,
        draft: state.draft.replace(action.payload.original, action.payload.improved),
        appliedSuggestions: [...state.appliedSuggestions, action.payload],
        suggestions: null,
      };
    // ... more actions
  }
}
```

Create 5 reducers:
- `editorReducer` — title, draft, ghost text, suggestions, applied suggestions
- `chatReducer` — messages, loading, typing message
- `proofReducer` — proofread result, tab, loading, checkFlash
- `projectReducer` — projects, activeWritingId, sidebar state
- `uiReducer` — screen, tab, grammarLog, showGrammarLog, miniLesson

**Impact:** Cuts `lyra.jsx` from 510 lines to ~300. Atomic state updates. Easier testing.

---

#### 2. Replace Silent Error Handling with Logging

**Problem:** 6 `catch(e) { /* silent */ }` blocks swallow errors. Users and developers get no feedback when storage fails, API calls break, or photo OCR errors out.

**How to achieve:**

Create a lightweight error logger:

```javascript
// src/utils/logger.js
const LOG_KEY = "lyra-error-log";

export function logError(context, error) {
  console.error(`[Lyra:${context}]`, error);

  // Optionally persist last 50 errors to localStorage for debugging
  try {
    const log = JSON.parse(localStorage.getItem(LOG_KEY) || "[]");
    log.unshift({
      context,
      message: error.message || String(error),
      timestamp: new Date().toISOString(),
    });
    localStorage.setItem(LOG_KEY, JSON.stringify(log.slice(0, 50)));
  } catch (_) { /* truly silent — logger itself shouldn't break the app */ }
}
```

Then replace every silent catch:

```javascript
// Before:
} catch (e) { /* silent */ }

// After:
} catch (e) { logError("storage:load-projects", e); }
```

**Files to update:**
- `src/lyra.jsx` — 4 storage operations, ghost text, structural suggestions
- `src/components/Onboarding.jsx` — photo OCR upload

**Impact:** Immediate visibility into production failures. Minimal code change.

---

#### 3. Add Component Tests

**Problem:** 36 tests exist but only cover utilities (api.js, constants.js, prompts.js). All 10 React components (861 lines) have zero test coverage. Estimated overall coverage: ~15%.

**How to achieve:**

Install React Testing Library:
```bash
npm install --save-dev @testing-library/react @testing-library/jest-dom jsdom
```

Update `vite.config.js`:
```javascript
test: {
  environment: "jsdom",
  setupFiles: "./tests/setup.js",
}
```

Create setup file:
```javascript
// tests/setup.js
import "@testing-library/jest-dom";

// Mock window.storage for all tests
window.storage = {
  async get() { throw new Error("not found"); },
  async set() { return {}; },
  async delete() { return {}; },
  async list() { return { keys: [] }; },
};
```

Write component tests:

```javascript
// tests/components/ErrorBoundary.test.jsx
import { render, screen } from "@testing-library/react";
import ErrorBoundary from "../../src/components/ErrorBoundary.jsx";

function BrokenComponent() {
  throw new Error("test crash");
}

it("shows error UI when child crashes", () => {
  render(
    <ErrorBoundary>
      <BrokenComponent />
    </ErrorBoundary>
  );
  expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  expect(screen.getByText("Reload Lyra")).toBeInTheDocument();
});
```

**Priority test files to create:**
1. `tests/components/ErrorBoundary.test.jsx` — crash recovery, reload button
2. `tests/components/Onboarding.test.jsx` — step navigation, validation gating
3. `tests/components/ChatTab.test.jsx` — message rendering, send, edit, delete
4. `tests/components/EditorTab.test.jsx` — draft editing, ghost text, proofread
5. `tests/components/Sidebar.test.jsx` — project CRUD, writing selection
6. `tests/components/GrammarLog.test.jsx` — entry display, deletion
7. `tests/components/DataExport.test.jsx` — export blob creation, import parsing

**Target:** 70%+ coverage with 50-60 additional test cases.

---

### HIGH PRIORITY — Next Sprint

---

#### 4. Extract Repeated Inline Styles

**Problem:** 40+ instances of duplicated style objects across components. The same button style, card border, caption text, and message bubble styles appear verbatim in multiple files.

**How to achieve:**

Expand `src/styles.js` with reusable style presets:

```javascript
export const sharedStyles = {
  // Existing
  app: { ... },
  btn: { ... },
  btnDisabled: { ... },
  card: { ... },
  chip: { ... },
  chipActive: { ... },

  // NEW — extracted from repeated patterns
  smallBtn: {
    padding: "4px 12px", borderRadius: 10,
    border: `1px solid ${COLORS.border}`, background: COLORS.card,
    fontFamily: "'Courier Prime', monospace", fontSize: 11, cursor: "pointer",
  },
  headerBtn: {
    padding: "6px 14px", borderRadius: 16,
    border: `1.5px solid ${COLORS.border}`, background: COLORS.card,
    fontFamily: "'Courier Prime', monospace", fontSize: 12, cursor: "pointer",
    color: COLORS.muted,
  },
  circleBtn: {
    width: 36, height: 36, borderRadius: 18,
    border: `1.5px solid ${COLORS.border}`, background: COLORS.card,
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer", color: COLORS.muted,
  },
  aiMessage: {
    background: COLORS.card, border: `1px solid ${COLORS.border}`,
    borderRadius: "4px 18px 18px 18px", padding: "12px 16px",
    fontSize: 14, lineHeight: 1.6, maxWidth: "85%", whiteSpace: "pre-wrap",
  },
  userMessage: {
    background: `linear-gradient(135deg, ${COLORS.accent2}, ${COLORS.accent1})`,
    color: "#fff", borderRadius: "18px 4px 18px 18px",
    padding: "12px 16px", fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap",
  },
  caption: {
    fontSize: 10, color: COLORS.accent2,
  },
  sectionTitle: {
    fontFamily: "'Courier Prime', monospace", fontSize: 15,
    fontWeight: 700, color: COLORS.heading,
  },
  panelOverlay: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    background: COLORS.card, borderTop: `1.5px solid ${COLORS.border}`,
    borderRadius: "18px 18px 0 0", padding: "18px",
    boxShadow: "0 -8px 32px rgba(0,0,0,0.08)", animation: "slideUp 0.3s ease",
    zIndex: 20,
  },
};
```

Then replace in components:
```javascript
// Before (repeated in 4+ files):
style={{ width: 36, height: 36, borderRadius: 18, border: `1.5px solid ${COLORS.border}`, background: COLORS.card, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 16, color: COLORS.muted }}

// After:
style={{ ...s.circleBtn, fontSize: 16 }}
```

**Impact:** Removes ~200-300 lines of duplicated code. Easier theming. Single source of truth for visual consistency.

---

#### 5. Add TypeScript (Incremental Migration)

**Problem:** No type safety across 1,750 lines. API responses are parsed with `JSON.parse()` and used directly without validation. Component props have no enforcement.

**How to achieve (incremental approach):**

**Phase 1 — Add TypeScript config (allows .js and .ts to coexist):**

```bash
npm install --save-dev typescript @types/react @types/react-dom
```

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "jsx": "react-jsx",
    "strict": true,
    "allowJs": true,
    "checkJs": false,
    "moduleResolution": "bundler",
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

**Phase 2 — Create type definitions file:**

```typescript
// src/types.ts
export interface Message {
  role: "user" | "ai";
  text: string;
  id?: number;
}

export interface Writing {
  id: string;
  title: string;
  topic: string;
  type: string;
  wordCount: number | string;
  draft: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  writings: Writing[];
}

export interface GrammarEntry {
  id: string;
  date: string;
  phrase: string;
  correction: string;
  rule: string;
  explanation: string;
  example_wrong: string;
  example_correct: string;
  topic: string;
}

export interface ProofreadResult {
  grammar: Array<{
    phrase: string;
    correction: string;
    rule: string;
    explanation: string;
    example_wrong: string;
    example_correct: string;
  }>;
  style: Array<{ observation: string; suggestion: string }>;
  vocabulary: Array<{ weak: string; stronger: string; reason: string }>;
  strengths: string;
  nextFocus: string;
}

export interface Suggestion {
  technique: string;
  description: string;
  original: string;
  improved: string;
  explanation: string;
}
```

**Phase 3 — Migrate files one at a time (rename .js to .ts/.tsx):**
Start with leaf modules: `constants.ts`, `prompts.ts`, `api.ts`, `hooks.ts`
Then move to components, starting with the simplest (Icons, MiniLessonCard)
Finish with `lyra.tsx`

**Impact:** Prevents 50-70 potential runtime bugs. IDE autocomplete. Self-documenting interfaces.

---

#### 6. Add JSDoc to All Exported Functions

**Problem:** Functions like `buildCoachPrompt()`, `callAI()`, and `buildProofreadPrompt()` have no documentation explaining parameters, return values, or side effects.

**How to achieve:**

```javascript
// src/prompts.js

/**
 * Builds the system prompt for Lyra's coaching chat.
 * Includes Socratic teaching rules, PEEL framework, and vocabulary guidance.
 *
 * @param {string} topic - The student's writing topic
 * @param {string} type - Writing type label (e.g. "Complaint Letter")
 * @param {number|string} wordCount - Target word count (number or "600+")
 * @returns {string} System prompt for the Claude API
 */
export function buildCoachPrompt(topic, type, wordCount) { ... }

/**
 * Calls the Anthropic Claude API with a system prompt and user message.
 * Optionally includes web search tool.
 *
 * @param {string} systemPrompt - System-level instructions
 * @param {string} userMessage - The user's message content
 * @param {boolean} [useSearch=false] - Whether to enable web search
 * @returns {Promise<string>} The assistant's text response
 * @throws {Error} On non-OK HTTP response with status code
 */
export async function callAI(systemPrompt, userMessage, useSearch = false) { ... }
```

**Files to document:** `api.js`, `prompts.js`, `hooks.js`, `constants.js`, all component exports.

---

### MEDIUM PRIORITY — Future Work

---

#### 7. Add React Context to Reduce Prop Drilling

**Problem:** `EditorTab` receives 28 props. `Sidebar` receives 15. Deep prop passing makes components tightly coupled and hard to refactor.

**How to achieve:**

```javascript
// src/context/LyraContext.jsx
import { createContext, useContext } from "react";

const LyraContext = createContext(null);

export function LyraProvider({ children, value }) {
  return <LyraContext.Provider value={value}>{children}</LyraContext.Provider>;
}

export function useLyra() {
  const ctx = useContext(LyraContext);
  if (!ctx) throw new Error("useLyra must be used within LyraProvider");
  return ctx;
}
```

Then wrap in `lyra.jsx`:
```jsx
<LyraProvider value={{ editor, chat, proofread, projects, actions }}>
  {tab === "chat" ? <ChatTab /> : <EditorTab />}
</LyraProvider>
```

Components consume only what they need:
```jsx
function EditorTab() {
  const { editor, actions } = useLyra();
  // No more 28 props
}
```

**Impact:** Cleaner component APIs. Easier to add new features. Better separation of concerns.

---

#### 8. Extract Magic Numbers to Named Constants

**Problem:** Hardcoded values scattered across `lyra.jsx` make behavior hard to tune and understand.

**How to achieve:**

```javascript
// src/constants.js (add to existing file)

export const DELAYS = {
  GHOST_TEXT_MS: 950,
  STRUCTURAL_SUGGESTIONS_MS: 2500,
  AUTO_SAVE_MS: 2000,
  TYPING_SPEED_MS: 18,
  WELCOME_DELAY_MS: 100,
  CHECK_FLASH_MS: 2000,
};

export const LIMITS = {
  GHOST_TEXT_MAX_CHARS: 80,
  DRAFT_CONTEXT_CHARS: 200,
  CHAT_CONTEXT_CHARS: 500,
  MIN_DRAFT_FOR_GHOST: 15,
  MIN_DRAFT_FOR_SUGGESTIONS: 50,
  MIN_PARAGRAPH_WORDS: 12,
  TOPIC_PREVIEW_CHARS: 80,
};

export const STORAGE_KEYS = {
  PROJECTS: "lyra-projects",
  GRAMMAR_LOG: "grammar-log",
};
```

---

#### 9. Add ESLint and Prettier

**Problem:** No formatting or linting rules. Code style varies between files.

**How to achieve:**

```bash
npm install --save-dev eslint prettier eslint-config-prettier eslint-plugin-react-hooks
```

```javascript
// eslint.config.js
import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  js.configs.recommended,
  {
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
];
```

```json
// .prettierrc
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 120
}
```

Add scripts:
```json
"lint": "eslint src/",
"format": "prettier --write src/"
```

---

#### 10. Add Accessibility (ARIA Labels)

**Problem:** Interactive elements like the hamburger button, grammar log button, and tab switcher have no ARIA labels. Screen readers cannot describe them.

**How to achieve:**

```jsx
// Before:
<button onClick={() => setSidebarOpen(true)} style={...}>☰</button>

// After:
<button onClick={() => setSidebarOpen(true)} style={...} aria-label="Open sidebar">☰</button>

// Before:
<button onClick={() => setShowGrammarLog(true)} style={...}>···</button>

// After:
<button onClick={() => setShowGrammarLog(true)} style={...} aria-label={`Grammar log (${grammarLog.length} mistakes)`}>···</button>
```

**Elements to update:** hamburger buttons (2), tab switcher buttons (2), grammar log button, close buttons (4), proofread button, file upload button, all action chips.

---

## Summary Table

| # | Improvement | Priority | Effort | Impact |
|---|------------|----------|--------|--------|
| 1 | useReducer for 34 useState hooks | Critical | 4-6 hrs | High — cleaner state, fewer bugs |
| 2 | Replace silent error handling | Critical | 1-2 hrs | High — instant debugging visibility |
| 3 | Add component tests (50+ cases) | Critical | 6-8 hrs | High — catch regressions |
| 4 | Extract repeated inline styles | High | 3-4 hrs | Medium — removes ~250 duplicate lines |
| 5 | TypeScript migration (incremental) | High | 20-30 hrs | High — prevents 50-70 runtime bugs |
| 6 | JSDoc on all exports | High | 2-3 hrs | Medium — better IDE experience |
| 7 | React Context for prop drilling | Medium | 4-6 hrs | Medium — cleaner component APIs |
| 8 | Named constants for magic numbers | Medium | 1 hr | Low — better readability |
| 9 | ESLint + Prettier setup | Medium | 1-2 hrs | Medium — consistent formatting |
| 10 | ARIA accessibility labels | Medium | 1-2 hrs | Medium — screen reader support |

---

## File Structure After All Improvements

```
lyra-dev/
├── src/
│   ├── types.ts                    # TypeScript interfaces
│   ├── lyra.tsx                    # ~300 lines (down from 510)
│   ├── main.tsx
│   ├── constants.ts                # + DELAYS, LIMITS, STORAGE_KEYS
│   ├── styles.ts                   # + 10 shared style presets
│   ├── prompts.ts
│   ├── api.ts
│   ├── hooks.ts
│   ├── api-patch.js
│   ├── storage-shim.js
│   ├── utils/
│   │   └── logger.ts              # Error logging utility
│   ├── context/
│   │   └── LyraContext.tsx         # React context provider
│   ├── reducers/
│   │   ├── editorReducer.ts
│   │   ├── chatReducer.ts
│   │   ├── proofReducer.ts
│   │   ├── projectReducer.ts
│   │   └── uiReducer.ts
│   └── components/
│       ├── Icons.tsx
│       ├── ErrorBoundary.tsx
│       ├── TypewriterBubble.tsx
│       ├── MiniLessonCard.tsx
│       ├── Onboarding.tsx
│       ├── ChatTab.tsx
│       ├── EditorTab.tsx
│       ├── Sidebar.tsx
│       ├── GrammarLog.tsx
│       └── DataExport.tsx
├── server/
│   └── proxy.js
├── tests/
│   ├── setup.js
│   ├── api.test.ts
│   ├── constants.test.ts
│   ├── prompts.test.ts
│   └── components/
│       ├── ErrorBoundary.test.tsx
│       ├── Onboarding.test.tsx
│       ├── ChatTab.test.tsx
│       ├── EditorTab.test.tsx
│       ├── Sidebar.test.tsx
│       ├── GrammarLog.test.tsx
│       └── DataExport.test.tsx
├── tsconfig.json
├── eslint.config.js
├── .prettierrc
├── package.json
├── vite.config.ts
└── index.html
```
