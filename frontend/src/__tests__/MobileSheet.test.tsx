import { render, screen } from "@testing-library/react";
import MobileSheet from "../components/common/MobileSheet";

describe("MobileSheet", () => {
  afterEach(() => {
    document.body.style.overflow = "";
  });

  it("renders nothing when closed", () => {
    render(
      <MobileSheet open={false} onClose={() => {}}>
        <p>Content</p>
      </MobileSheet>
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("locks body scroll when open and unlocks on close", () => {
    const { rerender } = render(
      <MobileSheet open={true} onClose={() => {}}>
        <p>Content</p>
      </MobileSheet>
    );
    expect(document.body.style.overflow).toBe("hidden");

    rerender(
      <MobileSheet open={false} onClose={() => {}}>
        <p>Content</p>
      </MobileSheet>
    );
    expect(document.body.style.overflow).toBe("");
  });

  it("keeps the scroll locked while a nested sheet is still open", () => {
    const { rerender: rerenderOuter } = render(
      <MobileSheet open={true} onClose={() => {}} title="Outer">
        <MobileSheet open={true} onClose={() => {}} title="Inner">
          <p>Inner content</p>
        </MobileSheet>
      </MobileSheet>
    );
    expect(document.body.style.overflow).toBe("hidden");

    // Close only the inner sheet — outer is still open, scroll must stay locked
    rerenderOuter(
      <MobileSheet open={true} onClose={() => {}} title="Outer">
        <MobileSheet open={false} onClose={() => {}} title="Inner">
          <p>Inner content</p>
        </MobileSheet>
      </MobileSheet>
    );
    expect(document.body.style.overflow).toBe("hidden");

    // Now close the outer sheet too — scroll should unlock
    rerenderOuter(
      <MobileSheet open={false} onClose={() => {}} title="Outer">
        <MobileSheet open={false} onClose={() => {}} title="Inner">
          <p>Inner content</p>
        </MobileSheet>
      </MobileSheet>
    );
    expect(document.body.style.overflow).toBe("");
  });
});
