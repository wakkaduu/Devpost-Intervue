import Link from "next/link";
import InterviewSession from "@/components/InterviewSession";
import Page from "@/components/ui/Page";
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
      <Page>
        <div className="card mx-auto max-w-xl p-6">
          <h1 className="text-xl font-semibold">We couldn’t find that track.</h1>
          <p className="mt-1 text-sm">Pick a track from the home page to start.</p>
          <Link href="/" className={buttonClasses({ className: "mt-4" })}>Back to Home</Link>
        </div>
      </Page>
    );
  }

  const practiceMode: PracticeMode = mode === "typed" ? "typed" : "mic";
  return (
    <Page>
      <h1 className="mb-6 text-2xl font-black tracking-tight text-white sm:text-3xl">{splitTrackName(category).title}</h1>
      <InterviewSession category={category} mode={practiceMode} />
    </Page>
  );
}
