import { render, screen } from "@testing-library/react";
import BoardGameList from "../components/boardgames/BoardGameList";

describe("BoardGameList", () => {
  it("renders the empty state when no entries are provided", () => {
    render(<BoardGameList entries={[]} onRemove={vi.fn()} />);
    expect(screen.getByText("Aucun jeu ajoute pour l'instant")).toBeInTheDocument();
  });

  it("renders one card per unique board game", () => {
    render(
      <BoardGameList
        entries={[
          {
            id: "e1",
            boardGame: { id: "g1", name: "Catan", yearPublished: 1995 },
            broughtBy: { id: "u1", username: "Alice" },
          },
          {
            id: "e2",
            boardGame: { id: "g2", name: "Risk", yearPublished: 1957 },
            broughtBy: { id: "u2", username: "Bob" },
          },
        ]}
        onRemove={vi.fn()}
      />
    );
    expect(screen.getByText("Catan")).toBeInTheDocument();
    expect(screen.getByText("Risk")).toBeInTheDocument();
  });

  it("groups multiple entries for the same game into a single card", () => {
    render(
      <BoardGameList
        entries={[
          {
            id: "e1",
            boardGame: { id: "g1", name: "Catan", yearPublished: 1995 },
            broughtBy: { id: "u1", username: "Alice" },
          },
          {
            id: "e2",
            boardGame: { id: "g1", name: "Catan", yearPublished: 1995 },
            broughtBy: { id: "u2", username: "Bob" },
          },
        ]}
        onRemove={vi.fn()}
      />
    );
    expect(screen.getAllByText("Catan")).toHaveLength(1);
  });
});
