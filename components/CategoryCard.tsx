import { splitTrackName } from "@/lib/questions";
import { stagger } from "@/lib/motion";

interface Props {
  name: string;
  icon: string;
  selected: boolean;
  onSelect: (name: string) => void;
  index?: number;
}

export default function CategoryCard({ name, icon, selected, onSelect, index = 0 }: Props) {
  const { title, blurb } = splitTrackName(name);
  return (
    <button
      type="button"
      onClick={() => onSelect(name)}
      aria-pressed={selected}
      style={stagger(index, 30, 300)}
      className={[
        "group flex w-full min-h-[56px] animate-fade-up items-start gap-3 rounded-xl border p-3 text-left transition duration-200",
        "hover:translate-x-1 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600",
        selected ? "border-forest-700 bg-white shadow-sm" : "border-sage-300 bg-sage-50 hover:bg-white",
      ].join(" ")}
    >
      <span aria-hidden="true" className="text-xl leading-6 transition-transform duration-200 group-hover:scale-110">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block break-words text-sm font-semibold text-darkslate-900">{title}</span>
        {blurb && <span className="mt-0.5 block break-words text-xs text-darkslate-600">{blurb}</span>}
      </span>
      {selected && (
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="#1F7A4D" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 animate-pop">
          <path d="M4 10.5l4 4 8-9" />
        </svg>
      )}
    </button>
  );
}
