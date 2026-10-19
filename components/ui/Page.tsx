import type { ReactNode } from "react";

/** The standard page body: uses the full width of the window up to very large screens, with comfortable side padding. */
export default function Page({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[96rem] px-4 py-8 sm:px-6 lg:px-10 lg:py-10 ${className}`.trim()}>{children}</div>;
}
