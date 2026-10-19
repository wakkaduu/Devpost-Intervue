---
doc: checklist
status: approved
---

# Build Checklist

Build mode: learn

## Slices

- [x] **1. You can answer one question in writing and get a specific AI review**
  Becomes usable: A running app where you type an answer to an interview question and get back a score, what to work on first, a stronger version, a follow-up question, and the interviewer's take, written by Gemini about what you actually said.
  Why now: This is the Unique Kernel and the riskiest unknown (model names, key handling, structured output). It also carries the scaffold, so everything later lands on a working base.
  PRD ref: `prd.md > AI review and follow-up`, `prd.md > Answering in writing`, `prd.md > Look and Feel`
  Spec ref: `spec.md > Stack`, `spec.md > AI review service`, `spec.md > Look and Feel`, `spec.md > File Structure`, `spec.md > Decisions and Open Issues`
  Build: Scaffold Next.js + TypeScript + Tailwind with the green/sage/gold tokens and Inter; re-verify package versions and Gemini model name; copy `data/questions.json`; add `lib/questions.ts`, `POST /api/review` (validation, server-held key, Gemini with JSON schema, `source` field), a shared `Button`, and a minimal page showing one question, a text box, loading and error-with-retry states, and the review. Add `.env.example` with placeholders.
  Verify (mechanical): `npm run build` passes; start dev server; POST a real sample answer to `/api/review` and confirm structured fields and `source: "ai"` that quotes the answer; confirm the key appears nowhere in client output; empty answer is rejected with no AI call.
  Learner check: Open http://localhost:3000, type an answer, and say whether the review feels specific to what you wrote and looks the way you pictured.
  Commit: `Scaffold app and add AI review of a written answer`

- [x] **2. Home with 52 tracks and a remembered mode**
  Becomes usable: A Home page with the start card, searchable grouped track picker, Voice/Written toggle that remembers your last choice, and an inline error if no track is chosen.
  Why now: Entry point of the Core Journey; the session needs a chosen track and mode before it can grow beyond one question.
  PRD ref: `prd.md > Track and mode selection`, `prd.md > Screens and Layout`
  Spec ref: `spec.md > Home and track picker`, `spec.md > Data Model` (`intervue_last_mode`)
  Build: Build `app/page.tsx`, `CategorySidebar`, `CategoryCard`, `SidebarContext`, mode persistence; Start navigates to `/interview?category=…&mode=…`; interview page reads those params.
  Verify (mechanical): Component tests for the picker and mode persistence; build passes; load Home and confirm 52 tracks listed, search filters, start with no track shows the error, mode survives a reload.
  Learner check: Pick a track, switch to Written, reload, and confirm your mode is remembered and Start takes you to that track's questions.
  Commit: `Add Home page with track picker and mode toggle`

- [x] **3. A full multi-question session ending in Results**
  Becomes usable: Answer several questions in order (timer, next/finish, end early), then see the Results page with an average score, a verdict label, and per-answer coaching.
  Why now: Completes the written-answer core loop end to end, so the app is demoable before voice and accounts.
  PRD ref: `prd.md > The Core Journey` (steps 4-7), `prd.md > Results and debrief`, `prd.md > States and Boundaries`
  Spec ref: `spec.md > Interview screen`, `spec.md > Results and feedback display`
  Build: `hooks/useInterviewSession`, `QuestionDisplay`, review-in-background while answering the next question, `app/summary/page.tsx`, `FeedbackPanel`, `ScoreRing`, `lib/score-verdict.ts`, end-early and zero-answer handling.
  Verify (mechanical): Unit tests for average (one decimal), verdict thresholds and zero-answer state; run a 3-question session through the dev server and confirm Results shows the right average and per-answer reviews.
  Learner check: Do a short session, end one early, and check that the Results screen makes sense and feels encouraging.
  Commit: `Add multi-question session and Results page`

- [x] **4. Voice answers with live transcript and delivery feedback**
  Becomes usable: Answer by speaking: live transcript, stop to finalize, words per minute with pace label, filler words, AI tone read, and a typed fallback if the mic is denied or unsupported.
  Why now: Voice is half of the core promise and carries browser-API risk, so it comes right after the written loop works.
  PRD ref: `prd.md > Answering by voice`, `prd.md > Delivery feedback`
  Spec ref: `spec.md > Speech in the browser`, `spec.md > Delivery feedback`, `spec.md > Important Failure Modes`
  Build: `useSpeechRecognition`, `useAudioRecorder`, `TranscriptArea`, `RecordingControls`, `lib/speech-metrics.ts`, max-length auto-stop, denial/unsupported messaging and 3-retry limit, delivery panel in feedback.
  Verify (mechanical): Unit tests for WPM, pace labels and filler counting; build passes; with speech recognition absent confirm the typed fallback appears.
  Learner check: In Chrome, answer one question by voice and confirm the transcript, pace and filler feedback appear; deny the mic once to see the fallback.
  Commit: `Add voice answers and delivery feedback`

