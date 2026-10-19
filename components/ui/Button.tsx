"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

import { BASE, VARIANTS, buttonClasses, type ButtonSize, type ButtonVariant } from "@/components/ui/button-classes";

export { buttonClasses };
export type { ButtonSize, ButtonVariant };

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
