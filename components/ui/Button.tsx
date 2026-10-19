"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

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

const BASE =
  "inline-flex items-center justify-center gap-2 font-bold whitespace-nowrap select-none " +
  "transition-[background-color,border-color,color,box-shadow,transform] duration-150 motion-reduce:transition-none " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 " +
  "active:translate-y-px motion-reduce:active:translate-y-0 " +
  "disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0 aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-forest-700 text-white shadow-sm hover:bg-forest-600 active:bg-forest-800 focus-visible:ring-forest-600 ring-offset-sage-100",
  secondary:
    "border border-forest-600/60 bg-white/70 text-forest-800 hover:bg-white hover:border-forest-600 focus-visible:ring-forest-600 ring-offset-sage-100",
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

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  /** Shows a spinner, disables the button and sets aria-busy. */
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export default function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  loading = false,
  leftIcon,
  rightIcon,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, fullWidth, className })}
      {...rest}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : (
        leftIcon
      )}
      {children}
      {!loading && rightIcon}
    </button>
  );
}

const ICON_SIZES = {
  sm: "h-9 w-9 max-sm:h-10 max-sm:w-10 rounded-lg",
  md: "h-11 w-11 rounded-xl",
} as const;

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required accessible name: icon-only buttons have no visible text. */
  label: string;
  variant?: "ghost" | "dark";
  size?: keyof typeof ICON_SIZES;
  /** Highlights the button when it represents an "on" state (also set aria-pressed). */
  active?: boolean;
}

/** Square icon-only button (close, replay, mute...) with the same states and focus ring as Button. */
export function IconButton({
  label,
  variant = "ghost",
  size = "md",
  active = false,
  className = "",
  children,
  type = "button",
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={rest.title ?? label}
      className={[
        BASE,
        "!gap-0 shrink-0",
        variant === "dark" ? VARIANTS.dark : "text-darkslate-600 hover:bg-forest-900/10 hover:text-darkslate-900 focus-visible:ring-forest-600 ring-offset-sage-100",
        active ? "!bg-amber-100 !text-amber-900 border border-amber-300" : "",
        ICON_SIZES[size],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </button>
  );
}
