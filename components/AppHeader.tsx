"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import Logo from "@/components/Logo";
import { useSidebar } from "@/context/SidebarContext";

const linkClass =
  "inline-flex min-h-[44px] items-center rounded-lg px-3 text-sm font-semibold text-emerald-200 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300";

/** Opens and closes the track list: the docked panel on Home at wide widths, the drawer everywhere else. Hidden during an interview, where picking another track would abandon it. */
function TracksToggle() {
  const pathname = usePathname();
  const { pickerOpen, setPickerOpen, dockOpen, setDockOpen, isDesktop } = useSidebar();
  if (pathname?.startsWith("/interview")) return null;
  const docked = pathname === "/" && isDesktop;
  const open = docked ? dockOpen : pickerOpen;
  return (
    <button
      type="button"
      aria-label="Browse tracks"
      aria-expanded={open}
      aria-controls={docked ? "track-dock" : "track-picker"}
      onClick={() => (docked ? setDockOpen(!dockOpen) : setPickerOpen(!pickerOpen))}
      className="mr-1 inline-flex min-h-[44px] items-center gap-2 rounded-lg px-3 text-sm font-semibold text-emerald-200 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
    >
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="transition-transform duration-300">
        <path d="M3 5h14M3 10h14M3 15h14" className={`origin-center transition-opacity ${open ? "opacity-60" : ""}`} />
      </svg>
      <span className="hidden sm:inline">Tracks</span>
    </button>
  );
}

export default function AppHeader() {
  const { data, status } = useSession();
  return (
    <header className="sticky top-0 z-40 flex h-[var(--header-h)] w-full items-center justify-between border-b border-white/10 bg-forest-950/70 px-3 backdrop-blur-md sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center">
        <TracksToggle />
        <Link
          href="/"
          className="group flex items-center gap-2 rounded-lg text-lg font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
        >
          <Logo size={32} className="transition-transform duration-300 group-hover:rotate-[-6deg] group-hover:scale-110" />
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
