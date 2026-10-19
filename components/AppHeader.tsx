import Link from "next/link";

export default function AppHeader() {
  return (
    <header className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 pt-4">
      <Link href="/" className="rounded-lg text-lg font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300">
        Intervue
      </Link>
      <nav aria-label="Main">
        <Link
          href="/history"
          className="inline-flex min-h-[44px] items-center rounded-lg px-3 text-sm font-semibold text-emerald-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
        >
          History
        </Link>
      </nav>
    </header>
  );
}
