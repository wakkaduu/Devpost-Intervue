/** A pulsing placeholder block for content that is on its way. Decorative: the surrounding status text says what is loading. */
export default function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`relative overflow-hidden rounded-lg bg-forest-900/10 ${className}`.trim()}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/50 to-transparent" />
    </div>
  );
}
