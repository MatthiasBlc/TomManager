import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import FAB from "../../components/common/FAB";
import ResponsiveModal from "../../components/common/ResponsiveModal";

// Mock useIsMobile - default to desktop
const mockUseIsMobile = vi.fn(() => false);
vi.mock("../../hooks/useIsMobile", () => ({
  useIsMobile: () => mockUseIsMobile(),
}));

// Mock useSocket
vi.mock("../../hooks/useSocket", () => ({
  useSocket: () => null,
}));

describe("FAB", () => {
  it("should render with aria-label", () => {
    const onClick = vi.fn();
    render(<FAB onClick={onClick} label="Create Event" />);
    const btn = screen.getByLabelText("Create Event");
    expect(btn).toBeInTheDocument();
    expect(btn.textContent).toBe("+");
  });

  it("should have fixed positioning classes", () => {
    render(<FAB onClick={vi.fn()} label="Test" />);
    const btn = screen.getByLabelText("Test");
    expect(btn.className).toContain("fixed");
    expect(btn.className).toContain("bottom-20");
  });
});

describe("ResponsiveModal", () => {
  it("should render as DaisyUI modal on desktop", () => {
    mockUseIsMobile.mockReturnValue(false);
    render(
      <ResponsiveModal open={true} onClose={vi.fn()} title="Test Title">
        <p>Content</p>
      </ResponsiveModal>
    );
    expect(screen.getByText("Test Title")).toBeInTheDocument();
    expect(screen.getByText("Content")).toBeInTheDocument();
    expect(document.querySelector(".modal-box")).toBeInTheDocument();
  });

  it("should render as MobileSheet on mobile", () => {
    mockUseIsMobile.mockReturnValue(true);
    render(
      <ResponsiveModal open={true} onClose={vi.fn()} title="Mobile Title">
        <p>Mobile Content</p>
      </ResponsiveModal>
    );
    expect(screen.getByText("Mobile Title")).toBeInTheDocument();
    expect(screen.getByText("Mobile Content")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
  });

  it("should render nothing when closed on desktop", () => {
    mockUseIsMobile.mockReturnValue(false);
    const { container } = render(
      <ResponsiveModal open={false} onClose={vi.fn()} title="Test">
        <p>Content</p>
      </ResponsiveModal>
    );
    expect(container.innerHTML).toBe("");
  });
});
