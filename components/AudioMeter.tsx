/** A small bar meter showing that the microphone is picking up your voice. Decorative: the status text names the state. */
export default function AudioMeter({ level }: { level: number }) {
  const bars = [0.55, 0.8, 1, 0.8, 0.55];
  return (
    <span aria-hidden="true" className="inline-flex h-5 items-end gap-0.5">
      {bars.map((weight, i) => (
        <span
          key={i}
          className="w-1 rounded-full bg-red-600 transition-[height] duration-100 ease-out"
          style={{ height: `${Math.round(4 + Math.min(1, level * weight * 1.4) * 16)}px` }}
        />
      ))}
    </span>
  );
}
