import { renderHook } from "@testing-library/react";
import { useEventSocket } from "../hooks/useEventSocket";

const useSocketMock = vi.fn();

vi.mock("../hooks/useSocket", () => ({
  useSocket: () => useSocketMock(),
}));

function makeFakeSocket(connected: boolean) {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  return {
    connected,
    emit: vi.fn(),
    on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(cb);
    }),
    off: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      listeners.get(event)?.delete(cb);
    }),
    trigger: (event: string) => {
      listeners.get(event)?.forEach((cb) => cb());
    },
  };
}

describe("useEventSocket", () => {
  it("joins the event room immediately", () => {
    const socket = makeFakeSocket(true);
    useSocketMock.mockReturnValue(socket);
    renderHook(() => useEventSocket("ev1", {}));
    expect(socket.emit).toHaveBeenCalledWith("join:event", { eventId: "ev1" });
  });

  it("does not call onReconnected on the very first connect", () => {
    const socket = makeFakeSocket(false);
    useSocketMock.mockReturnValue(socket);
    const onReconnected = vi.fn();
    renderHook(() => useEventSocket("ev1", { onReconnected }));

    socket.trigger("connect"); // first real connect
    expect(onReconnected).not.toHaveBeenCalled();
  });

  it("re-joins the room and calls onReconnected after a subsequent connect", () => {
    const socket = makeFakeSocket(true);
    useSocketMock.mockReturnValue(socket);
    const onReconnected = vi.fn();
    renderHook(() => useEventSocket("ev1", { onReconnected }));

    socket.emit.mockClear();
    socket.trigger("connect"); // reconnect after a drop
    expect(socket.emit).toHaveBeenCalledWith("join:event", { eventId: "ev1" });
    expect(onReconnected).toHaveBeenCalledTimes(1);
  });

  it("removes the connect listener on unmount", () => {
    const socket = makeFakeSocket(true);
    useSocketMock.mockReturnValue(socket);
    const { unmount } = renderHook(() => useEventSocket("ev1", {}));
    unmount();
    expect(socket.off).toHaveBeenCalledWith("connect", expect.any(Function));
  });
});
