import { render, screen, fireEvent } from "@testing-library/react";
import TableCard from "../components/planning/TableCard";

const baseTable = {
  id: "t1",
  title: "Donjon des morts",
  type: "JDR" as const,
  pitch: "Une aventure mortelle",
  maxPlayers: 5,
  startDateTime: "2026-04-10T18:30:00.000Z",
  endDateTime: "2026-04-10T22:00:00.000Z",
  creator: { id: "u1", username: "Alice" },
  tags: [
    { id: "tag1", name: "Fantasy" },
    { id: "tag2", name: "Horreur" },
  ],
  players: [
    { id: "u2", username: "Bob" },
    { id: "u3", username: "Charlie" },
  ],
  confirmedCount: 3,
  waitlistCount: 0,
  currentUserStatus: null,
  isGM: false,
  currentUserConflict: false,
  conflictingPlayerCount: 0,
};

describe("TableCard", () => {
  it("renders title, GM, pitch and counts", () => {
    render(<TableCard table={baseTable} onClick={() => {}} />);
    expect(screen.getByText("Donjon des morts")).toBeInTheDocument();
    expect(screen.getByText("MJ : Alice")).toBeInTheDocument();
    expect(screen.getByText("Une aventure mortelle")).toBeInTheDocument();
    expect(screen.getByText("3/5")).toBeInTheDocument();
  });

  it("renders the type badge (JDR or JDS)", () => {
    render(<TableCard table={baseTable} onClick={() => {}} />);
    expect(screen.getByText("JDR")).toBeInTheDocument();
  });

  it("renders all tag names as badges", () => {
    render(<TableCard table={baseTable} onClick={() => {}} />);
    expect(screen.getByText("Fantasy")).toBeInTheDocument();
    expect(screen.getByText("Horreur")).toBeInTheDocument();
  });

  it("renders the MJ badge when isGM is true", () => {
    render(<TableCard table={{ ...baseTable, isGM: true }} onClick={() => {}} />);
    expect(screen.getByText("MJ")).toBeInTheDocument();
  });

  it("renders the waitlist badge when waitlistCount > 0", () => {
    render(<TableCard table={{ ...baseTable, waitlistCount: 2 }} onClick={() => {}} />);
    expect(screen.getByText("+2 en attente")).toBeInTheDocument();
  });

  it("renders the Joined badge when currentUserStatus is CONFIRMED", () => {
    render(
      <TableCard table={{ ...baseTable, currentUserStatus: "CONFIRMED" }} onClick={() => {}} />
    );
    expect(screen.getByText("Inscrit")).toBeInTheDocument();
  });

  it("renders the Waitlist badge when currentUserStatus is WAITLIST", () => {
    render(
      <TableCard table={{ ...baseTable, currentUserStatus: "WAITLIST" }} onClick={() => {}} />
    );
    expect(screen.getByText("Liste d'attente")).toBeInTheDocument();
  });

  it("renders a conflict badge when currentUserConflict is true", () => {
    render(<TableCard table={{ ...baseTable, currentUserConflict: true }} onClick={() => {}} />);
    expect(screen.getByText(/Conflit/i)).toBeInTheDocument();
  });

  it("renders the GM player conflict badge with plural form when needed", () => {
    render(
      <TableCard
        table={{ ...baseTable, isGM: true, conflictingPlayerCount: 3 }}
        onClick={() => {}}
      />
    );
    expect(screen.getByText(/3 conflits/i)).toBeInTheDocument();
  });

  it("does not render a pitch paragraph when pitch is null", () => {
    render(<TableCard table={{ ...baseTable, pitch: null }} onClick={() => {}} />);
    expect(screen.queryByText("Une aventure mortelle")).not.toBeInTheDocument();
  });

  it("calls onClick when the card is clicked", () => {
    const onClick = vi.fn();
    const { container } = render(<TableCard table={baseTable} onClick={onClick} />);
    fireEvent.click(container.firstChild as HTMLElement);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
