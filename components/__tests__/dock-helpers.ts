// A fake matchMedia for tests that need a wide (desktop) or narrow screen.
const make = (matches: boolean) => (query: string) => ({
  matches,
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
});

export const DOCK = { wide: make(true), narrow: make(false) };
