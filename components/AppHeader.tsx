"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import Logo from "@/components/Logo";
import { useSidebar } from "@/context/SidebarContext";

const linkClass =
  "inline-flex min-h-[44px] items-center rounded-lg px-3 text-sm font-semibold text-emerald-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300";

/** Opens and closes the track list. Hidden during an interview, where picking another track would abandon it. */
function TracksToggle() {
  const pathname = usePathname();
  const { pickerOpen, setPickerOpen } = useSidebar();
  if (pathname?.startsWith("/interview")) return null;
  return (
    <button
      type="button"
      aria-label="Browse tracks"
      aria-expanded={pickerOpen}
      aria-controls="track-picker"
      aria-haspopup="dialog"
      onClick={() => setPickerOpen(!pickerOpen)}
      className="mr-1 inline-flex min-h-[44px] items-center gap-2 rounded-lg px-3 text-sm font-semibold text-emerald-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
    >
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M3 5h14M3 10h14M3 15h14" />
      </svg>
      <span className="hidden sm:inline">Tracks</span>
    </button>
  );
}

export default function AppHeader() {
  const { data, status } = useSession();
  return (
    <header className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 pt-4">
      <div className="flex min-w-0 items-center">
        <TracksToggle />
        <Link
          href="/"
          className="flex items-center gap-2 rounded-lg text-lg font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
        >
          <Logo size={32} />
          Intervue
        </Link>
      </div>
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
