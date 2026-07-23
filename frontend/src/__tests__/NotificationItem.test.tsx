import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import NotificationItem from "../components/notifications/NotificationItem";
import type { Notification } from "../hooks/useNotifications";

const baseNotification: Notification = {
  id: "n1",
  userId: "u1",
  type: "TABLE_UPDATED",
  title: "Table mise a jour",
  message: "Le donjon a change d'horaire",
  metadata: null,
  read: false,
  readAt: null,
  createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
};

function LocationProbe() {
  const loc = useLocation();
  return (
    <div data-testid="location">
      {loc.pathname}
      {loc.search}
    </div>
  );
}

function renderItem(
  notification: Notification,
  handlers: {
    onMarkAsRead: ReturnType<typeof vi.fn>;
    onDelete: ReturnType<typeof vi.fn>;
    onNavigate?: ReturnType<typeof vi.fn>;
  } = { onMarkAsRead: vi.fn(), onDelete: vi.fn() }
) {
  return {
    ...handlers,
    ...render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route
            path="/"
            element={<NotificationItem notification={notification} {...handlers} />}
          />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    ),
  };
}

describe("NotificationItem", () => {
  it("renders title, message and a relative time", () => {
    renderItem(baseNotification);
    expect(screen.getByText("Table mise a jour")).toBeInTheDocument();
    expect(screen.getByText("Le donjon a change d'horaire")).toBeInTheDocument();
    expect(screen.getByText("5min")).toBeInTheDocument();
  });

  it("applies the unread style when read is false", () => {
    const { container } = renderItem(baseNotification);
    const titleP = screen.getByText("Table mise a jour");
    expect(titleP.className).toContain("font-semibold");
    const root = container.querySelector(".cursor-pointer") as HTMLElement;
    expect(root.className).toContain("bg-base-200/50");
  });

  it("does not apply the unread style when read is true", () => {
    renderItem({ ...baseNotification, read: true });
    const titleP = screen.getByText("Table mise a jour");
    expect(titleP.className).not.toContain("font-semibold");
  });

  it("calls onMarkAsRead on click when notification is unread", () => {
    const onMarkAsRead = vi.fn();
    const onDelete = vi.fn();
    renderItem(baseNotification, { onMarkAsRead, onDelete });
    fireEvent.click(screen.getByText("Table mise a jour"));
    expect(onMarkAsRead).toHaveBeenCalledWith("n1");
  });

  it("does not call onMarkAsRead when notification is already read", () => {
    const onMarkAsRead = vi.fn();
    const onDelete = vi.fn();
    renderItem({ ...baseNotification, read: true }, { onMarkAsRead, onDelete });
    fireEvent.click(screen.getByText("Table mise a jour"));
    expect(onMarkAsRead).not.toHaveBeenCalled();
  });

  it("navigates to the event planning when metadata.eventId is set", () => {
    renderItem({ ...baseNotification, metadata: { eventId: "ev42" } });
    fireEvent.click(screen.getByText("Table mise a jour"));
    expect(screen.getByTestId("location")).toHaveTextContent("/events/ev42/planning");
  });

  it("deep-links to the table modal when metadata.tableId is set", () => {
    renderItem({ ...baseNotification, metadata: { eventId: "ev42", tableId: "t7" } });
    fireEvent.click(screen.getByText("Table mise a jour"));
    expect(screen.getByTestId("location")).toHaveTextContent("/events/ev42/planning?table=t7");
  });

  it("routes PARTICIPANT_REMOVED to the events list (no access to the event anymore)", () => {
    renderItem({
      ...baseNotification,
      type: "PARTICIPANT_REMOVED",
      metadata: { eventId: "ev42" },
    });
    fireEvent.click(screen.getByText("Table mise a jour"));
    expect(screen.getByTestId("location")).toHaveTextContent(/^\/events$/);
  });

  it("routes EVENT_DELETED to the events list", () => {
    renderItem({ ...baseNotification, type: "EVENT_DELETED", metadata: { eventId: "ev42" } });
    fireEvent.click(screen.getByText("Table mise a jour"));
    expect(screen.getByTestId("location")).toHaveTextContent(/^\/events$/);
  });

  it("routes TABLE_DELETED to the planning without a ?table deep-link", () => {
    renderItem({
      ...baseNotification,
      type: "TABLE_DELETED",
      metadata: { eventId: "ev42", tableId: "t7" },
    });
    fireEvent.click(screen.getByText("Table mise a jour"));
    const location = screen.getByTestId("location");
    expect(location).toHaveTextContent("/events/ev42/planning");
    expect(location.textContent).not.toContain("table=");
  });

  it("routes PLAYER_KICKED to the planning without a ?table deep-link", () => {
    renderItem({
      ...baseNotification,
      type: "PLAYER_KICKED",
      metadata: { eventId: "ev42", tableId: "t7" },
    });
    fireEvent.click(screen.getByText("Table mise a jour"));
    expect(screen.getByTestId("location").textContent).not.toContain("table=");
  });

  it("routes kitchen notification types to the kitchen tab", () => {
    const kitchenTypes = [
      "KITCHEN_SWAP_REQUESTED",
      "KITCHEN_SWAP_ACCEPTED",
      "KITCHEN_SWAP_REJECTED",
      "KITCHEN_ASSISTANT_SWAP_REQUESTED",
      "KITCHEN_ASSISTANT_SWAP_ACCEPTED",
      "KITCHEN_CHEF_ADDED",
      "KITCHEN_CHEF_REMOVED",
      "KITCHEN_MEAL_CLAIMED",
      "KITCHEN_OVERCAPACITY",
    ];
    for (const type of kitchenTypes) {
      const { unmount } = renderItem({
        ...baseNotification,
        id: `id-${type}`,
        type,
        metadata: { eventId: "ev42" },
      });
      fireEvent.click(screen.getByText("Table mise a jour"));
      expect(screen.getByTestId("location")).toHaveTextContent("/events/ev42?tab=kitchen");
      unmount();
    }
  });

  it("calls onNavigate on click (panel close) even without a destination", () => {
    const onNavigate = vi.fn();
    renderItem(baseNotification, { onMarkAsRead: vi.fn(), onDelete: vi.fn(), onNavigate });
    fireEvent.click(screen.getByText("Table mise a jour"));
    expect(onNavigate).toHaveBeenCalled();
  });

  it("calls onDelete and stops propagation when the delete button is clicked", () => {
    const onMarkAsRead = vi.fn();
    const onDelete = vi.fn();
    renderItem(baseNotification, { onMarkAsRead, onDelete });
    fireEvent.click(screen.getByRole("button", { name: /supprimer la notification/i }));
    expect(onDelete).toHaveBeenCalledWith("n1");
    expect(onMarkAsRead).not.toHaveBeenCalled();
  });

  it("renders the right icon for known notification types", () => {
    const types: Array<[string, string]> = [
      ["TABLE_DELETED", "🗑"],
      ["WAITLIST_PROMOTED", "⬆"],
      ["WAITLIST_DEMOTED", "⬇"],
      ["RESERVED_SEAT_ASSIGNED", "🔒"],
      ["PLAYER_KICKED", "🚫"],
      ["PARTICIPANT_REMOVED", "👋"],
      ["EVENT_UPDATED", "📅"],
      ["GM_PLAYER_JOINED", "🙋"],
      ["GM_PLAYER_WAITLISTED", "⏳"],
      ["GM_TABLE_FULL", "🎉"],
      ["KITCHEN_SWAP_REQUESTED", "🔄"],
      ["KITCHEN_ASSISTANT_SWAP_REQUESTED", "🔄"],
      ["KITCHEN_SWAP_ACCEPTED", "✅"],
      ["KITCHEN_ASSISTANT_SWAP_ACCEPTED", "✅"],
      ["KITCHEN_SWAP_REJECTED", "❌"],
      ["KITCHEN_CHEF_ADDED", "👨‍🍳"],
      ["KITCHEN_MEAL_CLAIMED", "👨‍🍳"],
      ["KITCHEN_CHEF_REMOVED", "👋"],
      ["KITCHEN_OVERCAPACITY", "⚠"],
      ["UNKNOWN_TYPE", "🔔"],
    ];
    for (const [type, icon] of types) {
      const { unmount } = renderItem({
        ...baseNotification,
        id: `id-${type}`,
        type,
      });
      expect(screen.getByText(icon)).toBeInTheDocument();
      unmount();
    }
  });
});
