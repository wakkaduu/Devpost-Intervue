"use client";

import { useId, useState, type ReactNode } from "react";

/**
 * One expandable section. The button announces whether the panel is open; the panel slides open and closed
 * (animating grid rows, so no fixed heights are needed) and is removed from the tab order and from
 * screen readers while closed.
 */
export default function Accordion({
  title,
  badge,
  eyebrow,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  headingLevel = 3,
  className = "",
  children,
}: {
  title: ReactNode;
  /** Small label on the right of the header, such as a score. */
  badge?: ReactNode;
  eyebrow?: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  headingLevel?: 2 | 3 | 4;
  className?: string;
  children: ReactNode;
}) {
  const [inner, setInner] = useState(defaultOpen);
  const open = controlledOpen ?? inner;
  const id = useId();
  const Heading = `h${headingLevel}` as "h2" | "h3" | "h4";

  function toggle() {
    const next = !open;
    if (controlledOpen === undefined) setInner(next);
    onOpenChange?.(next);
  }

  return (
    <div className={`group/acc overflow-hidden ${className}`.trim()}>
      <Heading className="m-0">
        <button
          type="button"
          id={`${id}-button`}
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          onClick={toggle}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors duration-200 hover:bg-forest-900/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-forest-600 sm:px-5"
        >
          <span className="min-w-0 flex-1">
            {eyebrow && <span className="eyebrow block">{eyebrow}</span>}
            <span className="block text-base font-semibold leading-snug">{title}</span>
          </span>
          {badge && <span className="shrink-0">{badge}</span>}
          <svg
            aria-hidden="true"
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`shrink-0 text-forest-600 transition-transform duration-300 ease-out ${open ? "rotate-180" : ""}`}
          >
            <path d="M5 8l5 5 5-5" />
          </svg>
        </button>
      </Heading>
      <div
        id={`${id}-panel`}
        role="region"
        aria-labelledby={`${id}-button`}
        aria-hidden={!open}
        // `inert` keeps hidden content out of the tab order; React 19 understands it as a boolean attribute.
        inert={!open}
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className={`px-4 pb-5 pt-1 transition-transform duration-300 ease-out sm:px-5 ${open ? "translate-y-0" : "-translate-y-2"}`}>{children}</div>
        </div>
      </div>
    </div>
  );
}
