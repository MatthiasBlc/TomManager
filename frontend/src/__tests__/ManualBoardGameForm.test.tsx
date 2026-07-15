import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import ManualBoardGameForm from "../components/boardgames/ManualBoardGameForm";

function clickStepper(label: string, direction: "Augmenter" | "Diminuer", times: number) {
  const group = screen.getByLabelText(label).closest(".join") as HTMLElement;
  const button = within(group).getByRole("button", { name: direction });
  for (let i = 0; i < times; i++) fireEvent.click(button);
}

describe("ManualBoardGameForm", () => {
  it("renders all fields and action buttons", () => {
    render(<ManualBoardGameForm onSubmit={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByLabelText("Nom")).toBeInTheDocument();
    expect(screen.getByLabelText("Année")).toBeInTheDocument();
    expect(screen.getByLabelText("Joueurs min")).toBeInTheDocument();
    expect(screen.getByLabelText("Joueurs max")).toBeInTheDocument();
    expect(screen.getByLabelText("Durée (min)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /créer et ajouter/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retour à la recherche/i })).toBeInTheDocument();
  });

  it("shows an error message when submitting without a name", async () => {
    const onSubmit = vi.fn();
    render(<ManualBoardGameForm onSubmit={onSubmit} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /créer et ajouter/i }));
    expect(await screen.findByText("Le nom est obligatoire")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits parsed numeric fields when valid", async () => {
    const onSubmit = vi.fn();
    render(<ManualBoardGameForm onSubmit={onSubmit} onCancel={vi.fn()} />);
    fireEvent.input(screen.getByLabelText("Nom"), {
      target: { value: "Catan" },
    });
    fireEvent.input(screen.getByLabelText("Année"), {
      target: { value: "1995" },
    });
    // Defaults : minPlayers=1, maxPlayers=4 (deja la valeur voulue), playingTime=30 (pas 15)
    clickStepper("Joueurs min", "Augmenter", 2);
    clickStepper("Durée (min)", "Augmenter", 6);

    fireEvent.click(screen.getByRole("button", { name: /créer et ajouter/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      name: "Catan",
      yearPublished: 1995,
      minPlayers: 3,
      maxPlayers: 4,
      playingTime: 120,
    });
  });

  it("calls onCancel when the back button is clicked", () => {
    const onCancel = vi.fn();
    render(<ManualBoardGameForm onSubmit={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: /retour à la recherche/i }));
    expect(onCancel).toHaveBeenCalled();
  });
});
