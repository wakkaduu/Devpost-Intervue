import type { Question } from "@/types";

export default function QuestionDisplay({ question, position, total }: { question: Question; position: number; total: number }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-forest-600">
        Question {position} of {total}
      </p>
      <h2 className="mt-1 text-xl font-semibold text-darkslate-900">{question.text}</h2>
    </div>
  );
}
