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
**309 tests green** (7 tab-history reducer tests — push/dup-collapse/cap, pop/empty-null, exit-predicate — replacing §45's view-stack tests). `vite build` clean; the `:3002` dev server transforms the updated `StyleLab.jsx` at runtime with **no error** (the §45.2-class runtime check). **Not driven live:** the click-through / on-device back-gesture — the Chrome automation extension was offline — so the manual walk is the final confirmation to do on the phone: Achievements → Report → ← → Achievements; keep pressing ← to empty the stack then exit; the exit lands on the correct underlying screen (active writing vs start); direct tab jumps retrace the real path; reopen → history is fresh; the ← is small (no big label crowding the header). Committed per part: Part 1 `d5c067e`, Part 2 + this report to follow.

