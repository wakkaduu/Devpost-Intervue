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
