---
doc: demo-storyboard
---

# Intervue: Demo Video Storyboard

**Target length:** about 3:00. The Devpost form sets the real limit, so check it and trim the optional beats (marked *cut first*) if it is shorter.
**Story in one line:** a nervous applicant answers out loud, gets coaching that quotes their own words, and then sees a chart proving they are improving.
**What reviewers must see:** the working proof of concept, with the AI review quoting the answer. A live deployment does not replace this video.

## Before you record

- **Browser:** Chrome (live voice transcription works best there). Window at 1920×1080 or 1280×720, zoom 100%, bookmarks bar and extensions hidden.
- **Never show `.env.local`, the terminal running `npm run dev`, or your email inbox.** Record the browser window only, not the whole screen.
- **Seed the History chart first.** Do two quick sessions on the same track on the day (a different, weaker answer each time) so the chart already has 2 points before you record. Use a **guest** profile, so nothing personal shows.
- **Fresh state for the take:** clear the unfinished-session draft so no "Resume?" prompt appears, and keep the Voice/Written toggle on Voice.
- **Pick one track** and keep it for the whole video. A short, universal one such as the behavioral track keeps the viewer's attention on the app, not the subject matter.
- **Mic check:** use a quiet room, an external mic if you have one, and system sound on so the interviewer voice is captured.
- **Record in short clips per scene** (not one take), then join them. Speed up only the AI loading waits (2×), never your speech.

## Scene list

| # | Time | Screen | What the viewer sees | Voice-over |
|---|---|---|---|---|
| 1 | 0:00–0:12 | Title card, then Home | Logo and tagline fade in, then cut to Home with the start card and sample feedback | "Interviews are scary when you can't see what you did wrong. Intervue is a mock interviewer that listens to your answer and tells you exactly what to fix." |
| 2 | 0:12–0:30 | Home → track picker | Click **Change track**; the left drawer opens with all 52 tracks; type "behav" in search; pick a track; drawer closes | "Pick from 52 tracks, from behavioral and engineering to medicine, law and visa interviews. Every track has 15 questions and a session asks 12, so it stays fresh." |
| 3 | 0:30–0:42 | Start card | Hover the sample feedback card for 2 s, then toggle **Voice** and **Written**, back to Voice, press **Start practicing** | "Answer by voice or in writing. Your choice is remembered. Here's what feedback looks like before you start." |
| 4 | 0:42–0:55 | Voice setup | Explainer screen; click **Test my microphone**, speak a sentence, the level meter moves; continue | "Voice mode starts with an optional mic check, so you're not surprised mid-answer." |
| 5 | 0:55–1:25 | Interview (voice) | Question appears; click **Listen** and the interviewer reads it aloud; timer runs; press **Start recording**, speak the sample answer below; live transcript fills in; HUD shows pace and filler count climbing; press **Stop** | "The interviewer reads the question aloud. As you speak you get a live transcript, and a live read-out of your pace and filler words." |
| 6 | 1:25–1:35 | Interview → next question | Press **Next question**; a small "reviewing" indicator shows; new question appears at once | "Your answer is reviewed in the background while you move on, so there's no waiting between questions." |
| 7 | 1:35–1:50 | Interview (written) *cut first* | On question 2 switch to typing (or use the typed fallback); type two sentences; submit | "Prefer typing? The review is identical." |
| 8 | 1:50–2:00 | Interview → End | Press **End early** after question 2 or 3 (don't film all 12 questions) | "Short on time? End early and get results for the answers you gave." |
| 9 | 2:00–2:25 | Results | Score ring counts up; verdict label ("Almost there"); scroll to the debrief: patterns, best and weakest answer, what to fix first; open the first answer's accordion: **Work on this first**, **A stronger way to say it**, **The follow-up a real interviewer would ask**, and the delivery panel (WPM, fillers, tone) | "You get a score and a plain verdict. The debrief shows patterns across answers. And each review quotes your own words, picks one thing to fix first, rewrites your weakest sentences, and asks the follow-up a real interviewer would." |
| 10 | 2:25–2:40 | History | Click **History**; trend chart draws in with 3 points; filter by track; flip to table view; zoom on "up X since your first session" | "Every session is saved, and the chart shows whether you're actually improving." |
| 11 | 2:40–2:50 | Login *cut first* | Show login card: email + code, Google, GitHub, Facebook buttons | "Guests keep history in the browser. An account keeps it across devices." |
| 12 | 2:50–3:00 | Closing card | Logo, GitHub URL, "Built with Next.js, Gemini, Groq, Supabase" | "Intervue: practise out loud, fix one thing at a time. Code is on GitHub." |

If the form allows only about 2 minutes, drop scenes 7 and 11 and shorten scene 2 to a single search-and-pick.

## Sample voice answer (scene 5, about 35 seconds)

Prompt: *"Tell me about a time you disagreed with a teammate."* Say it naturally, with the two filler words, and leave the outcome vague so the AI has a real weakness to quote.

> "So, um, last semester my teammate and I disagreed about whether to ship our project before the demo day. I wanted to wait and fix the bugs, she wanted to ship. We, like, had a call and decided to use a feature flag. It, um, worked out fine in the end and the demo went well."

This gives the review things to point at: no reason for the teammate's view, a vague result ("worked out fine"), and visible fillers. Run it once before filming and check the output reads well. If the AI quotes it clearly, keep that take.

## Shot notes

- **Pace:** hold each key result on screen for 2 to 3 seconds (the score, the "work on this first" card, the chart trend line) so viewers can read it. Add subtle zooms rather than cursor hunting.
- **Cursor:** enlarge it and slow it down. Use click highlights if your recorder supports them.
- **Captions:** burn in short captions for the three key claims: "52 tracks · voice or written", "Quotes your own words", "Progress you can see". Many reviewers watch muted.
- **Audio:** record voice-over separately after the screen capture so it is clean. Keep the interviewer's spoken question from the capture as a short sound bite, and duck music under it.
- **Music:** none, or very quiet instrumental. Check the licence if you use any.
- **Accessibility:** mention once that motion switches off with the system's reduced-motion setting only if there is room; otherwise skip it.

## Fallbacks if something breaks mid-take

- **AI is slow:** cut the wait, or use the "basic feedback" notice as an unplanned feature shot. It labels itself clearly and offers a retry, which shows the provider chain (Gemini, Groq, then the built-in grader).
- **Voice transcript doesn't start:** record in Chrome again; if you must use another browser, show the typed fallback and say so.
- **Interviewer voice silent:** the server voice needs the Gemini key. Check it works before the take.

## After recording

1. Watch the final cut once with sound off and once with sound on.
2. Scrub frame by frame for any visible keys, emails, tabs or notifications.
3. Upload somewhere reviewers can open without signing in (YouTube unlisted, Loom or similar), then open the link in a private window to confirm.
4. Paste the link into the Devpost form.

## Production notes (automated version)

The automated cut lives outside this repo in `../intervue-video` (see its README). It differs from the storyboard in these ways:

- Footage is a real, scripted run of the production build in a guest session: two unrecorded warm-up sessions first, so History has real points.
- Scene 5 shows the app's audio-recording path (record, Stop, the server transcribes), not the live transcript and HUD, because the test browser has no speech service. The pace and filler read-out still appears in the results.
- The spoken answer is synthetic audio played into the app as the microphone, so the video's applicant voice is synthetic.
- The interviewer's "Listen" audio is stubbed during filming, because the Gemini voice was over its quota. The footage shows the button's normal state.
- Waits for the AI and long typing are sped up and labelled with a speed badge. The cursor is drawn in the edit.