- [x] **5. AI debrief across all answers**
  Becomes usable: Results includes a debrief with patterns, best and weakest answer, and what to fix first.
  Why now: Second half of the kernel's insight; reuses the review pipeline, so it is cheap now.
  PRD ref: `prd.md > Results and debrief`
  Spec ref: `spec.md > Debrief`
  Build: `POST /api/review/summary`, `lib/debrief.ts`, `lib/debrief-evaluator.ts`, `SessionDebriefCard`.
  Verify (mechanical): POST a sample session to the route and confirm structured debrief; Results renders it with a loading and error state.
  Learner check: Finish a session and judge whether the debrief tells you what to fix first.
  Commit: `Add AI session debrief`

- [x] **6. Sessions are saved and the History chart works (guest mode)**
  Becomes usable: Every completed session is saved in the browser; History shows a trend chart filterable by track, a table view, and "change since your first session"; duplicate saves create no extra point.
  Why now: Delivers the second half of the kernel (seeing improvement) before accounts add complexity.
  PRD ref: `prd.md > History and progress chart`, `prd.md > Accounts and saved history` (guests), `prd.md > States and Boundaries`
  Spec ref: `spec.md > History and chart`, `spec.md > Data Model` (`intervue_guest_sessions`)
  Build: `lib/guest-storage.ts`, `lib/session-save.ts` with idempotency, `lib/progress-trend.ts`, `ScoreTrendChart`, `app/history/page.tsx`, empty state.
  Verify (mechanical): Tests for trend calculation and dedupe; save the same session twice and confirm one point; build passes.
  Learner check: Complete two sessions and confirm the chart shows two points and states the change since your first session.
  Commit: `Add guest history and progress chart`

- [x] **7. Sign up, sign in, and history that follows your account**
  Becomes usable: Create an account with email/password, sign in, and have sessions saved to Supabase and shown in History across devices.
  Why now: The first external-database integration; the guest flow already works so any failure is isolated.
  PRD ref: `prd.md > Accounts and saved history`, `prd.md > Screens and Layout` (Sign in / Sign up)
  Spec ref: `spec.md > Accounts and sign-in`, `spec.md > Data Model`, `spec.md > External Services and Dependencies`
  Build: `supabase/schema.sql` (no demo seed), `lib/supabase.ts`, `lib/db.ts`, `auth.ts` credentials provider with bcryptjs, `app/login/page.tsx`, `AuthProvider`, `/api/auth/register`, `/api/history`; save and load by account; Supabase save failure keeps results on screen with a notice. Needs the learner's fresh Supabase project and keys in `.env.local`.
  Verify (mechanical): Register and sign in against the real Supabase project; save a session; read it back from `GET /api/history`; a second save of the same session adds no row.
  Learner check: Sign up, finish a session, sign out and back in, and confirm your history is still there.
  Commit: `Add accounts and Supabase-backed history`

- [x] **8. Sign in with Google and GitHub**
  Becomes usable: One-click sign-in with Google or GitHub that lands in the same history.
  Why now: Same auth system, adding providers one at a time; depends on external OAuth setup the learner controls.
  PRD ref: `prd.md > Email sign-up with confirmation` (Google/GitHub carry over)
  Spec ref: `spec.md > Accounts and sign-in`, `spec.md > External Services and Dependencies`
  Build: Google and GitHub providers in `auth.ts`, `providers-available` route, buttons shown only when configured.
  Verify (mechanical): Build passes; `providers-available` reports only configured providers; complete an OAuth sign-in on localhost and confirm a `users` row exists.
  Learner check: Sign in with GitHub or Google and confirm your history appears.
  Commit: `Add Google and GitHub sign-in`

- [x] **9. Email confirmation with a resendable code**
  Becomes usable: New email sign-ups must enter a 6-digit emailed code; resend has a cooldown.
  Why now: Extended set, depends on Resend and the working account system.
  PRD ref: `prd.md > Email sign-up with confirmation`
  Spec ref: `spec.md > Accounts and sign-in`, `spec.md > Data Model` (`users` confirmation fields), `spec.md > External Services and Dependencies` (Resend)
  Build: `lib/email.ts`, `/api/auth/confirm-email`, `/api/auth/resend-confirmation`, hashed code with expiry and attempt limit, confirmation step in the login UI.
  Verify (mechanical): Register, capture the sent code, confirm succeeds; a wrong code increments attempts; an expired or over-attempted code is rejected; resend honors the cooldown.
  Learner check: Sign up with a new email and complete the confirmation.
  Commit: `Add email confirmation codes`

