---
doc: spec
status: approved
---

# Intervue — Technical Spec

Method note: the learner chose to rebuild on the same stack as their existing Intervue repo (https://github.com/wakkaduu/Intervue), with a fresh Supabase project and the same schema, reusing the 52-track question file. File names and behavior below come from that repo and are the reference for the rebuild. Versions are from its `package.json` and should be re-verified at install (see Decisions and Open Issues).

## How This Works, In Plain Language
Intervue is a website with two halves.

- **The browser half (the front end)** is what people see: the Home card, the interview screen, the results, the history chart. It runs in the person's browser. It listens to the microphone and shows a live transcript using the browser's own speech tools, and the interviewer's voice also uses the browser's built-in speech.
- **The server half (the back end)** is a set of small "doors" in your own app (called API routes, such as `/api/review`). The browser sends something through a door and gets a reply. The doors check the request, hold the secret keys, and talk to outside services.
- **Outside services:** Gemini (and Groq as a backup) read the answer and write the review. Supabase is the online spreadsheet where accounts and saved sessions live. Gmail (via nodemailer) sends confirmation emails. Google and GitHub confirm who you are when you sign in with them.
- **Where the secret keys live:** only on the server, in a git-ignored `.env.local`. The browser never sees an AI key.
- **Guests vs accounts:** a guest's history sits in the browser's own sticky note (`localStorage`). A signed-in person's history is saved in Supabase, so it follows them across devices.

Why this shape: it is the stack the learner already knows from the first build, and it keeps keys safe. The risky part is the number of outside services, so the build order is core first (Next.js, Gemini, Supabase) and the rest are added one at a time.

## The Core Journey Through the System
PRD ref: `prd.md > The Core Journey`.

1. **Home** — the page reads the track list from the question file and the last-used mode from `localStorage`. The user picks a track and mode and presses Start. The browser goes to `/interview?category=…&mode=…`.
2. **Voice setup / interview** — the page loads that track's questions. Voice mode uses the browser's speech recognition for the live transcript, and falls back automatically to recording audio when live captions are unavailable. The draft autosaves to `localStorage` as they type or speak.
3. **Each answer** — when they move on, the browser sends the question, answer, track, and earlier feedback points to `POST /api/review`. The server validates it, builds the prompt, calls Gemini (then Groq, then the built-in basic grader if both fail), and returns the structured review. This runs while they answer the next question. Delivery metrics (words per minute, fillers) are computed in the browser from the transcript and timer.
4. **Fallback transcription** — if the browser cannot transcribe, the recorded audio is sent to `POST /api/transcribe`, which uses Groq Whisper or Gemini.
5. **Results** — after the last question the summary page averages the scores, then calls `POST /api/review/summary` for the AI debrief across all answers.
6. **Saving** — the session is saved: signed-in users through `POST /api/history` into Supabase, guests into `localStorage`. A guard prevents duplicate saves.
7. **History** — `GET /api/history` (signed in) or the guest store feeds the trend chart, which plots each session's average score and states the change since the first session.

## Stack
Versions from the existing `package.json`; re-verify at install.

- **Next.js ^16.2 (App Router) + React ^19 + TypeScript ^5** — pages and API routes in one project. [docs](https://nextjs.org/docs)
- **Tailwind CSS ^3.4** — styling with the green/sage/gold tokens. [docs](https://tailwindcss.com/docs)
- **Auth.js / next-auth ^5 beta** — email/password (credentials), Google, GitHub, Facebook. [docs](https://authjs.dev)
- **bcryptjs ^3** — hashing passwords.
- **Supabase (`@supabase/supabase-js` ^2)** — hosted Postgres for users and sessions. [docs](https://supabase.com/docs)
- **Gemini (`@google/generative-ai` ^0.24)** — review, debrief, and transcription fallback. [docs](https://ai.google.dev/gemini-api/docs)
- **Groq** — second reviewer and Whisper transcription. [docs](https://console.groq.com/docs)
- **nodemailer (SMTP)** — confirmation emails, sent through Gmail with an app password or any SMTP service. [docs](https://nodemailer.com/)
- **Vitest + Testing Library** — tests. [docs](https://vitest.dev)
- **Inter** font via `next/font`.

Learner-chosen: "rebuild the same stack." Accepted tradeoff: many accounts and keys, mitigated by core-first build order.
Dropped: a text-to-speech package that the old `package.json` listed but never imported, and the old repo's demo-video folder, which is not rebuilt. The interviewer voice uses the browser's Web Speech API.
Unverified: current Gemini and Groq model names (`GEMINI_MODEL=gemini-flash-lite-latest`, `GROQ_MODEL=openai/gpt-oss-120b`), and whether `next-auth` v5 beta works with the Next version at install. Check these first in the build.

## Where It Runs and How Someone Tries It
- **Runtime:** Node.js (the old project ran on v24) with `npm install`, then `npm run dev`, then open http://localhost:3000.
- **Keys needed (in `.env.local`, never committed):** `GEMINI_API_KEY`, `GROQ_API_KEY`, `AUTH_SECRET`, `AUTH_GOOGLE_ID/SECRET`, `AUTH_GITHUB_ID/SECRET`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SMTP_USER`, `SMTP_PASSWORD` (optional `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `EMAIL_FROM`), `GEMINI_MODEL`, `GROQ_MODEL`, `AUTH_TRUST_HOST` (for production builds), optional `AUTH_FACEBOOK_ID/SECRET`, `GEMINI_TTS_MODEL`, `GEMINI_TTS_VOICE`. The repo ships only `.env.example` with placeholders.
- **Database setup:** run `supabase/schema.sql` in a fresh Supabase project's SQL editor.
- **Demo recording:** run locally and record: pick a track, answer by voice and in writing, show a review, the results/debrief, and the history chart with a few sessions. Works in Chrome (best speech support).
- **Submission:** a short demo video and a public GitHub repo are required. Vercel deployment is optional and planned by the learner after the app works; it does not replace the video.

## Look and Feel
Carried from `prd.md > Look and Feel`; no new design discovery.
- Colors: forest canvas `#23382B`, forest `#344E41` for primary buttons, sage `#E2ECE5` for cards, emerald for accents, gold `#E69F00` for highlights, dark slate `#1F2933` for body text.
- Typography: Inter.
- Energy: calm, encouraging coach. Score verdict labels are honest but never "you failed".
- Constraints Tailwind can honor: all of the above through `tailwind.config.ts` tokens. Contrast must meet WCAG AA with visible keyboard focus; layouts work from 320px.

## Components
### Home and track picker
Focal start card, mode toggle, searchable picker of 52 grouped tracks. Files: `app/page.tsx`, `components/CategorySidebar.tsx`, `CategoryCard.tsx`, `context/SidebarContext.tsx`, `lib/questions.ts`. PRD ref: `prd.md > Track and mode selection`.

### Interview screen
One question at a time, timer, autosave, read-aloud, voice setup and mic check. Files: `app/interview/page.tsx`, `hooks/useInterviewSession.ts`, `components/QuestionDisplay.tsx`, `MicCheck.tsx`, `TranscriptArea.tsx`, `InterviewerVoiceControls.tsx`, `lib/session-draft.ts`. PRD ref: `prd.md > Answering by voice`, `Answering in writing`.

### Speech in the browser
Live transcript, recording, text-to-speech. Files: `hooks/useSpeechRecognition.ts`, `hooks/useAudioRecorder.ts`, `components/VoiceAnswer.tsx` (one Start button: live captions, or audio recording transcribed on Stop when captions are unavailable), `lib/speech-synthesis.ts`, `lib/interviewer-voice.ts`. When a browser has no voice of its own (for example Brave on Linux), the question is read by the server voice: `lib/server-voice.ts`, `lib/tts.ts`, `app/api/speak/route.ts` (Gemini text-to-speech, restricted to questions in the bank, cached and fetched ahead). PRD ref: `prd.md > Answering by voice`, `Interviewer voice`.

### Delivery feedback
Words per minute, pace label, filler words. Files: `lib/speech-metrics.ts`, `components/LiveDeliveryHUD.tsx`. PRD ref: `prd.md > Delivery feedback`.

### AI review service
`POST /api/review` validates, rate-limits, builds the prompt, and runs the provider chain. Files: `app/api/review/route.ts`, `lib/evaluator.ts`, `lib/gemini.ts`, `lib/groq-llm.ts`, `lib/validation.ts`. PRD ref: `prd.md > AI review and follow-up`, `Multiple AI providers with fallback`.

### Debrief
`POST /api/review/summary` writes the debrief across answers. Files: `app/api/review/summary/route.ts`, `lib/debrief.ts`, `lib/debrief-evaluator.ts`, `components/SessionDebriefCard.tsx`. PRD ref: `prd.md > Results and debrief`.

### Transcription fallback
`POST /api/transcribe`. File: `app/api/transcribe/route.ts`. PRD ref: `prd.md > Answering by voice`.

### Results and feedback display
Files: `app/summary/page.tsx`, `components/FeedbackPanel.tsx`, `ScoreRing.tsx`, `SessionSummaryCard.tsx`, `lib/score-verdict.ts`. PRD ref: `prd.md > Results and debrief`.

### History and chart
Files: `app/history/page.tsx`, `components/ScoreTrendChart.tsx`, `lib/progress-trend.ts`, `app/api/history/route.ts`, `lib/session-save.ts`, `lib/guest-storage.ts`. PRD ref: `prd.md > History and progress chart`.

### Accounts and sign-in
Credentials, Google, GitHub, Facebook (each social button works once its keys are set); email confirmation code with resend; rate limiting. Files: `auth.ts`, `app/login/page.tsx`, `components/AuthForm.tsx`, `SocialSignIn.tsx`, `AuthProvider.tsx`, `app/api/auth/*` (nextauth, register, confirm-email, resend-confirmation, providers-available), `lib/db.ts`, `lib/supabase.ts`, `lib/email.ts`, `lib/security/*`. PRD ref: `prd.md > Accounts and saved history`, `Email sign-up with confirmation`.

### Shared UI, PWA and layout
Files: `components/ui/Button.tsx`, `PasswordInput.tsx`, `AppHeader.tsx`, `ErrorMessage.tsx`, `LoadingSpinner.tsx`, `app/layout.tsx`, `app/manifest.ts`, `public/`. PRD ref: `prd.md > Shared button/UI system`, `PWA support`.

## Data Model
**Supabase (fresh project, `supabase/schema.sql`):**
- `users` — id, name, email (unique), password_hash, image, email_verified, confirmation_code_hash, confirmation_code_expires, confirmation_attempts, created_at. Updated at sign-up, confirmation and OAuth sign-in. Persists permanently.
- `interview_sessions` — id, user_id, user_email, category, mode, average_score, question_count, entries (JSONB: question, answer, feedback, duration per answer), created_at. Written once when a session completes; read for History.
- The old schema pre-seeds a public demo account with a known password. The rebuild omits that seed because the repo is public.

**Browser storage (sticky notes):**
- `intervue_last_mode` — last Voice/Written choice; survives return visits.
- `intervue_session_draft_v1` — in-progress answers; expires after 24 hours; never overwritten by an empty draft.
- `intervue_guest_sessions` — guest history; lives only in that browser.
- `intervue_interviewer_muted` and `intervue_interviewer_speed` — read-aloud preferences.

**Questions:** `data/questions.json` — 52 tracks, each with 15 questions (the old repo's 12 plus 3 new per track, added in the final review); a session asks 12 of them. Copied from the old repo (learner approved). Read at build time and on the server and client through `lib/questions.ts`.

## File Structure
```
intervue-learn/
├── app/
│   ├── layout.tsx            # Inter font, header, providers
│   ├── page.tsx              # Home: start card
│   ├── manifest.ts           # PWA manifest
│   ├── interview/page.tsx    # Question-by-question practice
│   ├── summary/page.tsx      # Results, debrief, saving
│   ├── history/page.tsx      # Trend chart + table
│   ├── login/page.tsx        # Sign in / sign up / confirm
│   └── api/
│       ├── review/route.ts            # AI review (provider chain)
│       ├── review/summary/route.ts    # AI debrief
│       ├── transcribe/route.ts        # Audio → text fallback
│       ├── speak/route.ts             # Question → spoken audio (server voice fallback)
│       ├── history/route.ts           # Save/load sessions
│       └── auth/ [...nextauth], register, confirm-email, resend-confirmation, providers-available
├── components/               # UI pieces (listed under Components)
│   └── ui/                   # Button, PasswordInput, ErrorMessage, LoadingSpinner, Accordion, SegmentedControl
├── context/SidebarContext.tsx
├── hooks/                    # useInterviewSession, useSpeechRecognition, useAudioRecorder
├── lib/                      # evaluator, gemini, groq-llm, db, supabase, email, validation,
│   │                         # speech-metrics, speech-synthesis, progress-trend, guest-storage,
│   │                         # session-draft, session-save, score-verdict, questions, debrief
│   └── security/             # rate-limiter, validation, confirmation, logger
├── data/questions.json       # 52 tracks (copied from old repo)
├── types/                    # shared TypeScript types, next-auth types
├── public/                   # icons, logo
├── supabase/schema.sql       # tables (no demo seed)
├── auth.ts                   # Auth.js config
├── devpost/                  # Devpost learning workspace
├── .env.example              # placeholders only
├── tailwind.config.ts, next.config.ts, tsconfig.json, vitest.config.ts
└── package.json, README.md
```

## External Services and Dependencies
- **Gemini** — called from `lib/gemini.ts` with the server-held key; request: prompt + JSON response schema; response: structured review fields (score, summary, strengths, areasForImprovement, focusNext, strongerVersion, followUpQuestion, howTheyAnswered, toneAnalysis, questionConnection). Free tier is rate-limited. [docs](https://ai.google.dev/gemini-api/docs)
- **Groq** — chat model as second reviewer and Whisper for transcription; free key, rate-limited. [docs](https://console.groq.com/docs)
- **Supabase** — service-role key used only server-side. Free tier. [docs](https://supabase.com/docs)
- **SMTP (nodemailer)** — sends 6-digit confirmation codes. Defaults to Gmail over SSL with an app password; works with any SMTP service via `SMTP_HOST`/`SMTP_PORT`. Gmail limits daily sends.
- **Google, GitHub and Facebook OAuth** — client ID and secret per provider, with `http://localhost:3000/api/auth/callback/<provider>` as the redirect. [Google](https://console.cloud.google.com/apis/credentials), [GitHub](https://github.com/settings/developers)
- Specific endpoints and response shapes will be verified against current docs at the start of each build step; nothing here implies a lookup has happened.

## Important Failure Modes
- **AI provider slow or down** → each provider gets 12 seconds; after Gemini then Groq fail, the built-in grader answers and the screen says it is "basic feedback". A retry is offered.
- **Microphone denied** → clear message and a typed fallback. **Live captions unavailable or failing** (unsupported browser, unreachable speech service) → the same Start press records audio, which `/api/transcribe` turns into text when you stop. **No browser voice** → the server voice (`/api/speak`) reads the question.
- **Supabase save fails or duplicate save** → the user keeps their results on screen with a notice; saves are idempotent so no duplicate chart points. Guests are unaffected (local storage).

## What Was Simplified and Why
- **Interviewer voice via the browser's Web Speech API, with a Gemini server voice as fallback**, not a paid speech service. The old app never used one, and this avoids the cost. The fallback exists because some browsers (Brave, Chromium on Linux) have the speech API but no voices.
- **No pre-seeded demo account** — it carried a known password in a public repo.
- **AI keys server-only; no user-facing API-key modal** — learner decision; fewer ways to leak a key.
- **Core-first build order** — the extended set (email confirmation, PWA, provider fallback, etc.) comes after the demoable core.

## Decisions and Open Issues
**Learner decisions**
- Same stack as the old repo, if it fits the skill pack rules — accepted tradeoff: many services.
- Fresh Supabase project with the same schema.
- Reuse the 52-track `data/questions.json`.
- AI keys stay server-only.
- Email/password, Google and GitHub sign-in all carry over.

**Derived implementation details (not learner choices):** the file structure, the dropped unused speech package, and omitting the demo-account seed.

**Learner's one uncertainty:** how the AI review happens in the background. Clarified by walking the journey: the browser posts to `/api/review`; the server builds the prompt, calls Gemini then Groq then the basic grader, and returns structured feedback. Check during the build: the review response includes `source` (`ai` or `basic`) and server logs show which provider answered.

**Open / to verify early in the build**
- Current Gemini and Groq model names and rate limits.
- Whether `next-auth` v5 beta and the old `eslint-config-next` (14.x) alongside Next 16 install cleanly; the old repo mixes these.
- Public-repo hygiene: real keys live only in `.env.local`, which is git-ignored. The repo's `.env.example` holds placeholders only, and the full git history was checked for secrets before publishing.
- No unresolved questions remain from `prd.md > Open Questions`.
