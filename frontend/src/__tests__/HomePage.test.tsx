import { screen, waitFor, fireEvent } from "@testing-library/react";
import { renderWithRouter } from "../test/renderWithRouter";
import HomePage from "../pages/HomePage";

const useAuthMock = vi.fn();
const navigateMock = vi.fn();
const apiGetMock = vi.fn();

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));
vi.mock("../config/api", () => ({
  default: { get: (...args: unknown[]) => apiGetMock(...args) },
}));
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

function mockAuth(overrides: {
  user?: { id: string; username: string; role?: "USER" | "ADMIN" } | null;
  loading?: boolean;
  preferences?: Record<string, boolean>;
}) {
  useAuthMock.mockReturnValue({
    user: null,
    loading: false,
    preferences: {},
    ...overrides,
  });
}

describe("HomePage", () => {
  beforeEach(() => {
    useAuthMock.mockReset();
    navigateMock.mockReset();
    apiGetMock.mockReset();
  });

  it("renders the welcome message and the direct Discord login button", () => {
    mockAuth({ user: null, loading: false });
    renderWithRouter(<HomePage />);
    expect(screen.getByText("TomManager")).toBeInTheDocument();
    expect(screen.getByText(/Organisez vos soirées jeux/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Se connecter avec Discord/i })).toBeInTheDocument();
  });

  it("launches the Discord OAuth directly when clicking the login button", () => {
    const initiateDiscordLogin = vi.fn().mockResolvedValue(true);
    useAuthMock.mockReturnValue({
      user: null,
      loading: false,
      preferences: {},
      initiateDiscordLogin,
    });
    renderWithRouter(<HomePage />);
    fireEvent.click(screen.getByRole("button", { name: /Se connecter avec Discord/i }));
    expect(initiateDiscordLogin).toHaveBeenCalledWith("/");
  });

  it("does not navigate when still loading auth", () => {
    mockAuth({ user: null, loading: true });
    renderWithRouter(<HomePage />);
    expect(navigateMock).not.toHaveBeenCalled();
    expect(apiGetMock).not.toHaveBeenCalled();
  });

  it("navigates directly to the event when the user has exactly one", async () => {
    mockAuth({ user: { id: "u1", username: "Alice", role: "USER" } });
    apiGetMock.mockResolvedValue({ data: { data: [{ id: "ev1" }] } });
    renderWithRouter(<HomePage />);
    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith("/api/events?mine=true");
      expect(navigateMock).toHaveBeenCalledWith("/events/ev1", { replace: true });
    });
  });

  it("navigates to /events when the user has several events", async () => {
    mockAuth({ user: { id: "u1", username: "Alice", role: "USER" } });
    apiGetMock.mockResolvedValue({ data: { data: [{ id: "ev1" }, { id: "ev2" }] } });
    renderWithRouter(<HomePage />);
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/events", { replace: true });
    });
  });

  it("navigates to /events on api error", async () => {
    mockAuth({ user: { id: "u1", username: "Alice", role: "USER" } });
    apiGetMock.mockRejectedValue(new Error("fail"));
    renderWithRouter(<HomePage />);
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/events", { replace: true });
    });
  });

  it("navigates to /events without checking event count for an admin who can manage events", async () => {
    mockAuth({
      user: { id: "u1", username: "Admin", role: "ADMIN" },
      preferences: { "admin.events": true },
    });
    renderWithRouter(<HomePage />);
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/events", { replace: true });
    });
    expect(apiGetMock).not.toHaveBeenCalled();
  });

  it("navigates directly to the single event for an admin who has not enabled event management", async () => {
    mockAuth({
      user: { id: "u1", username: "Admin", role: "ADMIN" },
      preferences: { "admin.events": false },
    });
    apiGetMock.mockResolvedValue({ data: { data: [{ id: "ev1" }] } });
    renderWithRouter(<HomePage />);
    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith("/api/events?mine=true");
      expect(navigateMock).toHaveBeenCalledWith("/events/ev1", { replace: true });
    });
  });
});
