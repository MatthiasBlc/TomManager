import { render, screen, fireEvent } from "@testing-library/react";
import BoardGameDetailModal from "../components/boardgames/BoardGameDetailModal";

vi.mock("../hooks/useIsMobile", () => ({
  useIsMobile: () => false,
}));

const baseGame = {
  id: "g1",
  name: "Wingspan",
  yearPublished: 2019,
  minPlayers: 1,
  maxPlayers: 5,
  playingTime: 70,
  imageUrl: null,
};

describe("BoardGameDetailModal", () => {
  it("renders nothing when game is null", () => {
    const { container } = render(
      <BoardGameDetailModal
        open={true}
        onClose={vi.fn()}
        game={null}
        linkedTables={[]}
        broughtBy={[]}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders game name and stats", () => {
    render(
      <BoardGameDetailModal
        open={true}
        onClose={vi.fn()}
        game={baseGame}
        linkedTables={[]}
        broughtBy={[{ id: "u1", username: "Alice" }]}
      />
    );
    expect(screen.getAllByText("Wingspan").length).toBeGreaterThan(0);
    expect(screen.getByText("(2019)")).toBeInTheDocument();
    expect(screen.getByText("1-5 joueurs")).toBeInTheDocument();
    expect(screen.getByText("70 min")).toBeInTheDocument();
  });

  it("lists broughtBy users", () => {
    render(
      <BoardGameDetailModal
        open={true}
        onClose={vi.fn()}
        game={baseGame}
        linkedTables={[]}
        broughtBy={[
          { id: "u1", username: "Alice" },
          { id: "u2", username: "Bob" },
        ]}
      />
    );
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("shows linked tables when present", () => {
    render(
      <BoardGameDetailModal
        open={true}
        onClose={vi.fn()}
        game={baseGame}
        linkedTables={[
          { id: "t1", title: "Partie Wingspan" },
          { id: "t2", title: "Deuxieme table" },
        ]}
        broughtBy={[]}
      />
    );
    expect(screen.getByText("Tables associees (2)")).toBeInTheDocument();
    expect(screen.getByText("Partie Wingspan")).toBeInTheDocument();
    expect(screen.getByText("Deuxieme table")).toBeInTheDocument();
  });

  it("shows no-table message when linkedTables is empty", () => {
    render(
      <BoardGameDetailModal
        open={true}
        onClose={vi.fn()}
        game={baseGame}
        linkedTables={[]}
        broughtBy={[]}
      />
    );
    expect(screen.getByText("Aucune table associee")).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(
      <BoardGameDetailModal
        open={true}
        onClose={onClose}
        game={baseGame}
        linkedTables={[]}
        broughtBy={[]}
      />
    );
    fireEvent.click(screen.getByLabelText("Fermer"));
    expect(onClose).toHaveBeenCalled();
  });
});
