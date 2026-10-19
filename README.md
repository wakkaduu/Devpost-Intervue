# Intervue

A mock interview web app for job applicants who are prepared but nervous. Pick a track, answer questions **by voice or in writing**, and get AI coaching that quotes what you actually said: what to work on first, a stronger way to say it, and the follow-up question a real interviewer would ask. A history chart shows whether you're improving.

Built with Next.js, TypeScript, Gemini (with Groq as a backup reviewer), Supabase, Auth.js and nodemailer.

## What it does

- **52 interview tracks** (behavioral, engineering, medicine, law, sales, visas, pitch competitions and more), searchable and grouped by field.
- **Voice or written answers.** Voice mode shows a live transcript, a live pace and filler-word read-out, and has an optional microphone check. Browsers without live speech recognition can record audio that the server transcribes.
- **Per-answer AI review:** score, one thing to fix first, a stronger version of your weakest sentences, a follow-up question, and a read on your tone. Delivery feedback covers words per minute and filler words.
- **Session debrief:** patterns across all your answers, best and weakest answer, and what to fix first.
- **History and progress chart:** one point per session, filterable by track, with a table view and a plain-language "up/down since your first session".
- **Guest or account.** Guests keep history in their browser. Accounts (email + confirmation code, Google, GitHub) keep it across devices.
- **Resilience:** if Gemini fails, Groq reviews the answer; if both fail, a clearly labelled "basic feedback" grader answers and offers a retry. Unfinished sessions can be resumed for 24 hours.
- **Full-width layout and motion:** screens use the whole window, the track list docks on the left of Home, and answers and track groups open with smooth accordions. All animation switches off when your system asks for reduced motion.
- **Interviewer voice** reads each question aloud (mute and speed saved), the app is **installable on a phone**, and screens work from 320px wide.

## Run it locally

**Needs:** Node.js 20.9 or newer, and a modern browser (Chrome gives the best live voice transcription).

```bash
npm install
cp .env.example .env.local     # then fill in the keys below
npm run dev                    # http://localhost:3000
```

Other scripts: `npm test` (watch mode), `npm run test:run` (once), `npm run build`, `npm start`.

### Keys and services

Everything is configured in `.env.local`, which is git-ignored. **Never commit it.** The AI keys and the database service key are only ever read on the server.

| Variable | Needed for | Where to get it |
|---|---|---|
| `GEMINI_API_KEY` | AI reviews and debriefs (required for real AI feedback) | [Google AI Studio](https://aistudio.google.com/apikey) |
| `GEMINI_MODEL` | Optional; defaults to `gemini-flash-lite-latest` | |
| `GROQ_API_KEY`, `GROQ_MODEL` | Backup reviewer and audio transcription (optional but recommended) | [Groq console](https://console.groq.com/keys) |
| `AUTH_SECRET` | Signing sign-in sessions (required) | `openssl rand -base64 32` |
| `AUTH_TRUST_HOST` | Set to `true` to run the production build locally (`npm run build && npm start`) or to self-host; Vercel needs nothing. Without it, Auth.js refuses requests in production mode. | |
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Accounts and saved history | Supabase project → Project Settings → API (use the **service_role** key) |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | "Continue with GitHub" (optional) | GitHub → Settings → Developer settings → OAuth Apps |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | "Continue with Google" (optional) | Google Cloud console → Credentials |
| `AUTH_FACEBOOK_ID` / `AUTH_FACEBOOK_SECRET` | "Continue with Facebook" (optional) | [Meta for Developers](https://developers.facebook.com/apps) → your app → Settings → Basic |
| `SMTP_USER`, `SMTP_PASSWORD` | Emailing confirmation codes (nodemailer). For Gmail, an [app password](https://myaccount.google.com/apppasswords) | Your mail account |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `EMAIL_FROM` | Optional: another mail service or a custom From line (defaults to Gmail over SSL) | |

Without a Gemini or Groq key the app still runs and gives "basic feedback". Without Supabase it works as a guest-only app. Without SMTP settings, confirmation codes are printed in the server terminal during development.

**Database.** In a new Supabase project, open the SQL Editor and run [`supabase/schema.sql`](supabase/schema.sql) once. It creates the `users` and `interview_sessions` tables with row-level security on.

**Social sign-in.** Set the OAuth callback URL to `http://localhost:3000/api/auth/callback/github` (or `/google`, `/facebook`). The three buttons always show; one without its keys explains that it isn't set up on this server yet.

**Email.** Confirmation codes are sent over SMTP. For Gmail, turn on 2-Step Verification, create an app password and put it in `SMTP_PASSWORD`; the mail then goes out from that Gmail address to anyone. Gmail limits how many messages an account may send per day, so for a public launch use a transactional mail service and set `SMTP_HOST` and friends.

## How a review works

1. The browser sends the question, your answer and earlier feedback points to `POST /api/review`.
2. The server validates the request, rate-limits it, and builds a prompt that insists on quoting your own words.
3. It asks Gemini (12-second budget), then Groq, then falls back to the built-in grader. The response says which one answered (`source`: `ai` or `basic`, and `provider`), and the server log records it.
4. The review appears while you answer the next question.

## Project layout

```
app/            pages (Home, interview, summary, history, login) and API routes
  api/          review, review/summary, transcribe, history, auth/*
components/     screens and UI pieces; components/ui holds the shared Button, fields, messages
context/        in-progress session and track-picker state
hooks/          speech recognition and audio recording
lib/            review prompts and providers, scoring, history, autosave, validation, security
  security/     rate limiter, confirmation codes, security log
data/           questions.json: the 52 tracks
supabase/       schema.sql
```

## Security notes

- AI keys, the Supabase service key and the OAuth secrets are read on the server only and never sent to the browser.
- Passwords are stored as bcrypt hashes; confirmation codes as keyed hashes that expire after 15 minutes and lock after 5 wrong tries.
- Sign-in, sign-up, confirmation and every API route are rate limited; five failed sign-ins lock that account from that address for 15 minutes. Bodies are size-capped and validated, and internal errors are never shown to users.
- The database blocks the public key from reading anything; only the server can.

## Known limitations

- Rate-limit counters live in server memory, so they are exact on one server but looser across many serverless instances (a shared store such as Redis would fix that).
- No Content-Security-Policy header yet.
- The installable app has no offline mode: practising needs a connection to the AI services.
- Live voice transcription depends on the browser's speech service (Chrome works best; other browsers fall back to recorded audio or typing).
- Reviews are written by AI and can be wrong. Treat them as coaching, not a verdict.

## Tests

`npm run test:run` runs the full suite (unit tests for scoring, validation, security, the provider chain and the review prompts, plus component tests for the whole interview, results, history and sign-in flows).
