import AnswerPractice from "@/components/AnswerPractice";
import { getQuestions } from "@/lib/questions";

// Temporary single-question page; replaced by the Home and track picker in the next slice.
export default function Home() {
  const question = getQuestions("Behavioral")[0];
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
      <h1 className="text-3xl font-bold text-white">Intervue</h1>
      <p className="mb-6 mt-1 text-forest-100">Answer the question and get coaching that is specific to what you said.</p>
      <AnswerPractice question={question} />
    </div>
  );
}
