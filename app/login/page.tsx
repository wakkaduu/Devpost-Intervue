import AuthForm from "@/components/AuthForm";
import Logo from "@/components/Logo";

export const metadata = { title: "Sign in" };

const PERKS = [
  "Your practice history follows you across devices",
  "See whether you’re improving since your first session",
  "Pick up an unfinished session right where you left off",
];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string; error?: string }> }) {
  const { callbackUrl, error } = await searchParams;
  return (
    // Exactly one screen tall (below the header) and centred, so on a laptop nothing needs scrolling.
    // On a small phone the form is taller than the screen, so the page can still scroll there.
    <div className="mx-auto flex min-h-[calc(100dvh-var(--header-h))] w-full max-w-[96rem] items-start px-4 py-6 sm:px-6 lg:items-center lg:px-10 lg:py-4">
      <div className="grid w-full items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div className="hidden lg:block">
          <Logo size={64} className="animate-scale-in drop-shadow-lg" />
          <h2 className="mt-5 max-w-lg text-5xl font-black leading-[1.05] tracking-tight text-white">Keep every practice session.</h2>
          <p className="mt-4 max-w-md text-lg text-forest-100">An account saves your scores, so the chart can show how far you’ve come.</p>
          <ul className="mt-8 space-y-3">
            {PERKS.map((perk, i) => (
              <li key={perk} className="flex animate-fade-up items-center gap-3 text-forest-50" style={{ animationDelay: `${200 + i * 120}ms` }}>
                <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-300 ring-1 ring-emerald-300/30">
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10.5l4 4 8-9" /></svg>
                </span>
                {perk}
              </li>
            ))}
          </ul>
        </div>
        <div className="mx-auto w-full max-w-md lg:max-w-lg">
          <AuthForm callbackUrl={callbackUrl} authError={error} />
        </div>
      </div>
    </div>
  );
}
