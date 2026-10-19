"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import CategoryCard from "@/components/CategoryCard";
import { IconButton } from "@/components/ui/Button";
import { useSidebar } from "@/context/SidebarContext";
import { filterTrackGroups } from "@/lib/questions";

/** Track picker drawer on the left: 52 tracks grouped by field, searchable. Opened from the header or the start card. */
export default function CategorySidebar() {
  const { pickerOpen, setPickerOpen, selectedTrack, selectTrack } = useSidebar();
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    // Keyboard users: move focus into the dialog, keep Tab inside it, and give focus back when it closes.
    const opener = document.activeElement as HTMLElement | null;
    searchRef.current?.focus();
    const scrollBefore = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // the page behind shouldn't scroll while the drawer is open
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPickerOpen(false);
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
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
  }, [pickerOpen, setPickerOpen]);

  if (!pickerOpen) return null;

  const groups = filterTrackGroups(query);
  const count = groups.reduce((n, g) => n + g.tracks.length, 0);

  return (
    <div className="fixed inset-0 z-40 flex justify-start">
      <div className="absolute inset-0 animate-fade-in bg-black/50 motion-reduce:animate-none" onClick={() => setPickerOpen(false)} aria-hidden="true" />
      <div
        ref={panelRef}
        id="track-picker"
        role="dialog"
        aria-modal="true"
        aria-label="Choose a track"
        className="relative flex h-full w-full max-w-sm animate-slide-in-left flex-col bg-sage-100 shadow-xl motion-reduce:animate-none"
      >
        <div className="flex items-center justify-between gap-2 border-b border-sage-300 p-4">
          <h2 className="text-lg font-bold text-darkslate-900">Choose a track</h2>
          <IconButton label="Close track picker" onClick={() => setPickerOpen(false)}>✕</IconButton>
        </div>
        <div className="border-b border-sage-300 p-4">
          <label htmlFor="track-search" className="sr-only">Search tracks</label>
          <input
            id="track-search"
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search 52 tracks, e.g. nursing, sales, product"
            className="w-full rounded-xl border border-sage-400 bg-white p-3 text-sm text-darkslate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
          />
          <p className="mt-2 text-xs text-darkslate-600" aria-live="polite">{count} {count === 1 ? "track" : "tracks"}</p>
        </div>
        <div className="flex-1 space-y-6 overflow-y-auto p-4">
          {groups.length === 0 && <p className="text-sm text-darkslate-700">No tracks match “{query}”.</p>}
          {groups.map((group) => (
            <section key={group.id} aria-label={group.name}>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-forest-700">
                <span aria-hidden="true">{group.icon} </span>{group.name}
              </h3>
              <div className="space-y-2">
                {group.tracks.map((track) => (
                  <CategoryCard
                    key={track.name}
                    name={track.name}
                    icon={track.icon}
                    selected={track.name === selectedTrack}
                    onSelect={(name) => {
                      selectTrack(name);
                      setPickerOpen(false);
                      setQuery("");
                      // The chosen track shows on Home, so take people there from other pages.
                      if (pathname && pathname !== "/") router.push("/");
                    }}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
