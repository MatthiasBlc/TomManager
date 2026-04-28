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
      />,
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
      />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
