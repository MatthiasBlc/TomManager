import { renderHook, act } from "@testing-library/react";
import { useOnlineStatus } from "../hooks/useOnlineStatus";

function setNavigatorOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    get: () => value,
  });
}

describe("useOnlineStatus", () => {
  afterEach(() => {
    setNavigatorOnline(true);
  });

  it("returns the initial navigator.onLine value", () => {
    setNavigatorOnline(true);
    const { result: online } = renderHook(() => useOnlineStatus());
    expect(online.current).toBe(true);

    setNavigatorOnline(false);
    const { result: offline } = renderHook(() => useOnlineStatus());
    expect(offline.current).toBe(false);
  });

  it("updates to false when an offline event is fired", () => {
    setNavigatorOnline(true);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);

    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(result.current).toBe(false);
  });

  it("updates to true when an online event is fired", () => {
    setNavigatorOnline(false);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(false);

    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(result.current).toBe(true);
  });

  it("removes its event listeners on unmount", () => {
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => useOnlineStatus());
    unmount();
    expect(removeSpy).toHaveBeenCalledWith("online", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("offline", expect.any(Function));
    removeSpy.mockRestore();
  });
});
