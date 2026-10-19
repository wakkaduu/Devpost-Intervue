"use client";

import { useState, type InputHTMLAttributes } from "react";

/** A password field with a show/hide button, so a typo in a long password can be spotted and fixed. */
export default function PasswordInput({ className = "", ...input }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative mt-1">
      <input
        {...input}
        type={visible ? "text" : "password"}
        className={`min-h-[44px] w-full rounded-xl border border-sage-400 bg-white pl-3 pr-20 text-darkslate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 ${className}`.trim()}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-1 my-1 rounded-lg px-3 text-sm font-semibold text-forest-700 hover:bg-forest-900/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
      >
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  );
}
