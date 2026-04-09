import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import LoginPage from "../pages/LoginPage";

const useAuthMock = vi.fn();
const navigateMock = vi.fn();
const apiGetMock = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();
const loginMock = vi.fn();
const initiateDiscordLoginMock = vi.fn();

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));
vi.mock("../config/api", () => ({
  default: { get: (...args: unknown[]) => apiGetMock(...args) },
}));
vi.mock("react-hot-toast", () => ({
  default: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}));
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

function setUpAuth(overrides: Partial<{ user: unknown; loading: boolean }> = {}) {
  useAuthMock.mockReturnValue({
    user: null,
    loading: false,
    login: loginMock,
    initiateDiscordLogin: initiateDiscordLoginMock,
    ...overrides,
  });
}

function renderLogin(initialEntries: string[] = ["/login"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <LoginPage />
    </MemoryRouter>
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    apiGetMock.mockReset().mockResolvedValue({});
    toastSuccess.mockReset();
    toastError.mockReset();
    loginMock.mockReset();
    initiateDiscordLoginMock.mockReset();
    useAuthMock.mockReset();
  });

  it("renders the form fields and login button", () => {
    setUpAuth();
    renderLogin();
    expect(screen.getByLabelText(/email or username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^login$/i })).toBeInTheDocument();
  });

  it("calls login with the form values and navigates on success", async () => {
    setUpAuth();
    loginMock.mockResolvedValue(undefined);
    renderLogin();
    fireEvent.input(screen.getByLabelText(/email or username/i), {
      target: { value: "alice@example.com" },
    });
    fireEvent.input(screen.getByLabelText(/password/i), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: /^login$/i }));
    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith("alice@example.com", "secret");
      expect(navigateMock).toHaveBeenCalledWith("/events", { replace: true });
      expect(toastSuccess).toHaveBeenCalled();
    });
  });

  it("shows an error toast when login fails", async () => {
    setUpAuth();
    loginMock.mockRejectedValue(new Error("nope"));
    renderLogin();
    fireEvent.input(screen.getByLabelText(/email or username/i), {
      target: { value: "alice" },
    });
    fireEvent.input(screen.getByLabelText(/password/i), { target: { value: "bad" } });
    fireEvent.click(screen.getByRole("button", { name: /^login$/i }));
    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Invalid credentials");
      expect(navigateMock).not.toHaveBeenCalled();
    });
  });

  it("redirects to /events when a user is already authenticated", async () => {
    setUpAuth({ user: { id: "u1" } });
    renderLogin();
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/events", { replace: true });
    });
  });

  it("hides Discord button when api returns 503", async () => {
    setUpAuth();
    apiGetMock.mockRejectedValueOnce({ response: { status: 503 } });
    renderLogin();
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /login with discord/i })).not.toBeInTheDocument();
    });
  });

  it("calls initiateDiscordLogin when the Discord button is clicked", async () => {
    setUpAuth();
    initiateDiscordLoginMock.mockResolvedValue(undefined);
    renderLogin();
    const btn = await screen.findByRole("button", { name: /login with discord/i });
    fireEvent.click(btn);
    await waitFor(() => {
      expect(initiateDiscordLoginMock).toHaveBeenCalledWith("/events");
    });
  });

  it("shows a toast when the URL has an error param", async () => {
    setUpAuth();
    renderLogin(["/login?error=discord_denied"]);
    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Discord login cancelled");
    });
  });

  it("shows the correct Discord error toast when popup rejects with a known error key", async () => {
    setUpAuth();
    initiateDiscordLoginMock.mockRejectedValue(new Error("not_in_guild"));
    renderLogin();
    const btn = await screen.findByRole("button", { name: /login with discord/i });
    fireEvent.click(btn);
    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("You must be a member of the Discord server");
    });
  });

  it("shows a generic error toast when popup rejects with an unknown error key", async () => {
    setUpAuth();
    initiateDiscordLoginMock.mockRejectedValue(new Error("unexpected_error"));
    renderLogin();
    const btn = await screen.findByRole("button", { name: /login with discord/i });
    fireEvent.click(btn);
    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Discord login unavailable");
    });
  });
});
