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
    expect(screen.getByText("No Discord account linked")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Link Discord/i })).toBeInTheDocument();
  });

  it("shows Discord unlink button when account is linked", () => {
    useAuthMock.mockReturnValue({
      user: { ...baseUser, discordId: "discord123", discordUsername: "AliceDiscord" },
      initiateDiscordLogin: initiateDiscordLoginMock,
      unlinkDiscord: unlinkDiscordMock,
    });
    renderWithRouter(<ProfilePage />);
    expect(screen.getByText("AliceDiscord")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Unlink/i })).toBeInTheDocument();
  });

  it("calls initiateDiscordLogin when Link Discord button is clicked", async () => {
    initiateDiscordLoginMock.mockResolvedValue(undefined);
    useAuthMock.mockReturnValue({
      user: baseUser,
      initiateDiscordLogin: initiateDiscordLoginMock,
      unlinkDiscord: unlinkDiscordMock,
    });
    renderWithRouter(<ProfilePage />);
    fireEvent.click(screen.getByRole("button", { name: /Link Discord/i }));
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
    fireEvent.click(screen.getByRole("button", { name: /Unlink/i }));
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
    fireEvent.click(screen.getByRole("button", { name: /Link Discord/i }));
    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith("Discord account linked!");
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
    fireEvent.click(screen.getByRole("button", { name: /Link Discord/i }));
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
    fireEvent.click(screen.getByRole("button", { name: /Link Discord/i }));
    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        "This Discord account is already linked to another user"
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
    fireEvent.click(screen.getByRole("button", { name: /Link Discord/i }));
    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Discord login unavailable");
    });
  });

  it("disables Unlink button when user has no email", () => {
    useAuthMock.mockReturnValue({
      user: { ...baseUser, email: null, discordId: "discord123", discordUsername: "AliceDiscord" },
      initiateDiscordLogin: initiateDiscordLoginMock,
      unlinkDiscord: unlinkDiscordMock,
    });
    renderWithRouter(<ProfilePage />);
    const unlinkBtn = screen.getByRole("button", { name: /Unlink/i });
    expect(unlinkBtn).toBeDisabled();
  });
});
