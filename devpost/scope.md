---
doc: scope
status: approved
---

# Intervue

A mock interview web app that helps job applicants prepare for real interviews, with AI feedback that is specific to each answer.

## The Unique Kernel
The review is written by AI for each answer, so feedback is not repetitive and gives real insight into how to improve. It also asks the follow-up question a real interviewer would ask where an answer has holes. A history chart shows whether you've improved since your first attempt.

## Who It's For
Job applicants and anyone preparing for an interview, especially people like the learner: prepared, but always nervous. Today they would have to rehearse alone, with no honest feedback.

## The Core Loop
Open the web app, pick an interview category, choose to answer by voice or in writing, and answer several questions. Submit for AI evaluation, then receive a review, recommendations, and a follow-up question based on your answer. Come back to practise again and watch the history chart.

## Inspiration & Identity
Not discussed yet. To be covered briefly in the PRD.

## Why This Matters to the Learner
"I am one of those applicants that's wanted to be prepared but also always nervous." They want to help others like them prepare for job interviews.

## What "Working" Looks Like
Someone opens the web app, picks a category, chooses voice or written answers, answers several questions, and submits. They get AI reviews, recommendations, and a follow-up question that probes the holes in their answers. They can see a history chart of their progress. The demo shows all of this.

Delivery feedback is the existing app's definition: words per minute, filler words, and the AI's tone read of the answer. The history chart plots each session's average score over time, with sign-in saving the history.

## The POC Boundary
Everything the existing Intervue repo (https://github.com/wakkaduu/Intervue) does, rebuilt step by step following the Devpost skill pack, with the repo as reference. Built specifically for Devpost.

Core loop first (so a demo exists early): categories, voice or written answers, several questions per session, AI review with recommendations, AI follow-up question, delivery feedback (WPM, fillers, tone read), sign-in with saved history, and the progress chart.

Then the rest of the existing app, added in verified steps: email sign-up with confirmation, guest mode with local storage, session debrief summary, interviewer voice (reads the question aloud), mic check and live delivery HUD, autosave and resume of a session, multiple AI providers with fallback, API-key modal, rate limiting and input validation, PWA support, and the shared button/UI system.

Time risk acknowledged: this is well beyond the 2–4 hour target. The build order must keep the app demoable at each step; the PRD and spec will mark which parts are the core and which are the extended set.

## Later
- Vercel deployment (optional for the hackathon; the learner plans it).

## Explicitly Cut
Nothing. The learner wants everything the existing repo has. The demo video project (`my-video/`) in the old repo is not part of the app and is not rebuilt here.
