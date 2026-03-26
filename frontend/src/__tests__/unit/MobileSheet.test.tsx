import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import MobileSheet from "../../components/common/MobileSheet";

describe("MobileSheet", () => {
  it("should render nothing when closed", () => {
    const { container } = render(
      <MobileSheet open={false} onClose={vi.fn()}>
        <p>Content</p>
      </MobileSheet>
    );
    expect(container.innerHTML).toBe("");
  });

  it("should render children when open", () => {
    render(
      <MobileSheet open={true} onClose={vi.fn()}>
        <p>Sheet content</p>
      </MobileSheet>
    );
    expect(screen.getByText("Sheet content")).toBeInTheDocument();
  });

  it("should render title when provided", () => {
    render(
      <MobileSheet open={true} onClose={vi.fn()} title="My Title">
        <p>Content</p>
      </MobileSheet>
    );
    expect(screen.getByText("My Title")).toBeInTheDocument();
  });

  it("should call onClose when backdrop is clicked", () => {
    const onClose = vi.fn();
    render(
      <MobileSheet open={true} onClose={onClose}>
        <p>Content</p>
      </MobileSheet>
    );
    // Backdrop is the first child div inside the dialog
    const backdrop = screen.getByRole("dialog").querySelector(".bg-black\\/50");
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("should call onClose on Escape key", () => {
    const onClose = vi.fn();
    render(
      <MobileSheet open={true} onClose={onClose}>
        <p>Content</p>
      </MobileSheet>
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("should have aria-modal attribute", () => {
    render(
      <MobileSheet open={true} onClose={vi.fn()}>
        <p>Content</p>
      </MobileSheet>
    );
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
  });
});
