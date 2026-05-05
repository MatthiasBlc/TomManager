import { render, screen, fireEvent } from "@testing-library/react";
import BoardGameCard from "../components/boardgames/BoardGameCard";

const baseGame = {
  id: "1",
  name: "Catan",
  yearPublished: 1995,
  minPlayers: 3,
  maxPlayers: 4,
  playingTime: 120,
  imageUrl: null,
};

describe("BoardGameCard", () => {
  it("renders game name and year", () => {
    render(<BoardGameCard game={baseGame} broughtBy={[]} />);
    expect(screen.getByText("Catan")).toBeInTheDocument();
    expect(screen.getByText("(1995)")).toBeInTheDocument();
  });

  it("renders player count and duration", () => {
    render(<BoardGameCard game={baseGame} broughtBy={[]} />);
    expect(screen.getByText("3-4 players")).toBeInTheDocument();
    expect(screen.getByText("120 min")).toBeInTheDocument();
  });

  it("shows remove button for own entry", () => {
    const onRemove = vi.fn();
    render(
      <BoardGameCard
        game={baseGame}
        broughtBy={[{ id: "user1", username: "Alice" }]}
        onRemove={onRemove}
        removableEntries={[{ entryId: "entry1", broughtByUserId: "user1" }]}
        currentUserId="user1"
      />
    );
    const btn = screen.getByRole("button", { name: /Remove Catan/i });
    fireEvent.click(btn);
    expect(onRemove).toHaveBeenCalledWith("entry1");
  });

  it("hides remove button for another user's entry", () => {
    render(
      <BoardGameCard
        game={baseGame}
        broughtBy={[{ id: "user2", username: "Bob" }]}
        onRemove={vi.fn()}
        removableEntries={[{ entryId: "entry2", broughtByUserId: "user2" }]}
        currentUserId="user1"
      />
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows linkedTables badge when tables are present", () => {
    render(
      <BoardGameCard
        game={baseGame}
        broughtBy={[]}
        linkedTables={[
          { id: "t1", title: "Table 1" },
          { id: "t2", title: "Table 2" },
        ]}
      />
    );
    expect(screen.getByText("2 tables")).toBeInTheDocument();
  });

  it("shows singular badge for one linked table", () => {
    render(
      <BoardGameCard
        game={baseGame}
        broughtBy={[]}
        linkedTables={[{ id: "t1", title: "Table 1" }]}
      />
    );
    expect(screen.getByText("1 table")).toBeInTheDocument();
  });

  it("calls onClick when card is clicked", () => {
    const onClick = vi.fn();
    render(<BoardGameCard game={baseGame} broughtBy={[]} onClick={onClick} />);
    fireEvent.click(screen.getByText("Catan"));
    expect(onClick).toHaveBeenCalled();
  });

  it("renders description when present", () => {
    render(
      <BoardGameCard
        game={{ ...baseGame, description: "Un jeu de construction." }}
        broughtBy={[]}
      />
    );
    expect(screen.getByText("Un jeu de construction.")).toBeInTheDocument();
  });

  it("does not render description section when absent", () => {
    render(<BoardGameCard game={baseGame} broughtBy={[]} />);
    expect(screen.queryByText(/construction/i)).not.toBeInTheDocument();
  });

  it("stopPropagation on remove button does not trigger onClick", () => {
    const onClick = vi.fn();
    const onRemove = vi.fn();
    render(
      <BoardGameCard
        game={baseGame}
        broughtBy={[{ id: "user1", username: "Alice" }]}
        onRemove={onRemove}
        removableEntries={[{ entryId: "entry1", broughtByUserId: "user1" }]}
        currentUserId="user1"
        onClick={onClick}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Remove Catan/i }));
    expect(onRemove).toHaveBeenCalledWith("entry1");
    expect(onClick).not.toHaveBeenCalled();
  });
});
