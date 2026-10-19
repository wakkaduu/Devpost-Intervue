// Button class names, kept free of "use client" so server components can style links as buttons.
/**
 * Shared button system. Every button in the app should come from here so that
 * focus rings, press feedback, disabled/loading states and touch-target sizes
 * stay consistent.
 *
 * Variants (pick by the surface the button sits on and its importance):
 *   primary    main action on a LIGHT card (filled forest green)
 *   secondary  supporting action on a LIGHT card (outlined)
 *   ghost      low-emphasis action on a LIGHT card (text only)
 *   accent     main action on the DARK canvas/header (filled emerald)
 *   dark       supporting action on the DARK canvas/header (outlined)
 *   danger     destructive or failed-state action
 *
 * Sizes: sm (36px, 40px on phones) · md (44px) · lg (52px)
 */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "accent" | "dark" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export const BASE =
  "inline-flex items-center justify-center gap-2 font-bold text-center select-none " +
  "transition-[background-color,border-color,color,box-shadow,transform] duration-150 motion-reduce:transition-none " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 " +
  "active:translate-y-px motion-reduce:active:translate-y-0 " +
  "disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0 aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

export const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-forest-700 text-white shadow-sm hover:-translate-y-0.5 hover:bg-forest-600 hover:shadow-lift active:bg-forest-800 focus-visible:ring-forest-600 ring-offset-sage-100",
  secondary:
    "border border-forest-600/60 bg-white/70 text-forest-800 hover:-translate-y-0.5 hover:bg-white hover:border-forest-600 hover:shadow-card focus-visible:ring-forest-600 ring-offset-sage-100",
  ghost:
    "text-forest-800 hover:bg-forest-900/10 focus-visible:ring-forest-600 ring-offset-sage-100",
  accent:
    "bg-emerald-400 text-emerald-950 shadow-sm hover:bg-emerald-300 active:bg-emerald-500 focus-visible:ring-emerald-300 ring-offset-forest-900",
  dark:
    "border border-forest-600/80 bg-forest-800/80 text-emerald-200 hover:bg-forest-700 hover:text-white focus-visible:ring-emerald-300 ring-offset-forest-900",
  danger:
    "bg-red-600 text-white shadow-sm hover:bg-red-700 active:bg-red-800 focus-visible:ring-red-500 ring-offset-sage-100",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "min-h-[36px] max-sm:min-h-[40px] px-3 text-xs rounded-lg",
  md: "min-h-[44px] px-4 text-sm rounded-xl",
  lg: "min-h-[52px] px-6 text-base rounded-2xl",
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className = "",
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
} = {}): string {
  return [BASE, VARIANTS[variant], SIZES[size], fullWidth ? "w-full" : "", className]
    .filter(Boolean)
    .join(" ");
}

