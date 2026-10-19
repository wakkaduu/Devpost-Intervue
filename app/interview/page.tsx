import Link from "next/link";
import InterviewSession from "@/components/InterviewSession";
import { buttonClasses } from "@/components/ui/button-classes";
import { isValidTrack, splitTrackName } from "@/lib/questions";
import type { PracticeMode } from "@/lib/mode-storage";

export const metadata = { title: "Practice" };

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

  const practiceMode: PracticeMode = mode === "typed" ? "typed" : "mic";
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
      <h1 className="text-2xl font-bold text-white">{splitTrackName(category).title}</h1>
      <div className="mt-4">
        <InterviewSession category={category} mode={practiceMode} />
      </div>
    </div>
  );
}
