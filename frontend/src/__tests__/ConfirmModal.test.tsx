import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useState } from "react";
import { ConfirmProvider, useConfirm } from "../contexts/ConfirmContext";

const useIsMobileMock = vi.fn();

vi.mock("../hooks/useIsMobile", () => ({
  useIsMobile: () => useIsMobileMock(),
}));

// Harnais : declenche confirmDialog et affiche le resultat resolu
function Trigger() {
  const confirmDialog = useConfirm();
  const [result, setResult] = useState<string>("none");
  return (
    <>
      <button
        onClick={async () => {
          const ok = await confirmDialog({
            title: "Supprimer la table",
            message: "Cette action est irréversible.",
            confirmLabel: "Supprimer",
            variant: "danger",
          });
          setResult(String(ok));
        }}
      >
        trigger
      </button>
      <span data-testid="result">{result}</span>
    </>
  );
}

function renderHarness() {
  return render(
    <ConfirmProvider>
      <Trigger />
    </ConfirmProvider>
  );
}

describe("ConfirmProvider / useConfirm", () => {
  beforeEach(() => {
    useIsMobileMock.mockReset().mockReturnValue(false);
  });

  it("opens the dialog with title and message", async () => {
    renderHarness();
    fireEvent.click(screen.getByRole("button", { name: "trigger" }));
    expect(await screen.findByText("Supprimer la table")).toBeInTheDocument();
    expect(screen.getByText("Cette action est irréversible.")).toBeInTheDocument();
  });

  it("resolves true on confirm and closes", async () => {
    renderHarness();
    fireEvent.click(screen.getByRole("button", { name: "trigger" }));
    fireEvent.click(await screen.findByRole("button", { name: "Supprimer", hidden: true }));
    await waitFor(() => expect(screen.getByTestId("result")).toHaveTextContent("true"));
    expect(screen.queryByText("Cette action est irréversible.")).not.toBeInTheDocument();
  });

  it("resolves false on cancel", async () => {
    renderHarness();
    fireEvent.click(screen.getByRole("button", { name: "trigger" }));
    fireEvent.click(await screen.findByRole("button", { name: "Annuler", hidden: true }));
    await waitFor(() => expect(screen.getByTestId("result")).toHaveTextContent("false"));
  });

  it("resolves false on Escape", async () => {
    renderHarness();
    fireEvent.click(screen.getByRole("button", { name: "trigger" }));
    await screen.findByText("Supprimer la table");
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.getByTestId("result")).toHaveTextContent("false"));
  });
});
