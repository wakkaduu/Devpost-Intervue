"use client";

/**
 * Mutually exclusive buttons (sign in / create account, chart / table) with a highlight that slides to the
 * chosen option. The buttons keep `aria-pressed`, so the choice is announced and keyboard-operable.
 */
export default function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  fill = false,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** Stretch to the full width instead of fitting the labels. */
  fill?: boolean;
}) {
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const n = options.length;
  return (
    <div
      role="group"
      aria-label={label}
      className={`relative grid gap-0 rounded-xl border border-sage-400 bg-white/70 p-1 ${fill ? "w-full" : "w-fit"}`}
      style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-1 left-1 rounded-lg bg-forest-700 shadow-sm transition-transform duration-300 ease-out"
        style={{ width: `calc((100% - 0.5rem) / ${n})`, transform: `translateX(${index * 100}%)` }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={[
            "relative z-10 min-h-[40px] whitespace-nowrap rounded-lg px-4 text-sm font-bold transition-colors duration-300",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600",
            value === o.value ? "text-white" : "text-forest-800 hover:text-forest-950",
          ].join(" ")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
