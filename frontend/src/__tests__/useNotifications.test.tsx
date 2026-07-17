import { renderHook, waitFor, act } from "@testing-library/react";
import { useNotifications } from "../hooks/useNotifications";

const apiGetMock = vi.fn();
const apiPatchMock = vi.fn();
const apiDeleteMock = vi.fn();
const toastError = vi.fn();

vi.mock("../config/api", () => ({
  default: {
    get: (...args: unknown[]) => apiGetMock(...args),
    patch: (...args: unknown[]) => apiPatchMock(...args),
    delete: (...args: unknown[]) => apiDeleteMock(...args),
  },
}));
vi.mock("react-hot-toast", () => ({
  default: { error: (...a: unknown[]) => toastError(...a) },
}));
const useSocketMock = vi.fn(() => null as ReturnType<typeof makeFakeSocket> | null);
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
    trigger: (event: string, ...args: unknown[]) => {
      listeners.get(event)?.forEach((cb) => cb(...args));
    },
  };
}

const baseNotification = {
  id: "n1",
  userId: "u1",
  type: "TABLE_UPDATED",
  title: "Table mise a jour",
  message: "Le donjon a change",
  metadata: null,
  read: false,
  readAt: null,
  createdAt: "2026-04-10T10:00:00.000Z",
};

