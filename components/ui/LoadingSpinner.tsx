/** A spinner with a text label, announced to screen readers. `onCanvas` is for the dark green page background. */
export default function LoadingSpinner({ label, onCanvas = false, className = "" }: { label: string; onCanvas?: boolean; className?: string }) {
  return (
    <p role="status" className={`flex items-center gap-2 text-sm font-semibold ${onCanvas ? "text-forest-100" : "text-darkslate-600"} ${className}`.trim()}>
      <span aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" />
      {label}
    </p>
  );
}
