import { render } from "@testing-library/react";
import { act } from "react";
import ConnectionStatus from "../components/common/ConnectionStatus";

const useSocketMock = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("../hooks/useSocket", () => ({
  useSocket: () => useSocketMock(),
}));
vi.mock("react-hot-toast", () => ({
  default: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}));

interface FakeSocket {
  connected: boolean;
  on: (event: string, handler: () => void) => void;
  off: (event: string, handler: () => void) => void;
  __emit: (event: string) => void;
}

function createFakeSocket(connected: boolean): FakeSocket {
  const handlers: Record<string, Set<() => void>> = {};
  return {
    connected,
    on(event, handler) {
      handlers[event] = handlers[event] ?? new Set();
      handlers[event].add(handler);
    },
    off(event, handler) {
      handlers[event]?.delete(handler);
    },
    __emit(event) {
      handlers[event]?.forEach((h) => h());
    },
  };
}

describe("ConnectionStatus", () => {
  afterEach(() => {
    useSocketMock.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it("renders nothing when no socket is available", () => {
    useSocketMock.mockReturnValue(null);
    const { container } = render(<ConnectionStatus />);
    expect(container.firstChild).toBeNull();
  });

  it("renders an error badge when the socket is initially disconnected", () => {
    useSocketMock.mockReturnValue(createFakeSocket(false));
    const { container } = render(<ConnectionStatus />);
    const badge = container.querySelector(".badge");
    expect(badge).toHaveClass("badge-error");
    expect(badge).toHaveAttribute("title", "Deconnecte");
  });

  it("renders a success badge when the socket is initially connected", () => {
    useSocketMock.mockReturnValue(createFakeSocket(true));
    const { container } = render(<ConnectionStatus />);
    const badge = container.querySelector(".badge");
    expect(badge).toHaveClass("badge-success");
    expect(badge).toHaveAttribute("title", "Connecte");
  });

  it("updates when the socket emits connect / disconnect events", () => {
    const socket = createFakeSocket(false);
    useSocketMock.mockReturnValue(socket);
    const { container } = render(<ConnectionStatus />);

    let badge = container.querySelector(".badge")!;
    expect(badge).toHaveClass("badge-error");

    act(() => {
      socket.__emit("connect");
    });
    badge = container.querySelector(".badge")!;
    expect(badge).toHaveClass("badge-success");

    act(() => {
      socket.__emit("disconnect");
    });
    badge = container.querySelector(".badge")!;
    expect(badge).toHaveClass("badge-error");
  });

  it("shows an error toast on disconnect", () => {
    const socket = createFakeSocket(true);
    useSocketMock.mockReturnValue(socket);
    render(<ConnectionStatus />);

    act(() => socket.__emit("disconnect"));
    expect(toastError).toHaveBeenCalledWith("Connexion perdue — reconnexion en cours...");
  });

  it("shows a success toast on reconnect, but not on the initial connect", () => {
    const socket = createFakeSocket(false);
    useSocketMock.mockReturnValue(socket);
    render(<ConnectionStatus />);

    act(() => socket.__emit("connect"));
    expect(toastSuccess).not.toHaveBeenCalled();

    act(() => socket.__emit("disconnect"));
    act(() => socket.__emit("connect"));
    expect(toastSuccess).toHaveBeenCalledWith("Connexion retablie");
  });
});
