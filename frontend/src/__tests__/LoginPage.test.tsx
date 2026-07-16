import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import LoginPage from "../pages/LoginPage";

const useAuthMock = vi.fn();
const navigateMock = vi.fn();
const apiGetMock = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();
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
    initiateDiscordLoginMock.mockReset();
    useAuthMock.mockReset();
  });

  it("redirects to /events when a user is already authenticated", async () => {
    setUpAuth({ user: { id: "u1" } });
    renderLogin();
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/events", { replace: true });
    });
  });

  it("shows a fallback message and no Discord button when api returns 503", async () => {
    setUpAuth();
    apiGetMock.mockRejectedValueOnce({ response: { status: 503 } });
    renderLogin();
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /se connecter avec discord/i })
      ).not.toBeInTheDocument();
      expect(screen.getByText(/connexion est momentanément indisponible/i)).toBeInTheDocument();
    });
  });

  it("calls initiateDiscordLogin when the Discord button is clicked", async () => {
    setUpAuth();
    initiateDiscordLoginMock.mockResolvedValue(undefined);
    renderLogin();
    const btn = await screen.findByRole("button", {
      name: /se connecter avec discord/i,
    });
    fireEvent.click(btn);
    await waitFor(() => {
      expect(initiateDiscordLoginMock).toHaveBeenCalledWith("/events");
    });
  });

  it("shows a toast when the URL has an error param", async () => {
    setUpAuth();
    renderLogin(["/login?error=discord_denied"]);
    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Connexion Discord annulée");
    });
  });

  it("shows the correct Discord error toast when popup rejects with a known error key", async () => {
    setUpAuth();
    initiateDiscordLoginMock.mockRejectedValue(new Error("not_in_guild"));
    renderLogin();
    const btn = await screen.findByRole("button", {
      name: /se connecter avec discord/i,
    });
    fireEvent.click(btn);
    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Vous devez être membre du serveur Discord");
    });
  });

  it("shows a generic error toast when popup rejects with an unknown error key", async () => {
    setUpAuth();
    initiateDiscordLoginMock.mockRejectedValue(new Error("unexpected_error"));
    renderLogin();
    const btn = await screen.findByRole("button", {
      name: /se connecter avec discord/i,
    });
    fireEvent.click(btn);
    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Connexion Discord indisponible");
    });
  });
});
