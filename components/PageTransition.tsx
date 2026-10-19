"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Gives each page a short fade-and-rise when you arrive on it. The key restarts the animation on every navigation. */
export default function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="animate-fade-up">
      {children}
    </div>
  );
}
