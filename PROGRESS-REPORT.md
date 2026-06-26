# Lyra AI Writing Coach — Progress Report
## For App Store Launch Feasibility Analysis

**Date:** 8 March 2026
**Status:** Active Development
**Total Codebase:** 4,280 lines (3,976 frontend + 304 server) — up from 3,031 on 6 Mar
**AI Model:** Google Gemini 3 Flash Preview (thinking model)

---

## 1. WHAT LYRA IS

Lyra is a mobile-first AI writing coach for English learners. It teaches writing through Socratic questioning — the AI never writes for the student. Instead, it guides them with frameworks, grammar corrections with explanations, vocabulary upgrades, and structural suggestions.

**Core philosophy:** "We won't write it for you. But we'll make you scary good at it."

**Target user:** English learners (ages 14+) writing essays, letters, reports, narratives, and persuasive pieces.

---

## 2. FEATURE INVENTORY

### 2.1 Onboarding Flow (Complete)
- Step 1: Name input with time-of-day greeting
- Step 2: Topic description textarea + photo upload with OCR (camera extracts question text via AI vision)
- Step 3: Writing type selector (6 types: Complaint Letter, Business Email, Exam Essay, Story/Narrative, Report, Persuasive Writing)
- Step 4: Word count goal (50–600+ words) with AI-powered skill matching
- Session summary card before entering main app
- **Style Skill Matching (3 states):**
  - If student has saved skills → AI matches the best 1-2 skills for the task with "Apply" buttons
  - If skills exist but none match → reassuring message, Lyra will still coach
  - If no skills saved → **AI Writer Search:** suggests 2-3 real writers strong at the student's writing type with "Find articles" Google search links + "Open Style Lab" button to guide skill building

### 2.2 Chat Tab — "Ask Lyra" (Complete)
- AI coaching chat with typewriter animation (~18ms/char)
- Socratic questioning: never writes sentences for the student
- **Quick-action chips:** "✦ Skills", "Outline structure", "Brainstorm ideas", "Search for facts"
- **✦ Skills chip (NEW):** Reads all saved style skills from localStorage, sends them to Lyra with the student's current draft, and asks Lyra to analyse which skills to deploy and how each solves a specific writing problem. If no skills are saved, opens Style Lab instead.
- Message actions: Edit / Delete / Resend
- Teaching toolkit: INTRO (hook→context→thesis), BODY (PEEL method), CONCLUSION (restate→summarise→broaden)
- **Persistent memory (NEW):** Lyra never re-introduces herself when students switch tabs. She remembers every message, references the student's draft by quoting specific sentences, and continues naturally mid-conversation.
- **Stop button (NEW):** When Lyra is responding, the send arrow (→) is replaced by a stop button (■). Clicking it aborts the in-flight API request via AbortController. If Lyra was mid-typewriter, the partial response is preserved. Placeholder text changes to "Lyra is thinking..." during loading. Enter key also triggers stop when Lyra is responding.
- **Full draft context (NEW):** Lyra receives up to 3,000 characters of the student's draft with every message, plus role-labelled conversation history ("Student: ..." / "Lyra: ...").

### 2.3 Writing Editor Tab (Complete)
- Live word count progress bar
- Ghost text predictions (currently disabled — awaiting tuning)
- Structural suggestions: auto-fires 2.5s after paragraph completion, 3 technique cards per batch (relative clauses, participial phrases, appositives, fronting/inversion, cleft sentences, etc.), "Apply" button rewrites in-place
- Proofread panel: Grammar (up to 4 issues with example_wrong/example_correct), Style (2 observations), Vocabulary (3 upgrades)
- Formality-aware: formal types flag informal language; creative types accept casual tone
- Applied suggestions tracking: proofread prompt never contradicts previous improvements
- **✦ Skills picker (NEW):** Button in editor toolbar opens a collapsible panel showing all saved skills. Students can deploy a skill directly from the editor, triggering role classification + auto-enrichment (see §2.8). Panel auto-opens when navigated to from Chat tab's skills chip.
- **Technique strip with PEEL role badges (NEW):** When a skill is deployed, each technique displays a coloured role badge: Point (blue), Evidence (green), Explain (grey), Link (light), Hook (amber), Conclude (amber). Expanded view shows "Use for: Evidence sentence" labels. If coverage gaps exist, "finding more techniques..." appears while web search fills missing PEEL roles.

### 2.4 Style Lab (Complete)
- **Analyse Style tab:** Paste any published passage (30+ words), AI identifies the author and generates a deep linguistic profile covering 8 sections:
  1. COMPARING AND DESCRIBING
  2. SENTENCE PATTERNS
  3. HOW IDEAS ARE CONNECTED
  4. WORD CHOICES
  5. GRAMMAR TRICKS
  6. HOW THE WRITER PERSUADES
  7. FEELING AND PERSONALITY
  8. SIGNATURE STYLE
- Each section includes: KEY IDEA, explanation, EXAMPLE quote, 5-part BREAKDOWN (Plain Meaning, Sentence Map, Grammar, Function, Use It), WHY IT WORKS, STRUCTURE template with student example, WRITER'S WORDS vocabulary pairs
- Streaming API with live progressive rendering (SSE)
- Critical sentence structure detection: inverted clauses, fronted adverbials, concession clauses, conditional inversions, parallel structures
- **Practice tab:** Students type simple sentences → AI transforms them using techniques from the analysis → structured response with ORIGINAL, REWRITE, and CONCEPTS APPLIED (each bullet names the exact section it came from)
- **Collapsible source viewer:** Each concept bullet has a "▶ View from analysis" toggle that expands to show the original analysis section — connecting theory to practice
- **Anti-bias system:** Coach prompt explicitly forbids using pre-existing knowledge of the author; only techniques from the student's analysis are permitted
- **Saved Concepts tab:** Bookmark grammar breakdowns for review, stored in localStorage, expandable accordion cards with grammar pattern, function, "try it yourself", and original example

### 2.5 Grammar Log (Complete)
- Persistent log of all grammar mistakes from proofreads
- Grouped by date, individual delete, "Clear all"
- "Teach me this" → AI-generated mini-lesson cards (rule, explanation, memory trick, funny examples)
- "Ask Lyra about this" → sends rule+mistake to chat for live tutoring

### 2.6 Project Management — Sidebar (Complete)
- Multiple projects with collapsible writing lists
- Project rename/delete/create
- Writing metadata (word count, date)
- Auto-save 2s after typing stops
- Data export/import as JSON backup

### 2.7 Error Handling (Complete)
- ErrorBoundary component with friendly crash screen
- "Reload Lyra" recovery button
- API retry logic with exponential backoff on server

### 2.8 Skill Deployment System (NEW — Complete)
This is the complete flow from skill selection to writing guidance:

```
Student clicks "✦ Skills" (in editor toolbar or chat chip)
  → If no saved skills → opens Style Lab
  → If in Chat → Lyra analyses which skills to deploy and why
  → If in Editor → Skills picker panel opens
    → Student clicks "Write with this skill"
    → applySkillWithEnrichment(skill) fires
    → Fast AI call classifies each technique's PEEL body paragraph role
    → Techniques shown immediately with coloured role badges
    → Coverage check: are all 4 PEEL roles covered?
    → If gaps: "finding more techniques..." + web search for missing roles
    → New techniques appear in accordion as they arrive
    → Student sees complete paragraph guidance
```

**Two access points, two behaviours:**
1. **Chat chip (✦ Skills):** Lyra AI analyses all saved skills against the student's draft and recommends which to deploy, explaining how each skill solves specific problems
2. **Editor button (✦ Skills):** Opens a picker panel for direct skill deployment with PEEL role classification + auto-enrichment

---

## 3. TECHNICAL ARCHITECTURE

### 3.1 Tech Stack
| Layer | Technology | Version |
|-------|-----------|---------|
| UI Framework | React | 18.3.1 |
| Build Tool | Vite | 6.0.0 |
| Server | Node.js HTTP (vanilla) | — |
| AI Backend | Google Gemini 3 Flash Preview | — |
| Storage | Browser localStorage | — |
| Testing | Vitest | 4.0.18 |
| Styling | CSS-in-JS (inline styles) | — |
| Fonts | Google Fonts CDN | — |

### 3.2 File Structure (24 source files)
```
src/
├── main.jsx              (12 lines)    Entry point
├── lyra.jsx              (719 lines)   Main app, all state management ↑ from 574
├── api.js                (60 lines)    AI client with streaming + thinking + abort
├── api-patch.js          (19 lines)    Fetch interceptor
├── storage-shim.js       (26 lines)    localStorage wrapper
├── constants.js          (36 lines)    Design system (colors, fonts, types)
├── styles.js             (38 lines)    Shared styles & 11 keyframe animations
├── hooks.js              (19 lines)    useTypewriter custom hook
├── prompts.js            (287 lines)   7 AI prompt templates ↑ from 239
├── titleGenerator.js     (53 lines)    Smart title generation
├── utils.js              (91 lines)    NEW — shared parseTechniques, stripMd, truncate
├── vite.config.js        (23 lines)    Vite config with proxy
└── components/
    ├── Onboarding.jsx    (477 lines)   Multi-step setup flow + skill matching ↑ from 430
    ├── StyleLab.jsx      (1,143 lines) Style analyzer + practice + concepts + skills ↑ from 820
    ├── EditorTab.jsx     (381 lines)   Editor + skills picker + technique strip ↑ from 225
    ├── ChatTab.jsx       (153 lines)   Chat + stop button + skills chip ↑ from 137
    ├── Sidebar.jsx       (115 lines)   Project manager
    ├── GrammarLog.jsx    (100 lines)   Mistake log viewer
    ├── ErrorBoundary.jsx (71 lines)    Crash handler
    ├── DataExport.jsx    (57 lines)    Backup/restore
    ├── Icons.jsx         (45 lines)    SVG icon library
    ├── MiniLessonCard.jsx(28 lines)    Grammar concept card
    └── TypewriterBubble.jsx(23 lines)  Typewriter animation

server/
└── proxy.js              (304 lines)   Gemini API proxy + rate limiting + SSE ↑ from 169

tests/
├── api.test.js           (6 tests)
├── constants.test.js     (11 tests)
├── prompts.js            (17 tests)
└── titleGenerator.test.js(14 tests)
                          ─────────
                          48 tests total
```

