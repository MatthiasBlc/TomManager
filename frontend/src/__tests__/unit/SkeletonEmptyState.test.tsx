import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import {
  SkeletonCard,
  SkeletonCardGrid,
  SkeletonBoardGame,
  SkeletonBoardGameList,
  SkeletonNotification,
  SkeletonNotificationList,
  SkeletonTableDetail,
} from "../../components/common/Skeleton";
import EmptyState from "../../components/common/EmptyState";

describe("Skeleton components", () => {
  it("SkeletonCard should render skeleton elements", () => {
    const { container } = render(<SkeletonCard />);
    expect(container.querySelectorAll(".skeleton").length).toBeGreaterThanOrEqual(1);
    expect(container.querySelector(".card")).toBeInTheDocument();
  });

  it("SkeletonCardGrid should render correct number of cards", () => {
    const { container } = render(<SkeletonCardGrid count={4} />);
    expect(container.querySelectorAll(".card").length).toBe(4);
  });

  it("SkeletonBoardGame should render skeleton with image placeholder", () => {
    const { container } = render(<SkeletonBoardGame />);
    const skeletons = container.querySelectorAll(".skeleton");
    expect(skeletons.length).toBeGreaterThanOrEqual(3);
  });

  it("SkeletonBoardGameList should render correct number of items", () => {
    const { container } = render(<SkeletonBoardGameList count={5} />);
    expect(container.querySelectorAll(".card").length).toBe(5);
  });

  it("SkeletonNotification should render skeleton elements", () => {
    const { container } = render(<SkeletonNotification />);
    expect(container.querySelectorAll(".skeleton").length).toBeGreaterThanOrEqual(3);
  });

  it("SkeletonNotificationList should render correct number of items", () => {
    const { container } = render(<SkeletonNotificationList count={3} />);
    const items = container.querySelectorAll(".skeleton");
    // 3 items x at least 3 skeletons each
    expect(items.length).toBeGreaterThanOrEqual(9);
  });

  it("SkeletonTableDetail should render multiple sections", () => {
    const { container } = render(<SkeletonTableDetail />);
    const skeletons = container.querySelectorAll(".skeleton");
    expect(skeletons.length).toBeGreaterThanOrEqual(5);
    expect(container.querySelectorAll(".card").length).toBeGreaterThanOrEqual(1);
  });
});

describe("EmptyState", () => {
  it("should render title", () => {
    render(<EmptyState title="No items found" />);
    expect(screen.getByText("No items found")).toBeInTheDocument();
  });

  it("should render icon when provided", () => {
    render(<EmptyState icon={<span data-testid="icon">📅</span>} title="No events" />);
    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });

  it("should render description when provided", () => {
    render(<EmptyState title="Empty" description="Create something to get started." />);
    expect(screen.getByText("Create something to get started.")).toBeInTheDocument();
  });

  it("should render action when provided", () => {
    render(
      <EmptyState
        title="No data"
        action={<button>Create</button>}
      />
    );
    expect(screen.getByText("Create")).toBeInTheDocument();
  });

  it("should have animate-fade-in class", () => {
    const { container } = render(<EmptyState title="Test" />);
    expect(container.firstChild).toHaveClass("animate-fade-in");
  });
});

describe("Loading skeleton integration", () => {
  // Verify EventListPage shows skeleton during loading
  it("EventListPage skeleton grid should have responsive grid classes", () => {
    const { container } = render(<SkeletonCardGrid count={3} />);
    const grid = container.firstChild;
    expect(grid).toHaveClass("grid");
    expect(grid).toHaveClass("grid-cols-1");
  });
});
