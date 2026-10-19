import type { Question } from "@/types";
import questionsData from "@/data/questions.json";

const bank = questionsData as Record<string, Question[]>;

export function getTracks(): string[] {
  return Object.keys(bank);
}

export function getQuestions(track: string): Question[] {
  return bank[track] ?? [];
}
