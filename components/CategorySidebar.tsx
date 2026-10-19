"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import TrackPicker from "@/components/TrackPicker";
import { IconButton } from "@/components/ui/Button";
import { useSidebar } from "@/context/SidebarContext";

/**
 * The track list, on the left. On Home at wide widths it is a docked panel that the header button
 * collapses and reopens. Everywhere else (phones, tablets, other pages) it is a drawer that slides in over the page.
 */
export default function CategorySidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { pickerOpen, setPickerOpen, dockOpen, isDesktop, selectTrack } = useSidebar();
  const searchRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const onHome = pathname === "/";
  const duringInterview = pathname?.startsWith("/interview") ?? false;
  const docked = onHome && isDesktop;
  const drawerOpen = pickerOpen && !docked && !duringInterview;

  function pick(track: string) {
    selectTrack(track);
    setPickerOpen(false);
    // The chosen track shows on Home, so take people there from other pages.
    if (pathname && !onHome) router.push("/");
  }

  // Drawer only: focus moves in, Tab stays inside, Escape closes, the page behind doesn't scroll, focus returns on close.
  useEffect(() => {
    if (!drawerOpen) return;
    const opener = document.activeElement as HTMLElement | null;
    searchRef.current?.focus();
    const scrollBefore = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPickerOpen(false);
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      const visible = [...focusable].filter((el) => !el.closest("[inert]"));
      if (visible.length === 0) return;
      const first = visible[0];
      const last = visible[visible.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = scrollBefore;
      opener?.focus?.();
    };
  }, [drawerOpen, setPickerOpen]);

  if (duringInterview) return null;

  return (
    <>
      {onHome && (
        <aside
          id="track-dock"
          aria-label="Interview tracks"
          inert={!dockOpen}
          className="sticky top-[var(--header-h)] hidden h-[calc(100dvh-var(--header-h))] shrink-0 overflow-hidden transition-[width,opacity] duration-300 ease-out lg:block"
          style={{ width: dockOpen ? "22rem" : "0rem", opacity: dockOpen ? 1 : 0 }}
        >
          <div className="card m-4 ml-4 mr-0 h-[calc(100%-2rem)] w-[20rem] overflow-hidden">
            <TrackPicker onPick={pick} />
          </div>
        </aside>
      )}

      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-start">
          <div className="absolute inset-0 animate-fade-in bg-black/50 backdrop-blur-sm" onClick={() => setPickerOpen(false)} aria-hidden="true" />
          <div
            ref={panelRef}
            id="track-picker"
            role="dialog"
            aria-modal="true"
            aria-label="Choose a track"
            className="relative flex h-full w-full max-w-sm animate-slide-in-left flex-col bg-sage-100 shadow-lift"
          >
            <div className="flex items-center justify-between gap-2 border-b border-sage-300 p-4 pb-3">
              <h2 className="text-lg font-bold text-darkslate-900">Choose a track</h2>
              <IconButton label="Close track picker" onClick={() => setPickerOpen(false)}>✕</IconButton>
            </div>
            <div className="min-h-0 flex-1">
              <TrackPicker ref={searchRef} onPick={pick} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
