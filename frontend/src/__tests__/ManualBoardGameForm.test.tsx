import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ManualBoardGameForm from "../components/boardgames/ManualBoardGameForm";

describe("ManualBoardGameForm", () => {
  it("renders all fields and action buttons", () => {
    render(<ManualBoardGameForm onSubmit={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByLabelText("Nom")).toBeInTheDocument();
    expect(screen.getByLabelText("Annee")).toBeInTheDocument();
    expect(screen.getByLabelText("Joueurs min")).toBeInTheDocument();
    expect(screen.getByLabelText("Joueurs max")).toBeInTheDocument();
    expect(screen.getByLabelText("Duree (min)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /creer et ajouter/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retour a la recherche/i })).toBeInTheDocument();
  });

  it("shows an error message when submitting without a name", async () => {
    const onSubmit = vi.fn();
    render(<ManualBoardGameForm onSubmit={onSubmit} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /creer et ajouter/i }));
    expect(await screen.findByText("Le nom est obligatoire")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits parsed numeric fields when valid", async () => {
    const onSubmit = vi.fn();
    render(<ManualBoardGameForm onSubmit={onSubmit} onCancel={vi.fn()} />);
    fireEvent.input(screen.getByLabelText("Nom"), {
      target: { value: "Catan" },
    });
    fireEvent.input(screen.getByLabelText("Annee"), {
      target: { value: "1995" },
    });
    fireEvent.input(screen.getByLabelText("Joueurs min"), {
      target: { value: "3" },
    });
    fireEvent.input(screen.getByLabelText("Joueurs max"), {
      target: { value: "4" },
    });
    fireEvent.input(screen.getByLabelText("Duree (min)"), {
      target: { value: "120" },
    });

    fireEvent.click(screen.getByRole("button", { name: /creer et ajouter/i }));
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
    fireEvent.click(screen.getByRole("button", { name: /retour a la recherche/i }));
    expect(onCancel).toHaveBeenCalled();
  });
});
