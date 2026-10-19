/** The Intervue mark (public/intervue-logo.svg). Decorative when it sits next to the app name. */
export default function Logo({ size = 32, className = "", alt = "" }: { size?: number; className?: string; alt?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- a small static SVG; no image optimisation needed
  return <img src="/intervue-logo.svg" width={size} height={size} alt={alt} className={`shrink-0 ${className}`.trim()} />;
}
