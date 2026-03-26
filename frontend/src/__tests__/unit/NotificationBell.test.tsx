import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import NotificationBell from "../../components/notifications/NotificationBell";
import type { Notification } from "../../hooks/useNotifications";

// Mock useNotifications hook
const mockMarkAsRead = vi.fn();
const mockMarkAllAsRead = vi.fn();
const mockDeleteNotification = vi.fn();
const mockLoadMore = vi.fn();

const mockNotifications: Notification[] = [
  {
    id: "n1",
    userId: "u1",
    type: "TABLE_DELETED",
    title: "Table supprimee",
    message: "La table 'Donjons' a ete supprimee",
    metadata: { eventId: "e1", tableId: "t1" },
    read: false,
    readAt: null,
    createdAt: new Date().toISOString(),
  },
  {
    id: "n2",
    userId: "u1",
    type: "WAITLIST_PROMOTED",
    title: "Place confirmee",
    message: "Tu es confirme pour la table 'Catan'",
    metadata: { eventId: "e1", tableId: "t2" },
    read: true,
    readAt: new Date().toISOString(),
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
];

let mockReturnValue = {
  notifications: mockNotifications,
  unreadCount: 1,
  isLoading: false,
  hasMore: false,
  loadMore: mockLoadMore,
  markAsRead: mockMarkAsRead,
  markAllAsRead: mockMarkAllAsRead,
  deleteNotification: mockDeleteNotification,
  refresh: vi.fn(),
};

vi.mock("../../hooks/useNotifications", () => ({
  useNotifications: () => mockReturnValue,
}));

// Mock useSocket to avoid actual connection
vi.mock("../../hooks/useSocket", () => ({
  useSocket: () => null,
}));

function renderBell() {
  return render(
    <MemoryRouter>
      <NotificationBell />
    </MemoryRouter>
  );
}

describe("NotificationBell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReturnValue = {
      notifications: mockNotifications,
      unreadCount: 1,
      isLoading: false,
      hasMore: false,
      loadMore: mockLoadMore,
      markAsRead: mockMarkAsRead,
      markAllAsRead: mockMarkAllAsRead,
      deleteNotification: mockDeleteNotification,
      refresh: vi.fn(),
    };
  });

  it("should render bell icon with unread badge", () => {
    renderBell();
    const badge = screen.getByText("1");
    expect(badge).toBeInTheDocument();
  });

  it("should not show badge when no unread notifications", () => {
    mockReturnValue = { ...mockReturnValue, unreadCount: 0 };
    renderBell();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("should show 99+ when unread count exceeds 99", () => {
    mockReturnValue = { ...mockReturnValue, unreadCount: 150 };
    renderBell();
    expect(screen.getByText("99+")).toBeInTheDocument();
  });

  it("should toggle dropdown on click", () => {
    renderBell();

    // Dropdown should not be visible initially
    expect(screen.queryByText("Notifications")).not.toBeInTheDocument();

    // Click bell
    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
    expect(screen.getByText("Notifications")).toBeInTheDocument();

    // Click again to close
    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
    expect(screen.queryByText("Notifications")).not.toBeInTheDocument();
  });

  it("should render notification items in dropdown", () => {
    renderBell();
    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));

    expect(screen.getByText("Table supprimee")).toBeInTheDocument();
    expect(screen.getByText("Place confirmee")).toBeInTheDocument();
  });

  it("should show mark all as read button when unread exists", () => {
    renderBell();
    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));

    const markAllBtn = screen.getByText("Tout marquer lu");
    expect(markAllBtn).toBeInTheDocument();
    fireEvent.click(markAllBtn);
    expect(mockMarkAllAsRead).toHaveBeenCalled();
  });

  it("should show empty state when no notifications", () => {
    mockReturnValue = { ...mockReturnValue, notifications: [], unreadCount: 0 };
    renderBell();
    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));

    expect(screen.getByText("Aucune notification")).toBeInTheDocument();
  });

  it("should show load more button when hasMore is true", () => {
    mockReturnValue = { ...mockReturnValue, hasMore: true };
    renderBell();
    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));

    const loadMoreBtn = screen.getByText("Voir plus");
    fireEvent.click(loadMoreBtn);
    expect(mockLoadMore).toHaveBeenCalled();
  });
});
