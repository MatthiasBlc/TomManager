import { render, screen, fireEvent } from "@testing-library/react";
import ResponsiveModal from "../components/common/ResponsiveModal";

const useIsMobileMock = vi.fn();

vi.mock("../hooks/useIsMobile", () => ({
  useIsMobile: () => useIsMobileMock(),
}));

describe("ResponsiveModal (desktop)", () => {
  beforeEach(() => {
    useIsMobileMock.mockReset().mockReturnValue(false);
  });

  it("renders nothing when closed", () => {
    render(
      <ResponsiveModal open={false} onClose={() => {}} title="Test">
        <p>Content</p>
      </ResponsiveModal>
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(
      <ResponsiveModal open={true} onClose={onClose} title="Test">
        <button>Action</button>
      </ResponsiveModal>
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("traps Tab inside the modal", () => {
    render(
      <ResponsiveModal open={true} onClose={() => {}} title="Test">
        <button>Action</button>
      </ResponsiveModal>
    );
    // Dernier element focusable : Tab doit boucler sur le premier (bouton Fermer).
    // `hidden: true` : jsdom considere le contenu d'un <dialog> sans attribut
    // `open` comme inaccessible (DaisyUI utilise la classe modal-open a la place)
    const action = screen.getByRole("button", { name: "Action", hidden: true });
    action.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Fermer", hidden: true })
    );
  });

  it("traps Shift+Tab inside the modal", () => {
    render(
      <ResponsiveModal open={true} onClose={() => {}} title="Test">
        <button>Action</button>
      </ResponsiveModal>
    );
    // Premier element focusable : Shift+Tab doit boucler sur le dernier
    const close = screen.getByRole("button", { name: "Fermer", hidden: true });
    close.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Action", hidden: true })
    );
  });
});
