"use client";

/** A small row of mutually exclusive buttons (sign in / create account, chart / table). */
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
  /** Stretch the buttons to share the full width. */
  fill?: boolean;
}) {
  return (
    <div role="group" aria-label={label} className={fill ? "grid gap-2" : "flex gap-1"} style={fill ? { gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` } : undefined}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={[
            "min-h-[44px] rounded-xl px-4 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600",
            value === o.value ? "bg-forest-700 text-white" : "border border-sage-400 bg-white text-forest-800 hover:border-forest-600",
          ].join(" ")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