### 3.3 Design System
- **Typography:** Courier Prime (monospace typewriter feel), Special Elite (logo)
- **Palette:** Warm parchment (#F7F5F2), taupe accents (#9E9A96), dark heading (#3A3530)
- **Layout:** Mobile-first, max-width 430px, 100vh
- **Animations:** 11 keyframe animations (fadeIn, fadeUp, slideUp, bounce, shimmer, blink, pulse, featherWrite, inkTrail, slideLeft, fadeOverlay)
- **Icons:** All inline SVG (6 writing type icons + feather quill + avatar), zero external icon dependencies

### 3.4 AI Integration
- **Model:** Google Gemini 3 Flash Preview (thinking model — upgraded from 2.5 Flash)
- **Proxy server:** Node.js HTTP on port 3001 with:
  - Rate limiting: 30 req/min, 500 req/day
  - SSE streaming for real-time responses
  - Extended thinking support (thinkingBudget parameter)
  - Automatic retry with backoff
  - 180s timeout for long analyses
  - Google Search grounding for web search features
- **7 distinct prompt templates:** Coach (with persistent memory), Ghost text, Structural analysis, Proofread, Style profiler, Style coach, Role classifier
- **Inline prompts:** Skill matching (JSON array), Writer suggestions (JSON search queries), PEEL role classification (JSON array), Skills enrichment (web search)
- **Token management:** maxTokens tuned per feature (10,000 for style analysis, 4,096 for chat coaching, 4,000 for practice, 2,048 for enrichment/writer suggestions)
- **AbortController support (NEW):** Chat requests pass an AbortSignal through api.js to the fetch call, enabling user-initiated cancellation of in-flight requests
- **Note:** Gemini thinking tokens count toward maxOutputTokens — chat uses 4,096 to accommodate ~800-960 thinking tokens + response

### 3.5 Data Architecture
- **All data in localStorage** — no database, no accounts, no server-side storage
- Keys: projects, writings, grammar log, saved concepts, style skills, user name, active session
- Export/import as JSON for backup
- Auto-save with 2s debounce

---

## 4. WHAT IS COMPLETE vs IN PROGRESS

### Complete
- [x] Onboarding flow (4 steps + OCR + skill matching + AI writer search)
- [x] Chat coaching tab with persistent memory
- [x] Writing editor with ghost text (disabled) + structural suggestions
- [x] Proofread panel (grammar/style/vocabulary)
- [x] Grammar log with mini-lessons
- [x] Project management sidebar
- [x] Data export/import
- [x] Error boundary
- [x] Rate limiting
- [x] 48 unit tests
- [x] Style Lab: analyse writer's style (8-section profile) + streaming
- [x] Style Lab: practice tab with structured rewrite + concept application
- [x] Style Lab: collapsible source viewer linking concepts to analysis sections
- [x] Style Lab: saved concepts bookmarking
- [x] Style Lab: anti-bias system (ignores pre-existing author knowledge)
- [x] Style Lab: Skills tab — view, expand, delete saved skills
- [x] Style Skills auto-save after each analysis
- [x] Onboarding skill matching — AI matches saved skills to task (3-state UI)
- [x] AI Writer Search — suggests real writers with Google search links
- [x] All-skills context injection — coaching AI knows ALL saved skills
- [x] Extended thinking budget support
- [x] SSE streaming in api.js
- [x] **Skill deployment with PEEL role classification + auto-enrichment via web search**
- [x] **Technique strip with paragraph role badges (Point, Evidence, Explain, Link)**
- [x] **Skills picker in editor toolbar (collapsible panel)**
- [x] **✦ Skills chip in Chat — Lyra analyses and recommends skills for current draft**
- [x] **Persistent memory — Lyra never re-introduces, quotes student's draft, remembers full conversation**
- [x] **Stop button — abort in-flight AI requests, preserve partial typewriter responses**
- [x] **Full draft context (3,000 chars) sent with every chat message**
- [x] **Role-labelled conversation history (Student/Lyra) for accurate memory**
- [x] **AbortController signal propagation through api.js**

### Not Yet Built
- [ ] PWA manifest + service worker (offline support)
- [ ] User accounts / authentication
- [ ] Cloud database (data syncs across devices)
- [ ] Push notifications
- [ ] Analytics / error tracking (Sentry, Mixpanel)
- [ ] Accessibility (ARIA labels, screen reader, keyboard navigation)
- [ ] Native mobile wrapper (React Native / Capacitor / PWA-to-store)
- [ ] Payment / subscription system
- [ ] Onboarding tutorial / walkthrough
- [ ] Social features (share writing, peer review)
- [ ] Teacher dashboard / classroom mode
- [ ] Multi-language UI (currently English-only interface)
- [ ] Writing history / version tracking
- [ ] Performance metrics / writing improvement tracking over time

---

## 5. DEPENDENCIES

### Production (2)
| Package | Version | Purpose |
|---------|---------|---------|
| react | ^18.3.1 | UI framework |
| react-dom | ^18.3.1 | DOM rendering |

### Development (4)
| Package | Version | Purpose |
|---------|---------|---------|
| @vitejs/plugin-react | ^4.3.4 | Vite React plugin |
| concurrently | ^9.1.2 | Run multiple scripts |
| vite | ^6.0.0 | Build tool |
| vitest | ^4.0.18 | Test runner |

**Total production dependencies: 2** (extremely lean)

---

## 6. CURRENT LIMITATIONS

### 6.1 No Offline Support
- Requires internet for every AI interaction
- No service worker, no cached responses
- No PWA manifest — cannot be installed as app

### 6.2 No User Accounts
- All data lives in browser localStorage
- Data is lost if browser data is cleared
- No cross-device sync
- Export/import JSON is the only backup method

### 6.3 No Native Mobile Features
- No push notifications
- No haptic feedback
- No native share sheet
- No camera integration (uses web file input for OCR)
- No offline queuing of requests

### 6.4 Accessibility Gaps
- No ARIA labels or roles
- No screen reader support
- No keyboard navigation optimizations
- No semantic HTML (mostly styled divs)
- No high-contrast mode

### 6.5 No Analytics or Monitoring
- No crash reporting (Sentry)
- No usage analytics
- No A/B testing infrastructure
- Server logging is stdout only

### 6.6 API Cost Dependency
- Every feature requires an API call to Gemini
- Rate limited to 500 req/day
- No caching of repeated queries
- Extended thinking tokens consume budget unpredictably

---

## 7. APP STORE READINESS ASSESSMENT

### 7.1 What Works Today
- **UI is mobile-first:** 430px max-width, touch-optimized, no-zoom viewport
- **No external dependencies:** Only React + ReactDOM (2 packages)
- **Feature-complete core:** Writing coach, style analysis, skill ecosystem, grammar log — the full product loop works
- **Lightweight:** ~4,280 lines total, fast Vite builds, minimal bundle
- **Intelligent skill system:** Students build skills → AI recommends when to deploy → coach integrates techniques → PEEL role badges guide paragraph structure

### 7.2 Paths to iOS/Android

**Option A: PWA (Progressive Web App)**
- Add manifest.json + service worker
- Distribute via web URL (no app store needed)
- Can be added to home screen on both iOS and Android
- Limitation: No push notifications on iOS (until iOS 16.4+), no native feel
- Effort: ~1–2 days

**Option B: Capacitor/Ionic Wrapper**
- Wrap existing React app in native shell
- Full app store distribution
- Access to native APIs (camera, notifications, haptics)
- Existing codebase works with minimal changes
- Effort: ~3–5 days for basic wrapper, 1–2 weeks polished

**Option C: React Native Rewrite**
- Rewrite UI components using React Native
- Best native performance and feel
- Most engineering effort
- Can reuse: prompts, API logic, state management, business logic
- Must rewrite: all JSX/HTML → React Native components, all CSS-in-JS → StyleSheet
- Effort: ~4–8 weeks

**Option D: Expo + React Native Web**
- Write once in React Native, deploy to iOS + Android + Web
- Moderate rewrite effort (less than full RN rewrite)
- Effort: ~3–6 weeks

### 7.3 Critical Missing Pieces for App Store Launch

| Requirement | Status | Priority | Effort |
|-------------|--------|----------|--------|
| User accounts / auth | Not started | P0 | 1–2 weeks |
| Cloud database (Firestore/Supabase) | Not started | P0 | 1–2 weeks |
| Payment/subscription (RevenueCat/Stripe) | Not started | P0 | 1–2 weeks |
| Native wrapper (Capacitor) | Not started | P0 | 3–5 days |
| Push notifications | Not started | P1 | 2–3 days |
| Offline support / caching | Not started | P1 | 1 week |
| Analytics (Mixpanel/Amplitude) | Not started | P1 | 1–2 days |
| Crash reporting (Sentry) | Not started | P1 | 1 day |
| App Store assets (screenshots, descriptions) | Not started | P1 | 2–3 days |
| Accessibility (WCAG compliance) | Not started | P2 | 1–2 weeks |
| Privacy policy / Terms of Service | Not started | P0 | 1–2 days |
| Apple App Review compliance | Not started | P0 | Varies |
| Google Play Store compliance | Not started | P0 | Varies |
| Onboarding tutorial | Not started | P2 | 2–3 days |
| Writing improvement tracking | Not started | P2 | 1 week |

### 7.4 Revenue Model Considerations
- **Freemium:** X free analyses/day → subscription for unlimited
- **Subscription tiers:** Basic (chat coaching), Pro (Style Lab + unlimited), Classroom (teacher dashboard)
- **API cost per user:** At Gemini Flash pricing (~$0.15/$0.60 per million tokens), a heavy user might cost $0.02–0.10/day
- **Pricing benchmark:** Grammarly $12/mo, Quillbot $10/mo, language tutors $15–30/mo

---

## 8. KEY METRICS

| Metric | Value | Change since 6 Mar |
|--------|-------|--------------------|
| Total source lines | 4,280 | +1,249 (+41%) |
| Frontend lines | 3,976 | +1,114 |
| Server lines | 304 | +135 |
| Source files | 24 | +3 |
| Components | 11 | — |
| AI prompt templates | 7 | +1 |
| Unit tests | 48 | — |
| Production dependencies | 2 | — |
| Dev dependencies | 4 | — |
| Bundle size (est.) | ~180KB gzipped | — |
| Supported writing types | 6 | — |
| Style analysis sections | 8 | — |
| Animations | 11 keyframes | — |
| Design tokens (colors) | 15 | — |

---

## 9. COMPETITIVE POSITIONING

### What Makes Lyra Different
1. **Socratic approach:** Unlike Grammarly/QuillBot which just fix text, Lyra teaches WHY
2. **Style Lab:** No competitor offers "paste a passage → learn that writer's style → practice it"
3. **Concept-to-practice loop:** Analysis → Save → Practice → See which concepts applied — closed learning loop
4. **Skills ecosystem:** Style skills auto-save → AI matches relevant skills to new tasks → coach references all studied styles → students build a personal writing toolkit over time
5. **AI-powered skill recommendation (NEW):** Students click ✦ Skills in chat → Lyra reads their draft, reads their saved skills, and recommends exactly which skills to deploy and HOW each skill solves specific problems in their writing
6. **PEEL paragraph guidance (NEW):** Deployed skills are classified into body paragraph roles (Point, Evidence, Explain, Link) with coloured badges — students see exactly WHERE in the paragraph each technique belongs. Missing roles are auto-filled via web search.
7. **AI Writer Search:** When students lack skills, Lyra proactively suggests real writers to study with Google search links — turning "you have no skills" into an active learning opportunity
8. **Grammar log with mini-lessons:** Mistakes become learning opportunities with funny, memorable explanations
9. **Formality-aware:** Automatically adjusts coaching for formal vs creative writing
10. **Anti-bias coaching:** Practice tab uses ONLY what the student studied, not AI's pre-existing knowledge
11. **Persistent memory (NEW):** Lyra remembers the entire conversation, references specific sentences from the student's draft, and never re-introduces herself across tab switches

### Closest Competitors
- **Grammarly:** Grammar correction, no teaching
- **QuillBot:** Paraphrasing tool, no coaching
- **Hemingway Editor:** Readability scoring, no AI coaching
- **Duolingo:** Language learning but not writing-focused
- **Lex.page:** AI writing assistant for professionals, not learners

---

## 10. CHANGES SINCE LAST REPORT (6 Mar → 8 Mar)

### New Features Built
1. **Skill deployment with PEEL roles** — `applySkillWithEnrichment()` in lyra.jsx: classifies each technique into Point/Evidence/Explanation/Link roles via fast AI call, shows immediately, then auto-searches web for missing roles
2. **Technique strip in editor** — Collapsible accordion in EditorTab.jsx showing deployed techniques with coloured paragraph-role badges and "Use for: X sentence" labels
3. **Skills picker in editor** — ✦ Skills button in toolbar opens SavedSkills panel inline, no overlay needed
4. **✦ Skills chip in Chat** — Reads saved skills, sends to Lyra who analyses draft and recommends specific skills for specific problems
5. **Persistent memory** — Coach prompt updated with PERSISTENT MEMORY rules; conversation history sent as role-labelled format; full draft (3,000 chars) included in every request
6. **Stop button** — AbortController-based cancellation for in-flight chat requests. Send button swaps to stop icon during loading. Partial typewriter responses are preserved.
7. **Shared utilities** — Extracted parseTechniques, stripMd, truncate to src/utils.js for reuse across Onboarding and lyra.jsx

### Key Bug Fixes
- **Lyra response truncation:** Gemini thinking tokens consumed 957 of 1000 maxOutputTokens, leaving only 43 for actual response. Fixed by increasing chat maxTokens from 1,000 to 4,096.
- **Draft invisible to Lyra:** Was sending only 500 chars of draft. Increased to 3,000.
- **Conversation history losing speaker identity:** Changed from flat text join to role-labelled "Student: ... / Lyra: ..." format with delimiters.
- **Lyra re-introducing herself on every tab switch:** Added PERSISTENT MEMORY section to coach prompt.

### Files Changed
- `src/lyra.jsx` — 574 → 719 lines (+145): abort support, applySkillWithEnrichment, stopChat, skills chip callback, persistent memory in sendChat
- `src/components/EditorTab.jsx` — 225 → 381 lines (+156): skills picker panel, technique strip with role badges, enrichment status
- `src/components/ChatTab.jsx` — 137 → 153 lines (+16): stop button, skills chip, disabled-during-loading states
- `src/components/StyleLab.jsx` — 820 → 1,143 lines (+323): SavedSkills exported, expanded skill cards
- `src/components/Onboarding.jsx` — 430 → 477 lines (+47): imports shared parseTechniques from utils
- `src/prompts.js` — 239 → 287 lines (+48): persistent memory section, role classifier prompt
- `src/api.js` — 57 → 60 lines (+3): AbortSignal parameter
- `src/utils.js` — NEW (91 lines): shared parseTechniques with paragraphRole extraction
- `server/proxy.js` — 169 → 304 lines (+135): Google Search grounding, Gemini 3 Flash Preview support

---

## 11. SUMMARY

Lyra is a feature-complete AI writing coach with a unique pedagogical approach. The core product loop is now fully closed:

**Onboard → AI matches/suggests skills → Write → Deploy skills with PEEL guidance → Get coached with skill context + persistent memory → Learn from mistakes → Analyse published styles → Save skills → Skills auto-match next task**

The skill deployment system (§2.8) represents the biggest architectural addition since the last report: students don't just have skills — they can deploy them with paragraph-level guidance, and Lyra can proactively recommend which skills to use based on the student's specific draft problems.

**For app store launch, the primary gaps are infrastructure (auth, database, payments, native wrapper), not features.** The product itself is differentiated and the codebase is lean (4,280 lines, 2 dependencies), making it highly portable.

**Recommended path:** Capacitor wrapper (fastest to market) + Firebase Auth + Firestore + RevenueCat for subscriptions. Estimated timeline to MVP app store submission: 4–6 weeks with focused development.

---

## 12. UPDATE — 10 May 2026

### 12.1 Unified App Architecture (NEW)

**Source → X-Ray → Mission → Build** — replaced the previous disconnected Onboarding + Style Lab entry points with a single linear flow. Students now paste reference text FIRST, Lyra X-Rays it, and the extracted techniques ground the entire coaching session that follows.

- **`SourceSetup.jsx`** (NEW, ~492 lines) — three-step entry component:
  - Step 1: Source — paste/photograph an article (≥80 words), click "X-Ray This Writing", or skip
  - Step 2: X-Ray — render `XRayView` with streaming analysis results
  - Step 3: Mission — topic/type, then purpose/wordcount → "Start Writing"
- **`XRayView.jsx`** (NEW, ~720+ lines) — extracted reusable analysis-display component from StyleLab so both Style Lab and SourceSetup share the same X-Ray UI
- **`lyra.jsx`** wired with new state (`sourceText`, `sourceAnalysis`, `extractedSkills`, `targetVoice`); default screen changed from `"onboarding"` to `"source-setup"`
- **`prompts.js`** — added optional `sourceContext` parameter to all 4 main prompt builders so chat coaching, scaffolding, structural suggestions, and proofread are all aware of which author/techniques the student is studying

### 12.2 Three-Tier AI Router (NEW)

`src/ai-router.js` upgraded from a 2-tier flat config to a strategic 3-tier model strategy:

| Tier | Model | Brain prompt | Tasks |
|------|-------|-------------|-------|
| **PRO** | `gemini-3-flash-preview` | Yes (LYRA_BRAIN) | style_analysis, chat_coaching, scaffolding, training_eval, training_hint, voice_synthesis, writing_dna |
| **FLASH** | `gemini-flash-latest` | No | skill_enrich, peel_classify, writer_search, skill_match, practice_rewrite |
| **LITE** | `gemini-3.1-flash-lite-preview` | No | proofread, structural_suggest, training_exercise, grammar_lesson, **translate** |

New `needsBrain()` export marks pedagogical tasks; new `translate` route (Lite tier, no thinking budget) powers the translation feature below.

### 12.3 Sentence-by-Sentence Translation (NEW)

Hong Kong / Taiwanese 繁體中文 translation built into the X-Ray view. Helps 14-year-old English learners understand source material without leaving the app.

- **「翻譯成中文」 button** on the original-text panel header (top-right of the collapsible)
- **「翻譯成中文」 button** on each technique section card (top-right of the section title)
- **Toggle behavior**: first click translates + shows; second click hides; third click shows cached (no re-call)
- **EN/ZH pair format** for the original text — student sees each English sentence with its Chinese translation directly below for sentence-level comparison
- **Smart routing for section cards** — translation pairs are distributed across sub-sections by matching:
  1. English-side label (`FROM THE TEXT:`, `BREAKDOWN:`, `WHY IT WORKS:`, etc.)
  2. Chinese-side label (`文中引述`, `解析`, `為什麼有效`, etc.)
  3. Substring match against source content
  4. Fallback to first pair for keyIdea
- **Card-style breakdown rendering** — Chinese SENTENCE BREAKDOWN translation mirrors the English layout with bold labels (淺白解釋, 文法), shaded "功能" box, and dashed "試著使用" box
- **DIFFICULTY filtered** — both source line and translation pair stripped (students don't need difficulty ratings)
- **Cost**: ~$0.001 per Guardian-article translation on Flash Lite

### 12.4 Critical UTF-8 Streaming Fix

**Bug:** Chinese characters and em-dashes (—) were rendering as `��` corruption in chat coaching, X-Ray analysis, and translation responses.

**Root cause:** Multi-byte UTF-8 characters (Chinese = 3 bytes, em-dash = 3 bytes, emoji = 4 bytes) were being split across TCP packet boundaries. The proxy was calling `chunk.toString()` on every Buffer chunk, which immediately turned partial bytes into U+FFFD (replacement character).

**Fix in `server/proxy.js` — 4 locations corrected:**

| Path | Before | After |
|------|--------|-------|
| Inbound request body | `body += chunk` | `Buffer.concat(bodyChunks).toString("utf8")` at end |
| Streaming error body | `errBody += c` | `Buffer.concat(errChunks).toString("utf8")` at end |
| Streaming response | `buffer += chunk.toString()` | `StringDecoder("utf8").write(chunk)` per chunk |
| Non-streaming response (translation!) | `responseBody += chunk` | `Buffer.concat(respChunks).toString("utf8")` at end |

Streaming uses `StringDecoder` (holds incomplete sequences across chunks); non-streaming uses `Buffer.concat` (concatenates raw bytes, decodes once).

### 12.5 Performance Fix — X-Ray Freeze on Click

**Bug:** Clicking "X-Ray This Writing" appeared to freeze the page for 15-30s before any visible content.

**Root cause:** Three compounding issues —
1. `parseProfileSections` was running on every streamed token, re-parsing the full growing response (O(n²) work blocked the UI thread)
2. Thinking budget of 4096 tokens meant Gemini was "thinking silently" before producing visible output
3. Step 2 (X-Ray view) only rendered AFTER full stream completion, even though sections were arriving mid-stream

**Fixes in `SourceSetup.jsx`:**
- Throttled chunk parsing to every 400ms (avoids O(n²) thrash)
- Auto-advance to Step 2 as soon as the first technique parses, so students see content stream in
- Lowered `style_analysis` thinking budget 4096 → 2048 (cuts silent wait roughly in half)

### 12.6 Global Karpathy Coding Guidelines (NEW)

Installed `~/.claude/CLAUDE.md` based on [forrestchang/andrej-karpathy-skills](https://github.com/forrestchang/andrej-karpathy-skills). Auto-loads in every Claude Code session, applies four principles globally:
1. Think Before Coding
2. Simplicity First
3. Surgical Changes
4. Goal-Driven Execution

### 12.7 Files Changed (since 8 March 2026)

| File | Status | Purpose |
|------|--------|---------|
| `src/components/SourceSetup.jsx` | NEW (~492 lines) | Source → X-Ray → Mission unified entry |
| `src/components/XRayView.jsx` | NEW (~720 lines) | Reusable analysis display + translation logic |
| `src/components/TrainingSession.jsx` | NEW (~557 lines) | Reporter→Columnist voice training |
| `src/learning-sync.js` | NEW (~142 lines) | LYRA_BRAIN learning sync |
| `src/lyra-brain.js` | NEW (~310 lines) | Pedagogical system prompt |
| `src/ai-router.js` | NEW → upgraded to 3-tier | Pro/Flash/Lite routing + brain flag |
| `src/prompts.js` | UPDATED | sourceContext param, translatePrompt, removed DIFFICULTY |
| `src/lyra.jsx` | UPDATED | Source-setup screen, sourceContext wiring |
| `src/components/StyleLab.jsx` | REFACTORED | Imports from XRayView (deleted ~590 dup lines) |
| `server/proxy.js` | UPDATED | 4 UTF-8 fixes, gemini-3-flash-preview added to allowlist |

### 12.8 GitHub

Repository pushed to public GitHub: **https://github.com/adam08111/project-lyra**

### 12.9 X-Ray Translation Polish (11-12 May 2026)

Multiple iterations on the X-Ray section-card translation UI in `XRayView.jsx`:

- **Universal English-label rendering** — every translated section now shows its source label (KEY IDEA, FROM THE TEXT, BREAKDOWN, PLAIN MEANING, GRAMMAR, FUNCTION, USE IT, WHY IT WORKS, STRUCTURE, WRITER'S WORDS, WATCH OUT) as a bold prefix on the Chinese line, matching the layout students see in the English source above.
- **Card-style breakdown** — Chinese BREAKDOWN translation mirrors the English breakdown card with bold sub-labels, FUNCTION in shaded box, USE IT in dashed box with "For example:" cream-coloured inner card.
- **Annotation preservation** — `{phrase}[label]` markers in FROM THE TEXT survive translation. `translatePrompt` was extended with explicit rules to keep these markers AND translate both the phrase and label into Chinese.
- **For example arrow split** — `template → example` content split across SectionCard's "Try it yourself" (English), SectionCard's "TRY THIS PATTERN" (English), renderBreakdownTranslation's USE IT (Chinese), renderStructureTranslation (Chinese), and SavedConceptCard's useIt (both). Example renders in a cream-coloured inner card.
- **Universal label stripper** — `stripRedundantPrefix` now uses a single regex `^[一-龥]{1,10}[:：]` looping up to 3× to handle nested Chinese label prefixes (e.g. `解析：簡單意思：xxx`) without maintaining a synonym list.
- **Two-format parser** — `parseTranslationPairs` handles both EN/ZH pair format AND hybrid format (English label + Chinese content without EN:/ZH: prefixes). Robust scan for EN/ZH markers anywhere in text, not just blank-line delimited blocks.
- **WATCH OUT routed to own bucket** — was previously folded into body; now displays as its own labeled line.
- **Saved-concept translation** — each saved concept card in Style Lab gets a 翻譯成中文 button in its header; expanded view shows English label prefix + Chinese inline under each sub-section (grammar, function, useIt template + example, source quote).
- **Source quote display** — `renderExampleTranslation` puts the Chinese translation in a beige card matching the English FROM THE TEXT card, with AnnotatedQuote rendering preserved annotation markers.

Known issues that remain (12 May 2026):
- Translation parser occasionally still surfaces inline `ZH:` markers when the AI mixes both EN and ZH content on the same line without proper delimiters. Multiple parser revisions attempted but the underlying cause is the AI ignoring the prompt's strict format rule on some requests. A more deterministic structured-output format may be needed.

### 12.10 Other Changes

- **DIFFICULTY removed** from prompt template and parser — no longer shown in cards.
- **SIGNATURE STYLE hidden** from card display (still in prompt for future use).
- **Section numbering** — each technique card prefixed with `1.`, `2.`, etc. on the KEY IDEA line; the Chinese KEY IDEA translation mirrors the numbering.
- **saveStyleSkill bug fix** — validator was missing WORD CHOICES and FEELING AND PERSONALITY from its technique list, causing false "too-short" warnings on legitimate analyses. Now counts all 7 technique sections with `≥ 2` threshold.

---

## 13. UPDATE — 14 May 2026

### 13.1 Annotation Rendering Rebuilt (`AnnotatedQuote`)

The `{phrase}[label]` annotated quote rendering in `src/components/XRayView.jsx` went through several layouts (per-word inline-block, inline-flex column, position-absolute overlay) before settling on a **refined ruby approach** that handles both English and CJK labels universally:

- Phrase allowed to wrap naturally at word boundaries (no `whiteSpace: nowrap` on the ruby base)
- Label (rt) **auto-styles by content type** via `/[一-龥]/.test(seg.label)`:
  - CJK labels (隱喻, 方式狀語從句): fontSize 13, no letter-spacing, no lowercase-transform, lineHeight 1.3
  - English labels (metaphor, adverbial clause of manner): fontSize 11, letter-spacing 0.5, lowercase, lineHeight 1.1
- `wordBreak: keep-all` on the rt prevents CJK characters splitting mid-word (e.g., 隱喻 staying together instead of breaking to 隱 / 喻)
- `transform: translateY(-3px)` + `marginBottom: 6` lifts the label off the underlined phrase visually
- Universal — applies to both the English FROM THE TEXT card and the Chinese 譯文 card automatically

### 13.2 Universal Prefix Stripper

`stripRedundantPrefix` extended to handle four prefix classes in a single 5-iteration loop:

1. **Chinese label prefix** `^[一-龥]{1,10}[:：]` — existing
2. **English source label prefix** (`KEY IDEA` / `FROM THE TEXT` / `GRAMMAR` / `FUNCTION` / `WHY IT WORKS` / etc.) — NEW
3. **Stray `EN:` / `ZH:` markers** — resolves the §12.9 known bug
4. **Leading pipe separator** (`| GRAMMAR:` pattern that the AI uses in breakdown rows) — NEW

Universal across every translation renderer: `renderPairs`, `renderKeyIdeaAndBody`, `renderExampleTranslation`, `renderStructureTranslation`, `renderBreakdownTranslation`.

### 13.3 Breakdown Translation Parser — English Label Support

`renderBreakdownTranslation` had a failure mode where the AI preserved English sub-labels (`PLAIN MEANING:`, `GRAMMAR:`, `FUNCTION:`, `USE IT:`) inside the Chinese translation. The slow-path Chinese-only label dictionaries missed them, the parser fell through to raw `renderPairs`, and the user saw loose unstyled lines like `| GRAMMAR: 這裡使用了...`.

Fixes:

- Slow-path dictionaries now include English regex equivalents: `PLAIN\s+MEANING`, `GRAMMAR`, `FUNCTION`, `USE\s+IT`
- Position-based segment regex extended to match English labels too (case-insensitive)
- New **"leading content" fallback** captures any text before the first matched label as PLAIN MEANING (rescues cases where the AI omits the leading label entirely)
- Last-resort fallback now wraps `renderPairs` output in a styled BREAKDOWN card so visual consistency holds regardless of parse outcome

### 13.4 Translation Card — Chinese Sub-Labels

Translation cards now display Chinese sub-labels in place of preserved English ones:

| English (source card) | Chinese (translation card) |
|---|---|
| `TRANSLATION` (header) | `譯文` |
| `BREAKDOWN` (header) | `句子解析` |
| `PLAIN MEANING:` | `淺白解釋：` |
| `GRAMMAR:` | `文法：` |
| `FUNCTION:` | `功能：` |
| `USE IT:` | `試著使用：` |
| `For example:` | `例如：` |
| `WHY IT WORKS:` | `寫法的好處：` |

`renderPairs` auto-detects CJK content in `bucketLabels` and emits the Chinese full-width colon `：` for CJK labels, ASCII `": "` for English labels.

### 13.5 Visual Spacing Polish

| Element | Before | After |
|---|---|---|
| `譯文` header font-size | 10 | 13 |
| English FROM THE TEXT card line-height | 2.1 | 4.5 |
| Chinese 譯文 card line-height | 2.1 | 4.5 |
| Annotation label lift | none | `translateY(-3px) + marginBottom: 6` |

Both cards now have generous vertical room so annotation labels sit clearly above their phrases without crowding the line above.

### 13.6 Prefix Cleanups (renderer-side)

- `FROM THE TEXT:` duplicated prefix on the 譯文 card → removed (the universal `stripRedundantPrefix` handles the AI-emitted one; the renderer-added one was dropped)
- `KEY IDEA:` prefix on translated key-idea line → removed (kept the `1.` / `2.` numbering)

### 13.7 Dev Environment Setup (worktree-local)

The worktree at `src/.claude/worktrees/nifty-ritchie-06acd9/` had no `.claude/launch.json` of its own and the preview-MCP-registered servers from 10 May were 3+ days stale (missing the §12.4 UTF-8 fix). Recovery:

- Killed orphan `node.exe` (PID 22568) squatting on port 3001 alongside the registered proxy
- Created worktree-local `.claude/launch.json` + `.claude/start-vite.mjs` — the latter uses **single `..`** to resolve the project root because `.claude/` sits at the worktree root (whereas the main repo's `.claude/` is one level nested at `src/.claude/`, hence its `../..`)
- Copied `.env` from `C:\Users\Owner\Downloads\lyra-dev\.env` into the worktree root so `server/proxy.js` could find `GEMINI_API_KEY` via its `resolve(__dirname, "../.env")` lookup

### 13.8 Known Issue from §12.9 — Status

The §12.9 "inline `ZH:` markers leaking through" known issue is now addressed by extension of `stripRedundantPrefix` (rule #3 above). Subsequent leaks of any English source label or pipe separator are also caught by the same universal stripper.

### 13.9 Files Changed (since 13 May 2026)

| File | Status | Purpose |
|---|---|---|
| `src/components/XRayView.jsx` | UPDATED | `AnnotatedQuote` rebuild, `stripRedundantPrefix` universal extension, `renderBreakdownTranslation` English-label parsing + leading-content fallback + styled fallback card, Chinese sub-label translations, CJK-aware colon rendering, spacing/font-size polish |
| `.claude/launch.json` | NEW (worktree-local) | Worktree dev server config |
| `.claude/start-vite.mjs` | NEW (worktree-local) | Worktree-local Vite launcher (single `..` for worktree root) |
| `.env` | NEW (worktree-local, copied from main repo, gitignored) | Proxy API key lookup |

---

## 14. UPDATE — 17 May 2026

A long debugging session focused on hardening the LITE-tier translation pipeline. The LITE model (`gemini-3.1-flash-lite-preview`) is reliable on simple inputs but exhibits several quirky failure modes on complex labelled content: silent sub-section skips, mid-line `EN:` / `ZH:` markers without newlines, dropped EN prefixes, and `| LABEL:` row-prefix corruption. Multiple universal fixes landed to make the rendered translation card resilient regardless of how the AI formats its output.

### 14.1 `translateWithGuard` — Universal Completeness Guard

Extracted a module-level helper in `src/components/XRayView.jsx` that every translation path now routes through:

```js
translateWithGuard(sourceText, route, trackCall, expectedUnits?)
```

How it works:
1. Fires the main translate call.
2. Parses the response via `parseTranslationPairs`.
3. Detects two classes of missing translations:
   - **Universal**: orphan EN pairs (any EN with empty or missing ZH) — catches sentence-level skips in raw passages
   - **Caller-supplied**: labelled expected units (KEY IDEA / FROM THE TEXT / BREAKDOWN sub-labels / etc.) — caller passes them as an array
4. Fires focused parallel re-translate calls for each missing item.
5. Validates each focused response (must parse to ≥1 valid pair with non-empty zh) before appending — bare echoed source lines are dropped so they can't corrupt the trailing pair's content.

Used by:

| Caller | expectedUnits passed |
|---|---|
| `SectionCard.handleTranslate` (X-Ray section translation) | All labelled units from `parts` + breakdown sub-labels (PLAIN MEANING / GRAMMAR / FUNCTION / USE IT) |
| `XRayView.handleTranslate` (raw reference passage translation in Style Lab) | None — orphan-EN detection alone handles sentence skips |

### 14.2 `parseTranslationPairs` Hardening

Two structural fixes in `parseTranslationPairs`:

1. **Mid-line EN/ZH marker normalization** — LITE often emits subsequent `EN:` / `ZH:` markers mid-line (after a period or whitespace) without a newline. Added a pre-normalize pass that inserts `\n` before any mid-line marker so the strict `(^|\n)` boundary regex catches them all instead of only catching the first.

2. **Orphan EN handling** — when an `EN:` is followed by another `EN:` (no `ZH:` between), the pair was previously discarded silently. Now emits a pair with `zh: ""` so `translateWithGuard` can detect the silent skip.

### 14.3 `parseStructureContent` — Universal STRUCTURE Parser

New exported helper that parses the AI's STRUCTURE content into one of three shapes:

```
{ kind: "task-example", intro, task, example }   // TYPE 2/3 — REWRITE PROMPT / HYBRID
{ kind: "template-arrow", template, example }    // TYPE 1 — FILL-IN-THE-BLANK
{ kind: "plain", template }                      // unmatched
```

Strips inline labels (`TYPE N — XXX:`, Chinese `第一類型 — XXX：`, `Flat:`, `中性句：` / `平實句：` and 9 other Chinese synonyms) before parsing. Auto-detects English (`Task:` / `Example:`) AND translated Chinese (`任務：` / `範例：` / `例子：` / `例如：`) labels in the same regex.

Used universally by FOUR render sites — XRayView SectionCard (English source), XRayView `renderStructureTranslation` (Chinese translation), StyleLab SavedSkills, EditorTab technique strip.

### 14.4 Universal `stripRedundantPrefix` Extension

Extended to handle five prefix classes in one loop:

1. Chinese label prefix (`^[一-龥]{1,10}[:：]`) — existing
2. English source label prefix (`KEY IDEA` / `FROM THE TEXT` / `GRAMMAR` / etc.) — added §13
3. Stray `EN:` / `ZH:` markers (resolves §12.9) — added §13
4. Leading pipe separator (`| GRAMMAR:` row format) — NEW
5. TYPE markers — English (`TYPE 1 — FILL-IN-THE-BLANK:` / `TYPE 1 — FILL-IN-THE-BLANK.`) AND Chinese (`第一類型 — 填空題：` / `類型 1 — XXX：` / `型 1 — XXX：` variants) — NEW

### 14.5 Universal Pipe-Strip in Routing

The AI sometimes prefixes breakdown rows with `| ` separators (`EN: | GRAMMAR: ...` / `ZH: | 文法：...`). The leading `|` defeated the `^GRAMMAR` anchor in routing regexes, causing GRAMMAR / FUNCTION pairs to fall to the body bucket and disappear from the breakdown card.

Universal fix — applied at all three routing decision points:
- `groupPairsBySource` — added `labelProbe()` that strips `^[|｜]\s*` from both `en` and `zh` before regex testing
- `renderBreakdownTranslation` Fast Path — same strip on `en` before label tests
- `translateWithGuard` completeness covered-check — same strip when verifying coverage

### 14.6 Pattern-Based STRUCTURE / VOCAB Routing

The AI sometimes orphans STRUCTURE template/example pairs (the template line after `STRUCTURE: TYPE 1 — FILL-IN-THE-BLANK.` lacks any label) and WRITER'S WORDS vocab pairs (each `plain → "fancy"` pair emitted without the `WRITER'S WORDS:` parent). These orphans were falling to body / wrong buckets via the substring fallback.

Added pattern-based rules to `enLabelMap` AND mirrored in `zhLabelMap`:

| Pattern | Bucket | Catches |
|---|---|---|
| `_{3,}[\s\S]*?_{3,}` | structure | TYPE 1 fill-in-the-blank templates (multiple `____` runs) |
| `^["「『]?\s*(?:→\|→\|->)\s` | structure | TYPE 1 arrow examples (`→ "Example sentence"`) |
| `^[^→\n_"「『]{2,}\s(?:→\|→\|->)\s.*["」『]` | vocabUpgrade | True vocab pairs (content + arrow + quoted, NOT starting with arrow/blank/quote) |

Also added Flat/Task/Example/Pattern keyword routing — TYPE 2/3 STRUCTURE sub-pieces emitted as their own pairs without the STRUCTURE parent now route to structure correctly.

### 14.7 Translation Card UI Rebuild

Multiple iterations on the Chinese translation card visual design driven by user feedback:

- **譯文 header** (was `翻譯 · TRANSLATION`) at fontSize 13
- **No `FROM THE TEXT:` prefix** in translation card (cleaner — the 譯文 header is enough context)
- **句子解析 BREAKDOWN card** with Chinese sub-labels: `淺白解釋：` / `文法：` / `功能：` / `試著使用：` / `例如：`
- **試試看 GIVE IT A GO card** with same dashed-border + beige bg as English version, with `任務：` and `範例：` sub-labels in the same cream-amber sub-card styling
- **寫法的好處** (was `WHY IT WORKS:`) auto-routed via `bucketLabels` + CJK-aware colon detection
- **注意事項** (was `WATCH OUT:`) — same auto-routing
- **No `KEY IDEA:` prefix** on translated key idea (kept the `1.` / `2.` numbering only)
- **Annotation label upgrade** — CJK labels (隱喻, 方式狀語從句) get fontSize 13 / no letter-spacing / no lowercase / lineHeight 1.3 + `wordBreak: keep-all` so 隱喻 stays atomic instead of splitting to 隱 / 喻
- **Generous line-height (4.5)** on both English FROM THE TEXT card AND Chinese 譯文 card — ruby annotation labels lifted 3px with marginBottom 6 for breathing room

### 14.8 GIVE IT A GO Card Rebuild

Renamed `TRY THIS PATTERN` → `GIVE IT A GO` (chosen by user from alternatives: PRACTICE IT / YOUR TURN / NOW YOU TRY / etc.). Applied across all four render sites (XRayView, StyleLab, EditorTab × 2 cards).

The card now detects TYPE 1/2/3 format via the shared `parseStructureContent` and renders three styled blocks for TYPE 2/3:
- **Bold intro** (the Flat sentence — `Flat:` label stripped)
- **Task: ...** on a new line with bold label
- **Example: ...** in a cream-amber sub-card

TYPE 1 fill-in-the-blank format renders the template + arrow example in the same sub-card.

`TYPE N — XXX.` prefix (and the Chinese equivalent `第一類型 — XXX。` / `類型 N — XXX：` / `型 N — XXX：`) stripped universally in both `parseSectionContent` and `stripRedundantPrefix`.

`Flat:` inline label + 11 Chinese variants (`中性句` / `平實句` / `平直句` / `平淡句` / `平鋪直敘` / `普通句` / `直白句` / `平句` / `中立句` / `平凡句` / `樸素句`) stripped — keeps the bare neutral sentence, drops the label.

### 14.9 Debug Logging on Non-Streaming Proxy Path

The streaming branch in `server/proxy.js` had a `[DEBUG translate response]` log added in an earlier agent session, but `callAI(..., false, ...)` (non-streaming) hits a different branch with no debug log. Added the same log line to the non-streaming `proxyRes.on("end")` handler so future translation debugging can inspect the raw LITE response with:

```
preview_logs({ search: "[DEBUG translate" })
```

### 14.10 Bug-Hunting Agents

Two investigation agents deployed during this session to trace root causes:

1. **First agent** — confirmed the completeness-guard `presenceRe` was too permissive (matched label-substring anywhere, including orphaned EN lines with no ZH), causing focused re-calls to skip when they shouldn't. Result: rewrote the guard to use `parseTranslationPairs`-validated coverage.

2. **Second agent** — diagnosed the duplication + raw English leak from the focused re-call. Found two root causes: (a) `labelRe` greedy-captured body paragraphs as part of KEY IDEA's content, then focused re-call retranslated everything → duplicates; (b) bare echoed lines from focused calls got appended verbatim and corrupted the trailing pair's `zh` via `parseTranslationPairs`' end-of-text capture. Result: switched to `parts`-based label sourcing (no greedy regex) + safe-append (validate each focused response parses to ≥1 valid pair before appending).

### 14.11 Files Changed (since 14 May 2026)

| File | Status | Purpose |
|---|---|---|
| `src/components/XRayView.jsx` | UPDATED | `translateWithGuard` extracted, `parseStructureContent` added, `parseTranslationPairs` orphan-EN + mid-line marker normalization, `stripRedundantPrefix` extended with pipe + TYPE markers, `groupPairsBySource` pipe-strip + pattern-based STRUCTURE/VOCAB routing, breakdown Fast Path pipe-strip, translation card UI rebuild, GIVE IT A GO card rebuild |
| `src/components/StyleLab.jsx` | UPDATED | `parseStructureContent` import + use for SavedSkills card rendering, GIVE IT A GO rename |
| `src/components/EditorTab.jsx` | UPDATED | `parseStructureContent` import + use for technique strip rendering, GIVE IT A GO rename |
| `src/prompts.js` | UPDATED | `translatePrompt` strengthened with "translate EVERY labelled section" CRITICAL rule + count-and-verify instruction |
| `server/proxy.js` | UPDATED | `[DEBUG translate response]` log added to non-streaming branch |

### 14.12 Status of Known Issues

- §12.9 inline `ZH:` markers leak — **resolved** via `stripRedundantPrefix` rule #3 (§13.4) and parser orphan-EN handling (§14.2)
- LITE silent sub-section skip — **resolved** via `translateWithGuard` orphan-EN + labelled-unit detection (§14.1)
- Body paragraph duplication from focused re-call — **resolved** via `parts`-based label sourcing (§14.10)
- Raw English source leaking into trailing ZH — **resolved** via safe-append validation (§14.10)
- LITE `| GRAMMAR:` row format defeating `^GRAMMAR` routing — **resolved** via universal pipe-strip in routing (§14.5)
- STRUCTURE orphan pairs (template / arrow-example) leaking to wrong buckets — **resolved** via pattern-based routing rules (§14.6)

---

## 15. UPDATE — 17 May 2026 (afternoon) — Saved Skills tab refactor

The Skills tab in Style Lab previously rendered each saved skill as one large inline-expanded card with body / GIVE IT A GO / FROM THE TEXT / etc. all dumped together → wall of text. Refactored into a three-level navigation flow so students can drill into individual techniques without losing context of the whole list.

### 15.1 Three-Level Navigation

| Level | Content shown | Trigger |
|---|---|---|
| 1. **Skills list** | Compact rows — author name + edit icon + `›` chevron | Default view of the Skills tab |
| 2. **Skill detail** (`SavedSkillDetail`) | Back link + author header + signature + "When to use:" card + collapsed technique cards (key idea only) + Remove / Practice / Write-with-this-skill buttons | Click a row in the skills list |
| 3. **Technique detail** | Full `SectionCard` rendering (FROM THE TEXT / GIVE IT A GO / breakdown / 翻譯成中文 / WATCH OUT / WRITER'S WORDS — same as the post-X-Ray analysis page) | Click a technique row in the skill detail; collapse with `▾ Collapse` button |

Each level isolates one concern — list browse, skill overview, single technique deep-dive. No more wall-of-text.

### 15.2 New `sections` Field on Saved Skills

`saveStyleSkill` (`XRayView.jsx:1212`) now also stores the original full section content alongside the existing lossy `analysedTechniques`:

```js
sections: validSections.map(s => ({ title: s.title, content: s.content }))
```

This is the unredacted raw section data — `SectionCard` can re-render the saved skill with the same rich layout it produced after the original analysis. Forward-compat: any skill saved after this commit gets the full content.

### 15.3 Legacy-Skill Fallback + Banner

Skills saved BEFORE the `sections` field upgrade only stored four fields per technique (`technique`, `description` sliced to 250 chars, `structure`, `example` sliced to 200 chars). Those fields don't include BREAKDOWN / WHY IT WORKS / WATCH OUT / WRITER'S WORDS — the data simply isn't there.

Implemented `synthSectionFromTechnique` to convert legacy `analysedTechnique` records into the `{title, content}` shape `SectionCard` expects, so the detail view at least renders what's available. Added a yellow banner in `SavedSkillDetail` (only shown when `skill.sections` is missing) explaining the limitation:

> **Legacy skill:** only the key idea + brief description were saved. To see the full breakdown / why it works / watch out / writer's words sections, re-analyse the source passage and save again.

`saveStyleSkill` dedupes by `authorName` — re-saving the same author overwrites the legacy entry with the full new-format content.

### 15.4 Per-Technique Remove Buttons

Each `CollapsibleTechnique` card now has a red `×` button (fontSize 16, fontWeight 700, `COLORS.red`) for removing a single technique from a saved skill. Wired through:

- `CollapsibleTechnique` accepts `onRemove` prop
- `SavedSkillDetail` accepts `onRemoveTechnique(techIdx, hasFullSections)`
- `SavedSkills.removeTechnique` mutates either `skill.sections` (new format) OR `skill.analysedTechniques + skill.techniques` (legacy format) — keeps both arrays in sync regardless of which one the detail view rendered from
- Persists to localStorage immediately

`×` uses `e.stopPropagation()` so clicking it doesn't also trigger the card's expand-on-click handler.

### 15.5 Files Changed (this session)

| File | Status | Purpose |
|---|---|---|
| `src/components/XRayView.jsx` | UPDATED | `saveStyleSkill` now also stores `sections: [{title, content}]` array for full re-render fidelity |
| `src/components/StyleLab.jsx` | UPDATED | `SavedSkills` rewritten as list-then-detail navigation; new `SavedSkillDetail` and `CollapsibleTechnique` components; `synthSectionFromTechnique` for legacy fallback; legacy-skill banner; per-technique red `×` remove buttons + `removeTechnique` mutation; `trackCall` plumbed through |

---

## 16. UPDATE — 22–26 May 2026 — Branch `claude/objective-ramanujan-974c10`

**Branch:** `claude/objective-ramanujan-974c10` (16 commits, +730 lines net across `lyra-brain.js`, `prompts.js`, `lyra.jsx`, `components/StyleLab.jsx`, `components/TrainingSession.jsx`, `components/ChatTab.jsx`, `components/XRayView.jsx`, `ai-router.js`, `constants.js`, `hooks.js`, `server/proxy.js`).

This session focused on three themes: (a) tightening Lyra's coaching tone and pedagogy so she stops sounding mechanical, (b) plumbing chat persistence + scroll anchoring + source attribution into both chat surfaces (writing chat + training-session chat), and (c) emergency repair after Google deprecated the Lite-tier model name.

### 16.1 Coaching tone and pedagogy — LYRA_BRAIN rewrites

**Match the response to the question (commit `e5d4bbf`).** Lyra was reflexively deploying the full 4-Step Coaching Protocol on every chat turn, including casual `"??"` questions, with branded section headings like `## 1. THE SOURCE SKILL` printed into student-facing output. Added a new `MATCH THE RESPONSE TO THE QUESTION` block at the top of LYRA_BRAIN that gates protocol use by question type:

- Quick `"??"` / `"I don't understand"` → 1-3 sentences, no headings, no jargon
- Specific narrow question ("is this okay?") → under 60 words
- Draft attempt that already uses the technique → diagnose the tactical mistake, don't re-teach
- Draft attempt that doesn't yet use the technique → celebrate one move + name one thing to sharpen
- Genuinely stuck OR explicit "how do I do X" → THEN deploy the full protocol

Plus a banlist of the printable headers (`## 1. THE SOURCE SKILL`, `## 2. THE EFFECT ON THE READER`, etc.) — these are internal scaffolding, never section labels the student sees.

**Diagnose tactical mistakes, don't re-teach (commit `e1bfaa4`).** Follow-up to the previous fix: when the student's draft sentence already uses the craft move and just has a tactical bug (missing verb, awkward collocation, trailing fragment), Lyra was still printing a `COACHING MOMENT: THE POWER PIVOT` block re-explaining the source skill from scratch. New rule: if the student demonstrably understands the technique, your job is to diagnose the mistake in plain words ("you forgot a verb here") under 80 words, NOT to re-teach.

**Voice labels are internal-only + drop "scary good" (commit `08b3ac4`).** Lyra was quoting voice labels mid-coaching — `"give it that final 'Columnist' bite"`, `"shift from Reporter Voice to Columnist Voice"`, `(Weak Voice)` / `(Target Voice)` parentheticals in Before/After examples. To a 14-year-old reader these are jargon. Section renamed to `GENRE-AWARE VOICE FRAMEWORK (INTERNAL ONLY — DO NOT NAME TO STUDENTS)`. Added a "SAY THIS, NOT THAT" block with explicit ✗ / ✓ pairs. Also removed the `"scary good"` brand catchphrase from the LYRA_BRAIN opener and banned it from coaching output (it kept leaking into Socratic questions).

**Parallel Universe topic-separation banlist (commit `ac9796a`).** When teaching by varieties, Lyra was producing examples on the student's own essay topic (cashless payment essay → all three "different topic" examples still mentioned cash / coins / paper notes / senior citizens). That hands the student a finished sentence on their actual topic. Strengthened the rule with concrete ✗ WRONG / ✓ RIGHT pairs using the exact case from the wild — cashless-payment essay vs. the same technique applied to alarms, ramen queues, and goalkeeper gloves. Closing line: "Reusing any noun from the essay topic = writing the student's essay for them."

**Body paragraph 4-element structure + fabrication ban (commit `53e2c49`).** PEEL (Point-Evidence-Explanation-Link) was too thin for HKDSE — it collapsed elaboration and example-analysis into one slot, so Lyra accepted shallow paragraphs as complete. Replaced with the fuller four-element model that's now enforced in LYRA_BRAIN, `buildCoachPrompt`, `buildScaffoldingPrompt`, AND `constants.js` HKDSE essay/persuasive exam rules:

1. **Topic Sentence** — one clear sentence supporting the thesis
2. **Elaboration** — 2-3 sentences unpacking WHY, developing the cause-and-effect logic
3. **Example + Explanation of HOW it proves the point** — ONE strong well-developed example (depth, not count: one unshakable example beats two thin ones) IMMEDIATELY followed by 1-2 sentences explicitly linking it back ("What this shows is…", "This proves that…") — example without explanation is a quote-drop
4. **Closing Sentence** — tie back to thesis

An earlier draft of this rule taught Lyra to model fabricated citations (fake "2015 LSE study, 91 schools, 6.4%" precision and an invented "Diocesan Boys' School phone-locker policy") as ✓ good specifics. Caught and removed — the fabricated stat was inexcusable, and the citation style itself is unrealistic for a 14-year-old in a 90-minute exam. Replaced with HK-realistic examples (MTR carriages after school, TikTok / Instagram named, phone-pouch policies, SCMP soft attribution, classroom anecdotes) and an explicit ban: NEVER fabricate exact percentages, study names with years, or precise survey numbers in coaching output OR in what's asked of the student. Soft attribution ("according to a recent SCMP report") is fine; fake numbers are not.

### 16.2 Training Session chat — persistence, scroll, delete

**Anti-bias restore in training chat (commit `6012d84`).** The Masterclass Report was rendering "stolen from Writer A" instead of "learned from Polly Hudson" (or whatever the student has on the name card). Two bugs combined: LYRA_BRAIN literally instructed the model to say `"we stole from"`, and `TrainingSession.fetchLyraTurn` was calling `anonymiseSkillsForAI` but discarding the mapping and never calling `restoreAuthorNames` on the response. Fixed both. Now anti-bias stays in force (the model still sees only Writer A/B/C labels), but the display-time substitution honours whatever the student currently has on the name card — including nicknames like "applezz" or "xyz".

**Scroll anchors on the student's last question (commits `5e9437a` for training, `448a718` for writing chat).** When Lyra replied, the auto-scroll positioned the TOP of her bubble at the top of the viewport, pushing the student's question off-screen above. Student opens the chat and sees Lyra's monologue first, with no visible context for what they asked. Mirrored the fix in both chat surfaces: when Lyra has just replied, anchor the scroll on the student's MOST RECENT message. ChatTab.jsx now tags each message wrapper with `data-msg-role={m.role}` so the effect can find the last user bubble via `querySelectorAll`.

**Persist threads per technique (commit `504a9de`).** Every time a student returned to a Practice Session technique they'd already chatted with, the chat wiped — they lost the entire coaching conversation (4-step protocol turns, vocabulary ingredients, parallel-universe examples). New per-skill bag in localStorage under `lyra-training-chats`: `{ [skillId]: { [techIdx]: messages[] } }`. `chatMessages` was refactored from a separate `useState` to a derived view of `chatThreads[activeTechIdx]` — single source of truth, no mirror-effect race. When the student arrives on a technique, the saved thread is restored and the chat panel auto-opens; when they return after closing the × the button reads "Resume chat with Lyra" instead of "I'm stuck — chat with Lyra".

**Delete button with two-step inline confirmation (commits `766d923` + `c23f364`).** Once a chat thread persisted, students needed a way to delete one without going through `localStorage.removeItem` manually. Initial commit used native `confirm()` — replaced in the follow-up commit with an inline two-step confirmation that's impossible to dismiss by reflex: first click on Delete morphs the button into a muted "Cancel" outline + a filled-red "Tap again to delete"; 3.5-second timer auto-reverts if the student walks away. Matches the destructive-action idiom Sidebar / GrammarLog already use, but more visible than a browser modal.

### 16.3 Writing chat — persistence + animation removal

**Save chat history even when draft is empty (commit `0a6471c`).** The writing chat was already hooked into the per-writing autoSave pipeline (messages stored under `lyra-projects` localStorage), but autoSave had an early return: `if (!activeWritingId || !draft.trim() || screen !== "app") return;`. If the student chatted with Lyra (brainstorming, asking for an outline, vocabulary ingredients) BEFORE typing anything in the draft pane, the whole save was skipped. Removed the `draft.trim()` guard. Chat history now survives across sessions even when the draft is still blank.

**Drop the typewriter animation (commit `3ee1bdc`).** The character-by-character reveal at 18ms / char produced 5-6 second waits on multi-paragraph LYRA_BRAIN turns. Rewrote `useTypewriter` to return the full text synchronously with `done: true`. API is preserved (TypewriterBubble, PracticeTypingBubble, ChatTab welcome banner all still call it), but the gradual reveal and the blinking caret are gone — messages now appear instantly, matching the TrainingSession chat behaviour.

### 16.4 Saved skills — short titles + rename pencil (commit `720519f`)

Saved-skill technique cards used the AI's long `KEY IDEA` sentence as the heading on the Practice overview, the exercise card, and the SavedSkillDetail list ("The writer describes being late not as a mistake, but as a 'weapon' or a fake medical condition."). Wall of words before students even read the technique.

Added a `SHORT TITLE:` line to each of the 7 sections in `styleProfilerPrompt` requiring 2-4 plain everyday words in Title Case ("Weapon Excuse", "Concession Then Punch", "Sound Of A Fall") with an explicit jargon banlist ("syntactic inversion", "rhetorical interrogation", "anaphora"). `parseSectionContent` learns the new field. `saveStyleSkill` writes `title` onto `analysedTechniques[i]`. New exported `deriveShortTitle()` heals legacy skills (strips generic "The writer / Hudson uses..." prefixes, trims trailing `to <verb>` infinitives, balances quoted phrases) so existing saved skills get reasonable auto-titles without a backfill AI call.

Students who don't like the AI's short title can rename via a ✎ pencil on the `CollapsibleTechnique` row in `SavedSkillDetail` — mirrors the existing author-rename pencil pattern. Edits persist to BOTH `analysedTechniques[i].title` AND `sections[i].content` (the SHORT TITLE line is rewritten or injected), so the TrainingSession re-derive-from-sections path picks up renames immediately. Verified end-to-end: rename "Being Late" → "Weapon Excuse" on Polly Hudson's first technique → propagates to Practice overview list AND exercise card header.

The exercise card now shows a three-tier hierarchy: TECHNIQUE label → **Short Title** (16px bold) → long KEY IDEA sentence as the "what this means" subtitle → body paragraph below. Practice overview shows title big-bold with long sentence as a muted small-text subtitle.

### 16.5 Bottom tab rename — "Preview" → "My Writing" (commit `dd47447`)

`Preview` was jargon for the 14-year-old HK English learners Lyra is built for — they tapped the tab and weren't sure what it was. Renamed to "My Writing" (works for every writing type — essay, letter, story, report). Internal tab key stays `"preview"` (no state-machinery changes), so this is a single user-facing string swap with no behavioural risk.

### 16.6 Infrastructure repair (commit `9144660`)

Two unrelated breakages surfaced in the proxy log on the same session:

1. **Lite model 404.** Google promoted the Lite model from preview to GA — `gemini-3.1-flash-lite-preview` now returns 404 NOT_FOUND from the Gemini API, so every Lite-tier route was silently broken: translate (X-Ray translation), proofread, structural_suggest (vocabulary chips), training_exercise (Practice Session sentence generation), grammar_lesson (mini-lesson cards). `ai-router.js MODELS.lite` updated to `gemini-3.1-flash-lite`; `server/proxy.js ALLOWED_MODELS` adds the new name and keeps the old `-preview` name temporarily for stale-tab compat.

2. **Web-search response shape mismatch.** The "Search for facts" chip in ChatTab passes `useSearch=true` to `sendChat`. Proxy + Gemini did the search successfully (`[Grounding] 6 sources found` in the log), but `callAI`'s contract when `useSearch=true` is to return `{ text, sources }` instead of a raw string. `sendChat` then handed the object straight to `restoreAuthorNames` and `extractLearningData`, both of which call string methods (`.replace` / `.match`) on it and throw — catch block fired and the student saw "I'm having trouble connecting" even though the search itself had worked. Fix: unpack `result.text` for downstream string-expecting helpers, stash `result.sources` on `typingMsg`. All three `typingMsg → messages` handoff paths (`handleTypewriterDone`, tab-switch finalisation, `stopChat`) now carry sources along so attribution survives across re-renders. New "Sources" footer block in ChatTab renders numbered clickable links under any AI bubble that has them — students can click through to read the actual article and use it as a verifiable example.

### 16.7 Token cost audit (no code change yet)

User raised concern about API token cost mid-session. Sampled `lyra-proxy [Tokens]` log over 85 API calls captured since the proxy was last started (~2 days). Totals:

- Prompt tokens: 1,284,452 (avg ~15,100 per call)
- Response tokens: 54,736 (avg ~640 per call)
- Thinking tokens: 73,721 (avg ~860 per call)
- Total: 1,412,909

Prompt is 91% of all tokens. The bloat is dominated by LYRA_BRAIN (~9,000 tokens, 36 KB) prepended to every Pro-tier call, plus conversation history that grows unboundedly with each turn, plus the full draft echoed every turn, plus all saved skill cards embedded every turn, plus the source X-Ray analysis when present.

User decided to defer the LYRA_BRAIN modularisation work and prompt the work via Opus 4.7 in a follow-up session. Documented in a self-contained problem brief for Opus.

### 16.8 Files changed (this session)

| File | Status | Purpose |
|---|---|---|
| `src/lyra-brain.js` | UPDATED | MATCH THE RESPONSE block, diagnose-don't-re-teach sub-rule, voice-labels-internal-only refactor, "scary good" ban, body-paragraph 4-element non-negotiable rule with HK-realistic example illustrations and explicit anti-fabrication block |
| `src/prompts.js` | UPDATED | `styleProfilerPrompt` adds SHORT TITLE field to each of the 7 sections; `buildCoachPrompt` adds response-length tiers + banned-printable-headers + parallel-universe topic-separation rule + body-paragraph toolkit line; `buildScaffoldingPrompt` STEP 4 replaced PEEL with the four-element walk-through and parallel-universe rule |
| `src/constants.js` | UPDATED | HKDSE essay + persuasive rule blocks updated with non-negotiable body-paragraph 4-element requirement including the example-explanation pair and anti-fabrication clause |
| `src/lyra.jsx` | UPDATED | `sendChat` unpacks `{text, sources}` shape when useSearch=true; all three `typingMsg → messages` handoff paths carry sources along; autoSave guard relaxed so chat persists when draft is empty; bottom tab label "Preview" → "My Writing" |
| `src/components/StyleLab.jsx` | UPDATED | `CollapsibleTechnique` renders short title + long-sentence subtitle + pencil rename UI; `SavedSkillDetail` accepts `onRenameTechnique`; `SavedSkills.renameTechnique` persists to both `analysedTechniques[i].title` AND `sections[i].content`; `synthSectionFromTechnique` injects SHORT TITLE for legacy skills |
| `src/components/XRayView.jsx` | UPDATED | `parseSectionContent` learns `shortTitle`; new exported `deriveShortTitle()` heuristic for legacy skills; `saveStyleSkill` writes `title` onto analysedTechniques entries |
| `src/components/TrainingSession.jsx` | UPDATED | Chat thread persistence (per-skill / per-technique localStorage bag); `chatMessages` refactored to derived view of `chatThreads`; scroll anchored on student's most-recent message; Delete button with two-step inline confirmation; `restoreAuthorNames` call added; short-title rendering in overview list + exercise card |
| `src/components/ChatTab.jsx` | UPDATED | Auto-scroll anchors on `[data-msg-role="user"]` last student message instead of bottom; new Sources footer renders web-search attribution links; each message wrapper now has `data-msg-role={m.role}` attribute |
| `src/hooks.js` | UPDATED | `useTypewriter` rewritten to return full text synchronously with `done: true` — dropped the gradual character-by-character reveal across all three call sites |
| `src/ai-router.js` | UPDATED | `MODELS.lite` updated from deprecated `gemini-3.1-flash-lite-preview` to `gemini-3.1-flash-lite` (Google promoted to GA) |
| `server/proxy.js` | UPDATED | `ALLOWED_MODELS` adds `gemini-3.1-flash-lite`; both `isLiteTranslate` checks and the DEBUG-translate-response log condition accept either name |

---

## 17. UPDATE — 26–31 May 2026 — Branch `claude/objective-ramanujan-974c10` (cont.)

Seven more commits on the same branch after Section 16, plus a data-loss incident and its safety-net fix.

### 17.1 X-Ray translation polish

**Translate-button label cleanup (commit `11a4833`).** The "Original text" expand toggle in XRayView read `翻譯成中文 · Translate to traditional chinese` / `隱藏翻譯 · Hide`. The English suffix was noise for HK students and inconsistent with the other two translate buttons (which are Chinese-only). Dropped both English suffixes.

**Duplicate translation fragments fixed (commit `9fd9dea`).** A student reported `沒錯。` ("Exactly.") appearing three times in a translated X-Ray quote. Root cause (confirmed from the proxy's `[DEBUG translate response]` log): the LITE translate model splits a compound USE IT / STRUCTURE template ("Would they X? Exactly.") into two ZH pairs — the question, then a standalone `"Exactly. → 沒錯。"` punchline pair. The orphan fragment has no recognisable English label so `groupPairsBySource` dropped it into the `body` bucket, where it rendered as a duplicate line below the FROM THE TEXT translation (which already had `沒錯。` inside its annotated quote). Fix: a post-bucketing dedupe pass drops any `body`-bucket pair whose normalised ZH (annotation braces stripped, whitespace collapsed) is under 20 chars AND appears as a substring of any non-body pair's ZH.

**CJK annotation labels made consistent + visible (commit `354c204`).** Annotated translation quotes mixed two styles: short CJK labels (反問句) rendered as ruby ABOVE the text, long ones (加強語氣的單字句) rendered inline BESIDE it — because a long ruby label stretches the base characters apart and crowds the line above. The mix read as inconsistent. Now ALL CJK labels render inline parenthetically (`沒錯。(加強語氣的單字句)`); English labels keep ruby (they wrap cleanly on word boundaries). Also bumped `ANNOTATION_COLORS` background alpha 0.10 → 0.24 (the highlight was too faint to notice), border 2 → 2.5px, and the CJK ruby font 13 → 11 so even short labels don't tower over the base text.

### 17.2 Achievements / Masterclass Report (commits `190af4b`, `4be4526`)

A new **Achievements tab** (next to Skills in Style Lab) saves each Masterclass Report as a reviewable card. Two report shapes: structured (from the hidden `LYRA_LEARNING_DATA` block — renders the four sections Skills Deployed / Sentence Structures & Rhythm Maps / Before & After Evolution / Grammar & Proofreading) and freeform (verbatim Lyra text). Two-step inline delete per card.

The first cut never produced a visible achievement — the auto-save gated on `mastery_signal === "achieved"`, but the AI marks mastery "partial" during coaching, so the gate almost never fired, and the Practice chat didn't run learning-sync at all. Fixed with defense-in-depth:
- **LYRA_BRAIN coupling rule**: producing a Masterclass Report (or acknowledging a win) now MANDATES emitting the `LYRA_LEARNING_DATA` block with a `growth` entry + a `skills_deployed` entry marked `achieved`.
- **Loosened gate**: structured auto-save now fires on any `growth` (before/after) event.
- **Visible-report fallback** (`maybeSaveVisibleReport`): detects a printed MASTERCLASS REPORT (header or ≥2 section labels) and saves it even when the hidden JSON is missing/partial.
- **Both chats wired**: writing chat (`lyra.jsx`) and Practice chat (`TrainingSession.jsx`) both harvest learning data + run the fallback.
- **Manual "★ Save this turn" button** in BOTH the writing chat (ChatTab) and the Practice chat (TrainingSession) — the reliable, student-controlled path. This was the missing piece: the student's Masterclass Reports appeared in the Practice chat, which originally had no save button at all.

### 17.3 Local backup safety net (commit `c111f90`)

**Incident:** during cleanup of test data, a `localStorage.removeItem("lyra-training-chats")` wiped the student's Practice-chat threads. Only one turn survived (re-persisted from the component's in-memory state). The lost turns were unrecoverable — proxy logs hold only lengths/token counts, not text, and there was no backup layer.

**Fix:** `src/backup.js` keeps a rolling snapshot of all critical keys (`lyra-style-skills`, `lyra-projects`, `lyra-training-chats`, `lyra-masterclass-reports`, progress, vocabulary, structures, deployments, growth-log, grammar-log) under `lyra-backup-v1`.
- `autoRestoreFromBackup()` runs synchronously in `main.jsx` BEFORE React mounts, healing any key that is ENTIRELY ABSENT (the signature of a stray wipe). Present-but-empty `[]` is a legitimate user state and is never clobbered.
- `snapshotBackup()` is STICKY PER-KEY: it never downgrades a key from has-content to empty, so a wipe-then-snapshot can't erase the backup's record. Triggered 3s after load, every 30s, on tab-hide, and on `beforeunload`.
- Verified live: snapshot → `removeItem` → auto-restore recovers the exact value; deliberate `[]` survives; a snapshot during a wipe keeps the prior value.

### 17.4 Per-technique Practise (commit `5a17bed`)

Each technique in a saved skill now has a **"▶ Practise" button** — on the collapsed row (one tap) and a full-width one in the expanded card — so a student can drill ONE technique instead of only the whole skill via the overview list.

Wiring threads an optional `techIdx` from the technique → `onOpenTraining(skill, techIdx)` → `TrainingSession startTechIdx`, which opens directly on that technique's exercise screen (defensive clamp falls back to the overview if out of range).

**Navigation fix (user-reported):** a per-technique launch now returns to the SAME skill-detail card list on back, not the different-looking Practice Session overview. Per-technique practice keeps StyleLab mounted underneath (only whole-skill practice closes it); TrainingSession overlays raised z-index 90 → 110 so they sit above StyleLab (100); and the exercise back button calls `onClose()` when launched directly (revealing the unchanged detail) vs. `setScreen("overview")` when launched from the overview list.

### 17.5 Files changed (Section 17)

| File | Status | Purpose |
|---|---|---|
| `src/components/XRayView.jsx` | UPDATED | translate-button English suffix dropped; `groupPairsBySource` dedupe pass for orphan ZH fragments; `AnnotatedQuote` renders all CJK labels inline; brighter `ANNOTATION_COLORS` |
| `src/learning-sync.js` | UPDATED | `saveMasterclassReport` + `maybeSaveVisibleReport`; auto-save gate loosened to any growth event; `syncLearningData` returns `{ savedReport }` |
| `src/components/StyleLab.jsx` | UPDATED | Achievements tab + `Achievements`/`AchievementCard` components; per-technique "▶ Practise" buttons; `onPracticeTechnique` wiring; per-technique launch keeps StyleLab mounted |
| `src/components/TrainingSession.jsx` | UPDATED | learning-sync + visible-report fallback in `fetchLyraTurn`; "★ Save this turn" button per Lyra turn; `startTechIdx` prop opens a specific technique; back-button branches on launch type; z-index 90 → 110 |
| `src/components/ChatTab.jsx` | UPDATED | "★ Save this turn" button on each Lyra reply |
| `src/lyra.jsx` | UPDATED | `openTrainingSession(skill, techIdx)` + `closeTrainingSession`; visible-report fallback in `sendChat`; backup snapshot effect; backup import |
| `src/main.jsx` | UPDATED | `autoRestoreFromBackup()` before React mount |
| `src/backup.js` | NEW | local backup safety net (snapshot + sticky-per-key + absent-key auto-restore) |
| `src/components/EditorTab.jsx` | UPDATED | `onPractice` forwards `techIdx` (whole-skill vs per-technique) |

---

## 18. UPDATE — 1–3 June 2026 — Branch `claude/youthful-wing-17a2f6`

This branch was fast-forwarded onto commit `3551163` (the latest Style-Lab work, originally committed on `claude/objective-ramanujan-974c10` after a cwd drift), so youthful-wing now carries the full codebase. The `3551163` features were re-verified live in the preview, then four more Style-Lab improvements were built on top and committed as `1bdcdad`.

### 18.1 Verified live: the `3551163` features

A preview pass with a real analysis confirmed the commit that shipped just before this session:
- **Selectable section count (1–9)** — `styleProfilerPrompt` → `buildStyleProfilerPrompt(n)`; a 1–9 selector sits on the Source step and the Analyse tab (default 9). Choosing 3 produced "Style Profile — 3 sections analysed", so the count flows into the prompt, not just the UI.
- **`LYRA_LEARNING_DATA` leak strip** — stripped from analysis output at the flow level and as a `parseSectionContent` render guard.
- **"Try different text" reset** — clears the analysis and returns to the paste screen. *Observed nuance:* it does not empty the textarea — the previous passage stays in the box.
- **Practice selection-circle** — `SavedSkillDetail` "Practice" reveals a circle on each technique card; "Practise (N)" drills only the ticked ones.
- **Regex-escape in `anonymiseSkillsForAI`** — author names containing `()` no longer throw and break Practice.

### 18.2 Skills list — per-row delete (commit `1bdcdad`)

Each saved-skill row in the Skills tab now has a red **×** with a two-step confirm (× → "Tap to delete" / "Cancel"), matching the Achievements delete pattern, so a whole skill can be removed without opening it. Reuses the existing `remove(idx)`; updates the `Skills (N)` badge and localStorage. Verified: Cancel reverts; delete removes only the targeted skill.

### 18.3 Analyse tab — Original-text translation

The Analyse-tab Original-text block was missing the 翻譯成中文 toggle that the X-Ray entry flow (`XRayView`) already had. Added the same toggle (`translation`/`showTranslation`/`translating` state + `handleTranslateOriginal`, reusing the exported `translateWithGuard`), rendering sentence-by-sentence Traditional Chinese; resets on a new analysis. Verified live (e.g. "Old libraries smell of patience." → "古老的圖書館散發著耐心的氣息。").

### 18.4 Analyse tab — "Add to Skills" recovery

A skill auto-saves after analysis, but a manual removal left no way back. The saved banner is now three-way: **saved + in store** → green "Writing skill saved"; **removed** → an "✦ Add to Skills" button that re-saves (`saveStyleSkill` dedupes by author, so no duplicate); **too-short** → amber (unchanged). A `skillInStore` flag re-checks localStorage whenever the student returns to the Analyse tab, so removing the skill from the Skills tab flips the banner. Verified the full remove → recover loop.

### 18.5 Detail Remove — selection mode with red circles

`SavedSkillDetail`'s Remove button now mirrors Practice: tapping it enters a selection mode with a **red** circle on each technique, and "Remove (N)" deletes only the ticked ones. The circle colour is a new `selectColor` prop on `CollapsibleTechnique` (green for Practice, red for Remove); the shared `selectMode` is `null | "practice" | "remove"`. A new parent `removeTechniques(skillIdx, idxs, hasFullSections)` filters all indices in one pass (avoids the index-shift bug of calling single-remove repeatedly). Removing every technique deletes the whole skill and returns to the list. The per-technique "×" and "Practice" still work when not selecting. Verified: non-adjacent multi-select removed the right techniques; remove-all deleted the skill.

### 18.6 Investigated: reload/backup data integrity — NOT a production bug

During this session a saved skill once **disappeared** ("Unknown Author (The Guardian)") and a fully-deleted skill once **resurrected** ("Unknown Author") across reloads, which looked alarming. Investigated and cleared:

- `autoRestoreFromBackup()` (`backup.js`) writes a key **only when it is entirely absent** (`localStorage.getItem(k) === null`); a present value, even `"[]"`, is never overwritten.
- **Nothing in the app ever nulls `lyra-style-skills`** — every writer uses `setItem(JSON.stringify(array))`; the only `removeItem` is the generic `window.storage.delete` shim, which is never called on a skills key.
- So a deleted-but-present skills array cannot be resurrected by the backup in normal use. **Confirmed empirically:** a plain page reload with the key present is a no-op (no `[lyra-backup] restored` log; `localStorage` unchanged).

The session-only symptoms were **Vite HMR / Fast-Refresh dev artifacts**: `SavedSkills` holds its list in `useState(() => JSON.parse(localStorage…))`, and Fast Refresh preserved/re-seeded that React state out of sync with `localStorage` across ~6 live edits to `StyleLab.jsx`. A real user never triggers HMR, so it is not reproducible in production.

**Latent (low-risk) notes — not bugs, and not the cause of the above:**
- Whole-array (key-level) snapshots: a genuine full wipe (cleared site data) restores the last snapshot, which can be up to ~30s stale (snapshots run every 30s + on tab-hide/unload).
- The `useState(() => localStorage…)` copy pattern gives each component its own copy with no shared source of truth — a latent lost-update footgun if two skill-writers are ever mounted at once (currently avoided by per-tab mount/unmount).

Optional hardening (not required): snapshot on every critical write so the backup is never stale; or move to a single storage source-of-truth to remove the copy-divergence class.

### 18.7 Minor known item

Cosmetic React console warning on the 1–9 section-count chips (`SourceSetup.jsx` and the StyleLab Analyse tab): the chip merges `s.chip` (sets the `border` shorthand) with `s.chipActive` (sets `borderColor`), so React warns about mixing shorthand/non-shorthand border properties on every re-render. Harmless; not fixed.

### 18.8 Files changed (Section 18, commit `1bdcdad`)

| File | Status | Purpose |
|---|---|---|
| `src/components/StyleLab.jsx` | UPDATED | Skills-row two-step × delete (`confirmIdx`); Analyse-tab Original-text 翻譯成中文 toggle (reuses `translateWithGuard`); "Add to Skills" recovery banner + `skillInStore` + re-check effect; `SavedSkillDetail` shared `selectMode` (practice/remove) + red `selectColor` on `CollapsibleTechnique`; batch `removeTechniques`; "remove all = delete skill" |

---

## 19. UPDATE — 3–4 June 2026 — Achievements ⇄ Report restructure + the Continuous Growth Report (planned)

Branch `claude/youthful-wing-17a2f6`. This session reworked the Style Lab "Achievements" area and set up the app's next big feature — a continuous growth report card. Supporting fixes landed too. (Not yet committed when this section was written; lands with the same commit.)

### 19.1 Style Lab back arrow — tab history

The header ← now steps back through the tabs the student visited (Saved → Skills → Analyse), and only closes Style Lab (returning to the previous screen) when there's no earlier tab left. Implemented with a `tabHistory` stack + `goToTab`/`goBack`; resets on open/close and on "New analysis". Verified live.

### 19.2 Practice reports named after the practised skill

When a student drills a saved technique (e.g. "The One Person Reset"), the Masterclass Report is now named after THAT skill — not a fresh name the AI invents — keeping report/achievement names in sync with the Skills list. `TrainingSession` passes the active technique name as `forcedTechnique` into `syncLearningData` + `maybeSaveVisibleReport` (`learning-sync.js`), which apply it to `report.technique` and `skills[].skillName`. (The manual "Save this turn" already did this.) **Verified live:** practising "The One Person Reset" produced an auto report named "The One Person Reset".

### 19.3 Report dedup — one card per practice moment

The AI re-logs one student sentence under several invented technique names (and the manual "Save this turn" dumps the verbatim chat), so the same win used to appear many times. Two layers:
- **Save-side:** `saveMasterclassReport` skips a report whose `after` sentence already exists.
- **Display-side:** `groupReports()` clusters reports by sentence-content overlap (≥60% of the shorter sentence's content words shared) and shows ONE card per cluster — the richest report (structured gains+mistakes beats a freeform chat dump, via `reportRichness`). Deleting a card removes the whole cluster.

### 19.4 Achievements is now the detailed per-practice cards (Stage 1, done)

Per the product owner: the per-practice detailed card IS the "achievement". So the **Achievements** tab now renders the grouped detailed cards (`MasterclassReports`) — author/skill, before→after + why it's better, vocabulary gained, grammar fixed. The earlier concise "skills learnt + sentence" view (and its `learntSkillsFromReports` helper) was removed. Each card = one practice moment.

### 19.5 The Report tab → Continuous Growth Report (Stage 2 — designed here; **now BUILT + verified, see §20**)

The **Report** tab is now a placeholder for the app's centrepiece: a **continuous, evolving assessment of the student** (not per-practice). Per the product owner, this is "the heart of the app" — Lyra should remember the student's weaknesses and recurring mistakes and critique honestly as they grow, like a teacher's running report card.

Design is being drafted with a stronger model (Opus 4.8) before implementation. Open design questions:
- **Sections:** overall level/trajectory, strengths, recurring weaknesses & mistake patterns, growth since last time, focus for next.
- **Generation:** synthesize the whole history each time vs. maintain a persistent "student profile" updated incrementally.
- **Memory of weaknesses:** how to persist/track recurring mistakes across sessions so the critique is genuinely continuous, not a one-off summary.
- **Update cadence:** when to (re)generate given Gemini cost (on demand / after each practice / every N).
- **Tone:** honest critique that names real weaknesses without discouraging a 14-year-old (+ Traditional Chinese).
- **Data model & mobile UX:** one evolving card on a phone; assume one Gemini call per regeneration.

Data already available to feed it: `lyra-masterclass-reports` (per-practice before/after, skills, grammar, vocab), `grammar-log`, saved skills + practised techniques, `lyra-structures`, `lyra-vocabulary`, and the coaching-chat transcripts.

### 19.6 Files changed (Section 19)

| File | Status | Purpose |
|---|---|---|
| `src/components/StyleLab.jsx` | UPDATED | tab-history back arrow (`tabHistory`/`goToTab`/`goBack`); `groupReports` + `reportRichness` dedup; Achievements tab → grouped detailed cards; Report tab → growth-report placeholder; removed the now-unused concise `Achievements` view + `learntSkillsFromReports` |
| `src/components/TrainingSession.jsx` | UPDATED | pass `forcedTechnique` (active technique name) into the report-save paths |
| `src/learning-sync.js` | UPDATED | honour `forcedTechnique` for `report.technique` + `skills[].skillName`; save-side dedup by `after` |

---

## 20. UPDATE — 4 June 2026 — Continuous Growth Report BUILT + verified (branch `claude/growth-report`)

The §19.5 feature is implemented on a new branch `claude/growth-report` (off `claude/youthful-wing-17a2f6`), built in the spec's order — accuracy keystone first, verified before the UI. All 109 tests pass.

### 20.1 Architecture
Incremental student profile in `localStorage["lyra-growth-profile"]` (added to `backup.js` CRITICAL_KEYS). Each regeneration: load profile → build a delta of only-new learning → **one** Pro-tier Gemini call (`REPORT_CARD_BRAIN`) → updated profile → save. Never full re-synthesis (preserves continuity + bounds cost).

### 20.2 Files
| File | Purpose |
|---|---|
| `src/report-utils.js` (NEW, pure) | `groupReports` (practice-moment clustering, now shared with Style Lab), `consolidateMistakes` (cross-source dedup: grammar-log + report.grammar + before-sentence → one instance), `buildDelta` (reliable id-timestamp boundary) |
| `tests/growth-report.test.js` (NEW) | 4 tests — the dedup keystone ("one slip across three sources = 1"), grouping, delta boundary |
| `src/growth-report.js` (NEW) | profile load/save, cold-start gate (`MIN_PRACTICES_TO_UNLOCK = 3`), delta gathering, `regenerateGrowthProfile` (anonymise/restore, defensive JSON parse, history snapshot, NEW-item marking), cadence reset |
| `src/report-card-brain.js` (NEW) | `REPORT_CARD_BRAIN` — the 5 judgments (cluster by rule; rate not raw count; opportunity-before-credit; prescribe-a-check-not-a-lecture; ≤2 prescriptions), lifecycle tracking, honest-but-kind tone, bilingual, JSON schema |
| `src/components/GrowthReport.jsx` (NEW) | the Report tab — locked/loading/profile states, EN/繁中 toggle, named level + trajectory, green strengths / gold growth (NEW badges) / amber (never red) weakness cards with occurrence counts + trend + expandable before-after evidence / blue focus / subordinate stats; refresh disabled when no new practices |
| `src/ai-router.js` | `growth_report` route (Pro tier, `brain:false`) |
| `src/learning-sync.js` | cadence counter `lyra-growth-pending` (incremented per growth event, reset on regen) |
| `src/utils.js` | **§10 anti-bias fix** — `anonymiseSkillsForAI` now scrubs the newer `sections` field (author names in `sections.content` were leaking to the AI) |
| `src/components/StyleLab.jsx` | Report tab renders `<GrowthReport/>`; imports the shared `groupReports` |

### 20.3 Verification
- **Gate 1 (dedup):** 4 unit tests pass, incl. one mistake logged across grammar-log + report.grammar + before-sentence counted **once**.
- **Gate 2 (worked example — real Pro-tier call on actual practice data):** produced level "Developing Narrative Voice / 發展中的敘事者" (band 3.5-4.0 stored, display-gated), bilingual sections, a tracked weakness "Narrative Tense Drift" (occurrence count + a memorable-image prescription) citing the student's own "is swarming"/"sat" slip, plus NEW growth badges. Rendered correctly (amber, counts, expandable evidence). Matches the spec's §6.1 quality.

Commits: `5c76712` (foundation, steps 1-3) + `855a8d6` (steps 4-6 + §10 fix), pushed to `origin/claude/growth-report`.

### 20.4 Not yet done / caveats
- Cross-regen **continuity** (a weakness id incremented across multiple regens over time) is built + prompt-instructed, but only ONE regeneration was verified — it needs real practice data accumulating to exercise fully.
- **Milestone-force** regen (§5 — force a regen immediately when a weakness resolves or the level changes) is NOT wired; only auto-every-3-practices + manual refresh + cooldown.
- **Dual-audience:** `bandEstimate` is stored from day one but never rendered (display effectively gated off). An explicit feature flag + a teacher dashboard remain future work.
- To see it live in-app, the student needs **3 deduped practices** to unlock the first report.

---

## 21. UPDATE — 7 June 2026 — Milestone-force regeneration wired (§5) — branch `claude/vigorous-zhukovsky-413664`

Closes the first §20.4 caveat. The Continuous Growth Report no longer makes a student wait the full 3-practice cadence to see a turning point: when the previous report flagged a milestone as imminent, a single new practice now regenerates the report, and a fresh level-up or beaten weakness is celebrated at the top of the card.

### 21.1 The trigger — eager, but never a local guess
A milestone (a weakness resolving, or the level changing) is an AI judgment that only exists *after* a regeneration, so we never try to detect one locally. Instead we read the AI's own forward-looking flags from the *last* report:
- a weakness with `status === "improving"` (the model's "this is on the verge of resolving"), or
- `level.trajectory === "rising"` (on the way to a new level).

When either holds, `effectiveRegenThreshold()` drops the auto-regen bar from `REGEN_EVERY_N_PRACTICES` (3) to **1**, so the very next practice refreshes the report. Cost stays bounded: those flags are transient (they flip to resolved/steady once the student lands or plateaus), `pending` only grows on real practice, and the existing `pending === 0` guard still prevents a wasted zero-data call. Regeneration stays lazy (on Report-tab open), not a silent background spend.

### 21.2 The payoff — surfaced, not buried
`computeMilestones(prev, updated)` diffs the pre-regen profile against the freshly produced one and returns what actually changed: a level-up (level name changed) and any weakness that was *being worked on* and is now resolved/graduated. It is cold-start-guarded — a brand-new "resolved" the model invents on the first run can't masquerade as a hard-won win. The result rides back on `regenerateGrowthProfile`'s return as `{ profile, milestones }`. The Report tab shows a dismissible green banner (🚀 level-up / 🎉 beaten weakness, bilingual) above the header, and `level_up` growth items now get a 🚀 (was a generic ✓).

### 21.3 Files
| File | Status | Purpose |
|---|---|---|
| `src/growth-report.js` | UPDATED | `milestoneImminent` + `effectiveRegenThreshold` (eager cadence); `computeMilestones` + `hasMilestone` (post-regen diff, cold-start-guarded); `regenerateGrowthProfile` now returns `{ profile, milestones }` |
| `src/components/GrowthReport.jsx` | UPDATED | mount effect uses `effectiveRegenThreshold(profile)`; `milestones` state + dismissible celebratory banner; 🚀 icon for `level_up` items; dropped the now-unused `REGEN_EVERY_N_PRACTICES` import |
| `tests/growth-report.test.js` | UPDATED | +11 tests — imminence (improving / rising / steady / empty), threshold (1 vs cadence), milestone diff (level-up, graduate, status-resolved, cold-start guard, unchanged) |

### 21.4 Verification
- **120/120 unit tests pass** (was 109; +11 here), covering all the new pure logic. Production build compiles clean.
- **Not browser-verified, by design:** the path only fires on AI output that marks a weakness `improving` / changes the level. Faking that needs seeding the live preview's `localStorage` (against the standing "never seed a live preview" rule), and opening the Report tab on real data would spend a real Gemini call and mutate the saved profile — so the logic is pinned at the unit-test layer instead. A genuine end-to-end pass still waits on real accumulating practice data (the same dependency as §20.4's continuity caveat).

### 21.5 Still open (unchanged from §20.4)
Cross-regen continuity over many real regens; dual-audience `bandEstimate` rendering + teacher dashboard; first report still needs 3 deduped practices to unlock.

---

## 22. UPDATE — 9 June 2026 — X-Ray section trim: 2-3 curated sections + lazy "Analyse more" (branch `claude/vigorous-zhukovsky-413664`)

The Style Lab X-Ray produced 9 sections by default (~3-4k words of meta-text before a 14-year-old writes anything), gated behind a 1-9 numeric selector that asked for a decision the student couldn't evaluate. This replaces the selector with task-matched curation (2-3 sections) and a lazy, informed expansion. Built in units, each committed and green.

### 22.1 Name-based section selection (`buildStyleProfilerPrompt`)
The profiler now takes an array of canonical section **names** instead of a count: it filters to known names, re-orders them into canonical order (so output order stays stable for the header-keyed parser regardless of caller order), and falls back to a generic default when given nothing valid. The 9-section format **template is unchanged** (it's the reference); only the SECTION COUNT instruction was rewritten to "produce ONLY these … omit the rest". The master list is exported as `XRAY_ALL_SECTIONS` so the parser, the task map, and the expansion all share one source of truth. (Commit `4b5eb62`.)

### 22.2 Task-matched defaults + selector removal
`constants.js` gained `XRAY_SECTION_DEFAULTS` (per writing-type 2-3 section sets + a generic `_default`) and `defaultXraySections(typeId)`. `WHEN TO USE THIS STYLE` / `SIGNATURE STYLE` are never in a default set. Both numeric selectors (SourceSetup Source step + StyleLab Analyse tab) and their `sectionCount` state are gone; SourceSetup uses `_default` (the writing type isn't chosen yet on the Source step — the flow was deliberately **not** reordered to read it), StyleLab uses the task set with `writingType` plumbed from lyra.jsx. The selector slot now holds one muted caption — "Lyra will pick the {n} most useful lessons from this writing", `{n}` derived from the set length so it can't drift — framing the output as curation. Removing the chips also dropped the §18.7 border-shorthand React warning. (Commit `29955c1`.)

### 22.3 Lazy "Analyse more of this writer"
`saveStyleSkill` now persists the analysed `sourceText` on the skill (legacy records lack it and hide the button). A pure expansion engine in `XRayView.jsx`: `remainingSections(skill)` (canonical sections not yet covered), `mergeNewSectionsIntoSkill` (append-without-duplicate by normalized title, immutable, identity preserved), and `analyseMoreOfWriter` (ONE `style_analysis` call for just the missing sections on the cached source → merge → persist in place by author). An ✦ "Analyse more of this writer" button (`AnalyseMoreButton`, self-hiding when nothing remains or there's no cached source) appears in the post-analysis X-Ray footer (SourceSetup) and in `SavedSkillDetail` (Skills tab). `parseProfileSections` keys purely on the exported `XRAY_ALL_SECTIONS` headers and already handles arbitrary subsets, so a partial re-analysis merges cleanly. (Commit `3fd8c4a`.)

### 22.4 Verification
- **138 unit tests pass** (was 120 pre-feature): name selection + canonical re-ordering + fallback; the task map + no-WHEN/SIGNATURE-in-defaults rule; remaining-set incl. the empty case; merge dedupe (overlap ignored, case/space-insensitive, identity preserved, no mutation); and the coveredSections termination case (§22.5). Production build clean.
- **Live end-to-end (real Pro-tier calls, a public-domain Austen passage):** X-Ray produced exactly **3** generic-default sections, auto-advanced, auto-saved the skill **with sourceText** (whenToUse/signature empty as expected). "Analyse more" merged the remaining **6** (→ all 7 technique sections + WHEN TO USE + SIGNATURE), **no duplicates**, and the button **self-hid** when complete. `GRAMMAR TRICKS` / `WHEN TO USE` / `SIGNATURE` are reachable only via expansion; translation still works on the skill. Caption renders in the old selector slot with intentional spacing.

### 22.5 Adversarial review + fixes (commit `b3d827f`)
A review workflow (4 dimensions → per-finding adversarial verification, 16 findings rejected) surfaced three real issues, all fixed:
- **(major)** the "Add to Skills" recovery path re-saved the skill **without** `sourceText`, permanently disabling expansion for a removed-then-re-added skill — it now passes `referenceText` (the only call site of three that dropped it).
- **(cosmetic)** the X-Ray footer counted WHEN/SIGNATURE in the header but rendered no card for them ("9 analysed" / 7 cards) — the footer now appends only technique sections to the display (WHEN/SIGNATURE still persist + show in the Skills tab).
- **(robustness)** a WHEN/SIGNATURE section the model re-emitted with empty content was treated as still-missing, so the button could re-run forever — skills now carry a `coveredSections` ledger recorded by emitted header, which `remainingSections` trusts (content fallback only for pre-ledger records), so expansion always terminates.

### 22.6 Notes / out of scope (unchanged)
With fewer techniques per skill, `applySkillWithEnrichment`'s PEEL coverage check triggers web-search enrichment more often — expected, not a bug. Not built (deferred by spec): teacher-dashboard depth setting; task-specific top-up after the Mission step picks a type.

---

## 23. UPDATE — 10 June 2026 — Tappable annotation labels + the "Writer A" leak fix (branch `claude/vigorous-zhukovsky-413664`)

Annotation labels in the X-Ray quote cards ("appositive", "ironic cliché"…) were shown but never explained. Now tapping an annotated phrase opens a small bilingual explanation card directly below the quote card — AI-generated on first tap (Lite tier), cached forever, savable to Saved Concepts. Plus: found and fixed the leak that put "(like in your previous analysis of Writer A)" into student-facing analysis prose.

### 23.1 Route + prompt + cached glossary (commit `fb51604`)
New `annotation_explain` route (Lite, `brain:false`). `buildAnnotationExplainPrompt(label, phrase, sentence, sourceLang)` demands JSON-only bilingual output (`term/what/here/try ×en/zh`), forces the student's exact tapped phrase as the worked example with effect-on-the-reader framing, ~120-word EN cap, warm 繁體中文. `src/annotation-glossary.js`: localStorage cache (`lyra-annotation-glossary`) keyed `normKey(label, phrase)` (case/space/punct-insensitive, CJK kept); cache-before-call; ~150-entry cap with oldest eviction; defensive parse (fences/preamble tolerated; garbage throws and is **not** cached — retap retries); shared-promise in-flight guard; deliberately **not** in backup CRITICAL_KEYS (regenerable). `buildConceptFromExplanation` maps an entry onto the **existing** saved-concepts record shape.

### 23.2 Tap UI (commit `d99847b`)
`AnnotatedQuote` gains optional `onAnnotationTap`/`activeKey` — both render paths (English ruby + CJK inline) become tappable only when wired (unwired sites unchanged, no dead cursors); the open annotation's highlight brightens. `AnnotationExplainCard` mounts below the tapped quote card (loading / error+retry / loaded; term header with the annotation's colour accent; what→here→try; ☆ Save → ★ Saved into `lyra-saved-concepts`, deduped). SectionCard wires the English FROM THE TEXT card and the 譯文 card (sourceLang `zh`, per-line sentence), each one-open-at-a-time (retap closes, other tap swaps), with the muted bilingual hint "點一下螢光字詞看解釋 · Tap a highlighted phrase to learn it" under any quote card with ≥1 annotation. The Skills tab is covered automatically (SavedSkillDetail renders via SectionCard); SavedConceptCard's source quote is plain text (no AnnotatedQuote) so there was nothing to wire there.

### 23.3 The "Writer A" leak — investigated then fixed (commit `6f50e64`)
A live X-Ray rendered "(like in your previous analysis of Writer A)". Trace: the profiler is `brain:true`, so LYRA_BRAIN is prepended — and LYRA_BRAIN instructs the model to refer to prior skills via anonymous Writer labels, expecting a display-side substitution layer that exists only on the coaching surface. The profiler's CROSS-REFERENCE context sends prior **technique names only** — nothing is anonymised on that path, so no mapping exists and `restoreAuthorNames` could never apply. The model obeyed LYRA_BRAIN, and the label leaked. Restoring was impossible (the label is the model's invention) and dropping the cross-reference context would kill the connection feature, so the fix is a **banlist**: "NO WRITER LABELS — OVERRIDES EVERYTHING ABOVE" in `buildStyleProfilerPrompt` (after LYRA_BRAIN, so it wins; one place covers both call sites) + the technique-name-only rule appended to both CROSS-REFERENCE snippets. Regression test pins it.

### 23.4 Verification + review (commit `702e156`)
**152 unit tests** (was 138): prompt contents, normKey, cache-hit-skips-AI, garbage→error-not-cached, fenced/preamble parse, eviction, concept-shape conformance, the banlist. Build clean. **Live-verified** in the Skills tab: tapped "ironic cliché" → real Lite call → bilingual card in warm HK register with the phrase "one big happy family" as the worked example → Save wrote a conforming concept ("Ironic Cliché — 諷刺性老套語") → retap closed → second tap served **instantly from cache** (no second AI call). An adversarial review (3 dimensions → per-finding verification) confirmed 4 real issues, all fixed: Save not refreshing StyleLab's "Saved (N)" badge (onSaved threaded), missing `trackCall` on the Analyse-tab SectionCard (annotation calls were uncounted), a one-frame stale flash when swapping annotations (card now keyed by normKey), and no keyboard access on the tappable spans (tabIndex + Enter/Space).

### 23.5 Out of scope (per spec)
No LYRA_LEARNING_DATA from this surface; Grammar Log mini-lesson flow untouched; no pre-seeded static glossary.

### 23.6 Follow-ups landed same session (user feedback from the phone)
- **Register fix, universal (commit `7967210`):** the explain card's Chinese came out as spoken Cantonese (係指/嘅/唔). Both prompts carrying the "warm HK register, not stiff 書面語" line (annotation explain + REPORT_CARD_BRAIN) now demand standard written 書面語 with an explicit colloquial banlist (係/嘅/唔/嚟/嗰/咁/啲…); `GLOSSARY_VERSION` introduced so stale cached entries regenerate on next tap on every device. Live-verified: 「老套語」係指… → 「陳腔濫調」是指….
- **Worked example under Give-it-a-go (commit `6536bcb`):** the try-it pattern alone left no model answer; the prompt now returns `try_example_en/zh` (one completed sentence on an everyday school-life topic), rendered in the cream For-example box and carried into saved concepts as "pattern → example" (SavedConceptCard splits on the arrow natively). Cache v3.
- **Example-box typography (commit `4f89910`):** label inherited a large font; now the 10px sub-label idiom with 11px lines.

---

## 24. UPDATE — 10 June 2026 — Tap-to-define word dictionary (branch `claude/vigorous-zhukovsky-413664`)

Students hit unknown vocabulary everywhere in the app, not just in annotated quotes. Now selecting any single English word (double-tap or long-press — the native mobile gestures) anywhere in the app shows a 📖 bubble; tapping it opens a small bilingual definition card. One Lite-tier call per word ever; cached forever.

### 24.1 Architecture
Mirrors the proven annotation-glossary pattern. `word_lookup` route (Lite, `brain:false`). `buildWordLookupPrompt(word, sentence)` defines the sense **used in the given sentence** (±120 chars of context captured around the selection), plain-English + 書面語 (same Cantonese-colloquial banlist), one everyday example, ~60-word EN cap, JSON-only. `src/word-dictionary.js`: cache `lyra-word-dictionary` keyed by `normWord` (word alone — instant anywhere; curly→straight apostrophe unification, possessives stripped), 300-entry cap oldest-evicted, versioned, defensive parse (failures not cached), shared-promise in-flight guard. Not in backup CRITICAL_KEYS (regenerable).

### 24.2 UI — zero per-card wiring
`src/components/WordLookup.jsx`, mounted once per screen in lyra.jsx: ONE document-level `selectionchange` listener (debounced 250ms) covers every surface. Selection must be a lookable single word (`isLookableWord`), outside inputs/textareas/contenteditable/our own UI. The 📖 bubble anchors **below** the selection (above is where iOS/Android native selection menus render); pointerdown opens the card (wins the race against selection-clearing). The card is fixed, viewport-clamped: word + part of speech, the Chinese equivalent as the headline, EN+ZH meanings, everyday example in the For-example idiom; loading/error+retry; backdrop tap or × closes; scroll hides a stale bubble; resize/rotation dismisses (coordinates would be stale).

### 24.3 Verification + review
**165 unit tests** (was 155): prompt contents + register banlist, normWord (incl. curly-apostrophe unification), isLookableWord, cache-hit-skips-AI, garbage→error-not-cached, defensive parse, eviction. Build clean. **Live-verified:** selected "photograph" in "Paste or photograph a piece of writing…" → bubble → card chose the **verb** sense (拍攝 · 動詞) with formal register and a school-life example; cached; backdrop-tap closed; bubble confirmed rendering below the selection. An adversarial review (3 dimensions → per-finding verification, 8 rejected) confirmed 3 real issues, all fixed (commit `d01e7fe`): the bubble's original above-the-selection position collided with the native selection menus (major — moved below); stale viewport clamps on rotation (resize dismisses; clamp floor added); apostrophe cache-key duplication.

### 24.4 Notes
Cache key is the word alone — the first lookup's sentence picks the sense (acceptable at this vocabulary level; a polysemy-aware key would defeat the instant-cache goal). Possible future: surface looked-up words to the Growth Report as vocabulary signals.

### 24.5 Phone-feedback round (same session)
- **Bubble label (commits `9ae1228`, `c6201c7`):** "中文?" read oddly as a question → briefly "中文意思" → final: just **📖 {word}**.
- **Save vocab (commit `c6201c7`):** ☆ Save → ★ Saved on the definition card writes a `kind:"word"` record to `lyra-saved-concepts` via `buildConceptFromWord` (word · 中文 name, pos, bilingual meanings + example, legacy concept fields for graceful degradation), deduped by `wordKey`. `SavedConceptCard` gained a dedicated compact word-card render (blue accent, pos badge, no translate button — already bilingual). WordLookup lives outside StyleLab, so saves dispatch a `lyra-concepts-changed` window event and StyleLab listens to keep its "Saved (N)" badge fresh.
- **Part of speech (commit `c6201c7`):** now an explicit bordered badge (**verb · 動詞**) beside the word in the popup and on the saved card — the user wanted noun/verb/adj stated clearly.
- **Saved tab classification (commit `23f4121`):** words and concepts no longer share one flat list — grouped under **📖 Words · 生字 (N)** and **✦ Concepts · 概念 (N)** headers, sections shown only when non-empty, original indices preserved for expand/remove.

166 unit tests green; all rounds live-verified in the preview ("admire · 欣賞 / verb · 動詞" under Words, "Ironic Cliché" under Concepts).

---

## 25. UPDATE — 10 June 2026 — Housekeeping: mainline consolidation, sourceText cap, backup quota warns

### 25.1 Push + consolidate
§21–§24 lived only as local commits. Pushed `claude/vigorous-zhukovsky-413664` and fast-forwarded **`main`** (the remote's default branch; no local checkout existed, none in any worktree — `git fetch . branch:main` + push): `origin/main` 30e4010 → `0ed80be` at consolidation time; the FF means the 166-green test tree IS the mainline tree. **Stale-branch report (no deletions made — user decides):** fully merged into main and deletable when ready: `claude/growth-report`, `claude/youthful-wing-17a2f6`, `claude/nifty-ritchie-06acd9`, `claude/sleepy-murdock-09c5ec`, `claude/clever-swartz`, `claude/agitated-blackwell`, `claude/competent-poincare-f5a68e`, `claude/intelligent-elion-31b626`, `claude/magical-lichterman-1f54e8`, `claude/objective-leakey-8dea9a`, plus `master`/`unified-app`/`worktree-*`. NOT merged (diverged): `claude/objective-ramanujan-974c10`.

### 25.2 sourceText cap (commit `5648845`)
`saveStyleSkill` now bounds the persisted passage at `SOURCE_TEXT_MAX_CHARS = 50000` (≈8–10k words — longer than any real paste; quiet `.slice`, no warning), applied INSIDE the function since §22.5 proved call sites drift. `analyseMoreOfWriter`/`remainingSections` read the field as an opaque string — no change. Size audit from the live preview: `lyra-backup-v1` 56.7k and `lyra-style-skills` 35.1k dominate (the double-storage the cap bounds); the Austen skill's sourceText intact at 477 chars.

### 25.3 Backup failures un-silenced (commit `19d9242`)
`snapshotBackup` swallowed every error — when quota is hit, the safety net itself dies first, invisibly (§17.3 exists because silent loss already happened once). Its catch now `console.warn`s, with an explicit "localStorage quota exceeded; backups are NOT being updated" for `QuotaExceededError`/code 22; same one-line warns in `autoRestoreFromBackup` and `getBackupInfo`. Console-only by design.

**170 unit tests green** (166 → +2 cap, +2 quota). Build clean.

---

## 26. UPDATE — 10 June 2026 — Authentic-growth validation: no more conversational/meta junk in Achievements or the Growth Report

### 26.1 The bug chain (live evidence: 8 Jun card "Hollywood Cliché vs Messy Truth")
A saved Achievements card had `before` = the canned "Search for facts" quick-action chip message and `after` = third-person meta-commentary ("The student understands that…"). Chain: LYRA_BRAIN's coupling rule mandated a growth entry on any "win" → the model emitted one for a conversational insight → `syncLearningData`'s loosened gate (any growth pair ⇒ card) trusted it → junk card, junk `lyra-growth-log` entry, a fake `lyra-growth-pending` increment, and a fake practice queued for the next Growth Report regen.

### 26.2 The validator (commit `cddb545`)
`isAuthenticGrowth(g, studentTexts)` — pure, exported. ALL must pass: before/after non-empty + different; `before` is NOT a canned chip message (`QUICK_ACTION_MESSAGES` now lives in constants.js as the single source of truth — ChatTab builds its chips FROM it — because chips arrive AS user messages and provenance alone would authenticate them); `before` TRACES to text the student actually authored (substring or ≥0.6 content-word overlap via `reportWords`/`reportSameMoment`; empty studentTexts fails closed); neither side is meta-commentary (`isMetaGrowthText`); `after` ≤600 chars.

### 26.3 The gates (commit `dff173f`)
`syncLearningData` uses ONLY authentic entries for the growth-log write, the pending increment, and the auto card; grammar/vocab/structures/skills sync unchanged. All-rejected ⇒ diagnostic `console.warn`. `studentTexts` wired at both call sites: lyra.jsx `sendChat` (prior user messages + the just-sent message + the draft) and TrainingSession `fetchLyraTurn` (the `role:'student'` turns carrying rewrite attempts). `maybeSaveVisibleReport` refuses a card whose "After:" line is meta; the manual ★ Save stays as the student-controlled override.

### 26.4 The brain fix (commit `418f73b`)
The MANDATORY DATA EMISSION rule was amended in place: growth entries exist ONLY for a literal sentence rewrite (`before` = a sentence the student typed, verbatim); realisations/insights/answered questions are NOT growth — omit the array when no rewrite happened; never write third-person observations into any LYRA_LEARNING_DATA field; ✗/✓ pair added using the exact bug case.

### 26.5 The purge (commit `a384ea0`) — verified live
`purgeInauthenticGrowthV1` (boot, after `autoRestoreFromBackup`, flag-guarded, META check only — traceability can't be evaluated retroactively) removed exactly the bug from the preview on first reload: `[lyra-purge] removed 1 growth-log entry + 1 report card(s) with meta-commentary: "The student understands that creative writing for HKDSE…"` — both stores cleaned, flag set, backup snapshotted. Every device self-cleans on its next load. grammar-log/vocab/structures untouched; pending not recomputed (next regen resets it).

### 26.6 Tests
**183 unit tests green** (170 → +13): the exact screenshot junk as a fixture (canned and meta each independently sufficient), traceable-rewrite pass, fail-closed, 0.6-overlap paraphrase, gating (invalid-only ⇒ nothing written but vocab still syncs; mixed ⇒ only valid logged), meta visible-report ⇒ null, migration (junk removed/legit kept/flag/idempotent). One pre-existing test updated to supply provenance — the new contract.

---

## 27. UPDATE — 10 June 2026 — Photo upload: gallery wouldn't open on phones

### 27.1 Investigation (mechanism A)
Both SourceSetup file inputs carried `capture="environment"` — on Android that's a hard fork (camera app directly, gallery never offered; iOS likewise forces the camera UI). Ruled out: B (the `.click()` was already synchronous, input always mounted), C (no getUserMedia anywhere — noted for the future: the LAN-IP preview `http://192.168.0.x` is an insecure context where getUserMedia silently fails), D (no label/overlay issues). The Mission-step "Scan exam question" input had the identical bug; Onboarding's legacy upload has no `capture` and needed no change.

### 27.2 Fix (commit `86f7d1b`)
Two always-mounted inputs per surface — a capture-less gallery picker + a `capture="environment"` camera input — behind two compact chip buttons ("🖼 Gallery" / "📷 Take photo" on the Source step; "🖼 Gallery" / "📷 Scan exam question" on the Mission step). Synchronous `.click()` in onClick, shared OCR pipeline. On iOS the capture-less input natively offers Photo Library / Take Photo; the split is for Android's hard fork.

### 27.3 Hardening (commit `7b80a6a`)
`src/image-utils.js`: `prepareImageForOCR` transcodes non-jpeg/png/webp (Android can deliver HEIC) and downscales >2000px long edge via one canvas pass (createImageBitmap → JPEG 0.9); safe-and-small files pass through byte-identical. Failures now SURFACE — scanning always resolves to a filled textarea or a visible error ("Couldn't read that photo — try a screenshot instead"; the Mission scanner gained its own inline error line). `e.target.value` resets synchronously at the top of each handler so the same photo re-picks even after a failure. **190 tests** (+7: transcode decisions, downscale math).

### 27.4 Verified
Preview DOM: both buttons render; exactly two inputs mounted (capture-less + environment). Phone verification (gallery opens / camera opens / same-photo-twice / PNG+HEIC OCR) is in the user's hands on the LAN preview. Follow-up (commit `a92622e`): the 🖼/📷 emoji were replaced with line-art SVG icons (CameraIcon/GalleryIcon in Icons.jsx) matching the app's stroke style, per user feedback.

---

## 28. UPDATE — 11 June 2026 — Genre-mismatch tripwire + non-destructive type switch

### 28.1 The bug (live screenshot) and why a deterministic layer
Topic "write a letter to editor about cell phones should be fully banned at schools", declared type Formal Business Email. The session header read **0 API calls** — the canned welcome is a template with no model in the loop, so nothing could ever catch the contradiction: it echoed it verbatim ("a formal business email about 'write a letter to editor…'") and coaching ran under the wrong HKDSE convention block, session-fatally. Hence layer 1 is a free deterministic regex, not a model call.

### 28.2 The four layers
1. **Detector (`0362802`)** — `detectFormatCue(topic)` in `src/genre-cues.js`: regex over explicit format instructions only; ≥2 cues to different types → null (silent). **Taxonomy patch:** letter-to-editor/speech → `persuasive` is a deliberate nearest-fit until the genre taxonomy expands (out of scope).
2. **Mission nudge (`6836871`)** — amber one-liner under the type grid + [Use it] chip; re-evaluates on edits; non-blocking.
3. **In-session banner + switch (`0e1589e`)** — dismissible banner above the chat with [Switch to X]/[Keep Y]; decision persisted per writing (`genreCueDecision` via autoSave) so it never re-nags. The switch is **non-destructive** (setType only — verified in code: `typeLabel`/`examRules` are derived per render and the coach prompt is built at send time, so the next turn carries the right convention block automatically). A local no-API confirmation message is appended and a one-time context note rides the next sendChat. The header type chip is now tappable → 6-type picker → same path (covers cue-less student-initiated changes).
4. **Model rule (`7661fbb`)** — GENRE CHECK block in buildCoachPrompt (coach surface only): name the contradiction in the first reply, ask once, then respect the decision — catches implicit cases the regex can't see.

### 28.3 Welcome echo fix (`fa847f9`)
`topicBrief` extracted from generateTitle (instruction verbs/articles stripped, first clause); the welcome now reads "working on a {type}: {brief}" instead of `about "<raw instruction>"`.

### 28.4 Verified (preview, exact screenshot scenario)
Nudge appeared naming Letter to the Editor → ignored → banner appeared in-session → [Switch to Persuasive Writing]: banner gone, chip updated, local confirmation appended, chat intact → record shows `type:"persuasive"`, `genreCueDecision:"switched:persuasive"` → re-open: **no re-nag** → header-chip picker → switched to Report: both ack messages and draft preserved in the record. **201 tests green** (+11: detector incl. the exact topic, ambiguity, story-which-begins; topicBrief). Real-AI checks (first-reply acknowledgment, unit-4 implicit case) left to live phone use.

### 28.5 Same-session follow-ups (user feedback)
Title truncation: stored titles no longer bake in "..." (commit `2912750`) and a one-time boot migration heals pre-fix records from their full topic (`ca9b657` — the user's live record verified healed). Nav bar (☰ · Chat/My Writing · ···) moved from bottom to top (`55a5210`). Type picker: highlight follows the pointer like a classic menu, tick removed, outside-tap closes (`78e8e2f` after two feedback rounds `096c89e`/`6820fe5`).

---

## 29. UPDATE — 12 June 2026 — Search-grounded Brainstorm + claim-anchored Find-an-example

### 29.1 Plumbing findings (verified before building, commit `02adbb1`)
The proxy applies `google_search` grounding for ANY whitelisted model when `useSearch=true` (pro-tier coaching included) and honors the per-request model; quirk: `thinkingBudget` is deliberately dropped on grounded requests (thinking makes the model skip search). Sources already survive end-to-end (proxy `groundingMetadata` → `{text, sources}` → message record → ChatTab). **Grounding price (AI Studio pricing page, June 2026): Gemini 3.x = 5,000 grounded prompts/month free, then $14/1k queries — one prompt can bill multiple queries** (2.5-era: $35/1k); recorded in the router comment.

### 29.2 The two chips (commits `992ab09`, `d511fd1`, `ab9a1b5`)
"Search for facts" retired. **Brainstorm ideas** (divergent, pre-writing) and **Find an example** (convergent, mid-draft) both run grounded through the normal pro+LYRA_BRAIN coaching turn. Prompt modes: brainstorm = exactly 3-4 angles, each one Socratic question + a real anchor as a fragment with source name, HK-preferred, statistics only from results soft-attributed, ends asking which angle is theirs; find-an-example = identify the claim (named → recent → weakest-evidenced; none → ASK, never search blind), 1-2 real examples as fragment+source, each followed by a "how would you show this proves your point?" question — the linking sentence is never written for the student (the mark-bearing four-element skill). **Live test caught a real failure: "Search the web" in the canned message is LOAD-BEARING** — without it the model returned zero groundingChunks and invented plausible anchors from memory. Both messages now lead with it, and the prompt block adds execute-search-before-answering. Re-verified: `[Grounding] 6 sources found`.

### 29.3 QUICK_ACTION_MESSAGES coupling
The registry now has an active section (chips build from it) and a RETIRED section kept forever — old sessions still contain the facts/old-brainstorm strings and the §26 authenticity validator must keep rejecting them as growth `before`s. Both new strings registered (chips are sent AS user messages).

### 29.4 Sources UI (commit `2760629`)
Pure `formatSources` → hostname pills (a hostname-looking grounding `title` like "scmp.com" wins over the redirect uri's hostname), capped at 4, deduped, malformed skipped; rendered as small tappable bordered pills under grounded bubbles. Live: scmp.com · thestandard.com.hk · weforum.org · teachermagazine.com.

### 29.5 Switch warts (commit `bda3aa1`)
`upsertSwitchNotice` replaces a directly-preceding "Switched to…" notice instead of stacking four; `swapTitleTypePrefix` retargets the auto-generated "{Type} — " title prefix on switch, leaving customised titles untouched.

**220 unit tests green** (204 → +16). Build clean.

---

## 30. UPDATE — 12 June 2026 — Style Lab nav cleanup: five-noun tab bar, actions rehomed onto cards

### 30.1 Unit-0 findings (verify-then-rehome — the brief's fears tested against the code)
- **The Practice tab was NOT the home of training threads.** It was an ephemeral, in-memory sentence-rewrite chat against the current analysis (`practice_rewrite` route + `styleCoachPrompt`), plain `useState`, zero persistence, dead on unmount. `lyra-training-chats` appears nowhere in StyleLab — threads belong exclusively to TrainingSession, keyed `[skill.id][techIdx]`, resumed by reopening the same skill+technique. No global thread list existed anywhere, before or after.
- **The Use It tab had no action to rehome.** It was a read-only renderer of the current analysis's WHEN TO USE THIS STYLE section — no apply/pin, no skill_match, no deployment record (the brief's suspicion was wrong; followed the code). Applying a skill already lives on SavedSkillDetail's "✦ Write with this skill".
- **Entry points:** all internal — the two tab buttons + ONE `goToTab("practice")` ("Start Practising" on the Analyse tab). `initialTab` was dead plumbing (setter never called); the chat "✦ Skills" chip never targeted a tab; **no tab state persisted anywhere** → no migration needed.

### 30.2 The rehoming map
| Old path | New home | Commit |
|---|---|---|
| Practice actions | Already on technique cards (§15) — verified same props/keying; cards now also show **"Continue · N turns"** when a `lyra-training-chats` thread exists (new pure `countThreadTurns`/`loadTrainingChats` in `src/training-threads.js`) | `9e5dc29` |
| Use It display | Same parsing/markup as a "When to Use This Style" card at the end of the Analyse tab's section list (renders only when the analysis included the section) | `a44434e` |
| "Start Practising" CTA | Opens the real **TrainingSession on the just-auto-saved writer** (hidden when too-short/removed) — deviation: the old target was the ephemeral rewrite chat, which held no durable data and duplicated TrainingSession's purpose | `e920a60` |
| The tabs themselves | Deleted, plus all orphaned machinery (CoachMessage, PracticeTypingBubble, practice state/effects, styleCoachPrompt+useTypewriter imports, needsProfile disabled logic) — −328 lines | `e920a60` |

### 30.3 Tab-bar fit (the original motivation)
Verified at 430×932: five noun tabs — Analyse Style · Saved · Writers · Achievements · Report — `scrollWidth === clientWidth` (394px, padding tightened 16→6px/side), Achievements and Report directly tappable, all five always-alive with content, zero console errors. Unit-4 tests folded into unit 1 (+6, **226 total**); no tab tests existed to migrate.

---

## 31. UPDATE — 13 June 2026 — Genre taxonomy expanded: Letter to the Editor + Speech as first-class types (branch `claude/genre-taxonomy`)

Resolves the §28.2 taxonomy patch. The user's own live bug case WAS a letter to the editor — under the patch it coached as generic Persuasive Writing, with no salutation/sign-off guidance and no spoken-register awareness for speeches. Both genres carry real HKDSE format marks; now they're real types.

### 31.1 The two types (commit `449665a`)
`writingTypes` gains `editorial` ("Letter to the Editor", newspaper icon) and `speech` ("Speech / Talk", podium icon — the `speech` icon name was already taken by Persuasive's bubble; namespaces are separate but the new name avoids the trap). Task-matched X-Ray defaults: editorial = PERSUADES + IDEAS CONNECTED + WORD CHOICES (argument flow + formal diction); speech = PERSUADES + FEELING + SENTENCE PATTERNS (devices + emotion + rhythm). HKDSE convention blocks carry the mark-bearing formats: editorial — "Dear Editor," / "Yours faithfully," + name ("Chris Wong" if none given), respond-to-the-news opening, one-position rule, the four-element body, call to action; speech — greeting + self-intro naming audience and occasion, "Thank you." close, direct address/inclusive-we/rhetorical questions, signposting + tricolon, the four elements in spoken form. Other purposes (IELTS/TOEFL/Cambridge) fall back to their `_global` rules — those exams don't set these genres.

### 31.2 Detector retarget (commit `63548c8`)
genre-cues: letter-to-editor → `editorial`, speech → `speech`; the TAXONOMY PATCH comment is gone. The old "speech + letter to the editor → same type" test is now a genuine-ambiguity case (they're distinct genres); the same-type pair is article + essay (both cue → `essay`). **Remaining nearest-fit, noted in the module: article → essay** — the 8-card grid is at its limit.

### 31.3 Formality split (commit `da44b59`)
Letter to the Editor joins the formal list in both `buildStructuralPrompt` and `buildProofreadPrompt`. Speech / Talk gets a third branch — semi-formal SPOKEN register: contractions and direct audience address are never flagged; slang/chat-style words are; vocabulary upgrades stay natural to say aloud rather than stiffly academic (the old binary would have either flagged every contraction or mislabelled a speech "creative/narrative").

### 31.4 Live verification + two walk-fixes (commit `5a4cc5d`)
Fresh preview from this worktree at 430×932, full flow at **0 API calls** (nudge is regex; welcome is canned):
- **Mission grid:** all 8 types on one screen, two clean columns, no overflow; header type-picker shows all 8 rows, current type bold.
- **The exact §28 screenshot scenario** ("write a letter to editor about cell phones…" + wrong type): nudge names Letter to the Editor → [Use it] selects it → title prefix, header chip ("Letter to the Editor · HKDSE · 300 words"), and welcome all carry the new type. Speech flow likewise ("Speech / Talk · HKDSE · 200 words").
- **Walk-fix 1:** the nudge stuttered now that cue label can equal the type label ("asks for a Letter to the Editor — Letter to the Editor fits best") — the dash tail renders only when the labels differ (Speech — Speech / Talk keeps it; verified both live).
- **Walk-fix 2 (pre-existing, §18.7 class):** every Mission-step chip toggle tripped React's conflicting-style warning — `chip` sets shorthand `border`, `chipActive` set `borderColor`. chipActive now uses the full shorthand; fresh toggles add zero new warnings.

**232 unit tests green** (226 → +6: two HKDSE format blocks, speech detection, ambiguity case, spoken-register branch ×2, editorial-is-formal). Build clean.

### 31.5 Notes
- The legacy Onboarding screen (only renderer of the type icons) has no `setScreen("onboarding")` call site — the two new icons are dormant-but-correct until that screen returns. Nothing can overflow there; it can't render.
- The §28 in-session banner needed no change: it contrasts the cue against the *current* (wrong) type, so its copy never stutters.
- Old saved writings keep their `persuasive` type — no migration: the type was correct-as-saved under the old taxonomy, and the §28 banner/picker already covers changing it per-writing.

### 31.6 Same-session follow-up — X-Ray over-production fixed (user's phone, Marina Hyde case)
A live X-Ray on a 1012-word article produced **9 sections on a 3-section request** — the §22 curation contract broken by the model, not the code (SourceSetup correctly asked for the `_default` 3). Cause: the SECTION COUNT rule sits ~600 lines before the full 9-section reference template, and on a rich source the template's gravity won (the §22.4 Austen test passed because the passage was short). Two layers, both shipped:
1. **Prompt (recency):** `buildStyleProfilerPrompt` now ENDS with a FINAL CHECK — exact count, numbered list, "the formats above are reference… do NOT produce any section not in this list", and "After finishing {last}, STOP."
2. **Deterministic clamp:** `filterSectionsToRequested(sections, requestedNames)` (pure, exported from XRayView) applied at all four initial-analysis parse sites — SourceSetup and StyleLab, streaming partial AND final — before display and before `saveStyleSkill`, with ONE hoisted `requestedSections` const per call site shared by prompt + filters so the contract can't drift. Empty/invalid request = passthrough (the Analyse-more path manages its own subsets; its merge already dedupes).
**238 tests green** (+6: the live 9-on-3 case, compliant passthrough, case-insensitivity, empty-request passthrough, invalid input, prompt FINAL CHECK tail). **Live re-verified** (real Pro call, Austen): header "3 sections analysed", exactly 3 cards, saved skill carries 3 sections + coveredSections ledger of 3 — "Analyse more" still offers the remaining 6. The user's 9-section Marina Hyde skill is left as-is (valid content, student data).

---

## 32. UPDATE — 13 June 2026 — Practice sentence now persists across remounts (user's phone)

### 32.1 The bug
In the Practice Session, the "Rewrite this sentence" exercise **regenerated every time the student re-entered the page** — exit mid-practice, come back, and you're handed a *different* sentence (the student was practising one sentence with a new skill, then it silently changed under them). Captured live in the proxy log: **four separate `training_exercise` generations** for one skill, each a different red-dress sentence — including the exact screenshot one, "She wore a red dress that looked quite nice at the party last night."

### 32.2 Cause
`exercises` was component `useState(null)` — never persisted, while sibling state (`lyra-training-progress`, `lyra-training-chats`) was. On every remount `exercises` reset to null, the auto-generate effect (`if (skill && !exercises) generateExercises()`) re-fired, and the AI produced fresh sentences. The exercise sentences were simply the one piece of training state left out of localStorage.

### 32.3 Fix
Mirror the existing progress/chats persistence pattern, plus a merge so re-generation can never overwrite a sentence the student is mid-practice on:
- New store `lyra-training-exercises` keyed by `skill.id`; hydrate on mount (`exercisesHydrated` gate), save on change. (`src/components/TrainingSession.jsx`.)
- The auto-generate effect now waits for hydration and fires **only when a slot is missing** (`!exercises || techniques.some((_,i)=>exercises[i]==null)`) — so a remount with a stored set generates nothing.
- `mergeExercises(prev, parsed, length)` (pure, exported from `src/training-threads.js`): fills only null slots, preserves set sentences, always exactly `length` long. Both `generateExercises` and its fallback now merge instead of overwrite — so adding techniques later via "Analyse more" fills the new slots without rewriting the practised ones.

### 32.4 Verification
**243 tests green** (238 → +5: first-gen fill, never-overwrite, grow-and-keep after Analyse-more, length/out-of-range clamp, malformed input). Build clean. **Live-verified** (real skill "Maxine Eggenberger", 3 techniques): before the fix the proxy showed 4 generations / 4 different sentences; after the fix, reloaded the page and re-entered the session → exercise sentence **identical** to the stored one ("The red dress she wore to the party looked very nice on her.") and the proxy fired **zero** new `training_exercise` calls. Zero console errors.

---

## 33. UPDATE — 13 June 2026 — Universal no-semicolon coaching rule (user's phone, practice chat)

### 33.1 The bug
In the practice chat, Lyra coached the student to *"join your two ideas with a semicolon (;)"* — but for HKDSE the student is rewarded for fusing ideas into ONE grammatically integrated sentence, not parking two clauses behind a semicolon. The user wants Lyra to never suggest the semicolon shortcut and instead teach + encourage building one flawless complex sentence.

### 33.2 Root cause
Not just a missing rule — `LYRA_BRAIN`'s own gold-standard Parallel Universe exemplars modelled the splice (`"Undeniably X; yet, Y"`, `"… ; however, …"`, the Masterclass before/after `"… dry; on the other …"`). The model imitated its own examples. A rule alone would fight the exemplars.

### 33.3 Fix (universal — every coaching surface)
- **`src/lyra-brain.js`** — new section "ONE FLAWLESS SENTENCE — NEVER THE SEMICOLON SHORTCUT": never suggest/model/praise a clause-joining semicolon; coach subordination / relative clause / participial / appositive instead, with the exam rationale ("grammatical control" scores higher); the read-aloud test; and a clause binding **Lyra's own examples** ("if you would not accept it from the student, do not write it yourself"). All five spliced exemplars rewritten to integrated `"Although X, Y"` / `"While X, Y"` / `"…, only for … to …"` / `"…, while …"` forms — same concession-then-punch rhythm, one sentence.
- **`src/prompts.js`** — reinforced as a hard constraint in `buildTrainingChatPrompt` (the practice chat — the exact bug surface, including "your own Parallel Universes must be one integrated sentence"), and a one-liner each in the non-brain Lite surfaces `buildStructuralPrompt` + `buildProofreadPrompt` so no surface can suggest a semicolon.

### 33.4 Verification (deterministic + two live runs)
**247 tests green** (243 → +4: rule present in LYRA_BRAIN, old `; yet` exemplars gone / integrated ones present, training-chat constraint, both Lite surfaces). Build clean.
- **Live run 1** (rule + exemplar rewrite): Lyra declined the semicolon ("in an exam, that's like parking two cars next to each other… it doesn't show the reader how they're connected") and taught weaving — but **1 of her 3 own Parallel Universe examples still spliced** ("a room full of books; it was a venerable sanctuary").
- Strengthened the rule to explicitly bind Lyra's own example/PU/before-after sentences (scan-before-send), mirrored in the training-chat constraint.
- **Live run 2**: declines the semicolon again, and **all three** Parallel Universe examples are now integrated single sentences (participial "Transcending…", subordinating "Although…", participial "Acting as…"). The only semicolon left in the whole reply is in her *explanatory prose* ("the reader doesn't just see a dress and then a personality; they experience…") — a legitimate stylistic semicolon, not a model sentence or a suggestion to the student. Zero console errors.

### 33.5 Note / residual
The rule targets **suggestions and model sentences**, not Lyra's every utterance — she may still use an occasional semicolon in her own connective prose (and a studied source writer's semicolons remain hers to admire). If zero semicolons anywhere is wanted, that's a stricter, separate ask (risks stilting her coaching voice).

---

## 34. UPDATE — 13 June 2026 — Achievements: one card per technique + copyable practice chat (user's phone)

### 34.1 Two bugs from one practice session
Practising ONE technique ("Painted Style Pictures") and continuing the chat produced **a new Achievements card every turn** ("expanding into two new cards with wall of words") — and the student **couldn't copy** Lyra's coaching text out of the chat.

### 34.2 Why the cards multiplied
`saveMasterclassReport` dedups only by exact `after` sentence, and the Achievements tab grouped via `groupReports`, which clusters by practice-MOMENT (≥60% `after`-sentence word overlap). Each continued turn has a *different* example sentence, so every turn became its own group → its own card. `groupReports` is correct for the Growth Report (practice-volume / mistake dedup) but wrong for "achievements I've earned per technique".

### 34.3 Fix A — group Achievements by technique (commit pending)
New pure `groupAchievements(reports)` in `src/report-utils.js`: ONE card per technique (`reportTechniqueKey` = normalised `technique` || first skill name); reports with no technique fall back to the existing sentence-moment clustering (so they don't all collapse into one untitled card); display = the richest member (a structured report beats a freeform chat dump, so the card is the cleanest view, not every turn's wall stacked). `MasterclassReports` and the tab-badge initialiser switch to it; **`groupReports` and the whole Growth Report path are untouched** (different, correct semantics there).

### 34.4 Fix B — copyable coaching turns (commit pending)
Root cause of "can't copy": there was no copy affordance, long-press selection inside the fixed overlay is unreliable on mobile, AND the LAN-IP preview is an **insecure context** where `navigator.clipboard` is `undefined`. Added a **⧉ Copy** button beside "★ Save this turn" on every Lyra turn (`src/components/TrainingSession.jsx`), with a dual-path `copyTurn`: `navigator.clipboard.writeText` on a secure context, else a hidden-textarea `document.execCommand("copy")` fallback that works without HTTPS. Transient "✓ Copied" confirmation; timer cleaned on unmount; copied-state reset on technique switch.

### 34.5 Verification
**251 tests green** (247 → +4: same-technique folds to one card, different techniques stay separate, structured-beats-freeform display, no-technique sentence fallback). Build clean. **Live-verified** (preview held 3 "Painted Style Pictures" records from real practice chats): Achievements tab collapsed them to **one** card ("1 achievement", badge "Achievements (1)" before opening). The ⧉ Copy button renders on all 8 Lyra turns and is wired; the actual clipboard write can't be exercised in the headless preview (browsers block programmatic copy without a trusted tap — confirmed both `writeText` and `execCommand` are blocked there), so the final copy confirmation is a real finger-tap on the phone.

---

## 35. UPDATE — 13 June 2026 — Practice: add a fresh sentence on Lyra's approval (keep the old)

### 35.1 The request
When Lyra approves a rewrite in the practice chat, she should invite the student to keep drilling the SAME skill on a NEW practice sentence — **adding** it while **keeping** the old one (not refreshing/replacing). Lyra's approval is the condition under which the new sentence emerges.

### 35.2 Data model — each technique holds a LIST of sentences
`exercises[techIdx]` went from a single string (§32) to a **list** of sentences (original + any the student added). `src/training-threads.js`: `mergeExercises` now fills empty slots with one-element lists and never overwrites a populated slot; `normalizeExercises` migrates the legacy string-per-slot shape on read (live data auto-upgrades — verified the persisted store is already `[[…],[…],[…]]`); `appendSentence(prev, techIdx, sentence)` adds one, de-duped, immutably. Persistence (§32) carries over unchanged — sentences still survive remounts.

### 35.3 The flow
- **Lyra invites (prompt):** `buildTrainingChatPrompt` ongoing-turn guidance — on a genuine win, after celebrating, Lyra asks warmly whether they'd like to try the same technique on a fresh sentence ("same skill, new sentence"), and is told the app shows a button.
- **Approval gates the button:** `TrainingSession` sets `approvedActive` when a turn logs a win (`savedReport` or a `growth` entry in the learning data). A green **"✦ Try this skill on a new sentence"** button appears only then.
- **New sentence emerges:** the button calls `addNewSentence()` → ONE `training_exercise` call for just the active technique, passing the technique's existing sentences as an **avoid list** (`buildTrainingExercisesPrompt(techniques, avoid)`) so the new one is a clearly different everyday topic → `appendSentence` keeps the old + adds the new → jumps to it → resets the rewrite box.
- **Pager keeps the old reachable:** when a technique has >1 sentence, a `‹ N / M ›` pager (pure `pickSentence`, clamped) flips between them; one continuous chat thread per technique (matches "continue with that skill").

### 35.4 Verification
**262 tests green** (251 → +11: mergeExercises list-shape incl. legacy-string migration + multi-sentence preserve, normalizeExercises, appendSentence incl. no-duplicate, the avoid-block prompt, Lyra's invitation in the ongoing branch). Build clean. **Live end-to-end (real Pro calls):** sent a strong rewrite → Lyra approved ("You've nailed this technique. Want to try the same move on a brand-new sentence to lock it in?") → the green button appeared → tapped it → a new different-topic sentence ("He wore a navy suit to the office…") was appended while the original red-dress sentence was **kept**; pager showed **2 / 2**, flipping to **1 / 2** restored the original. Zero console errors.

---

## 36. UPDATE — 13 June 2026 — Adversarial review of §35, fixes applied

A review workflow (5 dimensions → per-finding skeptical verification) raised 9 findings: **8 confirmed, 1 rejected** (the rejected one — an anti-bias leak via the addNewSentence fallback — was correctly shown unreachable in current code because every production path keeps `sections`/`analysedTechniques` parallel). The 2 majors + the minor cluster are fixed:

- **(major) Wrong technique after a deletion.** `addNewSentence` (and the pre-existing `fetchLyraTurn`) resolve the active technique via `anonTechs[activeTechIdx]` (from `analysedTechniques`), but the display `techniques` array is derived from `skill.sections`. `StyleLab.removeTechnique`/`removeTechniques` filtered ONLY `sections` in the `hasFullSections` branch, so after deleting a technique the arrays desynced and the wrong technique was sent. **Root-cause fix:** both removers now filter `sections`, `analysedTechniques`, and `techniques` by the same index in lockstep, restoring the parallel-array invariant the display title-override and the coaching/exercise lookups both rely on.
- **(major) Stale chat context on a new sentence.** The chat thread is keyed by technique only, so after adding a sentence the next coaching turn sent the NEW sentence as the target but the OLD sentence's conversation as history. **Fix:** `addNewSentence` now appends a "✦ Fresh practice sentence — same skill: …" transition note into the thread, so the continuous conversation explicitly introduces the new target (kept one-thread-per-technique rather than re-keying per sentence, which would orphan existing saved threads and break the §30 "Continue · N" badge). Residual, documented: flipping the pager *back* to an older sentence and submitting still pairs that sentence with the whole thread — a rarer path.
- **(minor cluster) `addNewSentence` robustness.** It now only jumps the pager / clears the box / consumes the approval when a sentence was **actually appended** (computed from the result, not the pre-call length) — a de-duped/empty/errored generation keeps the green button for retry and shows a brief "Couldn't find a fresh one just now — tap again" notice instead of a silent dead button. An in-flight call that resolves after the student switched technique now skips the UI-position setters (live `activeTechIdxRef` guard), so it can't wipe the new technique's draft. The append itself always targets the captured technique.
- **(minor) Pager no longer wipes the draft.** The `‹ ›` arrows dropped their `setStudentAttempt("")` — flipping to re-read another sentence and back no longer discards an in-progress rewrite.

**262 tests green** (unchanged — these are component-level fixes; the pure layer they touch was already covered). Build clean. **Live re-verified:** typed a draft → flipped pager ‹ then › → draft intact; sent a strong rewrite → Lyra approved → tapped the button → a 3rd distinct sentence ("She wore a loose linen shirt…") appended (all three kept, pager 3 / 3) and the transition note landed as the latest chat turn. Zero console errors.

---

## 37. UPDATE — 13 June 2026 — Coaching Chinese: standard written 書面語, no spoken Cantonese

### 37.1 The bug
A Masterclass Report's GRAMMAR & PROOFREADING explanation rendered in spoken **Cantonese**: "喺英文入面，我哋唔會同時用 'although' 同埋 'but'。用其中一個就已經足夠表達對比。" Hong Kong students read/write standard 書面語; spoken forms look wrong on a teaching card.

### 37.2 Cause
The §23.6 register fix added a Cantonese banlist to `report-card-brain.js` (Growth Report) and to the annotation-explain / word-lookup prompts (`prompts.js`) — but **not to `LYRA_BRAIN`**, which generates the coaching turns and the Masterclass Report. LYRA_BRAIN's only Chinese guidance was "natural HK written Chinese, not Mainland phrasing" — it never banned spoken Cantonese, so the model slipped into it for full-sentence grammar explanations.

### 37.3 Fix
New "CHINESE REGISTER — STANDARD WRITTEN 書面語 ONLY" section in `src/lyra-brain.js`: every Chinese it emits (vocabulary glosses, Parallel Universe translations, grammar explanations, the report) must be Traditional 書面語; explicit banned-form → written-form table (係→是, 嘅→的, 唔→不, 喺→在, 我哋→我們, 同埋→和/以及, 嚟→來, 嗰→那, 咁→這樣, 啲→些, 畀→給, 乜→什麼, 冇→沒有, 噉→這樣); and the user's exact sentence as the ✗/✓ pair. The §410 checklist line now points to it.

### 37.4 Verification & note
**263 tests green** (+1: LYRA_BRAIN carries the register rule + the 我哋/同埋/喺 mappings). Build clean. The prompt rule applies to **new** turns only.

### 37.5 Follow-up — "still not fixed": the saved card heals at render time
The prompt rule can't touch a Masterclass Report **already saved** in Cantonese (reports are never regenerated) — so the card the user was looking at was unchanged, and they were right to say it wasn't fixed. Added a deterministic display-time converter `toWrittenChinese(text)` in **`src/zh-register.js`** and applied it where coaching Chinese renders (`renderReportMd` + the structured grammar/vocab/why-better fields in `AchievementCard`, and the practice-chat `renderMd`). It maps Cantonese-EXCLUSIVE tokens to written forms (喺→在, 我哋→我們, 唔→不, 同埋→和, 嘅→的, 嚟→來, 嗰→那, 啲→些, 畀→給, 冇→沒有, 噉/咁→這樣/這麼, 嘢→東西, 佢→他, 入面→裡面, …) with mask/restore guards for the two collision cases — 係 inside 關係/聯係, and the false bigram 入面 inside 進入/深入+面. Pure, render-only, no data mutation.

**269 tests green** (+6: the live-bug sentence → 書面語, each core token, 關係 not corrupted, 進入面試/深入面 not corrupted, English + already-written Chinese untouched incl. no I/G/L mask leakage, empty/null passthrough). Build clean. **Live-verified on the user's exact card** ("The Helpful Professional", a structured report whose saved data still contains "喺英文入面，我哋唔會…同埋…"): the Achievements card now renders **"在英文裡面，我們不會同時用 'although/even though' 和 'but'。用其中一個就已經足夠表達對比。"** — zero Cantonese markers, English untouched, no console errors. Belt-and-braces: the §37.3 prompt rule reduces it at the source, this converter heals anything already saved or still slipped.

---

## 38. UPDATE — 15 June 2026 — Word-dictionary 📖 bubble works on desktop but not mobile: touch-handoff fix (§24)

### 38.1 Investigation (6-agent adversarial workflow → A/B/C/D)
**Root cause: B (primary) + D (contributor); A and C ruled out.**
- **A (never appears) — ruled out.** The selectionchange path survives a normal mobile word-grab; the bubble *does* appear (matches "select → bubble → tap → nothing").
- **C (off-screen) — ruled out hard.** `index.html` sets `user-scalable=no` → no zoom → no visual-vs-layout-viewport divergence → the clamps cannot push the bubble off-screen.
- **B (tap does nothing) — PRIMARY.** The 📖 button renders only while `bubble && !popup`, ~10px below a *live* selection. On touch, the tap that reaches the bubble **collapses the selection** → `selectionchange` → the 250ms debounce hits `setBubble(null)` (popupOpenRef still false) → the button unmounts before the tap's pointer event lands. (On iOS the first tap outside a selection is often consumed by the OS to dismiss the callout, so a retry is needed — but the bubble is already gone.) Desktop works because mouse-select keeps the selection stable.
- **D (contributor) — confirmed.** Two teardown handlers also nuke the bubble mid-handoff, only on mobile: unconditional `onResize` (the URL-bar collapse changes `innerHeight`) and capture-phase `onScroll` (the article scrolls in an inner `overflowY:auto` container, so finger drift fires it).

### 38.2 Touch-robust fix (`src/components/WordLookup.jsx`)
- **B — bubble survives the selection collapse.** The word is already captured into `bubble` state when shown (kept). `openingRef` (set on the bubble's `pointerdown`) makes the collapse/scroll teardown bail while a tap is in flight. When the selection collapses with no tap in flight, dismissal is **deferred ~800ms from the collapse** (a `dismissTimerRef`), not from when the bubble was shown — so a slow reacher and the iOS first-tap-eaten **retry** still land; a real tap or a fresh selection cancels it; if ignored it still dismisses (not sticky).
- **Open on the touch-reliable events.** `pointerdown` claims the gesture (`preventDefault` + `openingRef=true` + a 1.5s backstop so it can't stick if the finger lifts off); open fires on `pointerup` + `touchend` + `mousedown` (idempotent — `openPopup` reads the captured word, never re-reads the collapsed selection). ≥44×44px hit target, `touch-action: manipulation`, `user-select:none`, transparent tap-highlight.
- **D — teardown handlers don't fire during the handoff.** `onScroll` bails on `popupOpenRef`/`openingRef`/own-UI target/within a 350ms grace; `onResize` is **width-gated** (rotation still dismisses synchronously; the height-only URL-bar reflow is ignored).
- **Geometry** reads `visualViewport` (no `offsetTop` subtraction — pinch-zoom is off, and subtracting would push up into the native menu, the §24 trap). Positioning/clamp extracted to pure `bubblePosition`/`cardPosition`.
- **On-device diagnostics:** a `?wldebug=1` overlay (phones lack devtools) prints bubble/popup/status/opening/viewport so the failure mode is visible on the phone.

### 38.3 Verification
**277 tests green** (+8: `bubblePosition`/`cardPosition` — below-anchor, bottom/edge clamps, narrow-viewport non-inversion). Build clean. **Live-verified in the preview** (driving the real DOM/event path): A — bubble appears; **B — bubble SURVIVES a simulated selection-collapse and the retry tap opens the card** (the headline fix); dismisses when ignored (not sticky); desktop `mousedown` opens; the pointer path opens; **Save (§24.5) still writes a `kind:"word"` concept**; 44px hit target confirmed; zero console errors. A self-caught bug during verification: the first grace was measured from bubble-shown and failed a slow reacher — corrected to collapse-relative. **Preserved (§24):** below-selection anchor, rotation/resize dismiss, scroll-hides-stale, input/own-UI exclusion, cache/in-flight guard, desktop flow. **Device caveat:** the in-browser simulation drives synthetic pointer/selection events; final confirmation is a real finger-tap on iOS/Android (enable `?wldebug=1` if anything still looks off).

---

## 39. UPDATE — 15 June 2026 — Word-definition card overflowed a narrow viewport: × off-screen, can't close (§24)

### 39.1 Cause
On a narrow phone the definition card rendered WIDER than the screen — the × (in the right padding) sat past the right edge, untappable; the student was trapped. The card declared `width: min(300, vw-24)` but **no `box-sizing`**, so the default `content-box` added the `12px 14px` padding + border (~30px) ON TOP of the declared width. The §24 left-clamp guaranteed only the LEFT edge; the right edge overflowed by ~30px once the viewport dropped below ~350px CSS-px. Same card mounts app-wide (one component, 3 mount points in `lyra.jsx`), so the fix lands everywhere.

### 39.2 Viewport-fit fix (`src/components/WordLookup.jsx`)
- `box-sizing: border-box` + `maxWidth: calc(100vw - 24px)` on the card; width = `min(360, visualViewport.width - 24)` (12px gutter each side) — the declared width now IS the rendered width.
- `cardPosition(anchor, vw, vh, cardW)` clamps **both** edges from the actual width: `left ∈ [12, vw-12-cardW]`, so `left ≥ 12` AND `left + width ≤ vw - 12` always hold (previously only the left was guaranteed).
- × is now a **44×44** flex-centred tap target (negative margins keep it visually tucked in the corner), `flex-shrink:0` so it's never the element that overflows; the word/POS/Save group wraps to its left.
- The For-example box / meanings already wrap and inherit the capped width (no inner fixed width).

### 39.3 Two-exit trap-proofing
Three independent exits now: the on-screen **×**, a full-viewport **backdrop** tap (zIndex 199, below the card), and **Escape** (new desktop `keydown` listener while the card is open). A popup can never have a single off-screen exit.

### 39.4 Verification
**281 tests green** (+4 net: `cardPosition` width ≤ vw-24, left ≥ 12, **right ≤ vw-12** across mid/far-left/far-right/bottom selections and 280/320px viewports, plus the 360 desktop cap). Build clean. **Live-verified at 320px**: card = left 12 / right 308 / width 296 (= vw-24), fully on-screen; **× at 44×44, fully visible and tappable**; meaning + example wrap inside. Both exits close the card (× ✓, backdrop ✓); a width change (rotation 320→700) **dismisses** it (no off-screen ×). No console errors. Final confirmation remains a real device tap.

---

## 40. UPDATE — 19 June 2026 — Word-card × was on the screen edge, unreachable by finger on a real phone (§39 follow-up)

### 40.1 The bug (user, on their phone)
After §39 fixed the × running OFF a narrow viewport, the × close button was on-screen but **jammed against the phone's edge — physically impossible to tap with a finger**. The student was still trapped in the card. §39 verified only that the *card* fit the viewport; it never measured the *button's* distance from the edge — a fitting card can still pin its × on the bezel.

### 40.2 Root cause
§39 deliberately pulled the × into the top-right corner with negative margins (`marginRight:-8, marginTop:-10`, "keep it visually tucked in the corner") and rendered it as a borderless, transparent 20px glyph. Measured live at 375px: the × right edge sat **19px from the screen edge — inside the iOS back-swipe gesture zone** (~0–20px, which swallows taps), as a tiny faint target in the hardest-to-reach corner. The §39 card-fit guarantee (right ≤ vw−12) was true and beside the point.

### 40.3 Fix (`src/components/WordLookup.jsx`)
- **Un-tuck the ×:** removed the negative margins so the button sits INSIDE the card's right padding, and made it a **visible bordered 44×44 button** (card bg, 1px border, 10px radius, 22px glyph) — a real, aimable target, not a faint corner glyph.
- **Wider screen gutter (12 → 16px):** `cardPosition` now clamps to left ≥ 16 / right ≤ vw−16, with `cardW = min(360, vw−32)` and `maxWidth: calc(100vw−32px)`, so the card (and the × in its padding) sits further off the bezel. The gutter is width-independent, so the clearance holds at every phone width.

### 40.4 Verification (measured live, driving the real DOM at 375px and 320px)
| | Before (§39) | After (§40) |
|---|---|---|
| × right edge → screen edge | 19px (in swipe zone) | **31px** (clear of iOS & Android zones) |
| × centre → screen edge | 41px | **53px** |
| Target | transparent 20px glyph, corner-flush | bordered 44×44 button, inset |

Clicking the × closes the card (verified). **281 tests green** (the §39 positioning suite retargeted to the 16px gutter: width ≤ vw−32, left ≥ 16, **right ≤ vw−16**; same case matrix). Build clean. Final confirmation is a finger tap on the user's phone.

---

## 41. UPDATE — 19 June 2026 — Chat header: cap resting height, collapse on scroll, fix meta wrap + control stability

(The spec called this §33; the report is already at §40, so it lands as **§41**.)

### 41.1 The bugs
On a long pasted HKDSE question the chat header rendered the FULL title at full font — ~8 lines, ~40% of the viewport before any chat showed. The meta line (`{type} · {wc} words · {n} API calls`) wrapped mid-token ("2 API / calls") because it was a plain div with no wrap strategy. ✎ and New got crowded by a long title.

### 41.2 Scroll source (verified, as the spec suspected)
The chat messages scroll in an **inner container** (`ChatTab.jsx` `chatScrollRef`, `overflowY:auto`), NOT the window — the content area is `overflow:hidden`. So collapse is driven by that container's `onScroll`, lifted to the parent. The header is a normal flex item (NOT sticky) in the `100vh` column, so collapsing it just resizes the content below: **scrollTop is preserved, the message list never jumps, and Unit 6 (sticky/safe-area) does not apply.**

### 41.3 The six units
- **Unit 1 — resting cap (`lyra.jsx`):** title clamped to 2 lines + ellipsis (`-webkit-line-clamp:2`); reclaims most of the screen.
- **Unit 2 — meta nowrap:** one non-wrapping row (`white-space:nowrap; overflow:hidden; text-overflow:ellipsis`); "API calls"→"calls"; ordered `type · purpose · {n} calls · {wc} words` so right-ellipsis drops the lowest priority first (**type > API calls > word count**). The type-picker dropdown moved to a non-clipping wrapper so `overflow:hidden` no longer hides it.
- **Unit 3 — collapse on scroll (`header-collapse.js` + `ChatTab.jsx` + `lyra.jsx`):** pure `nextHeaderCollapsed(scrollTop, current)` with HYSTERESIS (collapse > 24, expand < 8, hold in the band), rAF-throttled from the inner container. Collapsed = compact row (avatar 28, 1-line title, condensed meta `{type} · {n} calls`), gated to the chat tab via `headerCondensed`. Padding transitions 14→8px; no list jump.
- **Unit 4 — control stability:** ✎ + New moved into a fixed top-right cluster (`flexShrink:0`); title+meta sit in a `min-width:0` column that truncates. Verified identical control positions for a 1-line title, a 2-line title, and the collapsed row.
- **Unit 5 — full title on tap:** tapping the clamped title toggles the full text ↔ the 2-line clamp; rename stays a separate ✎ control (one gesture per target). The tap is disabled while condensed (would be a no-op).
- **Unit 6 — N/A:** header is not sticky, so no safe-area inset needed; the Chat/My Writing tab pill below stays stable on collapse (verified).

### 41.4 Adversarial review fix — collapse only on USER scroll
A pre-commit review (3 lenses → verify → synthesize) caught a real regression the first live pass missed: collapse was fed by **programmatic** scrollTop, so the welcome typewriter's per-tick `scrollIntoView` (and the on-reply anchor scroll) collapsed the header before the student touched anything — hiding the new 2-line title on first impression, worst on short viewports (375×667) where the long welcome overflows. **Fix:** only user scrolls drive collapse — the auto-scroll effect stamps a 600ms window around its programmatic scrolls (smooth `scrollIntoView` animates across frames) and the scroll handler ignores events inside it. This also turns OFF the accidental collapse-on-every-reply.

### 41.5 Verification
**286 tests green** (+5: `nextHeaderCollapsed` hysteresis — collapse > 24, hold in [8, 24], expand < 8, threshold edges, a round-trip flips once each way). Build clean. **Live-verified driving the real DOM at 375×812 / 600 / 320 + desktop:** 2-line clamp + ellipsis; meta one nowrap line ("…calls" before "…words"); collapse 80↔48px with hysteresis hold at 15; **scrollTop preserved (no jump)**; ✎/New identical positions across 1-line / 2-line / collapsed; tap title 36↔109px and back; ✎ rename opens separately; type picker un-clipped; **programmatic scroll (scrollTop 103) leaves the header expanded while a real user scroll still collapses.** Final confirmation is a finger scroll on the user's phone.

### 41.6 Note / residual
Collapse-on-reply is now intentionally OFF (the suppression covers the reply anchor scroll); the header collapses only on the student's own scroll. A short (non-overflowing) title is still tappable (a harmless no-op) — gating that on measured overflow is a documented minor follow-up.

---

## 42. UPDATE — 19 June 2026 — API "trouble connecting": proxy crash-resilience + vite timeout alignment

### 42.1 Symptom & diagnosis
Chat replied "I'm having trouble connecting. Please try again." (the `callAI` catch in `sendChat`). The proxy process (port 3001) had **died** — `netstat` showed nothing listening — so every AI call (vite proxies `/api/gemini` → `localhost:3001`) got connection-refused → `!res.ok` → the catch fired. (The word-lookups in the log succeeded *earlier*, while the proxy was alive; the chat came after.) The Pro model itself is healthy — a direct call returns HTTP 200 in ~6s, not slow, not 404/429. This is distinct from the §16.6 useSearch object-vs-string crash (that fix is still in place).

**Likely death trigger:** a CLIENT DISCONNECT mid-response — the chat's AbortController (stop button), a vite proxy timeout, or navigating away — resets the socket; the resulting `error` on the Node `ServerResponse` was unhandled and crashed the whole proxy, killing every AI call until a manual restart. `proxy.js` had no `res.on('error')` or `process.on('uncaughtException')` guard.

### 42.2 Fixes
- **`server/proxy.js` — crash resilience:** per-request `res.on('error')` + `req.on('error')`, plus global `process.on('uncaughtException')` / `unhandledRejection` handlers that log and keep serving (the proxy is stateless per request). **Verified: 3 requests aborted client-side mid-thinking left the proxy alive and serving** (the old code would have crashed on the response-socket reset).
- **`vite.config.js` — timeout alignment:** `/api/gemini` `timeout`/`proxyTimeout` raised 120000 → 200000 so a slow thinking-heavy call (X-Ray, grounded search) doesn't get a 504 from vite while the proxy's own 180s upstream timeout is still working — which would surface as "trouble connecting" with nothing actually broken. (Takes effect on the next vite restart.)

### 42.3 Verification
Restarted the hardened proxy; **live end-to-end from the preview browser** (`fetch('/api/gemini', …)` — the exact `callAI` path): **HTTP 200 in ~5s with a real coaching reply** — no more "trouble connecting." Build clean.

---

## 43. UPDATE — 19 June 2026 — Generated, in-voice opening greeting (template → fallback only)

(The spec called this §35; the report is at §42, so it lands as **§43**.)

### 43.1 The bug
Lyra's opening message was a fixed template with `{type}`/`{topic}` interpolated — **word-for-word identical every session** ("Hello! I'm Lyra, your writing coach… every word will be yours. I'm following HKDSE conventions… outline or brainstorm?"). A 14-year-old feels the absence of a mind instantly. It was also genre-blind (printed "a business email about 'write a letter to editor…'").

### 43.2 Unit 1 — a dedicated welcome route + prompt
`ai-router.js`: new `welcome: { model: MODELS.flash, thinkingBudget: 512, brain: true }` — deliberately **flash, not pro** (a greeting fires on every session open; a class of 40 = 40 calls — keep it cheap), `brain:true` so it's unmistakably Lyra's voice. `prompts.js`: `buildWelcomePrompt({name,type,purpose,wordCount,topic,cue})` prepends `LYRA_BRAIN` and instructs a 60–90-word in-voice greeting: greet BY NAME if given (never invent one), react to THIS topic specifically (not generic praise), a warm GENRE CHECK **only when a mismatch cue is passed**, varied conversational next steps, hard limits (no boilerplate / hollow praise / never-write-for-them). Prose, not JSON.

### 43.3 Unit 2 — wired on session start, STREAMED, template as the floor
The greeting is now **`messages[0]`** (a real AI turn), not the old ephemeral `welcomeText` banner. A `useEffect` (deps `[screen]`) fires ONCE per open (`!typedWelcome.current && messages.length === 0`) and STREAMS via `callAI(..., onChunk)` into `messages[0]` (`setMessages(prev => [{role:"ai",text:partial}, ...prev.slice(1)])`), `chatLoading` true until the first chunk. **Fallback floor** (`welcome.js`): `chooseWelcome(text, error, fallbackArgs)` returns the generated text unless error/empty → the kept template `FALLBACK_WELCOME(...)` — never a blank chat, never the raw error string. **Generate-once / persistence:** the greeting rides the existing `messages` autoSave; `resetToNew` (New) clears `messages` + `typedWelcome=false` → regenerate; `loadWriting` keeps the persisted greeting (`typedWelcome = messages.length > 0` — self-heals to a fresh greeting only if a writing somehow has no messages). The `welcomeText` state + the ChatTab welcome banner + its typewriter were removed (now dead). **§41 preserved** — the streamed greeting drives the same auto-scroll + suppression via `messages`; the removed `tw.displayed` dep was the typewriter that's now gone.

### 43.4 Unit 3 — the genre banner defers to the greeting
New `welcomeHandledCue` state, **persisted per writing**. Set optimistically true when a mismatch cue is present (so the §28 banner doesn't flash during a successful generation), corrected to false on fallback. The §28 banner returns null when `genreCueDecision || welcomeHandledCue` — the warm in-greeting version wins; only the genre-blind template fallback leaves the banner as the safety net. Pure `shouldSuppressWelcomeBanner(cuePresent, welcomeSucceeded)`.

### 43.5 Unit 4 — systemic templates left alone
Confirmed untouched and still deterministic: the "Switched to {type}" notice (§29), the "trouble connecting" error string (§42), toasts. **Principle: Lyra's COACHING VOICE = always the model; SYSTEM NOTICES = deterministic.** Only the welcome moved from canned to generated.

### 43.6 Adversarial review + verification
A pre-commit review (regression / welcome-edge / persistence lenses) returned **safe to commit, 0 must-fix** and confirmed §41 intact. Two minor nice-to-haves applied: (a) an **ownership guard** so a greeting that resolves AFTER the student has already sent a message doesn't clear that turn's spinner / flip banner state; (b) the **self-heal** on `loadWriting` above. Documented residuals (low-risk): no stop button during the greeting stream (matches pre-§43); optimistic `welcomeHandledCue` not corrected if an SSE hangs with no chunks; the banner trusts a successful call honoured the GENRE CHECK (model-compliance trade).

**298 tests green** (+12: `buildWelcomePrompt` includes name/topic/type + genre-check-when-cue / omit-when-none + brevity constraints; `welcome` route = flash + brain; `chooseWelcome` fallback on error/empty; `shouldSuppressWelcomeBanner`). Build clean. **Live-verified (real flash + pro calls):** greeting streams into `messages[0]`, "Hi Mei!" by name, topic-specific, 60–90 words, NOT the template, different per topic; a letter-to-editor topic on Exam Essay → the greeting warmly raises the mismatch AND the §28 banner is suppressed; forcing `/api/gemini` to fail → the template fallback prints (not blank, not the error); greeting + `welcomeHandledCue` persist as `messages[0]`; a normal next message still coaches.

---

## 34. UPDATE — 19 June 2026 — Adversarial review of §26–§33 (verify-then-fix) + the welcome confirmation

A workflow reviewed 8 feature areas (H1–H20 + X1–X3) — each hypothesis counter-cased against the real code, CONFIRMED findings independently re-verified, then synthesized. **20 code hypotheses: 6 CONFIRMED (1 major, 4 minor, 1 nit→downgraded), 14 REJECTED, 0 N/A.** Fixes applied in severity order (per-finding commits); **302 tests** (298 → +4).

### 34.1 CONFIRMED + fixed
| # | Sev | Finding | Fix (commit) |
|---|-----|---------|------|
| **H3** | major | `META_PATTERNS[0]` = `/\b(the\|this)\s+(student\|learner)\b/i` was noun-only → matched ordinary prose ("the student next to me", "this student represents…"); silently rejected legit rewrites in `isAuthenticGrowth` **and** the one-time boot purge irreversibly deleted matching growth-log/report entries. | Verb-anchored with a small auxiliary window (keeps "The student understands…" / "has learned"; drops noun-only). +1 test. `fd060f3` |
| **H2** | minor | "Help me start" + "Skills" chips send as USER messages but weren't in `QUICK_ACTION_MESSAGES` → validator check-2 couldn't reject growth built on them. | Registered both (the skills chip as a stable prefix) in the validator-only block. +1 test. `69be5ea` |
| **H11** | minor | The "execute Google Search BEFORE answering" block was unconditional in `buildCoachPrompt` → a typed "give me an example" (`useSearch=false`) produced search-shaped, source-less output. | `buildCoachPrompt(...searchActive)`; live-search modes only when true, else a no-fabrication / use-the-chips instruction. `sendChat` passes `useSearch`. +2 tests. `793f8ed` |
| **X2b** | minor | Hitting **Stop** during the pre-first-chunk greeting left the optimistic `welcomeHandledCue=true` → §28 banner suppressed all session. (The review's `stillMine` fix doesn't work — `stopChat` nulls `chatAbortRef` first.) | `welcomeStreamingRef` lets `stopChat` release the suppression when it aborts a mid-stream greeting. `416eb54` |
| **H5** | minor | The debounced structural-suggest effect read `typeLabel`/`examRules` but had deps `[draft, appliedSkill]` → a type switch within ~2.5s of a keystroke fired one suggestion with the PREVIOUS type's convention/formality. (H5's main worry — that coach/proofread/welcome snapshot the type — was REJECTED: they rebuild at call time.) | Added `typeLabel, examRules` to the effect deps. `2643cca` |
| H20 | nit | **Downgraded to non-finding.** The reviewer read the meta-truncation comment as "backwards," but at `lyra.jsx:967-978` the order is `… · {apiCalls} calls · {wcLabel} words` — word count IS rightmost, so ellipsis drops it first, exactly as the comment ("type > API calls > word count") and the §41 spec state. Comment matches runtime. |

### 34.2 REJECTED (14) — each held against its counter-case, file:line verified
**H1** `studentTexts` passed at both call sites, fails-closed with a `console.warn`. **H4** purge is flag-guarded/idempotent, runs after `autoRestoreFromBackup`. **H5(main)** type switch DOES change coaching (coach/proofread/welcome read `examRules`+formality at build time). **H6** switch-notice only de-stacks a *consecutive* AI notice. **H7** title-prefix swap requires the exact `{label} — ` prefix. **H8** `genreCueDecision` persisted per writing, no re-nag. **H9** grounded sources unpacked + stashed end-to-end (the §42 fix intact). **H10** find-an-example asks first when no claim. **H12** training threads still reachable via Writers→SavedSkillDetail. **H13** zero dead `setTab` targets, no persisted ghost tab. **H14** "Use it" rehome = same deploy state. **H15/H16/H17** dictionary card fits at 320px, dual exits + z-order correct, word captured at render-time. **H18** genuine collapse hysteresis. **H19** `onScroll` on the correct inner container. **X2a/X2c** no duplicate greeting / no type↔cue persistence desync.

### 34.3 Cross-cutting
- **X1 (storage)** ✅ healthy — 15 KB, `snapshotBackup` warns on `QuotaExceededError` (`backup.js:72`), and `lyra-word-dictionary` + `lyra-annotation-glossary` are correctly absent from the 12-key `CRITICAL_KEYS` (`backup.js:26`).
- **X3 (branch)** ⚠️ §40–§43 (now +§34) are committed **locally**, not pushed (the branch is ahead of `origin/main`). Reported for the user's decision — not auto-pushed.

### 34.4 PART 2 — the templated welcome (CONFIRMED, major) — already built
The fixed opening template (word-for-word identical; genre-blind) was the confirmed defect. **The replacement is §43** (generated, streamed, in-voice greeting; template as fallback floor; banner deferral) — it satisfies B1–B5 (route, prompt, streaming + fallback, banner deferral, 12 tests, 5 live checks). System notices ("Switched to {type}", "trouble connecting", toasts) confirmed and **left templated** — coaching voice = model, system notices = deterministic.

**302 tests green** (298 → +4: H3 false-positive, H2 chip rejection, H11 search-gating ×2). Build clean.

---

## 44. UPDATE — 19 June 2026 — Style Lab: one clear "exit to the page I came from" control  _(nav approach superseded — the big labelled exit crowded the header; see §46 for the final small-← + tab-history model)_

### 44.1 The problem + the case
Style Lab is a `showStyleLab` overlay over the current screen. Its top-left ← was a **hybrid** (closest to case (a)): `goBack` (StyleLab.jsx) popped a `tabHistory` stack when the student had moved between tabs, and only called `setShowStyleLab(false)` once that stack was empty. So it *did* exit — but ambiguously (sometimes "back a tab," sometimes "leave"), and on an empty tab (the screenshot's "No saved concepts yet") a student had no obvious way out. A correct label is impossible while the same button sometimes means "back one tab."

### 44.2 The fix
One unambiguous, destination-named exit, visible on EVERY tab:
- The header control is now a labelled pill — **"← Back to my writing"** when an active writing is open underneath, else **"← Back"** (returns to the start screen). Context-awareness is free: `setShowStyleLab(false)` reveals whatever screen was underneath; the *label* removes the ambiguity. `activeWritingId` plumbed into all three `<StyleLab>` mounts (lyra.jsx); pure `styleLabExitLabel(activeWritingId)` exported + tested.
- **Retired the tab-history back** (`tabHistory`/`goBack`): the §30 five-noun tab bar makes every tab one direct tap away, so the history-back was both redundant AND the source of the ambiguity. `goToTab` is now a plain `setActiveTab`. (Reported deviation from the literal case-(b) "keep the tab-back" — the tab-back is exactly what made leaving unclear.)
- Matches the existing idiom (border + `COLORS.card` + Courier Prime, like the "New analysis" pill); ≥44px tap target (measured 73×44). The title block truncates (`ellipsis`) so the longer label never overflows.

### 44.3 Strand-check (Step 2) — no confirm needed
Verified `saveStyleSkill` fires **only on stream completion** (StyleLab.jsx — after the full `await` + a complete parse), **never** inside `onChunk` → a partial/half-written skill can never be persisted. On exit, `StyleLab` returns `null` but stays mounted, so an in-flight X-Ray simply finishes in the background and saves a *complete* skill — the least-destructive outcome (no data loss). So no confirm dialog, no abort: exiting mid-analysis is harmless.

### 44.4 Verification
**304 tests green** (+2: `styleLabExitLabel` active-writing vs start-screen). Build clean. **Live-verified at 375px (real preview):** opened from an active writing → header reads "← Back to my writing" on every tab (Analyse · Saved · Writers · Achievements · Report, incl. the empty "No saved concepts yet" state) → tap → returns to that writing, draft + chat intact; opened from the start screen (no active writing) → reads "← Back" → tap → start screen; exit present on all five tabs; 73×44 hit target; renders native (screenshot).

---

## 45. UPDATE — 20 June 2026 — Style Lab nav floor (correction to §44): a view stack rooted at the X-Ray page  _(REVERTED by §46 — the view-stack / hamburger model was rejected; restored the tab-history ←)_

§44 had the wrong mental model. The right one: the **X-Ray paste page is the ROOT and the FLOOR** of a view stack; the tabbed workspace (Analyse / Saved / Writers / Achievements / Report) opens DEEPER from it. So there is no "exit to my writing" — leaving is the hamburger → global drawer.

### 45.1 The model (`StyleLab.jsx`)
- **`stack`** of view keys; `stack[0]` is always `"analyze"` (the X-Ray root). `activeTab = stack[top]`; `atRoot = stack.length === 1`.
- **Header:** at the floor → the **hamburger** (`☰`) which leaves Style Lab and opens the global drawer (`setShowStyleLab(false) + setSidebarOpen(true)`); no back control at the root. Above the floor → a compact **contextual back chevron** that pops ONE view, labelled by its destination: `‹ X-Ray` at the floor, `‹ Achievements`, `‹ Writers`, … One nav button only; ≥44px.
- **Tab nav as a stack:** a new tab pushes; re-selecting a tab already in the stack **pops back to it** (no duplicates) → Achievements → Report → tap Achievements lands on Achievements. `back()` pops one; it's only reachable from the chevron, which only renders above the floor — so there is no exit-to-writing branch.
- **History binding (corrected — see §45.1.1):** every level above the floor is mirrored by exactly ONE history entry carrying the full stack; going deeper pushes, and ALL backward motion (chevron, pop-to-existing, device/browser back) is driven through history, so the stack and history never desync. The device/browser back walks the stack down to the X-Ray page, then falls through (leaving Style Lab via the underlying app — never trapped).
- Pure helpers `styleLabBackLabel(destKey)` and `nextStyleLabStack(stack, key)` exported + tested. `activeWritingId` (the §44 plumb) removed; `setSidebarOpen` plumbed into all 3 mounts.

#### 45.1.1 History desync fixed (amendment)
The first §45 cut pushed a history entry going forward but the chevron `back()` and pop-to-existing tab re-selection mutated the React stack **without** consuming the matching pushed entry, and an `initialTab` direct-open pushed nothing. Net: orphaned history entries — a device-back after a chevron-back could skip a level or over-pop, and a device-back from a directly-opened tab walked the **app's** history underneath instead of Style Lab's stack. Fix: each `pushState` now stores the FULL stack (`{ slStack }`); `popstate` restores exactly that stack (the floor/baseline entry has none → returns to the X-Ray root). The chevron and pop-to-existing now go **through** `history.back()` / `history.go(-Δ)` so every pushed entry is consumed in lockstep — stack length and history length stay equal at all times. Direct-open to a tab pushes one entry so its device-back pops to the root, not the underlying app. (Storing the whole stack also makes the browser FORWARD button restore the view.) StyleLab is the app's only `history` user — no router — so this is self-contained.

### 45.2 Latent §44 bug fixed
§44's `resetAll` still called `setTabHistory([])` after §44 had deleted the `tabHistory` state — a dangling reference that would crash "New analysis" (only reachable with a profile loaded, so it slipped past §44's verification). Now `resetAll` does `setStack(["analyze"])`. (Lesson: the §44/§39-class of runtime-only ReferenceErrors don't fail `vite build` or unit tests — they need a live render check, which §45 added.)

### 45.3 Verification
**309 tests green** (+5 net: `styleLabBackLabel` ×3, `nextStyleLabStack` push / pop-to-existing / pop-to-root / no-op). Build clean. **Live-verified on a fresh server at 375px:** root shows the hamburger and no back control; entering the workspace shows `‹ X-Ray`; Achievements → Report → back lands on Achievements; popping all the way returns to the X-Ray page (hamburger) — never a "my writing" screen; the workspace subtitle "Analyse & practise writing styles" renders in full (no truncation); the hamburger leaves Style Lab and opens the global drawer; **zero console errors.**

**§45.1.1 amendment verification:** the history-sync correction changes only the *invisible* history bookkeeping — all four visible acceptance behaviors above are preserved (the chevron still pops one view, pop-to-existing still lands on the re-selected tab, pop-to-root still reveals the hamburger), traced step-by-step against the new push/`go(Δ)`/`slStack`-restore wiring. Re-verified: **309 tests green, `vite build` clean, and the dev server transforms `StyleLab.jsx` at runtime with no error** (the §45.2-class runtime check). The on-device *back-gesture* walk (device-back stepping the stack to the root, then falling through) was **not** driven live — the Chrome automation extension was offline at amend time — so the device-back path's final confirmation is a real back-gesture on the user's phone.

---

## 46. UPDATE — 20 June 2026 — Style Lab nav (redo of §44, REVERTS §45): a small ← that backs through tab history, then exits

Both prior attempts were wrong. **§44**'s big labelled "← Back to my writing" pill didn't fit the already-occupied header (title block + "New analysis"). **§45**'s view-stack — hamburger-at-root + contextual chevron — solved the wrong problem and swapped an intuitive back arrow for a hamburger-as-exit. The real bug was never the exit control: tab switches were **stateless**, so Achievements → Report stranded the student with no way back to Achievements. This redo restores the (pre-§44) tab-history model, refined, and reverts the entire §45 view-stack.

### 46.1 Part 1 — the exit control: small, not a button (`StyleLab.jsx`)
One compact **← icon** in the header (44×44 hit target, a visually small arrow, matching the round-icon idiom) — no wide label, no second control. Removed: the §45 hamburger/chevron, the `slStack` push/pop/`popstate` history wiring, the `nextStyleLabStack` / `styleLabBackLabel` helpers, and the `setSidebarOpen` plumbing (all 3 `<StyleLab>` mounts). Landed first with stateless tabs (← = pure exit) so the control change is isolated (commit `d5c067e`).

### 46.2 Part 2 — tab-history back-navigation (the real bug)
- `const [tabHistory, setTabHistory] = useState([])`. `goToTab(key)` pushes the tab being LEFT, then switches; the header **← = `goBack`** pops the last entry (returns there), and once the stack is empty it **exits Style Lab** (`setShowStyleLab(false)` → the screen underneath: active writing, else source-setup). One control, one "go back" meaning that degrades from "back a tab" to "back out".
- A **direct tab tap also pushes**, so back retraces the real path the student took (Achievements → Report → ← → Achievements → ← → wherever they were before). Consecutive duplicates collapse (a same-tab tap pushes nothing); the stack is **capped at `TAB_HISTORY_CAP = 10`** to bound growth.
- Pure, exported, tested helpers: `pushTabHistory(history, leaving, next)` (dup-collapse + cap), `popTabHistory(history)` (`{tab, history}`, or `null` on empty), `styleLabBackExits(history)` (the exit-vs-tab-back predicate). 7 reducer tests.

### 46.3 Part 3 — entry tab / empty-stack
The stack initialises **empty** with `initialTab` as the current tab (the `styleLabInitialTab` "open straight to a tab" paths, e.g. "no saved skills → open Style Lab"). So the first back from the entry tab finds an empty history → exits cleanly, never jumping to an unrelated tab. Tab history **resets on every open AND close** (and on "New analysis") — a fresh visit starts clean, no stale back targets carried across.

### 46.4 The (A)/(B) control decision
Chose **(A)** — the single ← does tab-back-then-exit, NO separate ✕ — per the brief's preference and because the empty-stack exit is the standard mobile back semantic (a back arrow that backs *out* when there's nothing left to back to is exactly what users expect; it is not surprising). Model (B) (← = tab-back only + a separate ✕) would add a second control to an already-tight header for no real gain. So Parts 1 and 2 are the SAME ← control — the brief anticipated this ("Part 1's separate exit control may be unnecessary IF the ← reliably exits once history is empty").

### 46.5 Verification
**309 tests green** (7 tab-history reducer tests — push/dup-collapse/cap, pop/empty-null, exit-predicate — replacing §45's view-stack tests). `vite build` clean; the `:3002` dev server transforms the updated `StyleLab.jsx` at runtime with **no error** (the §45.2-class runtime check). **Not driven live:** the click-through / on-device back-gesture — the Chrome automation extension was offline — so the manual walk is the final confirmation to do on the phone: Achievements → Report → ← → Achievements; keep pressing ← to empty the stack then exit; the exit lands on the correct underlying screen (active writing vs start); direct tab jumps retrace the real path; reopen → history is fresh; the ← is small (no big label crowding the header). Committed per part: Part 1 `d5c067e`, Part 2 `7ed471d`.

### 46.6 Top-right feather HOME button (continued §44)
The header's top-right corner was empty (← bookends the left; the title block sits between). Filled it with the reused **Lyra feather** (`FeatherIcon` — the same mark used across the app, not a new drawing) as a round **44×44** icon button matching the ← idiom (border + `COLORS.card`, muted) — symmetric bookends around the title.

- **Destination resolved (Step 0):** "X-Ray front page" = the **Analyse Style tab, key `"analyze"`** (the within-overlay reading — confirmed against the tab keys `analyze`/`saved`/`skills`/`achievements`/`report`). The feather does a within-overlay jump; it does **not** close Style Lab (`setShowStyleLab(false)` was the rejected alternative).
- **Two distinct verbs, two corners:** ← (top-left) = **relative** back (pop a tab, exit when empty, §44 — unchanged); feather (top-right) = **absolute** home (jump to Analyse from any tab). They coincide only on the Analyse tab with empty history — not special-cased (consistent placement > avoiding the one overlap).
- **§44-integrated:** the feather routes through **`goToTab("analyze")`**, not a raw `setActiveTab` — so the tab being left is pushed onto the tab history and **← still retraces correctly after a feather jump**. On the Analyse tab it's a clean no-op (`goToTab` early-returns on same-tab) — no history pollution. `aria-label="Go to X-Ray"`; shown on every tab incl. empty states.
- **No new pure logic** (reuses the already-tested `goToTab`/`pushTabHistory`); the manual header check carries it. One commit.

**Verification:** 309 tests green, `vite build` clean, the `:3000` dev server transforms the updated `StyleLab.jsx` at runtime with no error (feather wired). The visual placement/symmetry and the tap-to-jump are the on-screen checks — Chrome automation was offline, so confirm on the phone: ← top-left + feather top-right symmetric around "Style Lab"; from Achievements, tapping the feather lands on Analyse; afterwards ← retraces; feather present on every tab.

### 46.7 Home-feather made conditional — fixes the triple-feather stack on Analyse
The §46.6 home-feather, shown on every tab, stacked a THIRD feather on the **Analyse** tab: the header home-feather sat an inch above the large **decorative** feather over "Paste a passage…", and on Analyse it pointed home-to-home (a no-op). Fix: a pure `showStyleLabHomeFeather(activeTab)` (= `activeTab !== "analyze"`) gates the top-right button — **hidden on Analyse, shown on Saved / Writers / Achievements / Report** (those tabs have no decorative feather, so it's the only feather there and a real jump back to Analyse). The ← (top-left) and the decorative paste-box feather are unchanged. Result: exactly one feather on every tab.

- **Wordmark-tap home (added, not "kept"):** the brief assumed a "Style Lab" title-tap home already existed ("the +2 addition") — it did **not**, so I added it: the title block now fires `goToTab("analyze")` on tap (silent — no icon, so it never reads as a second feather), on **every** tab incl. Analyse. The Analyse tab thus keeps a home path even with the visible home-feather hidden; there the tap is a clean no-op (already home). Routed through `goToTab` so it respects the §44 history like the feather.
- **No header jump:** toggling the 44px feather only changes the `flex:1` title block's spare width; "Style Lab" + subtitle are short (nowhere near truncation), the ← is fixed-left, and the tab bar is a separate row — so switching Analyse↔other reflows nothing visible.

**Verification:** 311 tests green (+2: `showStyleLabHomeFeather` false on Analyse, true on the four other tabs); `vite build` clean; the `:3000` dev server transforms with no error. On-screen checks (Chrome automation offline → confirm on phone): Analyse shows ONE feather (the decorative one), no top-right button, title still silently goes home; Achievements/Report show the top-right feather → tap → Analyse; switching Analyse↔Report toggles the feather without disturbing the ← or tab bar; no tab shows two feathers. One commit.

### 46.8 Header adopts the app's ☰ menu — feather home button removed (closes §44 nav)
The recurring "too many header feathers/buttons" problem is ended by **removal + reuse**, not more conditional logic: Style Lab's header now uses the **same two-control top-left pattern as the rest of the app — ☰ + ←** — and the §46.6/46.7 top-right feather home button (plus its `showStyleLabHomeFeather` predicate + test) is **deleted**. Style Lab is no longer a nav island.

- **☰ (added, top-left):** the app's exact menu control — reused as-is from source-setup (36×36 circle, `COLORS` palette, the **count badge** = total writings across projects) — placed left of the ←. Plumbed `setSidebarOpen` + `projects` (for the badge) into all 3 `<StyleLab>` mounts.
- **z-index / open behaviour:** the global Sidebar renders at z 60/70, BELOW the Style Lab overlay (z 100). Rather than an app-wide z-index bump, the ☰ **closes Style Lab as it opens the sidebar** (`setShowStyleLab(false) + setSidebarOpen(true)` — the §45 pattern). So the menu shows over the underlying screen and "New Writing" lands on the front page — the app's home path.
- **← unchanged (§44):** same back-then-exit semantic (pop tab history; exit when empty) — only its position moved (now right of the ☰). The ☰ is the app's 36×36 and the ← is the §44 44×44, so the pair is **slightly mismatched in size** — followed the brief's "reuse the ☰ exactly" + "← position only" literally; trivial to unify if preferred.
- **One feather per tab:** the decorative Analyse paste-box feather is unchanged; with the header feather gone, the Analyse tab shows exactly ONE feather and the triple-stack is fully resolved.
- **Wordmark tap-home: KEPT (option A):** the silent "Style Lab" title-tap → Analyse stays on every tab (no icon / no button styling, so it doesn't compete with ☰/←) — a harmless logo-tap shortcut, distinct from ☰ (which opens the menu). (B) remove was the alternative; (A) chosen per the brief default as it adds no visible ambiguity.

**Verification:** 309 tests green (the 2 `showStyleLabHomeFeather` tests removed with the predicate; the §44 tab-history tests stay); `vite build` clean; the `:3000` dev server transforms with no error (☰ + badge wired, feather + predicate gone, 3 mounts plumbed). On-screen checks (Chrome automation offline → confirm on phone): every tab shows ☰ then ← top-left and NO header feather; Analyse shows only the decorative feather; ☰ opens the same sidebar as the main app and "New Writing" lands on the front page (Style Lab closes); the ☰ badge count matches the main app; ← back/exit unchanged. One commit.

### 46.9 A–Z letter index + load-more for saved WORDS (Saved tab)
The Saved tab's **WORDS** section (dictionary lookups, `kind:"word"`) grows into one long scroll. Added a contacts-style A–Z index + windowing — **WORDS only** (Concepts stays a plain list; an alphabet over a handful of grammar terms is pointless).

- **Pure `bucketWordsByLetter(words)`** (exported + tested, 6 cases): buckets each saved word by its first letter — trimmed + uppercased; A–Z → that letter, anything else (digit, CJK `中文 · …`, punctuation, empty/missing `name`) → **"#"** so nothing is dropped. Within a bucket, **newest-first** (`savedAt` desc — a student wants the word they just saved). Returns `{ buckets, letters }` where `letters` is the set of non-empty letters. The word field is the record's `name` (`"<english> · <中文>"`, English first), `savedAt` from `buildConceptFromWord`. Operates on the FULL store, and only computes the bucket key from the trimmed first char — it never mutates the stored `name`.
- **Letter chips** above the WORDS list: `All` (default) + A–Z + `#` (only when non-empty). Letters with **zero saved words are greyed + disabled** (from `letters`); the selected chip uses the heading/`#fff` active idiom. Counts omitted (26 chips + counts = noise).
- **Load-more per view:** renders the first **20** of the active view (All, or the selected letter) with a `Show more · 顯示更多 (N)` button revealing +20; the window **resets to 20 when the letter changes**. Replaces rendering the whole WORDS list at once.
- **Traps handled:** the letter buckets the **FULL store, then windows** (older matches still appear — never filter only the loaded window); case/whitespace-insensitive first letter; **`All` = current store order** (the index is an optional filter, not forced; a letter view is newest-first, `All` unchanged); the **original concept index** is carried through bucketing so remove/expand still hit the right record; empty Saved → the existing empty-state message, no chips. **Concepts section left as-is** (the `lyra-saved-concepts` cache caps at 150 — bounded — and grammar terms are few).

**Within-letter sort choice:** newest-first (`savedAt` desc). **Verification:** 315 tests green (+6 `bucketWordsByLetter`: case-insensitive, whitespace-trims-key-only, non-letter→#, empty→empty, newest-first, non-empty-set→chip-enable); `vite build` clean; the `:3000` dev server transforms with no error. On-screen checks (Chrome offline → confirm on phone): chips show with empty letters greyed; tap R → only R-words, newest-first, Show-more if >20; switching letter resets the window; a mixed-case / leading-space word lands under the right letter; All → full list + load-more; Concepts unaffected; empty Saved → message, no chips. One commit.

### 46.10 Saved tab navigation layer — search (both sections) + Concepts by category
Built on §46.9 (Words A–Z). Two more pieces: a top **search box** (the scale-proof outer filter) and **Concepts grouped by category** (the axis that fits concepts — nobody recalls one by first letter). **Step 0** confirmed the data shape: a saved record's English term/name = `name` (words: `"<english> · <中文>"`); the concept category = `section` (set to the X-Ray `section.title` at save, XRayView:1352); words carry Chinese in `name`/`meaning_zh`/`example_zh`; **concepts have no stored Chinese** (translated on demand). Words are `kind:"word"`; concepts have no `kind`.

- **`matchesSaved(item, query)`** (exported + tested, 6 cases): case/whitespace-insensitive substring over the item's text blob (name + meanings + grammar/function/useIt/examples). Words match by English AND 中文; concepts English-only. Empty query → true.
- **`groupConceptsByCategory(concepts)`** (exported + tested, 6 cases — piece `19e4bc1`): groups by `section`; canonical `XRAY_ALL_SECTIONS` order, other labels alphabetical, **"Other · 其他" last** (missing section never dropped); newest-first within a group; per-group load-more (20 + Show-more).
- **Search box** at the top of the Saved tab ("Search saved · 搜尋" + ✕ clear). Non-empty query = the **OUTER filter**: filters BOTH sections against the **full store** via `matchesSaved`, **suppresses** the A–Z chips and the category grouping, shows flat windowed lists with the **filtered count** in each header, and a section with zero matches shows "no matches · 沒有符合". Empty query → the browse layers (Words A–Z + Concepts-by-category) apply.

**Traps handled (Step 5):** search and both groupings filter/bucket the **full store, THEN window** (older matches always appear); case + whitespace insensitive throughout; default = empty query, Words "All", Concepts grouped; empty store → the existing empty-state (returns before any search/chip UI). **Clear-query restores to "All"** (simplest — noted). **Commit per piece:** Words A–Z `80a2096` (§46.9), Concepts-by-category `19e4bc1`, search (this).

**Verification:** 327 tests green (+6 `matchesSaved`, +6 `groupConceptsByCategory`); `vite build` clean; the `:3000` dev server transforms with no error. On-screen checks (Chrome offline → confirm on phone): search box on top; type "ref" → both sections filter live, A–Z + category headings collapse to flat lists, counts update, ✕ restores browse; a Chinese substring matches vocab by 中文; Words tap-R → R-words newest-first + Show-more; Concepts grouped under their section labels, no-category under "Other"; empty store → message only.

---

## 47. UPDATE — 21 June 2026 — Deferred-debt consolidation (verify-then-fix four parked items)

Ran AFTER the push/merge to `origin/main` (`b2eada7`) so these land on replicated mainline. Test baseline **327 → 329**.

### 47.1 Unit 1 — §34 adversarial review PART 1 (AUDIT) — ALREADY RAN; re-verified, no new fixes
§34 PART 1 (the H1–H20 + X1–X3 sweep) already ran — recorded in §34 (6 CONFIRMED / 14 REJECTED), confirmed fixes committed: H3 `fd060f3`, H2 `69be5ea`, H11 `793f8ed`, X2b `416eb54`, H5 `2643cca`. Re-verified the three mandatory hypotheses against the current (post §40–§46) code:

| Hyp | Verdict | Evidence |
|---|---|---|
| **H5** does the type-switch change coaching? | **REJECTED** (no-op worry unfounded) | `buildCoachPrompt(…, examRules, …)` builds the exam block from the param at call time (prompts.js:35-36); `examRules = getExamRules(purpose, type)` is derived per render (lyra.jsx:133) and passed at the call (lyra.jsx:644). The structural-suggest effect deps include `typeLabel, examRules` (lyra.jsx:565 — the §34/H5 fix). A type-switch DOES change coaching and reschedules suggestions under the new convention. |
| **H2** all chips registered? | **REJECTED** | Validator matches `before === m \|\| before.includes(m)` (learning-sync.js:60); grounded Brainstorm/Find-example send exact `QUICK_ACTION_MESSAGES[1]`/`[2]`, Outline a `QAM[0]` prefix, Help-me-start/Skills `QAM[7]`/`[8]` (constants.js:54-70). The generated welcome (§43) is model prose — NOT in QAM, and it's `messages[0]` (role ai), never a studentText, so it can't make junk traceable. |
| **H-storage** footprint | **AUDIT — healthy** | Live `:3000` localStorage: 20 keys, **~184 KB total** (~2–4% of quota). Top: `lyra-backup-v1` 90 KB (the CRITICAL_KEYS mirror), `lyra-training-chats` 35 KB, `lyra-style-skills` 13 KB (sourceText cap holding — far below 50 KB), reports 11 KB; caches `lyra-word-dictionary` 6 KB + `lyra-annotation-glossary` 3 KB present but **excluded from the backup**. No quota pressure. |

The remaining §34 hypotheses (H1, H3, H4, H6–H20, X1–X3) stand as recorded in §34 (already adversarially reviewed there — not re-swept). **No new Unit-1 findings → no fixes.**

### 47.2 Unit 2 — concept 中文 search asymmetry — FIXED (`3583f86`)
The §46.10 "concepts are English-only" note over-generalized: **annotation-explain concepts already carry Chinese** in `name` = `term_en — term_zh` (buildConceptFromExplanation), so they were already 中文-searchable; only **sentence-breakdown** concepts (XRayView grammarName, English) lack Chinese — and have none at save (forward-only, unchanged). Made it explicit + robust: `buildConceptFromExplanation` now persists `name_zh = term_zh`, and `savedSearchBlob` (matchesSaved) reads `name_zh`/`term_zh` — so concept 中文 search survives any future `name` reformat and stays symmetric with words. No legacy backfill (old records stay English-searchable; matchesSaved tolerates a missing field). +2 tests.

### 47.3 Unit 3 — storage cap + quota warning — ALREADY DONE (no change)
Both present: `saveStyleSkill` caps `sourceText` to `SOURCE_TEXT_MAX_CHARS = 50000` INSIDE the function (XRayView:1506/1569, const exported); `snapshotBackup` `console.warn`s on failure and emits the explicit "localStorage quota exceeded — backups are NOT being updated" on `QuotaExceededError`/`code===22` (backup.js:72-75), with matching warns in `autoRestoreFromBackup` (105) and `getBackupInfo` (122). The §24/§46 caches are OUT of the 12-key `CRITICAL_KEYS` (backup.js:26-39) — the 47.1 audit confirms they're live but not mirrored into the backup. The footprint audit shows this is forward-safety, not urgent.

### 47.4 Unit 4 — ☰/← size mismatch — FIXED (`6a9cbb6`)
§46.8 left the ☰ at 36×36 next to the §44 ← at 44×44. Unified: both are now a **36×36 visible circle** (matching the app's ☰ elsewhere) inside a **44×44 transparent tappable wrapper** — the glyph matches the app idiom while the hit target stays ≥44. Pure markup.

**Final: 329 tests green** (327 → +2 Unit 2); `vite build` clean; `:3000` dev transform clean. Commits: Unit 2 `3583f86`, Unit 4 `6a9cbb6` (Units 1 & 3 = verification / already-done, no code). On-screen confirmations (Chrome automation offline): the ☰/← matched pair, and Saved-tab 中文 concept search.

---

## 48. UPDATE — 21 June 2026 — Remove the redundant "✦ Write with this skill" (Writers tab)

The §30 "✦ Write with this skill" deploy button in `SavedSkillDetail`'s bottom row was a manual second path the user never uses — saved skills already reach the editor automatically.

### 48.1 Step 0 — clean subtraction (confirmed)
The button sets `appliedSkill`/`writingTechniques` via `onApply → applySkillWithEnrichment`. The editor's auto-surfacing is **independent**: `skill_match` runs at **onboarding** (Onboarding.jsx:63 — matches + applies a skill, whose `writingTechniques` carries into the editor's technique strip), NOT from this button; and the coach prompt reads `savedSkills` from localStorage directly (lyra.jsx:600). So removing the button doesn't break auto-surfacing.

### 48.2 Shared-button finding (flagged → user chose "Writers tab only")
`SavedSkillDetail` is reached from TWO contexts: the **Saved/Writers tab** AND the **editor's ✦ Skills picker** ("Deploy a Skill", EditorTab:77 → `SavedSkills` → drill into a skill → this button). The button is the picker's ONLY deploy control and `skill_match` doesn't run mid-writing, so removing it everywhere would make the picker a dead-end. Flagged per the brief; the user chose **Writers tab only**.

### 48.3 The change
The button renders only when `onApply` is passed (`{onApply && <button>}`). Stopped passing `onApply` in the Writers-tab `SavedSkills` (StyleLab.jsx:1780) → its detail bottom row is now **Remove · Practice**. The editor's ✦ Skills picker still passes `onApply` (EditorTab:77 → `onApplySkill = applySkillWithEnrichment`, lyra.jsx:1154), so deliberate mid-writing deploy keeps working there. Removed the now-dead `onApplySkill` threading to StyleLab (its signature + 3 mounts); `applySkillWithEnrichment` and the EditorTab pass are untouched. The button JSX in `SavedSkillDetail` stays (the picker still needs it) — pure subtraction of the Writers-tab wiring.

**329 tests green** (no test asserted the button); `vite build` clean; `:3000` dev transform clean. On-screen checks (Chrome automation offline): Writers-tab saved-skill detail shows Remove · Practice; the editor's ✦ Skills picker still deploys; Practice / per-card Practise / Analyse more / Remove unchanged.

### 48.4 Parked (per the brief — not acted on)
The bottom-row "Practice" may now be redundant with the per-card "Practise/Continue" (per-card is more precise — a technique, not the skill in abstract). Flagged for a future decision.

---

## 49. UPDATE — 21 June 2026 — Diagnostic Feedback Loop added to LYRA_BRAIN (the critique counterpart to the 4-Step Protocol)

Lyra had a strong GENERATIVE method (the 4-Step Coaching Protocol — teach a skill forward) but only a thin diagnostic block for critiquing a submitted draft. Added a new gated `LYRA_BRAIN` section — **THE DIAGNOSTIC FEEDBACK LOOP** — the systematic 7-phase critique that coaches an existing draft BACKWARD, distilled from the user's spec.

- **Gated** to "student submits a real DRAFT / PARAGRAPH for critique" — not casual replies or single sentences (defers to the existing MATCH THE RESPONSE + "DIAGNOSE, DON'T RE-TEACH" rules); one focus question per turn, lead with what works.
- **The 7 phases:** 0 comprehend (reflect the intended meaning back; ASK if unparseable) → 1 name the failing layer + praise the strong one → 2 group errors into NAMED rules ranked by frequency (patterns, not instances) → 3 sentence-by-sentence with the REASON → 4 **logic as a SEPARATE pass** (name each LEAP — size-mismatch / stacked-different / missing-causal-bridge / two-tangled; offer build-bridge OR shrink-claim) → 5 **device-sizing** (the device must match the claim's size and CARRY the logic — the black-hole self-reinforcing-loop worked example) → 6 preserve voice, separate correction from taste → 7 hand back ONE bounded task, confirm stuck patterns with evidence.
- Placed right after the 4-Step Protocol (its forward counterpart); the semicolon-ban + never-ghostwrite rules apply to every clean/target version modelled inside the loop. **Distilled (~600 words)** per the chosen approach — kept the directive essentials + the worked example, not the spec verbatim (LYRA_BRAIN rides every coaching call).

`LYRA_BRAIN` is prepended to coaching / training / eval (not proofread / structural / skill_match), so the loop reaches the chat coach where draft critique happens. **329 tests green, `vite build` clean, `:3000` serves the updated brain.** The behavioural check is a live coaching test — submit a draft to Lyra and confirm she runs the loop (reflect-back → named-rule grouping → separate logic pass → device-sizing → hand-back).

### 49.1 — v2 upgrade (completeness teeth)
v1 *described* each coaching move but never forced it to completion → shallow, representative-sample output. v2 adds the parts that make the diagnosis EXHAUSTIVE: **THE TWO LAWS** (Law 1 — exhaustive diagnosis: every pass is a COMPLETE SWEEP, name ALL instances / find ALL leaps; a tidy 3-point summary of a 10-issue draft is a FAILURE. Law 2 — minimal homework: hand back ONE bounded task. "Diagnose everything; ask for one thing."), **INVENTORY-FIRST** in the mechanics pass (list every error sentence-by-sentence BEFORE grouping → cluster → count & rank; expect 3-6 patterns, sweep again if only one surfaced), **sentence-by-sentence as the DEFAULT** for drafts under ~250 words, **enumerate EVERY logic leap** (expect 2-4, never stop at the first; zero/one on an argument = go back), a **logic→rhetoric firewall** (an over-sized metaphor is a logic leap FIRST in Phase 4, repaired rhetorically SECOND in Phase 5 — the black-hole anchor reframed accordingly), genre/format flagging in Phase 1, and a **PRE-OUTPUT COVERAGE GATE** (a silent checklist run before replying). Net ~600 → ~900 words — the added length IS the completeness mandate (v2's whole point), and it rides only coaching calls. 329 tests, build clean, :3000 serves v2.

---

## 50. UPDATE — 21 June 2026 — Diagnostic Critique block refined + VALIDATED on Gemini (supersedes the §49 loop)

The §49 v2 loop is **superseded** by a gold-anchored refinement. (The task labelled it §48; the log is past that, so it lands as §50.) The gap between a gold Opus critique and an earlier Lyra skim was RESOLUTION + PRIORITY + two rule-misses — NOT model intelligence — so the prompt forces the depth and a Flash-class model can hit the bar.

### 50.1 The block (`lyra-brain.js`, gated) — `b635047`
Renamed **DIAGNOSTIC CRITIQUE — full-resolution marking of a submitted draft**. Beyond v2 it forces:
- **SENTENCE-BY-SENTENCE at full coverage** (each flawed sentence: original → flaw + reason → fix), and EXPLICITLY bans collapsing into a grouped ranked-rule list — that grouping was the FAILURE mode (v2's cluster-into-rules step removed). The fix is an **illustration** of the student's own meaning, not an upgrade.
- **UNPARSEABLE → flag + labelled best-guess + ask**, never silent-fix.
- **Separate logic pass** naming **EVERY leap by sentence-LOCATION + TYPE** (4 types: missing-causal-bridge, size-mismatch incl. over-sized metaphor, stacked-but-different, two-tangled-arguments), each with **BOTH** repair directions (build-bridge / shrink-claim), student chooses — never build the bridge for them.
- **CORRECTION-vs-TASTE — HARD**, over-specified with the akin-to example (both the gold AND the failure "corrected" akin-to → is-akin-to; the prompt now forbids that exact move).
- Logic billed **EQUAL** to grammar; plain → never LaTeX (the gold had a raw `$…$` render bug); hand back **ONE** task. +6 tests.

### 50.2 Step 0 — trigger finding
No "critique"/"mark my writing" action exists — chat chips are Skills/Outline/Brainstorm/Find-example/Help-me-start, and the editor's Proofread is a separate structured-JSON path. So critique is **chat-intent only** → the gate is an **in-prompt intent condition**, not a code predicate. Implemented as such.

### 50.3 Dedup
The block opens by **cross-referencing** the existing rules ("apply them, don't restate them": never-write-it, explain-the-why, warm-HK / lead-with-strengths / no-hollow-praise, one-question, EN+繁中, LYRA_LEARNING_DATA) rather than re-pasting them. A test guards that the block stays < 50% of the brain and contains the cross-reference, not a fresh restatement.

### 50.4 VALIDATION on the preview — the framework TRANSFERRED to Gemini (Flash + 4096)
Fed a **representative** messy 15-sentence AI-debate speech (the exact gold draft wasn't supplied — only one sentence; the reconstruction seeded all 4 leap types + the akin-to trap ×2 + the black-hole metaphor) through the REAL `buildCoachPrompt` (59 KB system, model `gemini-3-flash-preview`, thinkingBudget 4096) to the live proxy. HTTP 200. Judged vs the gold on the three checks:
1. **Sentence-by-sentence with reasons (not grouped) — PASS.** Marked the flawed sentences 1→10, each original → fix → reason, plain → arrows, no LaTeX. The gold sentence resolved exactly: "Every decade's technology is different" with all three reasons.
2. **Separate logic pass, leaps by location + type, both directions — STRONG PASS (one gap).** A distinct Logic Pass named **3 typed, located** leaps — Missing Causal Bridge (S5→S7), Stacked-but-Different (S8→S9: jobs-fear vs identity-fear), Size Mismatch (S6 black hole vs S8 money) — with both directions on the main one. NOT the failure's vague "one big jump." Gap: it didn't name the 4th type (two-tangled-arguments) as an explicit leap, though it caught it in the hand-back ("pick ONE: Lazy Students OR Job Loss").
3. **Correction-vs-taste + no-rewrite — PASS (the headline win).** Gemini wrote verbatim: *"'Akin to' is a lovely, formal phrase (十分類似). It works well here!"* — treating it as TASTE, the exact thing BOTH the gold and the failure got wrong. Fixes illustrated the student's meaning without upgrading.

**Conclusion: checks 1–2 pass → the framework transferred. SHIP on the current `chat_coaching` tier** (gemini-3-flash-preview @ 4096) — no need to graduate critique to its own route + a stronger model. The forcing prompt reproduced gold-class depth on Flash and BEAT the gold on the akin-to guard. **Residual to watch:** the two-tangled-arguments leap surfaced only in the hand-back, not as a named 4th leap — a future tightening could push naming it explicitly, but it is not the shallow-skim failure mode. 335 tests green, build clean.

---

## 51. UPDATE — 21 June 2026 — §50 residual CLOSED: TWO TANGLED ARGUMENTS now named as a located leap

§50.4 left exactly one gap: in the live Gemini run the **two-tangled-arguments** leap surfaced only in the closing hand-back, not as a named leap in the logic pass. Closed.

### 51.1 The fix (`lyra-brain.js`, Diagnostic Critique block) — two surgical edits
The TWO TANGLED ARGUMENTS type was worded as a meta-observation about a *fix* ("separating them dissolves the other leaps") — which is precisely why the model filed it under the hand-back rather than the logic pass. Reframed it as a **located leap that must be named in the pass**: locate it at the **SEAM where the second argument first intrudes** ("S8 starts a new claim, not a step in the S1-S7 chain"), name it HERE like the other three, with an explicit ban on surfacing it ONLY in the closing hand-back. The same check was added to the silent PRE-OUTPUT COVERAGE GATE ("if the draft runs two or more distinct claims, the TWO TANGLED ARGUMENTS leap NAMED here at the seam, not left for the hand-back?"). +1 guarding test in `lyra-brain-critique.test.js` (asserts the seam wording + the gate clause). **336 tests green, `vite build` clean.**

### 51.2 VALIDATION — re-ran the §50.4 method; residual closed
Fed a synthetic 12-sentence "AI teachers" speech (seeded with all four leap types + the akin-to trap) through the REAL `buildCoachPrompt` (59,855-byte system, `gemini-3-flash-preview` @ thinkingBudget 4096) to the live proxy on :3001. HTTP 200. The Logic Pass now names **TWO TANGLED ARGUMENTS as leap #2, located "S7 → S9"** — *"two distinct 'bombs': education quality (laziness) vs economics (jobs)… by calling them 'the same problem' in S9 you weaken both"* — with BOTH repair directions (build the bridge OR split into two paragraphs). That is the exact behaviour missing in §50.4. Also held: **Size Mismatch (S6 black hole)** and **Missing Causal Bridge (S10)** as separate located leaps; sentence-by-sentence (not grouped); and the **akin-to TASTE guard** (*"'akin to' is grammatically correct if you want to sound more academic"* — offered as a choice, not "corrected"). One bounded hand-back (split into two paragraphs).

**Minor residual to watch (NOT the §51 target):** one sentence fix drifted toward a vocabulary upgrade ("no money at all" → "financial ruin") rather than a pure illustration of the student's own meaning — the correction-vs-illustration line. Candidate for a future tightening; it is not the shallow-skim failure mode.

---

## 52. UPDATE — 21 June 2026 — Diagnostic Critique made ENGLISH-PRIMARY (繁中 as support, not substitute)

*(Numbering: the task brief labelled this §49; the log is past that — §49 Feedback Loop, §50 Critique refined, §51 4th leap — so it lands as §52.)*

**Bug (preview screenshot):** the critique returned English section *headings* but a Chinese-DOMINANT body — the reasons, the logic-pass reasoning, and the closing task were in 繁中 only. For an English-writing coach that is inverted: the student is learning to write English, so the teaching must happen IN English with Chinese as a comprehension scaffold. The §50 block never specified the language RATIO, so Gemini defaulted to the student's L1.

### 52.1 The fix (`lyra-brain.js`, Diagnostic Critique block) — one scoped discipline
Added a **LANGUAGE — ENGLISH-PRIMARY, 繁中 AS SUPPORT** paragraph, applied to all of: the sentence-by-sentence reasons, the logic pass, the correction-vs-taste notes, and the closing task. Every explanation is clear, simple English (14-year-old level); Traditional Chinese (繁體) appears as a SUPPORT gloss for a hard term or a one-line clarification — NOT a full Chinese restatement, and NEVER a Chinese-only reason or section. Grammar-term pairs ("base verb / 原形動詞") stay welcome — support, not substitution. A short clause was added to the silent pre-output gate to enforce it. **Scoped to THIS block only** (no restatement of the app's general bilingual rule). +1 guarding test. **337 tests green, build clean.** This English-default is also what makes the coming per-message 「翻譯成中文」 toggle meaningful (§53).

### 52.2 VALIDATION — re-ran a 15-sentence AI-debate speech; inversion fixed
Real `buildCoachPrompt` (60,679-byte system, `gemini-3-flash-preview` @ 4096) → live proxy, HTTP 200. **CJK ratio of the visible reply = 0.6%** (15 CJK chars vs 2,326 Latin): the whole critique — Pass A sentence marks, Pass B logic pass (3 located leaps incl. Two Tangled Arguments S7→S9 with both repair directions), and the one closing task — is now ENGLISH, with 繁中 only as parenthetical glosses ("風格選擇", "過度概括", "不合邏輯的推論"). The Chinese-dominant inversion is gone. Correction-vs-taste held (*"'akin to' … It's your call (風格選擇)"*).

**Separate known issue re-surfaced (NOT §52 scope):** this run emitted LaTeX math arrows `$\rightarrow$` despite the block's plain-→ ban — model non-determinism on the Flash tier (the §50 run passed that check). Flagged per Brief 2 Step 6 as a separate tightening candidate; it does not affect the language fix.

---

## 53. UPDATE — 21 June 2026 — Chat message action row: Copy · Translate · Reload (AI messages only)

*(Numbering: the task brief labelled this §50; the log is past that, so it lands as §53. Pairs with §52 — English-primary critique + full-Chinese-on-demand per message.)*

The slot under each Lyra bubble was empty. Added a Claude-style action row on **AI messages only** (never user bubbles), attached once the message is in `messages[]` (i.e. after streaming): **Copy · Translate · Reload**, 44×36 tap targets, line icons (`Icons.jsx`: CopyIcon / TranslateIcon / ReloadIcon).

### 53.0 Reload feasibility (Step 0) + the state added
The conversation lives in `messages[]` (role-labelled, persisted into the writing) so each AI reply's originating user turn — and for a critique the draft inside it — IS reconstructable. But per-message request params and a stable id were NOT retained (`handleTypewriterDone` kept only text/sources). Added minimal state: **`reqText` / `reqSearch` / `reqScaffold` are stamped on the AI typingMsg in `sendChat` and carried through both finalizers** (typewriter-done + tab-switch). `sendChat` gained a **`historyMsgs` param**: when supplied (reload) it re-fires WITHOUT appending a duplicate user message and uses an explicit history (the turns before the originating user message), sidestepping the stale-`messages`-closure trap. `reloadChat(i)` slices off the reply (keeps the originating user turn + prior history) and re-fires. `canReloadMessage(m)` (true only for AI messages with `reqText`) gates the button — the §43 welcome and legacy messages correctly show **no** Reload.

### 53.1 Copy / Translate / Reload
- **COPY** — `cleanMessageText` (`chat-actions.js`) = `stripLearningData` ∘ `stripMd`: clipboard gets readable plain text, no hidden `LYRA_LEARNING_DATA`, no `**`. `navigator.clipboard.writeText` + ✓ feedback for ~1.5s; clipboard failure is caught silently (no crash).
- **TRANSLATE** — taps to full 繁中 and back. Lite tier (`translate` route, thinkingBudget 0) via new `buildMessageTranslatePrompt` (flowing prose, 繁體 never Simplified, output-only — distinct from the sentence-pair source translator). **Cached on `message.translation_zh`** so a re-tap toggles with NO second call; in-flight guard + a small bounce spinner; translates the CLEAN text.
- **RELOAD** — drops the reply and re-fires the same call (Step-0 mechanism); disabled while a turn is in flight; the regenerated message gets a fresh row and its translation cache is cleared.
- New testable module `src/chat-actions.js` (cleanMessageText / canReloadMessage / getMessageTranslation) + `tests/chat-actions.test.js` (8). **345 tests green, build clean.**

### 53.2 Live verification (preview — all five checks)
Drove the app to a Persuasive chat. (1) Row shows under Lyra messages, **none on the user bubble**. (2) Copy wired (clean-text unit-tested; the headless clipboard blocks `writeText`, so the ✓ only shows in a real browser). (3) **Translate** flipped the welcome to 繁中 (157 CJK), toggled back to English, and the re-tap was **cache-served — proxy log confirmed no 2nd request**. (4) **Reload** on the coaching reply changed the output and kept counts at `{ai:2, user:1}` — regenerated **in place, no duplicate user message**; the proxy log shows the reload as an identical re-fire (`system_len=62233, msg_len=1004`, same as the original). (5) Reload is **absent on the welcome + a legacy message** (no `reqText`).

### 53.3 Notes / residuals
- **Learning-sync on reload (Step 5):** the Achievements **card** is deduped by `after`; structures/vocabulary dedupe by name. But the raw **grammar-log / growth-log** entries are appended without a content dedup, so reloading a *critique* turn can re-add them — this mirrors the pre-existing **Resend** behaviour (not introduced here). Flagged for a future dedup pass.
- **Preview proxy artifact:** this preview's `lyra-proxy` points at the main-repo `proxy.js`, whose allow-list predates the `gemini-3.1-flash-lite` rename, so the lite translate fell back to `gemini-flash-latest`. The **worktree's own `proxy.js` allows the new name** — so real deployment uses the intended lite tier; only the preview wiring fell back.
- LaTeX `$...$` (the §52 residual) would also land in copy output verbatim — same separate tightening candidate.
- Verification created one throwaway writing ("Should AI be banned in schools?") in the preview's local data — safe to delete from the sidebar.

### 53.4 Follow-up — Copy fixed for insecure contexts (phone on the LAN IP)
**Bug (reported):** Copy did nothing. Cause: on a phone hitting the dev server over the LAN IP (`http://<ip>:3000`, an **insecure context**) `navigator.clipboard` is `undefined`, so `writeText` threw and the silent catch left Copy doing nothing (it would have worked on desktop `localhost` = secure). Fix: `copyToClipboard` (chat-actions.js) tries `navigator.clipboard.writeText` (secure context) then falls back to `document.execCommand("copy")` via a focused off-screen textarea (works on a real tap in insecure contexts). Copy now also copies **what's displayed** — the 繁中 when translated, else English. +2 tests (347 total), build clean. *Headless caveat: neither clipboard path can be demonstrated headlessly (both need a real user-activation/focus that programmatic clicks lack) — re-test on the device.*

---

## 54. UPDATE — 21 June 2026 — Critique output: strip the prompt's internal scaffolding from the visible reply

*(Numbering: an addendum to the English-primary fix; that fix already shipped as §52, so this lands as §54 — same block, re-validated the same way, one commit.)*

**Bug (screenshot):** the critique echoed the prompt's own organisation into the chat — `### A) Sentence-by-Sentence Pass` / `### B) Logic Pass` (the `###` rendering raw because chat is plain-text), and `S7 → S9` index shorthand. This exposes how Lyra works (bad at a demo / to a competitor) and reads as jargon to a 14-year-old. **Third instance of prompt-scaffolding leaking** (after the §52 `$\rightarrow$` LaTeX).

### 54.1 The fix (`lyra-brain.js`, Diagnostic Critique block)
Added **OUTPUT — WHAT THE STUDENT SEES** rules: (a) NEVER print phase/pass names ("Sentence-by-Sentence Pass", "Logic Pass", "Pass A/B", "Phase 0/1/2") — the structure is FELT, never NAMED; if a signpost helps, use plain student words ("Let's look at your sentences", "Now the flow of your argument"); (b) the chat renders `**bold**` but no other markdown, so NO `#`/`##`/`###` headings and NO LaTeX/math, arrows as `→` or "becomes"; (c) point to sentences in PLAIN words ("Sentence 7", "between your 7th and 9th sentences", or quote) — NEVER `S7 → S9`/`S1-S7` (the numbered 1./2. list stays fine); (d) a **standing class-closer**: "EVERYTHING you output is read directly by the student — NEVER expose internal structure, labels, or notation from these instructions." Also rewrote the block's OWN internal examples from `S7 → S9` / `S8`-shorthand to plain language so the model mirrors plain references, and added the check to the silent pre-output gate. **Correction:** the chat's `renderMd` DOES render `**bold**`, so bold is kept for light emphasis (the brief lumped `**` with `###`, but only headers/LaTeX render raw). +1 test (**348 total**), build clean.

### 54.2 VALIDATION — re-ran the 15-sentence draft; scaffolding gone
Real `buildCoachPrompt` → live proxy @ 4096, HTTP 200. Automated checks all pass: **no markdown headers, no phase/pass labels, no `S`-notation, no LaTeX**, CJK = 0.7% (still §52 English-primary). The reply reads as a teacher: plain signposts (*"Let's look at your sentences first, then your argument flow"*, *"The flow of your argument"*), located leaps in plain words (*"Between your 7th and 9th sentences"*, *"In your 11th sentence"*), both repair directions, akin-to held as taste, one task. Leap **type** names (Size Mismatch, Two Tangled Arguments) are retained — pedagogical vocabulary the student should learn, not internal scaffolding. The §52 LaTeX residual did not surface this run.

---

## 55. UPDATE — 21 June 2026 — Grammar Log delete × is now red (destructive affordance)

The per-card × in the Grammar Log (`GrammarLog.jsx`) rendered neutral grey — same weight as inert text — despite DELETING the card. Coloured it `COLORS.red` (#D94F4F) with a faint red-tinted circular background + faint red border at rest that strengthen on hover/press, inside a 44px tap target (26px visible circle). Delete behaviour unchanged. Verified live on the preview: rest glyph/border/bg = red at 100% / 33% / 5%, hover = red at 100% / 100% / 15%, 44×44 target, one × per card (3 cards). "Clear all" untouched (its own control).

**Scope — proofread panel NOT included, by design:** the proofread panel's grammar cards have no per-card delete ×; its only × (`EditorTab.jsx:299`) just CLOSES the panel (non-destructive, reopenable by re-running Proofread), so it correctly stays neutral grey. Only destructive ×'s go red.

---

## 56. UPDATE — 21 June 2026 — Adversarial review of §43–§55, then push + merge to origin/main

*(Numbering: the task brief labelled this §51; the log is past that, so the review fixes land as §56/A2 + §56/C3 and this is §56.)*

### PART 1 — review (20 hypotheses; fan-out of 5 area investigators + adversarial verify on the 7 CONFIRMED)
The verify pass earned its keep: it **downgraded/refuted 3 of the 7** confirmed findings.

| ID | Verdict (post-verify) | Evidence | Outcome |
|----|------|----------|---------|
| **A2** | CONFIRMED · medium · HELD | Reload re-runs `syncLearningData`; grammar + skills had NO dedup, growth had no content dedup AND double-incremented `lyra-growth-pending` (premature regen). `learning-sync.js:139-194` | **FIXED** `9cf71ca` |
| **C3** | CONFIRMED · ↓high→low · HELD | Standing leak-ban present, but literal `A)`/`B)` pass labels (`lyra-brain.js:169/171/173/202`) contradicted the §54 "Pass A/B" ban. (Verify corrected the original's bad citations: 5 occurrences, self-check clean.) | **FIXED** `7a59b66` |
| C1 | CONFIRMED · medium · HELD (observation) | Critique gate is in-prompt/model-judged, not a code predicate (`lyra-brain.js:161-165`). Fix is conditional ("if mis-firing seen"). | Design note (not fixed) |
| C2 | CONFIRMED · ↓ to low/info | ~2.1K-token block rides every brain call, BUT verify refuted the cost argument — it's a stable *prefix* (ideal for Gemini caching), not cache-busting. | Design note (not fixed) |
| C4, C5 | CONFIRMED · no defect | Correction-vs-taste is HARD + anchored (`:193-200`); no-rewrite illustration rule present + distinct (`:179-182`). | No action |
| W2 | **REFUTED** | Claimed no timeout → session-long banner suppression; WRONG — `proxy.js:232` has a 180s upstream timeout → error SSE → client catch runs FALLBACK + clears suppression. Auto-recovers. | No action |
| L1, A1, A3, A4, H1, H2, H3, S1, S2, S3, W1, W3, R1 | REJECTED (clean) | English-primary keeps 繁中 support; reload genuinely re-fires; translate caches + strips; copy clean (secure+insecure); back/exit no dead-ends; no revert leftovers; ☰/New-Writing correct; search/A–Z/category all filter the FULL store; Chinese search safe; fallback floor holds; reopen keeps original greeting; §47 removal clean. | No action |

Incidental (out of scope, not fixed): stale unused import `parseStructureContent` at `StyleLab.jsx:16`; an inaccurate z-index comment at `StyleLab.jsx:1484-1486`.

### PART 2 — push + merge
All of **§51–§56 was local** (origin/main was `2471743` = §50; the brief's "34a3e16" was stale). Pushed branch `claude/thirsty-meninsky-bc7a11` to origin, then **fast-forwarded `origin/main` `2471743..7a59b66`** (FF verified ancestor; no force, no divergence). Post-push `origin/main..HEAD` is empty. **Final origin/main = `7a59b66`** carrying §51, §52, §53, §53-fix, §54, §55, §56/A2, §56/C3. Branch hygiene reported only (no deletes); this branch is now merged into main; unmerged: objective-ramanujan-974c10, start-lyra-preview-CLY2d, deep-logic-analysis-DESuG, continue-lyra-ufYB2.

**Tests: 353 green before and after** (was 348 pre-review; +4 A2 dedup, +1 C3 guard). Build clean.

---

## 57. UPDATE — 21 June 2026 — Proofread panel showed empty Grammar/Style/Vocab (parse failure → silent empty)

**Bug (screenshot):** the Proofread panel showed Grammar/Style/Vocab tabs with NO content under any tab and no error — looked stuck/unresponsive.

### 57.0 Step-0 finding — **B (PARSE FAILED)**, root cause = thinking tokens starving the response budget
Traced the flow live. `runProofread` (`lyra.jsx`) called the Lite route at **`maxTokens: 1000`** and parsed with a **naive** `JSON.parse(result.replace(/```json|```/g,""))` — no preamble strip, no outermost-`{}` extraction. The proxy token log was decisive: `thinking=957` (cap 1000) / `thinking=1815` (cap 2048) with `response=39` / `229` — **the model's thinking tokens count toward `maxOutputTokens`, leaving almost nothing for the JSON, which truncated mid-object** → naive parse threw → the `catch` set `{grammar:[],style:[],vocabulary:[],strengths,nextFocus}`, but EditorTab renders **only the three arrays** and never showed `strengths`/`nextFocus` → empty tabs, no error (the screenshot). Not A (HTTP 200), not C (not a clean empty parse), not D (tabs do switch). Live repro: at 1000 the Lite reply was prose or truncated JSON; **at 4096 it returned complete `{grammar:4, style:2, vocabulary:3}` that parses cleanly.**

### 57.1 The fix
- **`maxTokens` 1000 → 4096** (`lyra.jsx`) — room for thinking + the full grammar/style/vocab payload (the chat-tier pattern). This is the primary fix; verified the real model now returns complete parseable JSON.
- **Robust parse** — new `extractJsonObject` (`utils.js`, the `parseProfileJSON` pattern: strip fences, slice the outermost `{…}`, parse) replaces the naive parse; **retry once** before giving up.
- **Hardened prompt** (`prompts.js`) — "Return ONLY a single raw JSON object — start with `{`, end with `}`, no code fences, no prose" (the Lite model had returned markdown prose).
- **Never silent/stuck** (`EditorTab.jsx`) — on failure the panel now shows a visible **"Couldn't check this right now — try again"** with a retry button (was an invisible error payload); each tab shows a **"✓ No … found"** placeholder when its array is empty, so a clean draft never looks broken either. Every `runProofread` exit sets `proofLoading=false`.
- +7 `extractJsonObject` tests (**360 green**), build clean.

### 57.2 Verification
Live: real model at 4096 → full `{g:4,s:2,v:3}` JSON, both naive and robust parsers OK (was truncated to 39–229 response tokens at 1000). Adversarial verify (2 independent agents over the final code): **no silent/stuck path** across all five outcomes (valid · empty-arrays · partial-object · parse-throw×2 · call-throw); `proofLoading` cleared on every exit; JSX balanced.

---

## 58. UPDATE — 22 June 2026 — Proofread cards now carry Lyra's judgment (correction-vs-taste, no-fabrication, no-rewrite) — still Lite/fast/card-based

Proofread (Lite, `brain:false`) shared NONE of Lyra's pedagogy, so it contradicted the chat critique — e.g. flagging "akin to" as a grammar error while the critique correctly treats it as a style CHOICE. Fix: give proofread the JUDGMENT it was missing via a distilled (~350-token) rules block — NOT the full ~9K-token LYRA_BRAIN, NOT a flip to Pro/brain, NOT sentence-by-sentence.

### 58.0 Step-0 findings
- **Formality/exam context already wired** — `buildProofreadPrompt` has the formal/spoken/creative split + `examBlock`, and `runProofread` passes `typeLabel` + `examRules`. So formality is reused, not re-added.
- **Rules were inline-only in LYRA_BRAIN** — correction-vs-taste (`:193-200`) and no-rewrite/illustration (`:179-182`) lived only in the critique block; no shared constant. No-fabrication had no proofread-relevant rule.

### 58.1 Single source of truth (extracted, not copied)
New `src/judgment-rules.js`: extracted **`CORRECTION_VS_TASTE`** and **`NO_REWRITE_ILLUSTRATION`** verbatim from the critique block, added **`NO_FABRICATION`** (proofread-specific), and composed **`PROOFREAD_JUDGMENT_RULES`**. **Both** `LYRA_BRAIN` (critique) and `buildProofreadPrompt` (proofread) now import the SAME constants — they cannot drift to different definitions (the exact failure the task flagged). Chose EXTRACTION over a proofread-scoped copy precisely to kill that drift risk; the critique interpolates the constants and behaves identically (the §50/§52/§54 critique tests + brain tests — 30 — stay green, satisfying Step 3's "behave identically").

### 58.2 Proofread wiring + scope guards
`PROOFREAD_JUDGMENT_RULES` is **prepended** to `buildProofreadPrompt`; the JSON card shape, formality context, exam rules, and `appliedSuggestions` handling are untouched. Proofread STAYS Lite (`brain:false`), card-based (NOT sentence-by-sentence), and does NOT get the full brain. +3 tests (single-source assertions incl. both prompts embedding the shared constants). **363 tests, build clean.**

### 58.3 VERIFICATION (live, the AI-debate draft)
Through the now-judgment-aware `buildProofreadPrompt` @ 4096: **"akin to" is NOT flagged as a grammar error** (consistent with the critique) and is not mis-corrected; real errors ARE flagged with explanations + a 繁中 gloss (e.g. *"Good morning everyone, today" → comma splice (逗號連接句)*); **no padding** (grammar 2 / style 2 / vocab 3 — honest, not maxed). Still Lite/fast/card-based.

---

## 59. UPDATE — 22 June 2026 — Proofread cap 4 → ~100 AND grouped by rule (patterns over instances)

"up to 4 grammar issues" hid the true scale (a weak draft has dozens). Raised the cap to ~100 AND grouped repeated errors under one named rule so 100 isn't an unscrollable wall and the cards honour "patterns over instances".

### 59.0 Step 0
The "4" was **prompt-only** (`buildProofreadPrompt`; the render never sliced). The shape was **FLAT** (one entry per occurrence). The "patterns/rule" clustering doctrine lives in **report-card-brain** (the Growth Report); the chat critique itself does sentence-by-sentence (NOT grouped — §50), so proofread's grouping aligns with the report-card patterns doctrine, a different surface.

### 59.1 Cap (commit `ad66947`)
`buildProofreadPrompt` grammar limit 4 → **up to 100, framed as a CEILING not a target** with the §58 no-fabrication rule reinforced inline. Modest bump: style → 6, vocab → 8 (grammar was the one needing the lift).

### 59.2 Grouping + render (commit `7d... this commit`)
- **Grouped JSON shape**: one grammar entry per RULE with an `instances:[{wrong,right}]` array, ranked most-frequent-first.
- **`groupGrammarByRule` (utils.js)** — pure/testable: normalises the grouped shape OR the legacy flat shape, merges same-rule entries (case-insensitive), ranks by instance count. Guarantees one card per rule no matter what the model returns.
- **EditorTab**: one card per rule (rule + "N places" badge + first 3 instances + "and N more" expandable + explanation + example + Teach me this + Saved to Grammar Log). Progressive, not a wall.
- **Grammar-log save (lyra.jsx)**: one entry per rule-GROUP (representative instance), not one per occurrence — the log isn't spammed.
- **`maxTokens` 4096 → 8192**: the 100-cap enlarges the payload and thinking tokens count toward the budget; a low cap truncated the grouped JSON → parse fail. Bigger budget = slower/pricier on a heavily-flawed draft, acceptable for the thoroughness the cap exists to provide (flagged).
- +7 tests. **370 green, build clean.** Critique unchanged.

### 59.3 Verification (live, error-dense run-on)
20 grammar instances (vs old 4) grouped into **4 rule-cards — Subject-Verb Agreement (9), Noun Pluralization (8), Article Usage (2), Double Negatives (1) — most-frequent-first ✓**, bilingual rule names (主謂一致 …), **"akin to" NOT flagged as a grammar error ✓** (§58 held at the higher cap), no padding (style 2 / vocab 5). Grammar-log gets 4 entries (one per rule), not 20.

---

## 60. UPDATE — 22 June 2026 — Grammar Log card title no longer collides with the × button

The §55 red × (absolute, top-right 44px) overlapped long bilingual titles ("Singular Nouns and Adjective Forms (單數名詞與形容詞形式)") which had no reserved space. Fix (`GrammarLog.jsx`): the title gets `paddingRight: 44` so it wraps/stops BEFORE the × zone instead of running under it; the × stays out of flow, anchored top-right, red, ≥44px tap target. Verified live: with the long title injected, the title text area ends at x=586 while the × button starts at x=599 (no overlap), and the title wraps to a second line. 370 tests, build clean.

---

## 61. UPDATE — 22 June 2026 — Proofread × closes + aborts in every state; never-stuck soft timeout

*(Numbering: the task brief labelled this §60; the log is already at §60 (title overlap), so it lands as §61.)*

**Bug (screenshot):** the proofread panel stuck on "Doing the magic" and the × did nothing — student trapped.

### 61.0 Step 0 (two causes)
- **× dead during load**: `EditorTab` × did `onClick={() => setProofread(null)}`. During load `proofread` is already null and `proofLoading` is true, so the panel `{(proofread || proofLoading)}` stayed open — the × cleared neither `proofLoading` nor the in-flight call.
- **Slow/hung call**: `runProofread` passed **no abort signal** and had **no client-side timeout**; the heavier §59 call (cap ~100 + grouping @ 8192) is slow, so a slow/hung call sat on the spinner until the proxy's 180s timeout ×2 retries (~minutes). Live timing: the call **resolves in ~22.5s** (flash-fallback w/ thinking) — genuinely slow, not fundamentally hung.

### 61.1 Fix (one unit)
Added `proofAbortRef` + an `AbortController` in `runProofread`, pass `ctrl.signal` to `callAI`, a **60s client-side soft timeout** (`timedOut → abort`), an ownership guard (a superseding cancel/run won't clobber state), and an abort-break in the retry loop (an aborted call doesn't retry). New **`cancelProofread`** (abort + `setProofLoading(false)` + `setProofread(null)`) is wired to the × so it **closes in EVERY state — loading, loaded, error** — and cancels the call. A timeout surfaces as a retryable error ("taking too long"), never an eternal spinner. Kept the §59 cap at 100: the defensive parse (§57) + abort + soft timeout make the heavy call safe without lowering it.

### 61.2 Verification (live, error-dense draft)
× tapped mid-load → **panel closes immediately + call aborts**; reopen → fresh, **resolves to grouped cards in 22.5s** (7 / 4 / 1 / 1 / 1 places); × also closes the loaded panel. Never eternal. 370 tests, build clean.

---

## 62. UPDATE — 22 June 2026 — Draft field framed as a paper "sheet"

*(Numbering: the task brief labelled this §61; the log is already at §61, so it lands as §62.)*

The draft text sat directly on the parchment bg with nothing delineating it. Framed the writing field as a defined sheet.

### 62.0 Step-0 decision — style the existing wrapper, not the textarea
The draft textarea was already `background: transparent`, `border: none`, `padding: 16px 18px`, `height: 100%` inside an "Editor area" wrapper (`flex:1; position:relative; overflow:hidden`) that also holds the blank-page nudge. Ghost text is disabled (no overlay). So I styled **the existing wrapper** as the sheet (no new element, no double-wrap) and left the textarea transparent inside it — gutter margin floats the sheet on the parchment while the textarea keeps its own padding + native scroll.

### 62.1 The sheet (`EditorTab.jsx`)
Wrapper gets `border: 1px solid COLORS.border (#E2E5EA)`, `borderRadius: 14`, `background: COLORS.card (#fff)`, `margin: 0 18px 14px` (parchment gutters + gap above Ask Lyra). White-on-parchment reads as paper; border defines it; no heavy shadow (matches the `card` idiom — calm, not boxy). `flex:1` means an empty draft fills the height like a page (min-height inherent). Toolbar (Skills/Proofread) above and the Ask Lyra bar below stay OUTSIDE the frame as chrome.

### 62.2 Preserved / verified
Monospace draft, placeholder, word-count + progress bar (chrome above), auto-save all unchanged. The wrapper already had `overflow:hidden` + the textarea scrolls natively, so mobile keyboard scroll is unaffected (only the visual frame was added — no clipping introduced). Verified live: sheet bg `#fff` on parchment `#F7F5F2`, border `0.8px` (1px) `#E2E5EA`, radius 14, 18px gutters, sheet width 394px (text ~358px — readable on the 430 column), textarea transparent. 370 tests, build clean.

**Out of scope (noted for a future consistency pass):** the Style Lab Analyse "paste a passage" box is a similar textarea — the same paper treatment would give visual consistency, but not changed now.

---

## 63. UPDATE — 22 June 2026 — Copy-draft button on the writing field

*(Numbering: the task brief labelled this §62; the log is already at §62, so it lands as §63. Distinct from the §53 chat action row, which copies Lyra's MESSAGES — this copies the STUDENT'S DRAFT.)*

Students had no easy way to get their writing out (manual select-all on a phone is painful). Added a one-tap Copy button to the draft field.

### 63.1 Placement — a non-scrolling copy bar, not a floating corner button
The §62 sheet became a flex column: a **non-scrolling top bar** (the Copy button, right-aligned, code-block style) + the scrolling textarea below it (`flex:1; minHeight:0`). A *floating* corner button would cover the end of line 1 and any line that scrolls under it (the Grammar-Log overlap class); a separate row means it can **never** sit over the draft text or caret. Verified live: button bottom (≤ textarea top) — no overlap; top-right corner; 68×36 (matches the §53/icon-button idiom + ≥44px-wide tap target).

### 63.2 Behaviour
Copies the **verbatim draft** (the textarea value — no markdown/stripping; it's the student's plain text) via the **shared §53 `copyToClipboard`** (secure-context `navigator.clipboard` + insecure-context `execCommand` fallback — reused, not reinvented). Two-state feedback: `Copy` → `✓ Copied` for 1.5s → revert (same as §53). Clipboard failure is graceful (no crash). **Hidden on an empty draft** (`draft.trim()`).

### 63.3 Verified
Empty draft → button hidden ✓; type → button appears top-right ✓; no overlap with textarea/caret ✓ (its own row); reuses the §53 clipboard helper (already unit-tested) so the copy + secure/insecure paths are covered. Ghost text is disabled (no overlay to disturb); the §62 frame scroll is unchanged (textarea scrolls below the fixed bar). 370 tests, build clean.

---

## 64. UPDATE — 22 June 2026 — Adversarial review of §57–§63 (3 proofread fixes)

*(Logged after the fact — this is the work already in commit `e8a28d8`, written into the log to keep the `§` sequence linear. The task brief for the CLAUDE.md work below ALSO said §64; since the commit log already holds §64, that work lands as §65 — same reconciliation as the §62→§63 note above.)*

A multi-agent adversarial review (8 lenses × 3-skeptic refutation, **0 false positives**) of the unreviewed §57–§63 proofread / grammar-log / copy-draft surface found 3 real defects; all fixed, all matched against the actual code.

### 64.1 Zero-instance grammar group (medium) — `utils.js`
`groupGrammarByRule` could emit a group with no real instance when the Lite tier returns a rule header but truncates/omits its wrong→right pairs (common near the token ceiling) — rendering a hollow "0 places" card, suppressing the "✓ no issues" placeholder, and persisting a **blank junk row to the Grammar Log** in localStorage. Fixed by dropping zero-instance groups in the return (one `.filter` cascades to all three consumer sites). + regression test.

### 64.2 Orphaned proofread on navigation (high) — `lyra.jsx`
§61 wired the abort protocol into the × ONLY, not the two navigation paths (`loadWriting`, `resetToNew`). A proofread in flight when the student opened another writing / hit New resolved into the NEW writing — the ownership guard `proofAbortRef.current !== ctrl` passed because the ref was never nulled — **contaminating the new writing's Grammar Log** with the old draft's entries, plus a phantom "Doing the magic" spinner. Both paths now abort + NULL `proofAbortRef` and clear `proofLoading`, so the late run is rejected by the guard.

### 64.3 Stale expand-state (low) — `EditorTab.jsx`
`expandedRules` was keyed by array index and never reset, so a grammar card expanded in one run pre-expanded a DIFFERENT (frequency-ranked) rule the next run. Now keyed by the stable `grp.rule` string.

### 64.4 Verified
**371 tests** (+1 regression), Vite HMR clean, no console/server errors, app mounts. Committed `e8a28d8` (local; not yet on origin/main).

---

## 65. UPDATE — 22 June 2026 — CLAUDE.md consolidated into the enforceable discipline

No project `CLAUDE.md` / `KARPATHY.md` / `golden-rules.md` / `architecture.md` / ADRs existed in the repo. The recurring §22–§63 failures were **drift over long sessions** — NOT blind-start: work sat local-only ~2 weeks (flagged 4×); rule definitions got duplicated and diverged (correction-vs-taste, no-fabrication, cluster-by-rule); prompt scaffolding leaked to students (3×); AI calls froze with no error state (2×). A one-time read at session start decays. Fix: a project-root `CLAUDE.md` (auto-loaded every session) that INLINES the non-negotiables so they stay in context, plus a before/during/after-session checklist targeting the skipped steps, plus pointers to the deeper docs.

### 65.1 What was created
- **`CLAUDE.md`** at the repo root. **## NON-NEGOTIABLES** — the 10 recurring-failure rules inlined (1–3 lines each): Karpathy discipline, push discipline, single-source-of-truth, no-scaffolding-leak, verify-before-fix, check-don't-assume, error-states/never-stuck, learning-sync dedup, mobile-first/preserve-overlays, pedagogy-is-law.
- **## SESSION CHECKLIST** — BEFORE WORK / DURING / BEFORE SESSION END, foregrounding the most-skipped steps (push + FF-merge to `origin/main`; single-source-of-truth check; check-don't-assume; PROGRESS-REPORT section per unit).
- **## DEEPER DOCS** — pointers to `lyra-brain.js`, `judgment-rules.js`, `report-card-brain.js`, `ai-router.js`, `LYRA-PROJECT-BRIEF.md`, `PROGRESS-REPORT.md`, `.cursorrules` (only files that exist).

### 65.2 Inventory notes (Step 0)
- `KARPATHY.md` did NOT exist → the short Karpathy discipline was inlined fresh (non-negotiable #1), not linked.
- `golden-rules.md` / `architecture.md` / ADRs do NOT exist → not pointed to.
- The closest existing "rules doc" is `.cursorrules`; its architecture lines (single-file app, `api.anthropic.com` via `api-patch.js`) are STALE vs the current multi-component + Gemini/proxy reality. `README.md` and `LYRA-PROJECT-BRIEF.md` are likewise stale on the API/stack (Anthropic / single-file ~1,384 lines). CLAUDE.md states the current facts and flags those docs as stale (defer to `ai-router.js` + the code). Not rewritten here (out of scope).
- `lyra-brain.js` pedagogy constraints confirmed present as readable in-file comments (the pointer is valid).
- AUGMENT, not overwrite: no existing CLAUDE.md to preserve; the accurate rules from `.cursorrules` (mobile-first 430px, AI-never-writes-for-the-student, formality-aware, COLORS palette, no emojis in chrome) are reflected, the stale ones dropped.

### 65.3 Out of scope (noted)
A pre-push git hook enforcing the session-end push is a reasonable FUTURE addition — noted in `CLAUDE.md`, not built (docs/process task only, one commit, no code changes).

---

## 66. UPDATE — 22 June 2026 — The coach who KNOWS the student (growth profile → coaching + proofread)

*(Numbering: the task brief labelled this §63; the log is already past that — it lands as §66, the next linear section. Same reconciliation convention as the §62→§63 note.)*

Lyra's longitudinal memory of each student — the growth profile (`lyra-growth-profile`, §20+: clustered weaknesses with status, occurrence counts, trajectory, recently-resolved wins) — was SILOED in the Report tab. The coaching chat and proofread never read it, so Lyra-in-the-chat was amnesiac about what Lyra-in-the-Report knew. §66 makes coaching + proofread COACH FROM the profile.

**Design principle — "the coach who KNOWS the student", not "the coach who recites a file":** memory is ALWAYS used but mostly INVISIBLE (it makes Lyra ANTICIPATE characteristic errors and coach sharper, not announce them); it becomes EXPLICIT only to MARK A WIN (citing improvement motivates; citing weakness accuses). The growth profile stays the SINGLE SOURCE OF TRUTH — §66 adds RETRIEVAL, never a parallel cache that could drift.

### 66.1 The distiller — `getStudentContext()` (`growth-report.js`)
`getStudentContext(profile = loadProfile())` returns a COMPACT slice (not the whole profile — that's the §16.7 bloat trap on a Pro call every turn): level+trajectory; the 1-2 FOCUS weaknesses (the ones carrying a `prescription`, cap 3) each with a terse "what to watch for" (the concrete `distinctForms`, else the prescription); recently-resolved WINS (graduated + status-resolved, names only, cap 4 — the ammunition for explicit win-citing); a name-only WATCH-LIST (other open weaknesses, cap 2). Pure when passed a profile (unit-tested without localStorage); returns `null` on cold start / no signal so callers inject nothing. Staleness is documented in-function as eventually-consistent-by-design.

### 66.2 Chat injection — `buildCoachPrompt` (`prompts.js`, `lyra.jsx`)
`buildCoachPrompt` takes the slice and prepends a framed **WHAT YOU KNOW ABOUT THIS STUDENT** block right after `LYRA_BRAIN` (stable per-student → prefix-cacheable like the §48 block). The block carries the USAGE DISCIPLINE — *ANTICIPATE, don't recite* (coach a known weakness as familiar/fixable; never open with deficits, never "your profile shows…"); *speak the memory out loud ONLY to mark a WIN*; inherit the report-card tone (strengths first, "what we're working on", never "you always fail"). Wired on the coach path only (scaffolding, for a stuck blank-page student, gets no memory). The §48 critique lives inside `LYRA_BRAIN`, so a coaching turn that critiques a draft is covered.

### 66.3 Proofread injection — `buildProofreadPrompt` (`prompts.js`, `lyra.jsx`)
The Lite proofread gets an even thinner version: a name-only list of the FOCUS weakness rules ("known patterns to watch for this student: …") so it looks HARDEST where the student characteristically slips. Names only — Lite stays Lite; NO win-citing (motivational memory is the chat's job); NO FABRICATION still rules (the list says WHERE to look, never invents errors).

### 66.4 Cold-start + staleness
No profile → `getStudentContext()` returns null → no block in either prompt → coach/proofread run exactly as before (cold-start safe, verified). The injected slice is eventually-consistent with the Report (regenerates every N practices); weaknesses don't change turn-to-turn, so a few-practice lag is acceptable — deliberately NOT made live (the milestone-force regen §5 accelerates catching a just-beaten weakness).

### 66.5 Verified
Four commits (distiller / chat / proofread / review-fixes). Rendered the ACTUAL injected prompt text from a sample profile (node, no live-localStorage seeding) — coach block reads as a coach who knows the student, proofread block is thin + honesty-guarded, cold-start injects nothing. App compiles (Vite HMR) + mounts.

Adversarial review (3 lenses × 2-skeptic refutation) found 3 real defects, all fixed in 66/review and on the design principle:
- **(med)** the same rule could land in BOTH `focus` and `wins` on profile drift (open+graduated) → coach would accuse AND congratulate one weakness in a single block; the distiller now excludes any open-weakness name from wins (open state wins over celebrate state).
- **(low)** `distillFocusNote` didn't dedup `distinctForms` ("he go, he go") → now Set-deduped like its siblings.
- **(low)** the watch-list rendered with no usage discipline → added a silent-anticipation clause (on the radar, never recited).
- Rejected correctly: routing "improving" weaknesses to wins (still open → premature celebration).

**383 tests** (+12 over the §65 baseline: 7 distiller + 5 chat/proofread), full suite green.

---

## 67. UPDATE — 23 June 2026 — Critique covers EVERY sentence (match the gold standard)

*(Numbering: the task brief labelled this §63; the log is past it — lands as §67.)*

The gold Opus critique did all 15 sentences of a draft (each numbered, flaw+reason+fix; the unparseable one flagged + asked; then ALL logic leaps; then one task). Gemini sampled 6 sentences and bailed to the logic pass. Three causes, all fixed (commit per fix).

### 67.0 Step-0 diagnosis (all three)
- **What let it sample:** the §48 block said *"Take the FLAWED sentences one at a time"* — it only mandated covering flawed sentences, never numbering EVERY sentence. So the model picked a handful. (The "COMPLETE sweep, never a sample" line one above was undercut by the operative per-sentence instruction.)
- **Old token value:** the coaching call passed **maxTokens 4096** with **thinkingBudget 4096** (chat_coaching route). Thinking counts toward maxOutputTokens, so thinking could consume the whole cap → the visible sweep truncated after ~6 sentences.
- **Where the name leaked:** `antiBiasPrefix` (= `ANTI_BIAS_BLOCK`) is appended to the coaching prompt ONLY inside `if (savedSkills.length || appliedSkill)` (lyra.jsx ~623-645). A plain critique with no attached skill had NO anti-bias guard, and the §48 block didn't forbid named authors → the model invented "Maxine Eggenberger".

### 67.1 Fix A — force numbered every-sentence coverage (`lyra-brain.js`)
Rewrote the §48 coverage instruction to MANDATE completeness: number the draft 1..N, account for EVERY sentence in order, each on its own numbered line — no sampling, no "main ones", no batching, no early wrap to reach the logic pass ("a 15-sentence draft gets 15 numbered lines; if you stop before the last sentence you have failed the task"). Clean sentence → marked clean explicitly ("Sentence 7 — this one's fine"); unparseable → flag + best-guess + ask (unchanged). Silent pre-output gate now counts numbered lines against the sentence count. All existing rules intact (grouping ban, logic pass, correction-vs-taste, no-rewrite, EN-primary, no scaffolding leak).

### 67.2 Fix B — raise maxTokens so the full sweep can't truncate (`ai-router.js`, `lyra.jsx`)
Added `maxTokens` to the route config: **chat_coaching 16384**, scaffolding 8192 (both with margin over their 4096 thinking budget); the call now uses `chatRoute.maxTokens`. Single generous ceiling (output only bills when used; streaming covers UX) rather than app-side intent detection.

### 67.3 Fix C — never name a real writer in critique (`lyra-brain.js`)
Put the no-real-author rule in the critique block itself (always on the critique path, not gated on skills like `antiBiasPrefix`): NO REAL AUTHORS — never name/invoke a real writer or attribute a technique to one; lead with strengths by praising the student's OWN moves, never "very Hemingway"; only the anonymous Writer A/B labels from the student's own Style Lab cards are allowed.

### 67.4 Validation (live model, real prompt + new budget)
Ran a faithful 15-sentence AI-debate draft (planted flaws, an unparseable sentence 3, an oversized-metaphor size-mismatch, a two-tangled-arguments seam) through the real `buildCoachPrompt` → proxy → `gemini-3-flash-preview` at maxTokens 16384 (no live-browser-session interference). Result: **15 / 15 sentences covered**, each numbered with flaw→reason→fix; clean ones marked "This sentence is fine" (4, 9, 11, 15); sentence 3 flagged "I cannot fully decode this… my best guess is… does that match?"; logic pass named Size Mismatch (s7), Two Tangled Arguments (s8), Missing Causal Bridge (s10→11), each with both repair directions; **no real author names**; reached the hand-back task (not truncated); 繁中 as support glosses, no scaffolding leak. The two-passes-separate design held — sentence 11 was grammatically "fine" yet flagged in the logic pass as the overgeneralization.

### 67.5 Verified
Three commits (coverage / anti-bias / budget). **387 tests** (+4: every-sentence mandate, no-real-author, 2 budget), full suite green; app compiles + mounts; live critique validation above. The §48 sample failure is closed.

---

## 68. UPDATE — 23 June 2026 — Critique stops leaking its own pass/step labels

The §67 validation run happened to come back clean, but a real run leaked internal scaffolding into the student-facing reply: a bold **"Sentence-by-Sentence Pass"** header, a **"Flag + Ask:"** label (and on softer runs a **"Sentence-by-sentence feedback"** header). The §54/§67 OUTPUT ban already listed the pass names, yet the model still echoed them — and "Flag + Ask" was never banned. Everything a model emits is read directly by a 14-year-old; no scaffolding may leak (NON-NEGOTIABLE #4).

### 68.1 Root cause
The prompt's OWN ALL-CAPS label tokens are echo magnets: the instruction wrote the unparseable step as "FLAG + ASK" and titled sections "SENTENCE-BY-SENTENCE…" / "LOGIC PASS", and nothing forbade a heading ABOVE the numbered list — so the model mirrored them as bold student-facing headers/labels. A static ban that merely names the forbidden strings loses to a strong in-prompt template.

### 68.2 Fix (`lyra-brain.js`)
- Removed the ALL-CAPS "FLAG + ASK" step-label from the instructions (now lowercase "flag it and ask"), so there is no label token to mirror; the unparseable note is modelled as plain speech ("Sentence 3 — I can't fully decode this one; my best guess is…").
- The sentence pass must begin DIRECTLY with "1." — NO heading/title/bold label above the numbered list (the numbers ARE the structure), at most one plain lead-in line.
- The logic pass opens with a plain spoken transition, never a "Logic Pass" label/title.
- OUTPUT ban strengthened + generalised: any ALL-CAPS / label-shaped token here is FOR YOU not the student; no bold-faked headers; the phrases "Sentence-by-Sentence" and "Logic Pass" must not appear in the reply in ANY form ("…Pass", "…feedback", bold title); explicit DON'T→DO example. "Flag + Ask" added to the banned list.

### 68.3 Verified
Before: 1 leak in 2 live runs ("Sentence-by-Sentence Pass" + a soft "feedback" header). After: **4 / 4 live runs clean** — no sentence-by-sentence / logic-pass / flag-ask token in any form, no markdown headers, no author names, full 15/15 coverage retained; the model now opens with "Let's go through your sentences one by one:" and goes straight into "1.". **388 tests** (+1 leak-ban test).

---

## 69. UPDATE — 24 June 2026 — A re-mark request re-runs the FULL sweep, even mid-session

Reported: a "mark my whole essay" turn came back as a short stance-tip + one grammar fix instead of the §67 every-sentence sweep. The pasted output ("I love that you've KEPT your black hole and athlete's-pace images…") shows it was a FOLLOW-UP after a prior critique — so the model handed back a single next-step (the §48 CLOSE move) instead of re-marking the revised draft.

### 69.1 Diagnosis (honest: could NOT reproduce)
Tried to reproduce the short reply across **13 live runs / 5 scenarios** — single-turn explicit mark, with conversation history, prior-critique history + a soft "check it", §66 growth-profile injected, and **HKDSE exam rules active** (the most promising lead, since the output fixated on stance). **All 13 gave the full 15/15 sweep.** The failure is nondeterministic; the §67 mandate is robust in every harness I could build. Latent risk identified in the code regardless: `buildCoachPrompt`'s "RESPONSE LENGTH" caps a "draft attempt" at 80–120 words, which can classify a whole-essay submission as a short turn and compete with the §48 full sweep; and nothing told the model that a follow-up re-mark should re-sweep rather than hand back one step.

### 69.2 Fix (prompt reinforcement — user chose "always re-run the full sweep on a re-mark")
- **`lyra-brain.js` §48 GATE:** added "RE-MARK = A FRESH FULL SWEEP, EVERY TIME" — a whole-draft mark / check / "mark again" / "is it better now?" re-runs the COMPLETE every-sentence sweep on the CURRENT draft, EVEN as a follow-up after an earlier version was marked; the "hand back ONE thing" CLOSE is never a substitute for the sweep; applies on turn 1 and turn 10 identically. (Only a question about ONE specific part stays focused.)
- **`prompts.js` buildCoachPrompt:** a FULL-DRAFT CRITIQUE carve-out at the top of RESPONSE LENGTH that OVERRIDES the short-reply word-caps and disambiguates the small "draft attempt" rows from a whole-essay marking.

This is REINFORCEMENT (the failure was never captured), not a fix validated against a repro — stated plainly so the record is honest.

### 69.3 Verified
**4 / 4 live runs** of the realistic failing shape (follow-up re-mark after a prior critique + HKDSE exam rules + soft "is it better now? check the whole thing again") → full **15/15** sweep, no scaffolding leak, ~640–840 words each. **390 tests** (+2: §48 re-mark clause, buildCoachPrompt cap-override). If a short reply recurs, the exact student message is needed to capture the precise trigger.

---

## 70. UPDATE — 25 June 2026 — Save a chat critique's grammar fixes to the Grammar Log (one tap)

The sentence-by-sentence critique gives grammar corrections in the chat, but they only reach the Grammar Log via the hidden `LYRA_LEARNING_DATA` auto-sync — which the model often omits on a long 15-sentence sweep (lyra.jsx already had a "when the AI forgets the hidden block" backstop). So the fixes the student SEES in chat were not getting saved. Added a visible per-message button to save them.

### 70.1 Parser — `parseChatGrammarFixes` (`chat-actions.js`, pure + tested)
Pulls the `N. <original> → <correction> (explanation)` lines out of a critique message. Line-based, tolerant: handles `**bold**` and `"quotes"` (straight + curly) around either side, `→`/`becomes` as the arrow; SKIPS lines with no arrow — a clean "this one's fine" or an unparseable "I can't decode this" — and same-text no-change lines; dedups by phrase+correction; derives a Grammar-Log card title (rule) from the EN/繁中 explanation via a conservative keyword map (agreement / tense / plural / article / possessive / preposition / spelling), default "Grammar fix". Returns `[]` on a normal coaching turn.

### 70.2 UI — `GrammarFixSaver` (`ChatTab.jsx`)
A button under any AI message that carries parseable fixes: "+ Save N grammar fixes to Grammar Log" → "✓ Saved N to Grammar Log" (memoised on `message.text`, idempotent via `message.savedToGrammarLog`, hidden entirely on a normal turn). No emoji in chrome; mobile-friendly chip styling.

### 70.3 Wiring — `onSaveCorrections` (`lyra.jsx`)
Maps the parsed fixes → Grammar-Log entries with the SAME shape as the proofread/coaching sync (rule, phrase, correction, explanation, topic, `source:"coaching"`) and the SAME phrase|correction dedup, so a re-tap or overlap with the auto-sync can't duplicate; flashes the log badge (`checkFlash`).

### 70.4 Verified
Bundled parser confirmed **in-browser** (dynamic import → 2 fixes parsed from a mixed quote/bold/繁中 sample, unparseable + clean lines skipped, rule names derived). The button rendered **live on the user's real HKDSE critique** as "+ Save 14 grammar fixes to Grammar Log" (14 parsed) — real end-to-end proof of parser + prop chain + conditional render; not clicked, to avoid writing to the user's real Grammar Log unprompted. No console errors, app mounts. **392 tests** (+2 parser tests).

### 70.5 Bug fixes — raw markdown leak + 8 review findings
The user saved fixes and the Grammar-Log card showed raw `**agreement**` (markdown asterisks) in the explanation: the parser kept the bold markers and the card renders plain text. Fixed (strip bold), then ran a 3-lens × 2-skeptic adversarial review of the whole §70 path which surfaced 8 confirmed defects — including a HIGH-severity miss the user's screenshot (a one-arrow line) had masked:
- **(high)** The CANONICAL §67 sweep line has TWO arrows — `original → reason → fix` (lyra-brain.js:217) — but the parser split on the FIRST arrow, so the green "correct" pill got reason-blob + a raw `→` + the real fix, and the explanation was empty. Now splits on EVERY arrow: first=original, last=fix, middle=reason→explanation.
- **(med)** Outlines (`1. Introduction → hook the reader`) parsed as fixes and the Save button appeared on plan turns → gate: real critiques double-quote or **bold** the sentence; outlines don't → skip.
- **(med)** A flagged-undecodable line whose best-guess contained an arrow became a junk fix → skip by phrase.
- **(med)** A nested-paren reason / period-after-`)` leaked into the correction → greedy trailing-`(reason)` + tolerant of sentence-final punctuation.
- **(low)** single `*`/`` `code` `` survived the strip → now removed; topic mid-word `slice(0,60)` → word-boundary `truncate()` (also the §59 proofread sibling); the success badge flashed even when dedup added 0 (a §69 re-mark) → flash gated on genuinely-new entries.

Verified in the live bundle: two-arrow → clean fix pill + reason in explanation; outline → 0 fixes; the original one-arrow card still clean. **397 tests** (+5).

### 70.6 Render-layer cleanup (legacy entries)
The §70/fix cleaned only NEW saves; entries saved before it kept raw `**` in the stored data and still rendered with literal asterisks (and a mid-word "From: …Module: Lea"). Fixed at the DISPLAY layer in `GrammarLog.jsx`: each shown field runs through `clean()` (stripMd + backtick strip), and the topic through word-boundary `truncate()` — cleans EVERY card, legacy + new, no data migration. Verified on the user's real entry (no `**`, clean "From: HKDSE … (Part B)…").

---

## 71. UPDATE — 25 June 2026 — Grammar fixes out of the Achievements tab

Per the user: **Achievements** are for SKILLS the student earned through practice (techniques, structures, vocabulary, before/after wins) — NOT grammar corrections, which belong in the Grammar Log. The `AchievementCard` (`StyleLab.jsx`) rendered a "4 · Grammar & Proofreading" section from `report.grammar`, so grammar fixes appeared in the Achievements tab.

**Fix:** removed that render section (display-only → cleans existing AND new cards). Deliberately KEPT `report.grammar` in the stored masterclass-report data — the Continuous Growth Report's `consolidateMistakes` / `buildDelta` read it to track mistakes over time, and practice-chat grammar lives only there; deleting it would break the Growth Report. The Achievements trigger was already skill-based (an authentic growth / before-after win, never grammar alone), so nothing creates a grammar-only Achievement. Verified live (fresh server): no "Grammar & Proofreading" in the DOM, clean console, app healthy. **397 tests**.

---

## 72. UPDATE — 25 June 2026 — Grammar critiques fully out of Achievements (freeform + grammar-rule-titled)

§71 was incomplete: a grammar critique the student saved via "★ Save this turn" landed in Achievements as a FREEFORM `reportText` card (headline "Writing win", body = the whole sentence-by-sentence sweep) — §71 only removed the structured `report.grammar` section. Inspecting the user's real store (`lyra-masterclass-reports`, 10 entries) also surfaced a STRUCTURED report headlined "Subject-verb agreement" — a grammar rule masquerading as a skill.

**Fix (`report-utils.js`, the `groupAchievements` chokepoint — covers card list + tab count, legacy + new):**
- `isGrammarCritiqueText(text)` — a message with ≥2 numbered "original → correction" lines is a grammar sweep, not a skill.
- `isGrammarOnlyReport(r)` — that, OR a report whose headline IS a grammar rule (`GRAMMAR_RULE_LABEL`: subject-verb / agreement / tense / articles / plural / possessive / preposition / spelling / …) with no real writing-skill structure.
- `groupAchievements` skips `isGrammarOnlyReport(r)`; `saveMasterclassReport` also refuses to STORE a freeform critique (no growth-report value — its grammar is already in the grammar-log). `report.grammar` data is otherwise KEPT (display-side filtering only; no Growth-Report breakage).

Verified on the user's real store: **6 → 4 achievements** (the freeform "Writing win" critique and the "Subject-verb agreement" card filtered out; the 4 real skills — Analogy, Logical Imagery, The Helpful Professional, Painted Style Pictures — remain). **398 tests** (+1).

**Flagged, not fixed (separate concern):** one remaining achievement is titled "Analogy / **Maxine Eggenberger** style" — a real/hallucinated author name leaked into stored achievement data (the §67 anti-bias leak, from before that fix). Surfaced to the user for a decision (strip author names from achievement titles? delete the card?) rather than silently expanding scope.

---

## 73. UPDATE — 26 June 2026 — Grammar-Log "From:" line: full title, collapsed by default

The user flagged the "From: HKDSE English Language Paper 2 (Part B)…" line THREE times. The first two fixes (markdown strip §70.6, word-boundary truncate) treated symptoms. Reading the actual data finally showed the root cause: the writing's TITLE *is* the entire exam prompt — `generateTitle` produced "Exam Essay — HKDSE … [the whole 120-word brief]". There is no short title; a fixed truncation always looks broken. The user's ask: **full title available, but collapsed by default** ("full title but collapsed form").

**Fix (`GrammarLog.jsx` + `lyra.jsx`):**
- The "From:" line is collapsed by default ("…▼ more") and expands to the full title on tap ("▲ less") — a small `expandedFrom` Set keyed by entry id. No permanent mid-word "…".
- It resolves the SOURCE writing's title LIVE rather than copying a 120-word title into every grammar entry: a new entry stores `writingId: activeWritingId`; a legacy entry (no id) is matched to the current writing when its stored topic is a prefix of the live topic. Falls back to the stored 200-char topic snippet for entries from other writings.
- `lyra.jsx` passes `currentTitle` / `currentTopic` / `currentWritingId`; the §70 (chat-save) and §59 (proofread) grammar entries store `writingId` + a topic snippet instead of the duplicated/truncated title. Dropped the now-unused `truncate` import (orphan cleanup).

Verified live on the user's real entry: collapsed "From: Exam Essay — HKDSE English Language Paper 2…▼ more"; expand reveals the full title and ends cleanly (no "…"); tap toggles both ways; no console errors. **398 tests**.

---

## 74. UPDATE — 26 June 2026 — Copy button on every chat bubble (student + Lyra), sticky while scrolling

Two asks: a Copy button on the STUDENT'S messages too (it was Lyra-only, in the §53 bottom row), and the Copy button reachable wherever you scroll a long message (Claude-style), on both sides.

**Fix (`ChatTab.jsx`):**
- Every message bubble (role user AND ai) now has a Copy button pinned **top-right** with `position: sticky; top: 6` (floated right) so it stays visible as you scroll through a long message, instead of being buried at the message's bottom. White-on-gradient on the student bubble, muted on Lyra's card; reuses `handleCopy` → `copyToClipboard` (secure-context + the §53 insecure-context `execCommand` fallback) with the ✓ feedback.
- Removed the now-redundant Copy from the AI bottom action row; that row keeps Translate · Reload.

Verified live: the copy button renders on both `user` and `ai` bubbles (3 on the current thread), computed `position` is `sticky`, click fires with no console error. The actual clipboard write + ✓ can't be demonstrated headlessly (no real user-activation/focus — same known limitation as §53), but it's the same helper already working on-device for the Lyra copy. **398 tests**.

