"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession as useAccount } from "next-auth/react";
import ScoreTrendChart from "@/components/ScoreTrendChart";
import { buttonClasses } from "@/components/ui/button-classes";
import Button from "@/components/ui/Button";
import { loadGuestSessions, removeGuestSessions } from "@/lib/guest-storage";
import { trendPoints, trendSummary } from "@/lib/progress-trend";
import { splitTrackName } from "@/lib/questions";
import type { SavedSession } from "@/types";

const dateFmt = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

export default function HistoryView() {
  const { status } = useAccount();
  const signedIn = status === "authenticated";
  const [sessions, setSessions] = useState<SavedSession[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [localOnly, setLocalOnly] = useState<SavedSession[]>([]);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [track, setTrack] = useState("");
  const [view, setView] = useState<"chart" | "table">("chart");

  // Signed in: history comes from the account. Guests: from this browser.
  // Sessions still sitting in this browser while signed in can be added to the account.
  async function load() {
    setLoadError(null);
    if (!signedIn) {
      setSessions(loadGuestSessions());
      setLocalOnly([]);
      return;
    }
    try {
      const res = await fetch("/api/history");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "We couldn't load your history.");
      const account: SavedSession[] = data.sessions;
      const known = new Set(account.map((s) => s.id));
      setLocalOnly(loadGuestSessions().filter((s) => !known.has(s.id)));
      setSessions(account);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "We couldn't load your history.");
    }
  }

  useEffect(() => {
    if (status === "loading") return;
    void load();
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  async function importLocal() {
    setImporting(true);
    setImportError(null);
    try {
      for (let i = 0; i < localOnly.length; i += 50) {
        const batch = localOnly.slice(i, i + 50);
        const res = await fetch("/api/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessions: batch }),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "Import failed.");
        removeGuestSessions(batch.map((s) => s.id));
      }
      await load();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  }

  const tracks = useMemo(() => [...new Set((sessions ?? []).map((s) => s.category))].sort(), [sessions]);
  const points = useMemo(() => trendPoints(sessions ?? [], track || null), [sessions, track]);
  const summary = trendSummary(points);

  const importBox = (
    <div className="text-sm text-darkslate-900">
      <p>
        {localOnly.length} {localOnly.length === 1 ? "session" : "sessions"} from this browser {localOnly.length === 1 ? "isn’t" : "aren’t"} in your account yet.
      </p>
      <Button className="mt-2" size="sm" loading={importing} onClick={() => void importLocal()}>Add to my account</Button>
      {importError && <p role="alert" className="mt-2 text-red-700">{importError}</p>}
    </div>
  );

  if (loadError) {
    return (
      <div role="alert" className="rounded-2xl bg-sage-100 p-6 text-darkslate-900">
        <h1 className="text-xl font-semibold">We couldn’t load your history</h1>
        <p className="mt-1 text-sm">{loadError}</p>
        <Button className="mt-4" onClick={() => void load()}>Try again</Button>
      </div>
    );
  }
  if (sessions === null) return <p className="text-forest-100" role="status">Loading your history…</p>;

  if (sessions.length === 0) {
    return (
      <div className="space-y-4 rounded-2xl bg-sage-100 p-6 text-darkslate-900">
        {localOnly.length > 0 && importBox}
        <h1 className="text-xl font-semibold">No sessions yet</h1>
        <p className="mt-1 text-sm">Finish your first practice session and its score will show up here, so you can see whether you’re improving.</p>
        <Link href="/" className={buttonClasses({ className: "mt-4" })}>Start your first session</Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {localOnly.length > 0 && <div className="rounded-2xl bg-sage-100 p-4">{importBox}</div>}
      <section aria-label="Progress" className="rounded-2xl bg-sage-100 p-5 sm:p-6 text-darkslate-900">
        <h1 className="text-xl font-bold">Your progress</h1>

        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <label htmlFor="track-filter" className="block text-xs font-bold uppercase tracking-wide text-forest-600">Track</label>
            <select
              id="track-filter"
              value={track}
              onChange={(e) => setTrack(e.target.value)}
              className="mt-1 min-h-[44px] max-w-full rounded-xl border border-sage-400 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
            >
              <option value="">All tracks</option>
              {tracks.map((t) => <option key={t} value={t}>{splitTrackName(t).title}</option>)}
            </select>
          </div>
          <div role="group" aria-label="Chart or table" className="flex gap-1">
            {(["chart", "table"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={[
                  "min-h-[44px] rounded-xl px-4 text-sm font-bold capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600",
                  view === v ? "bg-forest-700 text-white" : "border border-sage-400 bg-white text-forest-800",
                ].join(" ")}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        <p className="mt-4 text-base font-semibold" aria-live="polite">
          {summary ? summary.text : "Complete one more session in this view to see how you’re changing."}
        </p>

        {view === "chart" ? (
          <div className="mt-2">
            <ScoreTrendChart points={points} />
            <p className="text-xs text-darkslate-600">Average score per session, out of 10. Newest on the right.</p>
          </div>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Average score for each session</caption>
              <thead>
                <tr className="border-b border-sage-300 text-xs uppercase tracking-wide text-darkslate-600">
                  <th scope="col" className="py-2 pr-3">Date</th>
                  <th scope="col" className="py-2 pr-3">Track</th>
                  <th scope="col" className="py-2 pr-3 text-right">Score</th>
                  <th scope="col" className="py-2 text-right">Answers</th>
                </tr>
              </thead>
              <tbody>
                {[...sessions]
                  .filter((s) => !track || s.category === track)
                  .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
                  .map((s) => (
                    <tr key={s.id} className="border-b border-sage-300/60">
                      <td className="py-2 pr-3 whitespace-nowrap">{dateFmt.format(new Date(s.createdAt))}</td>
                      <td className="py-2 pr-3">{splitTrackName(s.category).title}</td>
                      <td className="py-2 pr-3 text-right font-bold tabular-nums">{s.averageScore}</td>
                      <td className="py-2 text-right tabular-nums">{s.questionCount}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-4 text-xs text-darkslate-600">
          {signedIn ? (
            "Saved to your account, so it follows you across devices."
          ) : (
            <>Saved in this browser. <Link href="/login?callbackUrl=/history" className="font-semibold text-forest-700 underline">Sign in</Link> to keep your history across devices.</>
          )}
        </p>
      </section>
    </div>
  );
}
