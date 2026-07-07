import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MobileHeader from "../components/layout/MobileHeader";

const useAuthMock = vi.fn();

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));
vi.mock("../components/common/ConnectionStatus", () => ({
  default: () => <span data-testid="connection-status" />,
}));
vi.mock("../components/notifications/NotificationBell", () => ({
  default: () => <span data-testid="notification-bell" />,
}));

function renderHeader(isOnline = true) {
  return render(
    <MemoryRouter>
      <MobileHeader isOnline={isOnline} />
    </MemoryRouter>
  );
}

describe("MobileHeader", () => {
  afterEach(() => {
    useAuthMock.mockReset();
  });

  it("renders the TM logo as a link to home", () => {
    useAuthMock.mockReturnValue({ user: null });
    renderHeader();
    const logo = screen.getByRole("link", { name: "TM" });
    expect(logo).toHaveAttribute("href", "/");
  });

  it("does not render notification bell or connection status when not authenticated", () => {
    useAuthMock.mockReturnValue({ user: null });
    renderHeader();
    expect(screen.queryByTestId("connection-status")).not.toBeInTheDocument();
    expect(screen.queryByTestId("notification-bell")).not.toBeInTheDocument();
  });

  it("renders notification bell and connection status when authenticated", () => {
    useAuthMock.mockReturnValue({ user: { id: "u1", username: "Alice" } });
    renderHeader();
    expect(screen.getByTestId("connection-status")).toBeInTheDocument();
    expect(screen.getByTestId("notification-bell")).toBeInTheDocument();
  });

  it("shifts down below the offline banner when isOnline is false", () => {
    useAuthMock.mockReturnValue({ user: null });
    renderHeader(false);
    expect(screen.getByRole("banner")).toHaveClass("top-10");
  });

  it("sits at the top when online", () => {
    useAuthMock.mockReturnValue({ user: null });
    renderHeader(true);
    expect(screen.getByRole("banner")).toHaveClass("top-0");
  });
});
