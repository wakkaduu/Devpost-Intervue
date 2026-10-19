"use client";

import { forwardRef, useEffect, useId, useRef, useState } from "react";
import CategoryCard from "@/components/CategoryCard";
import { useSidebar } from "@/context/SidebarContext";
import { filterTracks } from "@/lib/questions";

/** Search box plus all 52 tracks in one list, so nothing is hidden behind a section. Used in the docked panel and the drawer. */
const TrackPicker = forwardRef<HTMLInputElement, { onPick: (track: string) => void }>(function TrackPicker({ onPick }, searchRef) {
  const { selectedTrack } = useSidebar();
  const inputId = useId();
  const [query, setQuery] = useState("");
  const listRef = useRef<HTMLUListElement>(null);

  const tracks = filterTracks(query);

  // Bring the chosen track into view when the list first appears.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.scrollIntoView?.({ block: "center" });
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-sage-300 p-4">
        <label htmlFor={inputId} className="sr-only">Search tracks</label>
        <input
          id={inputId}
          ref={searchRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search 52 tracks, e.g. nursing, sales"
          className="w-full rounded-xl border border-sage-400 bg-white p-3 text-sm text-darkslate-900 transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
        />
        <p className="mt-2 text-xs text-darkslate-600" aria-live="polite">{tracks.length} {tracks.length === 1 ? "track" : "tracks"}</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tracks.length === 0 ? (
          <p className="p-1 text-sm text-darkslate-700">No tracks match “{query}”.</p>
        ) : (
          <ul ref={listRef} aria-label="Interview tracks" className="space-y-2">
            {tracks.map((track, i) => (
              <li key={track.name}>
                <CategoryCard name={track.name} icon={track.icon} selected={track.name === selectedTrack} onSelect={onPick} index={i} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
});

export default TrackPicker;
