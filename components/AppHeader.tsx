"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

const linkClass =
  "inline-flex min-h-[44px] items-center rounded-lg px-3 text-sm font-semibold text-emerald-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300";

export default function AppHeader() {
  const { data, status } = useSession();
  return (
    <header className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 pt-4">
      <Link href="/" className="rounded-lg text-lg font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300">
        Intervue
      </Link>
      <nav aria-label="Main" className="flex items-center">
        <Link href="/history" className={linkClass}>History</Link>
        {status === "authenticated" ? (
          <>
            <span className="hidden max-w-[10rem] truncate text-sm text-forest-100 sm:inline">{data.user?.name}</span>
            <button type="button" onClick={() => signOut({ callbackUrl: "/" })} className={linkClass}>Sign out</button>
          </>
        ) : status === "unauthenticated" ? (
          <Link href="/login" className={linkClass}>Sign in</Link>
        ) : null}
      </nav>
    </header>
  );
}
