import InterviewerVoiceControls from "@/components/InterviewerVoiceControls";
import type { Question } from "@/types";

export default function QuestionDisplay({ question, position, total, paused, upcoming }: { question: Question; position: number; total: number; paused?: boolean; upcoming?: string }) {
  return (
    <div>
      <p className="eyebrow">
        Question {position} of {total}
      </p>
      <h2 className="mt-2 text-2xl font-semibold leading-snug text-darkslate-900 sm:text-3xl">{question.text}</h2>
      <InterviewerVoiceControls text={question.text} paused={paused} upcoming={upcoming} />
    </div>
  );
}
