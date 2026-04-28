import { render } from "@testing-library/react";
import {
  SkeletonText,
  SkeletonCard,
  SkeletonCardGrid,
  SkeletonBoardGame,
  SkeletonBoardGameList,
  SkeletonNotification,
  SkeletonNotificationList,
  SkeletonTableDetail,
} from "../components/common/Skeleton";

describe("Skeleton variants", () => {
  it("SkeletonText applies the default class when none provided", () => {
    const { container } = render(<SkeletonText />);
    const div = container.firstChild as HTMLElement;
    expect(div).toHaveClass("skeleton");
    expect(div).toHaveClass("h-4");
    expect(div).toHaveClass("w-full");
  });

  it("SkeletonText accepts a custom className", () => {
    const { container } = render(<SkeletonText className="h-2 w-16" />);
    const div = container.firstChild as HTMLElement;
    expect(div).toHaveClass("skeleton");
    expect(div).toHaveClass("h-2");
    expect(div).toHaveClass("w-16");
  });

  it("SkeletonCard renders three skeleton text lines", () => {
    const { container } = render(<SkeletonCard />);
    expect(container.querySelectorAll(".skeleton")).toHaveLength(3);
  });

  it("SkeletonCardGrid renders the requested number of cards", () => {
    const { container } = render(<SkeletonCardGrid count={5} />);
    expect(container.querySelectorAll(".card")).toHaveLength(5);
  });

  it("SkeletonCardGrid defaults to 3 cards", () => {
    const { container } = render(<SkeletonCardGrid />);
    expect(container.querySelectorAll(".card")).toHaveLength(3);
  });

  it("SkeletonBoardGame renders an image and text placeholders", () => {
    const { container } = render(<SkeletonBoardGame />);
    expect(
      container.querySelectorAll(".skeleton").length,
    ).toBeGreaterThanOrEqual(4);
  });

  it("SkeletonBoardGameList renders the requested number of items", () => {
    const { container } = render(<SkeletonBoardGameList count={4} />);
    expect(container.querySelectorAll(".card")).toHaveLength(4);
  });

  it("SkeletonNotification renders an avatar and text placeholders", () => {
    const { container } = render(<SkeletonNotification />);
    expect(
      container.querySelectorAll(".skeleton").length,
    ).toBeGreaterThanOrEqual(4);
  });

  it("SkeletonNotificationList renders the requested number of items", () => {
    const { container } = render(<SkeletonNotificationList count={6} />);
    // Each notification has at least one skeleton avatar div
    const avatars = container.querySelectorAll(".rounded-full");
    expect(avatars).toHaveLength(6);
  });

  it("SkeletonTableDetail renders multiple cards and skeleton blocks", () => {
    const { container } = render(<SkeletonTableDetail />);
    expect(container.querySelectorAll(".card").length).toBeGreaterThanOrEqual(
      2,
    );
    expect(container.querySelectorAll(".skeleton").length).toBeGreaterThan(5);
  });
});
