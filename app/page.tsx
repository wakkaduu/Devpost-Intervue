import HowItWorks from "@/components/HowItWorks";
import SampleFeedback from "@/components/SampleFeedback";
import StartCard from "@/components/StartCard";
import Page from "@/components/ui/Page";

export default function Home() {
  return (
    <Page>
      <div className="grid items-start gap-8 xl:grid-cols-12 xl:gap-x-10 xl:gap-y-10">
        <header className="xl:col-span-7">
          <p className="inline-flex items-center gap-2 rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-200 ring-1 ring-emerald-300/30">
            <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
            AI coaching on every answer
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-black leading-[1.05] tracking-tight text-white sm:text-5xl 2xl:text-6xl">
            Practise the interview you’re <span className="bg-gradient-to-r from-emerald-300 to-gold-400 bg-clip-text text-transparent">nervous about.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-forest-100">
            Answer by voice or in writing and get coaching that quotes what you actually said, then watch your score climb.
          </p>
        </header>
        <div className="xl:col-span-5">
          <StartCard />
        </div>
        <div className="xl:col-span-12">
          <HowItWorks />
        </div>
        <div className="xl:col-span-12">
          <SampleFeedback />
        </div>
      </div>
    </Page>
  );
}
