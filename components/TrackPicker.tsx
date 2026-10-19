"use client";

import { forwardRef, useId, useState } from "react";
import Accordion from "@/components/ui/Accordion";
import CategoryCard from "@/components/CategoryCard";
import { useSidebar } from "@/context/SidebarContext";
import { filterTrackGroups } from "@/lib/questions";
import { TRACK_GROUPS } from "@/lib/tracks";

/** Search box plus the 52 tracks, grouped by field into sections that open and close. Used in the docked panel and the drawer. */
const TrackPicker = forwardRef<HTMLInputElement, { onPick: (track: string) => void }>(function TrackPicker({ onPick }, searchRef) {
  const { selectedTrack } = useSidebar();
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const groups = filterTrackGroups(query);
  const count = groups.reduce((n, g) => n + g.tracks.length, 0);
  const searching = query.trim().length > 0;
  const selectedGroup = TRACK_GROUPS.find((g) => g.tracks.some((t) => t.name === selectedTrack))?.id;
  // While searching, every matching section is open; otherwise the chosen track's section starts open.
  const isOpen = (id: string) => searching || (openGroups[id] ?? id === selectedGroup);

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
        <p className="mt-2 text-xs text-darkslate-600" aria-live="polite">{count} {count === 1 ? "track" : "tracks"}</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {groups.length === 0 && <p className="p-4 text-sm text-darkslate-700">No tracks match “{query}”.</p>}
        <div className="divide-y divide-sage-300">
          {groups.map((group) => (
            <Accordion
              key={group.id}
              headingLevel={3}
              open={isOpen(group.id)}
              onOpenChange={(open) => setOpenGroups((o) => ({ ...o, [group.id]: open }))}
              title={<><span aria-hidden="true">{group.icon} </span>{group.name}</>}
              badge={<span className="rounded-full bg-forest-900/10 px-2 py-0.5 text-xs font-semibold text-forest-800">{group.tracks.length}</span>}
            >
              <div className="space-y-2">
                {group.tracks.map((track, i) => (
                  <CategoryCard key={track.name} name={track.name} icon={track.icon} selected={track.name === selectedTrack} onSelect={onPick} index={i} />
                ))}
              </div>
            </Accordion>
          ))}
        </div>
      </div>
    </div>
  );
});

export default TrackPicker;
