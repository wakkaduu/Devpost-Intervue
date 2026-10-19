// Small helpers for staggered entrance animations.

/** Inline style that delays an `animate-fade-up` (or similar) by `index` steps, capped so long lists don't crawl. */
export function stagger(index: number, stepMs = 60, maxMs = 600): { animationDelay: string } {
  return { animationDelay: `${Math.min(index * stepMs, maxMs)}ms` };
}