- [x] **10. Backup AI providers and transcription fallback**
  Becomes usable: If Gemini fails, Groq answers; if both fail, a clearly labelled basic grader answers; audio can be transcribed by the server when the browser can't.
  Why now: Resilience for the kernel and the learner's stated uncertainty about the background flow; best tested once the main path is stable.
  PRD ref: `prd.md > Multiple AI providers with fallback`, `prd.md > AI slow or failing`
  Spec ref: `spec.md > AI review service`, `spec.md > Transcription fallback`, `spec.md > Important Failure Modes`
  Build: `lib/groq-llm.ts`, `lib/evaluator.ts` provider chain with 12s timeouts, basic grader, "basic feedback" notice, `POST /api/transcribe`, server logs showing which provider answered.
  Verify (mechanical): Force Gemini to fail (bad key) and confirm `source` falls to Groq; force both and confirm `basic` with the notice; transcribe a sample audio file.
  Learner check: Run a session with the Gemini key temporarily broken and confirm you still get feedback and a notice.
  Commit: `Add provider fallback and transcription route`

- [x] **11. Interviewer voice, mic check and live delivery HUD**
  Becomes usable: The interviewer reads questions aloud (mute, speed), voice setup offers a mic check, and a live HUD shows pace and fillers while speaking.
  Why now: Polish on the voice experience, safe to add after the voice core is proven.
  PRD ref: `prd.md > Extended set` (Interviewer voice; Mic check and live delivery HUD)
  Spec ref: `spec.md > Interview screen`, `spec.md > Delivery feedback`, `spec.md > Data Model` (`intervue_interviewer_*`)
  Build: `lib/speech-synthesis.ts`, `InterviewerVoiceControls`, `MicCheck`, `LiveDeliveryHUD`, voice setup screen.
  Verify (mechanical): Tests for voice preference storage; build passes; Listen stays available when muted or unsupported.
  Learner check: In Chrome, hear a question read aloud, run the mic check, and watch the HUD while you speak.
  Commit: `Add interviewer voice, mic check and live HUD`

- [ ] **12. Autosave and resume**
  Becomes usable: Refreshing mid-session offers to resume for up to 24 hours; an empty draft never replaces a real one.
  Why now: Self-contained browser feature that touches the session hook, so it goes in after the session behavior is stable.
  PRD ref: `prd.md > Autosave and resume`, `prd.md > States and Boundaries`
  Spec ref: `spec.md > Interview screen`, `spec.md > Data Model` (`intervue_session_draft_v1`)
  Build: `lib/session-draft.ts` integrated into `useInterviewSession` with expiry and resume prompt.
  Verify (mechanical): Tests for expiry, empty-draft protection and restore; refresh mid-session and confirm resume.
  Learner check: Start a session, refresh, and resume where you left off.
  Commit: `Add autosave and resume`

- [ ] **13. Rate limiting, input validation and safe errors**
  Becomes usable: Abuse of auth and API routes is throttled; bad input gets clean errors; internal details never reach the user.
  Why now: Hardening needs all routes to exist.
  PRD ref: `prd.md > Rate limiting and input validation`
  Spec ref: `spec.md > Accounts and sign-in` (`lib/security/*`), `spec.md > AI review service`
  Build: `lib/security/rate-limiter`, `validation`, `logger`, applied to every route.
  Verify (mechanical): Tests and scripted requests: over-limit requests return 429, malformed bodies return 400, forced server errors return a generic message.
  Learner check: Try submitting odd inputs and rapid repeated sign-in attempts and confirm friendly errors.
  Commit: `Add rate limiting and input validation`

- [ ] **14. PWA, UI consistency and accessibility pass**
  Becomes usable: Installable on a phone; all screens use the shared UI system, keep AA contrast and focus rings, and work from 320px.
  Why now: Final polish over finished screens.
  PRD ref: `prd.md > PWA support`, `prd.md > Shared button/UI system`, `prd.md > States and Boundaries` (Mobile)
  Spec ref: `spec.md > Shared UI, PWA and layout`, `spec.md > Look and Feel`
  Build: `app/manifest.ts`, icons, `AppHeader`, `PasswordInput`, `ErrorMessage`, `LoadingSpinner`, audit all screens for shared components, contrast, focus and small-width layout; write README with run steps.
  Verify (mechanical): Manifest served and valid; production build passes; all tests pass; no horizontal overflow at 320px on each screen; no secrets in tracked files.
  Learner check: Open the app on your phone or a narrow window and install it; tab through a screen to see focus.
  Commit: `Add PWA support and UI consistency pass`

## Hands-on Checkpoints

- [ ] Early usable behavior explored — after slice 3 (written session end to end), where feedback can still shape voice, history and accounts
- [ ] Final kick-the-tires exploration and feedback completed

## Final Review

- [ ] Final review complete — feedback resolved and learner confirms ready to ship

## Code Tour and App Map

- [ ] Learning activity complete — guided route, focused alternative, prior practice connected, or brief recap
- [ ] Optional edit and transfer reflection addressed — offered/declined/already covered/not applicable as appropriate
- [ ] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence: [what actually happened; real document/test/code references; unfinished work if interrupted]
Route and stops: [actual paths and symbols; guided stops completed, or reference-only route]
Edit outcome: [tried/kept/reverted/declined/not applicable; verification if changed]
Reflection: [offered/answered/declined/already covered — personal answer belongs only in the ignored profile]
Activity mode: [live app and editor, explicit static fallback, focused alternative, prior practice, or recap]

## Revisions
