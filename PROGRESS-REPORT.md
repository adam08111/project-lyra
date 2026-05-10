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

