// The last-resort grader: simple rules, no AI. It is deliberately modest and says so, so nobody
// mistakes it for a real read of the answer. It never invents facts about the candidate.
import type { Feedback, ReviewRequest } from "@/types";

const HEDGES = ["i guess", "maybe", "probably", "sort of", "kind of", "i think", "not sure", "hopefully", "just"];
const STOP = new Set(["the", "and", "you", "your", "about", "tell", "time", "describe", "give", "what", "how", "why", "with", "that", "this", "have", "when", "where", "which", "would", "could", "example"]);

export function basicReview(request: ReviewRequest): Feedback {
  const answer = request.answer.trim();
  const lower = answer.toLowerCase();
  const words = answer.split(/\s+/).filter(Boolean);
  const n = words.length;

  const hasNumbers = /\d/.test(answer);
  const hedges = HEDGES.filter((h) => new RegExp(`\\b${h}\\b`).test(lower)).length;
  const we = (lower.match(/\b(we|our|us)\b/g) ?? []).length;
  const i = (lower.match(/\b(i|i've|i'm|my|me)\b/g) ?? []).length;
  const hasResult = /\b(result|outcome|impact|improved|reduced|increased|saved|delivered|achieved|led to|learned)\b/.test(lower);
  const hasAction = /\bi (decided|built|led|wrote|created|set up|organized|proposed|fixed|designed|asked|called)\b/.test(lower);

  const keywords = request.question.toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/).filter((w) => w.length > 4 && !STOP.has(w));
  const covered = keywords.filter((k) => lower.includes(k.slice(0, Math.max(4, k.length - 2)))).length;
  const onTopic = keywords.length === 0 || covered / keywords.length >= 0.25;

  let score = n < 20 ? 2 : n < 45 ? 3 : n < 80 ? 4 : 5;
  if (hasAction) score += 1;
  if (hasResult) score += 1;
  if (hasNumbers) score += 1;
  if (!onTopic) score -= 1;
  if (hedges >= 2) score -= 1;
  if (we >= 3 && i <= 1) score -= 1;
  score = Math.max(1, Math.min(7, score)); // rules alone never justify a top score

  const strengths: string[] = [];
  if (hasAction) strengths.push("You said what you personally did, which is the part interviewers listen for.");
  if (hasResult) strengths.push("You named an outcome or what you learned.");
  if (hasNumbers) strengths.push("You included a number, which makes a claim easier to believe.");
  if (strengths.length === 0) strengths.push("You gave an answer to work from; the next step is adding detail.");

  // Most specific problems first: the first one becomes "work on this first".
  const fixes: string[] = [];
  if (!onTopic) fixes.push("The answer drifts from the question. Answer it in the first sentence.");
  if (hedges >= 2) fixes.push("Phrases like “maybe” and “I guess” make you sound unsure. State what you did plainly.");
  if (we >= 3 && i <= 1) fixes.push("You used “we” a lot. Say which parts were yours.");
  if (n < 45) fixes.push(`Your answer was only ${n} words. Add the situation, what you did and how it ended.`);
  if (!hasAction) fixes.push("It isn't clear what you personally did. Start a sentence with “I” and a verb.");
  if (!hasResult) fixes.push("There's no outcome. End by saying what happened because of what you did.");
  if (fixes.length === 0) fixes.push("Add one specific detail, such as a decision you made and why.");

  return {
    score,
    summary: `This is basic feedback from simple checks, not a full read of your answer. Your answer was ${n} words${hasResult ? " and mentions an outcome" : " and doesn't clearly state an outcome"}. Try the AI review again for specific coaching.`,
    strengths: strengths.slice(0, 3),
    areasForImprovement: fixes.slice(0, 3),
    focusNext: fixes[0],
    strongerVersion: "The basic grader can't rewrite your answer. A shape that works: “The situation was [situation]. I [what you did]. As a result, [outcome].”",
    followUpQuestion: "What was the result, and how did you know it worked?",
    howTheyAnswered: n < 45 ? "Short; there wasn't much structure to assess." : "Long enough to have structure; the AI review can say how well it was built.",
    toneAnalysis: hedges >= 2 ? "Several hedging phrases made it sound unsure." : "Nothing in the wording stood out as hesitant.",
    questionConnection: onTopic ? "It touches the main words of the question." : "It uses few of the question's key words, so it may have drifted.",
  };
}
