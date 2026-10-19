import { splitTrackName } from "@/lib/questions";

interface Props {
  name: string;
  icon: string;
  selected: boolean;
  onSelect: (name: string) => void;
}

export default function CategoryCard({ name, icon, selected, onSelect }: Props) {
  const { title, blurb } = splitTrackName(name);
  return (
    <button
      type="button"
      onClick={() => onSelect(name)}
      aria-pressed={selected}
      className={[
        "flex w-full min-h-[56px] items-start gap-3 rounded-xl border p-3 text-left transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600",
        selected ? "border-forest-700 bg-white shadow-sm" : "border-sage-300 bg-sage-50 hover:bg-white",
      ].join(" ")}
    >
      <span aria-hidden="true" className="text-xl leading-6">{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-darkslate-900">{title}</span>
        {blurb && <span className="mt-0.5 block text-xs text-darkslate-600">{blurb}</span>}
      </span>
    </button>
  );
}
