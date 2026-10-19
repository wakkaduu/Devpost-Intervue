import Link from "next/link";
import AnswerPractice from "@/components/AnswerPractice";
import { buttonClasses } from "@/components/ui/button-classes";
import { getQuestions, isValidTrack, splitTrackName } from "@/lib/questions";

// Single-question stand-in; the full question-by-question session is the next slice.
export default async function InterviewPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; mode?: string }>;
}) {
  const { category, mode } = await searchParams;

  if (!isValidTrack(category)) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-12">
        <div className="rounded-2xl bg-sage-100 p-6 text-darkslate-900">
          <h1 className="text-xl font-semibold">We couldn’t find that track.</h1>
          <p className="mt-1 text-sm">Pick a track from the home page to start.</p>
          <Link href="/" className={buttonClasses({ className: "mt-4" })}>Back to Home</Link>
        </div>
      </div>
    );
  }

  const question = getQuestions(category)[0];
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
      <h1 className="text-2xl font-bold text-white">{splitTrackName(category).title}</h1>
      {mode === "mic" && (
        <p className="mb-4 mt-1 text-sm text-gold-300">Voice answers are coming in a later step. For now, type your answer.</p>
      )}
      <div className="mt-4">
        <AnswerPractice question={question} />
      </div>
    </div>
  );
}
