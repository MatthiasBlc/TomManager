import { renderHook, act } from "@testing-library/react";
import { useIsMobile } from "../hooks/useIsMobile";

type Listener = (e: MediaQueryListEvent) => void;

interface MockMediaQueryList {
  matches: boolean;
  media: string;
  addEventListener: (type: "change", listener: Listener) => void;
  removeEventListener: (type: "change", listener: Listener) => void;
  dispatchEvent: (matches: boolean) => void;
}

function createMatchMedia(initialMatches: boolean) {
  const listeners = new Set<Listener>();
  const mql: MockMediaQueryList = {
    matches: initialMatches,
    media: "(max-width: 767px)",
    addEventListener: (_type, listener) => {
      listeners.add(listener);
    },
    removeEventListener: (_type, listener) => {
      listeners.delete(listener);
    },
    dispatchEvent: (matches: boolean) => {
      mql.matches = matches;
      listeners.forEach((l) => l({ matches } as MediaQueryListEvent));
    },
  };
  return mql;
}

describe("useIsMobile", () => {
  let currentMql: MockMediaQueryList;

  beforeEach(() => {
    currentMql = createMatchMedia(false);
    window.matchMedia = vi.fn().mockImplementation(() => currentMql) as unknown as typeof window.matchMedia;
  });

  it("returns false when viewport is wider than the mobile breakpoint", () => {
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it("returns true when matchMedia reports a mobile viewport", () => {
    currentMql = createMatchMedia(true);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it("updates when the media query changes", () => {
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    act(() => {
      currentMql.dispatchEvent(true);
    });
    expect(result.current).toBe(true);

    act(() => {
      currentMql.dispatchEvent(false);
    });
    expect(result.current).toBe(false);
  });

  it("removes its listener on unmount", () => {
    const removeSpy = vi.spyOn(currentMql, "removeEventListener");
    const { unmount } = renderHook(() => useIsMobile());
    unmount();
    expect(removeSpy).toHaveBeenCalledWith("change", expect.any(Function));
  });
});
