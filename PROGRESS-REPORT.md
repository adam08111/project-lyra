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

## 18. UPDATE — 1 June 2026 — Branch `claude/objective-ramanujan-974c10` (cont.)

Three commits this session — a test-suite repair plus a run of Style Lab / X-Ray analysis fixes surfaced while previewing the app live.

### 18.1 Test suite realigned to shipped behaviour (commit `0c7a6e6`)

The suite had 9 stale failures asserting removed behaviour. `tests/api.test.js` still tested the OLD Anthropic `callAI` (api.anthropic.com, `claude-sonnet-4-6`, `content:[{text}]`, `web_search_20250305`) instead of the live `/api/gemini` proxy client; `tests/prompts.test.js` asserted pre-redesign wording (PEEL, "stronger hint with vocabulary", an exact "Do NOT give a fill-in-the-blank template" string). Rewrote api.test.js for the Gemini-proxy `callAI` (request shape, text/empty/sources returns, model/thinkingBudget/signal forwarding, SSE streaming path) and updated the 4 stale prompt assertions to the current 4-element body structure + Socratic/no-template hint. **105/105 green; `vite build` clean.** (App code was already correct — the tests had simply lagged the Gemini migration + prompt redesign.)

### 18.2 "NOT SUITABLE FOR" bullet leak (commit `02345dd`)

The saved-skill "When to use" card showed a dangling `NOT SUITABLE FOR:` label. Root cause: the PERFECT-FOR bullet parser `•[^•]+` greedily swallowed the trailing NOT-SUITABLE-FOR section into the last bullet. Fixed at the source (`saveStyleSkill` cuts the section at "NOT SUITABLE FOR" before extracting bullets), at render (`SavedSkillDetail` strips it so existing skills display cleanly without re-analysing), and in the Style Lab "Use It" tab.

### 18.3 Selectable section count, 1–9 (commit `3551163`)

Students now choose how many style-profile sections the X-Ray generates. `styleProfilerPrompt` (a static const) became `buildStyleProfilerPrompt(n)`, which emits ONLY the first N of the 9 sections in order (techniques 1–7, then When-to-use, then Signature) and stops. A 1–9 chip selector lives on the Source step and the Style Lab Analyse tab (default 9 — behaviour unchanged unless lowered). `tests/lyra-brain.test.js` updated for the rename.

### 18.4 LYRA_LEARNING_DATA leak in analysis output (commit `3551163`)

LYRA_BRAIN instructs the model to append a hidden `<!--LYRA_LEARNING_DATA …-->` block on coaching turns; it sometimes appended it to the X-Ray analysis too, where the analysis flow (unlike the chat) never stripped it — so raw JSON leaked into the last WRITER'S WORDS card. Added `stripLearningData()` to `learning-sync.js`, applied in both analysis flows (streaming + final, so saved skills are clean) and as a defensive strip inside `parseSectionContent` (covers older analyses + saved skills at render).

### 18.5 "Analyse new text" button + technique picker (commit `3551163`)

- The analysis result gained an **"Analyse new text"** button (`resetAll`) so students can clear and paste a fresh article without hunting for the top-right "New analysis".
- `SavedSkillDetail`'s **"Practice"** now enters a selection mode: a circle appears on each technique card (descriptions stay visible), the student ticks which to drill, and **"▶ Practise (N)"** launches a session containing only those (a partial selection gets its own progress/chat id namespace). Circles are hidden until Practice is pressed; per-card edit/remove/single-practise hide during selection.

### 18.6 anonymiseSkillsForAI regex crash (commit `3551163`)

`replaceAuthor` built `new RegExp(authorName, 'gi')` without escaping, so a name containing regex metacharacters — e.g. "Alaina Demopoulos (The Guardian)", whose last word is "Guardian)" — threw "Invalid regular expression" and broke exercise generation + the stuck-chat for that skill. Now escapes metacharacters first. (Known minor: for parenthetical names the bare surname can still leak in the anonymisation — cosmetic, not a crash.)

### 18.7 Files changed (Section 18)

| File | Status | Purpose |
|---|---|---|
| `tests/api.test.js` | REWRITTEN | Gemini-proxy `callAI` coverage (replaces stale Anthropic assertions) |
| `tests/prompts.test.js` | UPDATED | 4 stale assertions → 4-element body structure + Socratic/no-template hint |
| `tests/lyra-brain.test.js` | UPDATED | `styleProfilerPrompt` → `buildStyleProfilerPrompt()` |
| `src/prompts.js` | UPDATED | `styleProfilerPrompt` const → `buildStyleProfilerPrompt(n)` with first-N-sections directive |
| `src/learning-sync.js` | UPDATED | new `stripLearningData()` helper |
| `src/utils.js` | UPDATED | escape regex metacharacters in `anonymiseSkillsForAI` / `replaceAuthor` |
| `src/components/SourceSetup.jsx` | UPDATED | section-count selector; strip leaked learning-data on analysis (stream + final) |
| `src/components/StyleLab.jsx` | UPDATED | section-count selector; NOT-SUITABLE-FOR strip; "Analyse new text"; technique-selection Practice; learning-data strip |
| `src/components/XRayView.jsx` | UPDATED | `saveStyleSkill` NOT-SUITABLE-FOR cut; `parseSectionContent` strips leaked learning-data/HTML comments at render |

**Verification this session:** `npx vite build` ✓ (54 modules) and `npx vitest run` → **105/105** after each change; the `anonymiseSkillsForAI` fix verified by running the real function on a Guardian-byline name (no throw, correct anonymise/restore). UI changes confirmed via the live preview where reproducible; not seeded into the preview's localStorage (a separate sandbox) after an earlier incident where a test-seed looked like data loss.

