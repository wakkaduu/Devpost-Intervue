---
doc: prd
status: approved
---

# Intervue — Product Requirements

Intervue is a mock interview web app where job applicants practise by voice or in writing and get specific AI coaching on every answer. Source: `scope.md > The Unique Kernel`, `scope.md > The Core Loop`.

Method note: the learner built Intervue first. Per their instruction, the existing repo (https://github.com/wakkaduu/Intervue, its gallery captions, requirements doc and code) is the factual source for behavior. Behaviors below come from it and were confirmed or corrected by the learner in review. Product-identity and boundary choices come from the learner (see Product Decisions).

## The Core Journey
Source: `scope.md > The Core Loop`, `scope.md > What "Working" Looks Like`.

1. Someone opens the web app and lands on Home: a focal card showing their current track, a Voice/Written toggle, and a "Start practicing" button.
2. They pick a track (change it via the track picker: 52 tracks grouped by field, searchable) and choose Voice or Written. Their last chosen mode is remembered.
3. They press Start practicing. In Voice mode a setup screen explains how it works and offers an optional microphone check.
4. They answer questions one at a time. The question is shown first, the interviewer can read it aloud, a timer runs, and the draft autosaves. Voice shows live transcription and a live delivery HUD; Written shows a text box.
5. After the last question (or ending early), every answer is reviewed by AI.
6. The Results screen shows an average score with a plain verdict and an AI debrief across all answers (patterns, best and weakest answer, what to fix first).
7. Each answer's review shows: one thing to work on first, a stronger way to say it, the follow-up question a real interviewer would ask, the interviewer's take, and delivery feedback (words per minute, filler words, tone read).
8. The session is saved. The History page charts each session's average score over time so they see whether they've improved since their first attempt. They start another session.

Success: a first-time visitor completes steps 1-8 and sees a review that quotes what they actually said, plus a history point for the session.

## Screens and Layout
- **Home** (`/`): hero line, one focal start card (track, Voice/Written, Start practicing, "N questions, about M minutes"), and an example of what feedback looks like. A sidebar/picker lets the user change track.
- **Track picker:** 52 tracks grouped by field, with search and filters.
- **Voice setup:** explainer plus optional mic check, before question one.
- **Interview** (`/interview`): one question at a time; question, read-aloud control, timer, answer area (live transcript or text box), recording/live delivery HUD, next/finish controls.
- **Results / Summary** (`/summary`): score ring, verdict, AI debrief, per-answer coaching, collapsible answers.
- **History** (`/history`): score trend chart (filterable by track), table view, a plain note on improvement.
- **Sign in / Sign up** (`/login`): optional accounts.
- Works on phones with large touch targets and a next action that stays in reach.

## Look and Feel
Source: learner decision to keep the existing identity.
- Palette: deep forest green canvas, light sage card surfaces, emerald accents, warm gold highlights, dark slate body text.
- Typeface: Inter.
- Mood: calm, encouraging, coach-like. Feedback is honest but never "you failed" (verdicts: Interview-ready, Almost there, Needs work, Not ready yet).
- Avoid: generic AI-app styling. Keep contrast accessible (WCAG AA) and visible keyboard focus.

## Features and Behavior

### Core set (built first, so the app is demoable early)

#### Track and mode selection
Source: `scope.md > The Core Loop`.
- As an applicant, I want to pick a track and Voice or Written so I practise what matters to me.
  - [ ] Home shows a current track and 52 tracks are reachable through the picker.
  - [ ] Starting with no track chosen shows an inline error and stays on Home.
  - [ ] The last-used mode is preselected next visit.

#### Answering by voice
- As a nervous applicant, I want to speak my answer and see it transcribed.
  - [ ] Recording shows the live transcript, with interim text visually distinct.
  - [ ] Stopping finalises the transcript as the answer.
  - [ ] If the mic is denied or unsupported, a clear message appears and a typing fallback is offered.
  - [ ] Recording stops automatically at the maximum length and tells the user.

#### Answering in writing
- [ ] Typed answers work end to end identically to voice (same review).
- [ ] An empty answer cannot be submitted; an inline message appears and no AI request is made.

#### AI review and follow-up
Source: `scope.md > The Unique Kernel`.
- As an applicant, I want specific feedback so I know exactly how to improve.
  - [ ] Each answer gets a 1-10 score, one thing to work on first, a stronger version, a follow-up question, and the interviewer's take.
  - [ ] Feedback quotes or clearly refers to what the user actually said (not generic).
  - [ ] A loading state shows while the AI reviews; on failure the user sees a clear error with a retry.
  - [ ] The AI key is never exposed to the browser.

#### Delivery feedback
- [ ] For voice answers: words per minute with a pace label (optimal is 120-160), filler word count and highlights, and a short coach tip.
- [ ] The review includes an AI tone read of the answer.

#### Results and debrief
- [ ] After the last question, the user sees the average score (one decimal) and a verdict label.
- [ ] An AI debrief covers patterns across answers, best and weakest answer, and what to fix first.
- [ ] Ending early shows results for answered questions only; with zero answers it shows a "no answers submitted" message instead of a score.

#### History and progress chart
Source: `scope.md > The Unique Kernel`.
- [ ] Each completed session adds one point (average score) to the chart.
- [ ] The chart can be filtered to one track and has a table view.
- [ ] With 2+ sessions it states the change "since your first session"; with fewer it shows a friendly empty state.
- [ ] Duplicate saves of the same session do not create duplicate points.

#### Accounts and saved history
- [ ] Guests can practise without signing in; their history is kept in the browser.
- [ ] Signing in keeps history across devices (account-based).

### Extended set (added after the core works, one verified step at a time)
Source: `scope.md > The POC Boundary`.
- **Email sign-up with confirmation:** register, confirmation code by email, resend with cooldown; also Google/GitHub sign-in as in the existing app (learner confirmed all three carry over).
- **Interviewer voice:** the interviewer reads the question aloud, preferring a plain English voice; the Listen button stays available when muted or unsupported.
- **Mic check and live delivery HUD** during voice answers.
- **Autosave and resume:** an in-progress session survives refresh; resume is offered for up to 24 hours; an empty draft never overwrites a real one.
- **Multiple AI providers with fallback:** if one AI provider fails, another is tried; the user sees a notice when only basic feedback was possible.
- **Rate limiting and input validation** on auth and API routes; internal errors are never shown to users.
- **PWA support:** installable on a phone.
- **Shared button/UI system** used consistently across screens.

## States and Boundaries
- **First use:** Home with a default track, Voice selected unless a previous choice exists, sample feedback shown.
- **No history yet:** History shows an empty state inviting the first session.
- **Mic denied / unsupported / failed:** descriptive message plus typed fallback; up to 3 retries before the typed fallback is the only option.
- **Empty answer:** blocked with an inline message; no AI call.
- **AI slow or failing:** error with retry; if all providers fail, the user is told the review could not be completed. The resubmit option disappears once feedback has arrived.
- **Refresh mid-session:** the autosaved draft can be resumed (extended set).
- **Guest vs account:** guests' history lives in the browser only; signing up keeps it across devices.
- **Mobile:** all of the above works at 320px width and up with no horizontal scrolling.

## Product Decisions
- Keep the existing green, sage and gold identity with Inter — the learner chose to keep it as the app's identity.
- Rebuild everything the existing repo does, core first — scope decision, so the app is demoable early and the extras follow in verified steps.
- All 52 tracks, reusing the question file from the existing repo — learner confirmed.
- The existing repo is the factual source for behavior — the learner built it specifically for Devpost and asked that it be read instead of re-described.
- AI keys stay server-only; no user-facing API-key modal (decided in `4-spec`).
- Delivery feedback means words per minute, fillers, and the AI's tone read, not audio pitch analysis — matches the existing app.

## What We're Building
Everything under Core set and Extended set above, with the 52 tracks and their question file reused from the old repo.

## Deferred From the POC
- Vercel deployment — optional for the hackathon; the learner plans to do it after the app works.

## Possible Later Enhancements
- Audio-based tone analysis (pitch, emotion), which would need an audio model.
- Custom question banks or pasting a real job description.

## Non-Goals
- Rebuilding the old repo's `my-video/` demo-video project — it is not part of the app.
- Audio-signal tone analysis in this version — the existing app doesn't do it.

## Open Questions
None. Resolved during `4-spec`: all three sign-in methods (email/password, Google, GitHub) carry over; AI keys stay server-only, so the old app's user-facing API-key modal is dropped.
