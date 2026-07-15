import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithRouter } from "../test/renderWithRouter";
import ProfilePage from "../pages/ProfilePage";

const useAuthMock = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();
const unlinkDiscordMock = vi.fn();
const initiateDiscordLoginMock = vi.fn();

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));
vi.mock("react-hot-toast", () => ({
  default: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}));

const baseUser = {
  id: "u1",
  username: "Alice",
  email: "alice@example.com",
  role: "USER" as const,
  avatarUrl: null,
  discordId: null,
  discordUsername: null,
};

describe("ProfilePage", () => {
  beforeEach(() => {
    useAuthMock.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
    unlinkDiscordMock.mockReset();
    initiateDiscordLoginMock.mockReset();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders nothing when user is not authenticated", () => {
    useAuthMock.mockReturnValue({
      user: null,
      initiateDiscordLogin: initiateDiscordLoginMock,
      unlinkDiscord: unlinkDiscordMock,
    });
    const { container } = renderWithRouter(<ProfilePage />);
    expect(container.firstChild).toBeNull();
  });

  it("renders user profile information", () => {
    useAuthMock.mockReturnValue({
      user: baseUser,
      initiateDiscordLogin: initiateDiscordLoginMock,
      unlinkDiscord: unlinkDiscordMock,
    });
    renderWithRouter(<ProfilePage />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    expect(screen.getByText("USER")).toBeInTheDocument();
  });

  it("renders avatar when avatarUrl is provided", () => {
    useAuthMock.mockReturnValue({
      user: { ...baseUser, avatarUrl: "https://example.com/avatar.png" },
      initiateDiscordLogin: initiateDiscordLoginMock,
      unlinkDiscord: unlinkDiscordMock,
    });
    renderWithRouter(<ProfilePage />);
    const avatar = screen.getByRole("img", { name: "avatar" });
    expect(avatar).toHaveAttribute("src", "https://example.com/avatar.png");
  });

  it("shows Discord link button when no Discord account is linked", () => {
    useAuthMock.mockReturnValue({
      user: baseUser,
      initiateDiscordLogin: initiateDiscordLoginMock,
      unlinkDiscord: unlinkDiscordMock,
    });
    renderWithRouter(<ProfilePage />);
    expect(screen.getByText("Aucun compte Discord lié")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Lier/i })).toBeInTheDocument();
  });

  it("shows Discord unlink button when account is linked", () => {
    useAuthMock.mockReturnValue({
      user: {
        ...baseUser,
        discordId: "discord123",
        discordUsername: "AliceDiscord",
      },
      initiateDiscordLogin: initiateDiscordLoginMock,
      unlinkDiscord: unlinkDiscordMock,
    });
    renderWithRouter(<ProfilePage />);
    expect(screen.getByText("AliceDiscord")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Délier/i })).toBeInTheDocument();
  });

  it("calls initiateDiscordLogin when Link Discord button is clicked", async () => {
    initiateDiscordLoginMock.mockResolvedValue(undefined);
    useAuthMock.mockReturnValue({
      user: baseUser,
      initiateDiscordLogin: initiateDiscordLoginMock,
      unlinkDiscord: unlinkDiscordMock,
    });
    renderWithRouter(<ProfilePage />);
    fireEvent.click(screen.getByRole("button", { name: /Lier/i }));
    await waitFor(() => {
      expect(initiateDiscordLoginMock).toHaveBeenCalledWith("/profile");
    });
  });

  it("calls unlinkDiscord when Unlink button is clicked", async () => {
    unlinkDiscordMock.mockResolvedValue(undefined);
    useAuthMock.mockReturnValue({
      user: {
        ...baseUser,
        discordId: "discord123",
        discordUsername: "AliceDiscord",
        email: "alice@example.com",
      },
      initiateDiscordLogin: initiateDiscordLoginMock,
      unlinkDiscord: unlinkDiscordMock,
    });
    renderWithRouter(<ProfilePage />);
    fireEvent.click(screen.getByRole("button", { name: /Délier/i }));
    await waitFor(() => {
      expect(unlinkDiscordMock).toHaveBeenCalled();
      expect(toastSuccess).toHaveBeenCalled();
    });
  });

  it("shows success toast when Discord link completes via popup", async () => {
    initiateDiscordLoginMock.mockResolvedValue(true);
    useAuthMock.mockReturnValue({
      user: baseUser,
      initiateDiscordLogin: initiateDiscordLoginMock,
      unlinkDiscord: unlinkDiscordMock,
    });
    renderWithRouter(<ProfilePage />);
    fireEvent.click(screen.getByRole("button", { name: /Lier/i }));
    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith("Compte Discord lié !");
    });
  });

  it("does not show success toast when popup is cancelled (resolves false)", async () => {
    initiateDiscordLoginMock.mockResolvedValue(false);
    useAuthMock.mockReturnValue({
      user: baseUser,
      initiateDiscordLogin: initiateDiscordLoginMock,
      unlinkDiscord: unlinkDiscordMock,
    });
    renderWithRouter(<ProfilePage />);
    fireEvent.click(screen.getByRole("button", { name: /Lier/i }));
    await waitFor(() => {
      expect(initiateDiscordLoginMock).toHaveBeenCalled();
    });
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });

  it("shows specific error when Discord account is already linked to another user", async () => {
    initiateDiscordLoginMock.mockRejectedValue(new Error("discord_already_linked"));
    useAuthMock.mockReturnValue({
      user: baseUser,
      initiateDiscordLogin: initiateDiscordLoginMock,
      unlinkDiscord: unlinkDiscordMock,
    });
    renderWithRouter(<ProfilePage />);
    fireEvent.click(screen.getByRole("button", { name: /Lier/i }));
    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        "Ce compte Discord est déjà lié à un autre utilisateur"
      );
    });
  });

  it("shows generic error when Discord link fails with unknown error", async () => {
    initiateDiscordLoginMock.mockRejectedValue(new Error("unexpected"));
    useAuthMock.mockReturnValue({
      user: baseUser,
      initiateDiscordLogin: initiateDiscordLoginMock,
      unlinkDiscord: unlinkDiscordMock,
    });
    renderWithRouter(<ProfilePage />);
    fireEvent.click(screen.getByRole("button", { name: /Lier/i }));
    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Connexion Discord indisponible");
    });
  });

  it("asks for confirmation before unlinking Discord", async () => {
    unlinkDiscordMock.mockResolvedValue(undefined);
    useAuthMock.mockReturnValue({
      user: {
        ...baseUser,
        discordId: "discord123",
        discordUsername: "AliceDiscord",
        email: "alice@example.com",
      },
      initiateDiscordLogin: initiateDiscordLoginMock,
      unlinkDiscord: unlinkDiscordMock,
    });
    renderWithRouter(<ProfilePage />);
    fireEvent.click(screen.getByRole("button", { name: /Délier/i }));
    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => expect(unlinkDiscordMock).toHaveBeenCalled());
  });

  it("does not unlink Discord when confirmation is declined", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    useAuthMock.mockReturnValue({
      user: {
        ...baseUser,
        discordId: "discord123",
        discordUsername: "AliceDiscord",
        email: "alice@example.com",
      },
      initiateDiscordLogin: initiateDiscordLoginMock,
      unlinkDiscord: unlinkDiscordMock,
    });
    renderWithRouter(<ProfilePage />);
    fireEvent.click(screen.getByRole("button", { name: /Délier/i }));
    expect(unlinkDiscordMock).not.toHaveBeenCalled();
  });

  it("disables Unlink button when user has no email", () => {
    useAuthMock.mockReturnValue({
      user: {
        ...baseUser,
        email: null,
        discordId: "discord123",
        discordUsername: "AliceDiscord",
      },
      initiateDiscordLogin: initiateDiscordLoginMock,
      unlinkDiscord: unlinkDiscordMock,
    });
    renderWithRouter(<ProfilePage />);
    const unlinkBtn = screen.getByRole("button", { name: /Délier/i });
    expect(unlinkBtn).toBeDisabled();
  });
});
