import "@testing-library/jest-dom";
import "vitest-axe/extend-expect";
import * as matchers from "vitest-axe/matchers";
import { expect } from "vitest";
expect.extend(matchers);

// Mock window.matchMedia for jsdom (used by useIsMobile hook)
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});
