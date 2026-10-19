import StartCard from "@/components/StartCard";

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
      <h1 className="text-3xl font-bold text-white sm:text-4xl">Practise the interview you’re nervous about.</h1>
      <p className="mb-6 mt-2 text-forest-100">
        Answer by voice or in writing and get coaching that quotes what you actually said.
      </p>
      <StartCard />
    </div>
  );
}
