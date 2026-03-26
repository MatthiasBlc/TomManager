import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import NotificationItem from "../../components/notifications/NotificationItem";
import type { Notification } from "../../hooks/useNotifications";

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

function makeNotif(overrides: Partial<Notification> = {}): Notification {
  return {
    id: "n1",
    userId: "u1",
    type: "TABLE_DELETED",
    title: "Table supprimee",
    message: "La table 'Donjons' a ete supprimee",
    metadata: { eventId: "e1", tableId: "t1" },
    read: false,
    readAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("NotificationItem", () => {
  it("should render title and message", () => {
    const onMarkAsRead = vi.fn();
    const onDelete = vi.fn();

    render(
      <MemoryRouter>
        <NotificationItem
          notification={makeNotif()}
          onMarkAsRead={onMarkAsRead}
          onDelete={onDelete}
        />
      </MemoryRouter>
    );

    expect(screen.getByText("Table supprimee")).toBeInTheDocument();
    expect(screen.getByText("La table 'Donjons' a ete supprimee")).toBeInTheDocument();
  });

  it("should show bold title for unread notifications", () => {
    render(
      <MemoryRouter>
        <NotificationItem
          notification={makeNotif({ read: false })}
          onMarkAsRead={vi.fn()}
          onDelete={vi.fn()}
        />
      </MemoryRouter>
    );

    const title = screen.getByText("Table supprimee");
    expect(title.className).toContain("font-semibold");
  });

  it("should not show bold title for read notifications", () => {
    render(
      <MemoryRouter>
        <NotificationItem
          notification={makeNotif({ read: true })}
          onMarkAsRead={vi.fn()}
          onDelete={vi.fn()}
        />
      </MemoryRouter>
    );

    const title = screen.getByText("Table supprimee");
    expect(title.className).not.toContain("font-semibold");
  });

  it("should call onMarkAsRead and navigate on click", () => {
    const onMarkAsRead = vi.fn();
    render(
      <MemoryRouter>
        <NotificationItem
          notification={makeNotif()}
          onMarkAsRead={onMarkAsRead}
          onDelete={vi.fn()}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText("Table supprimee"));
    expect(onMarkAsRead).toHaveBeenCalledWith("n1");
    expect(mockNavigate).toHaveBeenCalledWith("/events/e1/planning");
  });

  it("should not call onMarkAsRead for already read notification", () => {
    const onMarkAsRead = vi.fn();
    render(
      <MemoryRouter>
        <NotificationItem
          notification={makeNotif({ read: true })}
          onMarkAsRead={onMarkAsRead}
          onDelete={vi.fn()}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText("Table supprimee"));
    expect(onMarkAsRead).not.toHaveBeenCalled();
  });

  it("should call onDelete when delete button is clicked", () => {
    const onDelete = vi.fn();
    render(
      <MemoryRouter>
        <NotificationItem
          notification={makeNotif()}
          onMarkAsRead={vi.fn()}
          onDelete={onDelete}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByLabelText("Supprimer la notification"));
    expect(onDelete).toHaveBeenCalledWith("n1");
  });

  it("should render correct icon for different types", () => {
    const { rerender } = render(
      <MemoryRouter>
        <NotificationItem
          notification={makeNotif({ type: "PLAYER_KICKED" })}
          onMarkAsRead={vi.fn()}
          onDelete={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByText("🚫")).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <NotificationItem
          notification={makeNotif({ type: "WAITLIST_PROMOTED" })}
          onMarkAsRead={vi.fn()}
          onDelete={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByText("⬆")).toBeInTheDocument();
  });
});
