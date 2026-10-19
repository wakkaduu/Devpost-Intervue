import type { ReactNode } from "react";

/**
 * The one way to show a problem or a notice. Errors are announced immediately (role="alert");
 * warnings are announced politely (role="status"). Colour never carries the meaning alone: the text does.
 */
export default function ErrorMessage({
  children,
  variant = "error",
  className = "",
}: {
  children: ReactNode;
  variant?: "error" | "warning";
  className?: string;
}) {
  const styles = variant === "error" ? "bg-red-50 text-red-800" : "bg-gold-100 text-gold-900";
  return (
    <div role={variant === "error" ? "alert" : "status"} className={`rounded-lg p-3 text-sm ${styles} ${className}`.trim()}>
      {children}
    </div>
  );
}