describe("useNotifications", () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPatchMock.mockReset();
    apiDeleteMock.mockReset();
    toastError.mockReset();
    useSocketMock.mockReturnValue(null);
  });

  it("loads notifications and unread count on mount", async () => {
    apiGetMock.mockImplementation((url: string) =>
      url.includes("unread-count")
        ? Promise.resolve({ data: { data: { count: 1 } } })
        : Promise.resolve({ data: { data: [baseNotification], nextCursor: null } })
    );
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));
    expect(result.current.unreadCount).toBe(1);
    expect(toastError).not.toHaveBeenCalled();
  });

  it("shows an error toast when the initial fetch fails", async () => {
    apiGetMock.mockRejectedValue(new Error("network"));
    const { result } = renderHook(() => useNotifications());
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Echec du chargement des notifications")
    );
    expect(result.current.notifications).toEqual([]);
  });

  it("shows an error toast when markAsRead fails", async () => {
    apiGetMock.mockImplementation((url: string) =>
      url.includes("unread-count")
        ? Promise.resolve({ data: { data: { count: 1 } } })
        : Promise.resolve({ data: { data: [baseNotification], nextCursor: null } })
    );
    apiPatchMock.mockRejectedValue(new Error("network"));
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));

    await act(() => result.current.markAsRead("n1"));
    expect(toastError).toHaveBeenCalledWith("Echec du marquage comme lu");
  });

  it("shows an error toast when deleteNotification fails", async () => {
    apiGetMock.mockImplementation((url: string) =>
      url.includes("unread-count")
        ? Promise.resolve({ data: { data: { count: 1 } } })
        : Promise.resolve({ data: { data: [baseNotification], nextCursor: null } })
    );
    apiDeleteMock.mockRejectedValue(new Error("network"));
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));

    await act(() => result.current.deleteNotification("n1"));
    expect(toastError).toHaveBeenCalledWith("Echec de la suppression de la notification");
  });

  it("adds a notification received via socket and ignores duplicates", async () => {
    const socket = makeFakeSocket(true);
    useSocketMock.mockReturnValue(socket);
    apiGetMock.mockImplementation((url: string) =>
      url.includes("unread-count")
        ? Promise.resolve({ data: { data: { count: 0 } } })
        : Promise.resolve({ data: { data: [], nextCursor: null } })
    );
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled());

    await act(() => {
      socket.trigger("notification:new", { notification: baseNotification });
    });
    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.unreadCount).toBe(1);

    // Doublon (course refetch/socket) : ignore, pas de double increment
    await act(() => {
      socket.trigger("notification:new", { notification: baseNotification });
    });
    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.unreadCount).toBe(1);
  });

  it("syncs a read from another device and stays idempotent on the echo", async () => {
    const socket = makeFakeSocket(true);
    useSocketMock.mockReturnValue(socket);
    apiGetMock.mockImplementation((url: string) =>
      url.includes("unread-count")
        ? Promise.resolve({ data: { data: { count: 2 } } })
        : Promise.resolve({ data: { data: [baseNotification], nextCursor: null } })
    );
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));

    // Lecture faite sur un autre appareil : l'item local passe lu, compteur -1
    await act(() => {
      socket.trigger("notification:read", { id: "n1" });
    });
    expect(result.current.notifications[0].read).toBe(true);
    expect(result.current.unreadCount).toBe(1);

    // Echo du meme evenement (ou action locale redondante) : no-op
    await act(() => {
      socket.trigger("notification:read", { id: "n1" });
    });
    expect(result.current.unreadCount).toBe(1);
  });

  it("does not double-decrement when the socket echo follows a local markAsRead", async () => {
    const socket = makeFakeSocket(true);
    useSocketMock.mockReturnValue(socket);
    apiGetMock.mockImplementation((url: string) =>
      url.includes("unread-count")
        ? Promise.resolve({ data: { data: { count: 1 } } })
        : Promise.resolve({ data: { data: [baseNotification], nextCursor: null } })
    );
    apiPatchMock.mockResolvedValue({});
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));

    await act(() => result.current.markAsRead("n1"));
    expect(result.current.unreadCount).toBe(0);

    // L'appareil emetteur recoit aussi l'echo de sa propre action
    await act(() => {
      socket.trigger("notification:read", { id: "n1" });
    });
    expect(result.current.unreadCount).toBe(0);
  });

  it("decrements the counter for a read notification beyond the loaded page", async () => {
    const socket = makeFakeSocket(true);
    useSocketMock.mockReturnValue(socket);
    apiGetMock.mockImplementation((url: string) =>
      url.includes("unread-count")
        ? Promise.resolve({ data: { data: { count: 3 } } })
        : Promise.resolve({ data: { data: [baseNotification], nextCursor: null } })
    );
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));

    // Notification non chargee localement, lue ailleurs : le compteur bouge quand meme
    await act(() => {
      socket.trigger("notification:read", { id: "n-far-away" });
    });
    expect(result.current.unreadCount).toBe(2);
  });

  it("syncs read-all and delete from another device", async () => {
    const socket = makeFakeSocket(true);
    useSocketMock.mockReturnValue(socket);
    const second = { ...baseNotification, id: "n2" };
    apiGetMock.mockImplementation((url: string) =>
      url.includes("unread-count")
        ? Promise.resolve({ data: { data: { count: 2 } } })
        : Promise.resolve({ data: { data: [baseNotification, second], nextCursor: null } })
    );
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.notifications).toHaveLength(2));

    await act(() => {
      socket.trigger("notification:deleted", { id: "n2" });
    });
    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.unreadCount).toBe(1);

    // Suppression d'un id absent : no-op
    await act(() => {
      socket.trigger("notification:deleted", { id: "n2" });
    });
    expect(result.current.unreadCount).toBe(1);

    await act(() => {
      socket.trigger("notification:read-all");
    });
    expect(result.current.unreadCount).toBe(0);
    expect(result.current.notifications.every((n) => n.read)).toBe(true);
  });

  it("refetches notifications after a socket reconnect (not on the first connect)", async () => {
    const socket = makeFakeSocket(true);
    useSocketMock.mockReturnValue(socket);
    apiGetMock.mockImplementation((url: string) =>
      url.includes("unread-count")
        ? Promise.resolve({ data: { data: { count: 1 } } })
        : Promise.resolve({ data: { data: [baseNotification], nextCursor: null } })
    );
    renderHook(() => useNotifications());
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled());

    apiGetMock.mockClear();
    await act(() => {
      socket.trigger("connect");
    });
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled());
  });
});
