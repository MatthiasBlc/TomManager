import { render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { axe } from "vitest-axe";
import EmptyState from "../../components/common/EmptyState";
import { SkeletonCardGrid } from "../../components/common/Skeleton";

// Mock useIsMobile - default desktop
const mockUseIsMobile = vi.fn(() => false);
vi.mock("../../hooks/useIsMobile", () => ({
  useIsMobile: () => mockUseIsMobile(),
}));

// Mock useSocket
vi.mock("../../hooks/useSocket", () => ({
  useSocket: () => null,
}));

// Mock AuthContext
vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1", username: "testuser", role: "ADMIN" } }),
}));

// Mock api
vi.mock("../../config/api", () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { data: [] } }),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("Accessibility (axe-core)", () => {
  it("EmptyState should have no critical accessibility violations", async () => {
    const { container } = render(
      <EmptyState
        icon={<span>📅</span>}
        title="No events yet"
        description="Create your first event."
        action={<button>Create</button>}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("SkeletonCardGrid should have no critical accessibility violations", async () => {
    const { container } = render(<SkeletonCardGrid count={3} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("MobileSheet should have no critical accessibility violations", async () => {
    const MobileSheet = (await import("../../components/common/MobileSheet")).default;
    const { container } = render(
      <MobileSheet open={true} onClose={vi.fn()} title="Test Sheet">
        <p>Sheet content</p>
      </MobileSheet>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("ResponsiveModal (desktop) should have no critical accessibility violations", async () => {
    mockUseIsMobile.mockReturnValue(false);
    const ResponsiveModal = (await import("../../components/common/ResponsiveModal")).default;
    const { container } = render(
      <ResponsiveModal open={true} onClose={vi.fn()} title="Test Modal">
        <p>Modal content</p>
      </ResponsiveModal>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("NotificationItem should have no critical accessibility violations", async () => {
    const NotificationItem = (await import("../../components/notifications/NotificationItem")).default;
    const { container } = render(
      <MemoryRouter>
        <NotificationItem
          notification={{
            id: "n1",
            userId: "u1",
            type: "TABLE_DELETED",
            title: "Test notification",
            message: "Test message",
            metadata: { eventId: "e1" },
            read: false,
            readAt: null,
            createdAt: new Date().toISOString(),
          }}
          onMarkAsRead={vi.fn()}
          onDelete={vi.fn()}
        />
      </MemoryRouter>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
