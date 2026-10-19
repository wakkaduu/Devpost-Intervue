import { beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";

// Confirmation-code hashing is keyed with AUTH_SECRET; give tests a fixed one.
process.env.AUTH_SECRET = "test-secret-for-vitest";

// jsdom has no matchMedia. Tests run as a narrow, motion-allowed screen unless they say otherwise.
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

// A browser that can speak (one working voice) is the default for tests, so reading questions aloud makes no network calls.
// Tests about other browsers replace or delete it.
beforeEach(() => {
  if (typeof window === "undefined") return;
  window.sessionStorage?.clear();
  Object.defineProperty(window, "speechSynthesis", {
    configurable: true,
    writable: true,
    value: {
      speak: (u: { onend?: () => void }) => setTimeout(() => u.onend?.(), 0),
      cancel: () => {},
      getVoices: () => [{ name: "Test Voice", lang: "en-US", default: true }],
      addEventListener: () => {},
      removeEventListener: () => {},
    },
  });
  (globalThis as unknown as Record<string, unknown>).SpeechSynthesisUtterance ??= class {
    text: string; rate = 1; lang = ""; voice: unknown;
    onstart?: () => void; onend?: () => void; onerror?: () => void;
    constructor(t: string) { this.text = t; }
  };
});
