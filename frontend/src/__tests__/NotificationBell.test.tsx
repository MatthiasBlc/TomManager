import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import NotificationBell from "../components/notifications/NotificationBell";

const useNotificationsMock = vi.fn();
const useIsMobileMock = vi.fn();

vi.mock("../hooks/useNotifications", () => ({
  useNotifications: () => useNotificationsMock(),
}));
vi.mock("../hooks/useIsMobile", () => ({
  useIsMobile: () => useIsMobileMock(),
}));
vi.mock("../components/common/MobileSheet", () => ({
  default: ({
    open,
    children,
    title,
  }: {
    open: boolean;
    children: React.ReactNode;
    title: string;
    onClose: () => void;
  }) =>
    open ? (
      <div data-testid="mobile-sheet" aria-label={title}>
        {children}
      </div>
    ) : null,
}));

const baseNotifData = {
  notifications: [],
  isLoading: false,
  hasMore: false,
  loadMore: vi.fn(),
  markAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
  deleteNotification: vi.fn(),
  unreadCount: 0,
  fetchNotifications: vi.fn(),
};

function renderBell() {
  return render(
    <MemoryRouter>
      <NotificationBell />
    </MemoryRouter>
  );
}

describe("NotificationBell", () => {
  beforeEach(() => {
    useIsMobileMock.mockReset().mockReturnValue(false);
    useNotificationsMock.mockReset();
  });

  it("renders the bell button without a badge when unreadCount is 0", () => {
    useNotificationsMock.mockReturnValue({ ...baseNotifData, unreadCount: 0 });
    renderBell();
    expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("renders the unread count badge", () => {
    useNotificationsMock.mockReturnValue({ ...baseNotifData, unreadCount: 5 });
    renderBell();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("caps the unread badge at 99+", () => {
    useNotificationsMock.mockReturnValue({ ...baseNotifData, unreadCount: 200 });
    renderBell();
    expect(screen.getByText("99+")).toBeInTheDocument();
  });

  it("toggles the desktop dropdown on click", () => {
    useNotificationsMock.mockReturnValue({ ...baseNotifData });
    renderBell();
    expect(screen.queryByText("Notifications")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
    // The dropdown header includes the text "Notifications"
    expect(screen.getByText("Aucune notification")).toBeInTheDocument();
  });

  it("renders mobile sheet on mobile when opened", () => {
    useIsMobileMock.mockReturnValue(true);
    useNotificationsMock.mockReturnValue({ ...baseNotifData });
    renderBell();
    expect(screen.queryByTestId("mobile-sheet")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
    expect(screen.getByTestId("mobile-sheet")).toBeInTheDocument();
  });

  it("renders 'Tout marquer lu' button when there are unread notifications", () => {
    useNotificationsMock.mockReturnValue({ ...baseNotifData, unreadCount: 3 });
    renderBell();
    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
    expect(screen.getByRole("button", { name: /Tout marquer lu/i })).toBeInTheDocument();
  });
});
