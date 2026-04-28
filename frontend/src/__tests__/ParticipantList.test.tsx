import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ParticipantList from "../components/events/ParticipantList";

const useAuthMock = vi.fn();
const useIsMobileMock = vi.fn();
const apiDeleteMock = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));
vi.mock("../hooks/useIsMobile", () => ({
  useIsMobile: () => useIsMobileMock(),
}));
vi.mock("../config/api", () => ({
  default: { delete: (...args: unknown[]) => apiDeleteMock(...args) },
}));
vi.mock("react-hot-toast", () => ({
  default: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}));

const baseParticipants = [
  {
    userId: "u1",
    username: "Alice",
    role: "ADMIN",
    joinedAt: "2026-01-01T10:00:00.000Z",
  },
  {
    userId: "u2",
    username: "Bob",
    role: "USER",
    joinedAt: "2026-01-02T10:00:00.000Z",
  },
];

describe("ParticipantList", () => {
  beforeEach(() => {
    useAuthMock.mockReset();
    useIsMobileMock.mockReset().mockReturnValue(false);
    apiDeleteMock.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the empty state when no participants", () => {
    useAuthMock.mockReturnValue({ user: { id: "u1" } });
    render(
      <ParticipantList
        eventId="ev1"
        createdBy="u1"
        participants={[]}
        onChanged={vi.fn()}
      />,
    );
    expect(screen.getByText("No participants yet")).toBeInTheDocument();
  });

  it("renders all participants in a desktop table", () => {
    useAuthMock.mockReturnValue({ user: { id: "u1" } });
    render(
      <ParticipantList
        eventId="ev1"
        createdBy="u1"
        participants={baseParticipants}
        onChanged={vi.fn()}
      />,
    );
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("shows the Remove button for non-creator participants when current user is creator", () => {
    useAuthMock.mockReturnValue({ user: { id: "u1" } });
    render(
      <ParticipantList
        eventId="ev1"
        createdBy="u1"
        participants={baseParticipants}
        onChanged={vi.fn()}
      />,
    );
    const removes = screen.getAllByRole("button", { name: "Remove" });
    expect(removes).toHaveLength(1);
  });

  it("does not show Remove buttons when current user is not the creator", () => {
    useAuthMock.mockReturnValue({ user: { id: "u2" } });
    render(
      <ParticipantList
        eventId="ev1"
        createdBy="u1"
        participants={baseParticipants}
        onChanged={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Remove" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /leave event/i }),
    ).toBeInTheDocument();
  });

  it("does not show Leave button for the creator", () => {
    useAuthMock.mockReturnValue({ user: { id: "u1" } });
    render(
      <ParticipantList
        eventId="ev1"
        createdBy="u1"
        participants={baseParticipants}
        onChanged={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /leave event/i }),
    ).not.toBeInTheDocument();
  });

  it("calls api.delete and onChanged when Remove is clicked", async () => {
    apiDeleteMock.mockResolvedValue({});
    const onChanged = vi.fn();
    useAuthMock.mockReturnValue({ user: { id: "u1" } });
    render(
      <ParticipantList
        eventId="ev1"
        createdBy="u1"
        participants={baseParticipants}
        onChanged={onChanged}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => {
      expect(apiDeleteMock).toHaveBeenCalledWith(
        "/api/events/ev1/participants/u2",
      );
      expect(onChanged).toHaveBeenCalled();
      expect(toastSuccess).toHaveBeenCalled();
    });
  });

  it("calls api.delete and onChanged when Leave is clicked", async () => {
    apiDeleteMock.mockResolvedValue({});
    const onChanged = vi.fn();
    useAuthMock.mockReturnValue({ user: { id: "u2" } });
    render(
      <ParticipantList
        eventId="ev1"
        createdBy="u1"
        participants={baseParticipants}
        onChanged={onChanged}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /leave event/i }));
    await waitFor(() => {
      expect(apiDeleteMock).toHaveBeenCalledWith(
        "/api/events/ev1/participants/me",
      );
      expect(onChanged).toHaveBeenCalled();
    });
  });

  it("renders cards (no table) on mobile", () => {
    useIsMobileMock.mockReturnValue(true);
    useAuthMock.mockReturnValue({ user: { id: "u1" } });
    render(
      <ParticipantList
        eventId="ev1"
        createdBy="u1"
        participants={baseParticipants}
        onChanged={vi.fn()}
      />,
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });
});
