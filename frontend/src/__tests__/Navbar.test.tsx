import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Navbar from "../components/layout/Navbar";

const useAuthMock = vi.fn();
const useIsMobileMock = vi.fn();
const logoutMock = vi.fn();
const navigateMock = vi.fn();

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));
vi.mock("../hooks/useIsMobile", () => ({
  useIsMobile: () => useIsMobileMock(),
}));
vi.mock("../components/common/ConnectionStatus", () => ({
  default: () => <span data-testid="connection-status" />,
}));
vi.mock("../components/notifications/NotificationBell", () => ({
  default: () => <span data-testid="notification-bell" />,
}));
vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );
  return { ...actual, useNavigate: () => navigateMock };
});

function setAuth(
  user: { id: string; username: string; avatarUrl: string | null } | null,
) {
  useAuthMock.mockReturnValue({ user, logout: logoutMock });
}

function renderNavbar() {
  return render(
    <MemoryRouter>
      <Navbar />
    </MemoryRouter>,
  );
}

describe("Navbar (desktop)", () => {
  beforeEach(() => {
    useIsMobileMock.mockReturnValue(false);
    logoutMock.mockReset().mockResolvedValue(undefined);
    navigateMock.mockReset();
  });

  it("shows the Login link when no user is authenticated", () => {
    setAuth(null);
    renderNavbar();
    expect(screen.getByRole("link", { name: "Login" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Logout" }),
    ).not.toBeInTheDocument();
  });

  it("shows username, avatar, events link, logout when authenticated", () => {
    setAuth({
      id: "u1",
      username: "Alice",
      avatarUrl: "https://example.com/a.png",
    });
    renderNavbar();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "avatar" })).toHaveAttribute(
      "src",
      "https://example.com/a.png",
    );
    expect(screen.getByRole("link", { name: "Events" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Logout" })).toBeInTheDocument();
    expect(screen.getByTestId("connection-status")).toBeInTheDocument();
    expect(screen.getByTestId("notification-bell")).toBeInTheDocument();
  });

  it("does not render an avatar img when avatarUrl is null", () => {
    setAuth({ id: "u1", username: "Bob", avatarUrl: null });
    renderNavbar();
    expect(
      screen.queryByRole("img", { name: "avatar" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("calls logout and navigates home when Logout is clicked", async () => {
    setAuth({ id: "u1", username: "Alice", avatarUrl: null });
    renderNavbar();
    fireEvent.click(screen.getByRole("button", { name: "Logout" }));
    await waitFor(() => {
      expect(logoutMock).toHaveBeenCalled();
      expect(navigateMock).toHaveBeenCalledWith("/");
    });
  });
});

describe("Navbar (mobile)", () => {
  beforeEach(() => {
    useIsMobileMock.mockReturnValue(true);
    logoutMock.mockReset().mockResolvedValue(undefined);
    navigateMock.mockReset();
  });

  it("renders MobileHeader and BottomTabBar when authenticated", () => {
    setAuth({ id: "u1", username: "Alice", avatarUrl: null });
    renderNavbar();
    // MobileHeader logo
    expect(screen.getByText("TM")).toBeInTheDocument();
    // BottomTabBar Events link
    expect(screen.getByRole("link", { name: /Events/ })).toBeInTheDocument();
  });

  it("renders MobileHeader without BottomTabBar when not authenticated", () => {
    setAuth(null);
    renderNavbar();
    expect(screen.getByText("TM")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Events/ }),
    ).not.toBeInTheDocument();
  });
});
