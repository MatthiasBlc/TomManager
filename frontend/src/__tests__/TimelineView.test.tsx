import { render, screen, fireEvent } from "@testing-library/react";
import TimelineView from "../components/planning/TimelineView";

const makeTable = (
  overrides: Partial<{ id: string; startDateTime: string; title: string }> = {}
) => ({
  id: "t1",
  title: "Donjon",
  pitch: null,
  maxPlayers: 5,
  startDateTime: "2026-04-10T18:00:00.000Z",
  endDateTime: "2026-04-10T22:00:00.000Z",
  creator: { id: "u1", username: "Alice" },
  tags: [],
  confirmedCount: 0,
  waitlistCount: 0,
  currentUserStatus: null,
  isGM: false,
  currentUserConflict: false,
  conflictingPlayerCount: 0,
  ...overrides,
});

describe("TimelineView", () => {
  it("renders the empty state when no tables", () => {
    render(<TimelineView tables={[]} onTableClick={vi.fn()} />);
    expect(screen.getByText("No tables yet")).toBeInTheDocument();
  });

  it("renders one card per table", () => {
    render(
      <TimelineView
        tables={[
          makeTable({ id: "t1", title: "Donjon" }),
          makeTable({ id: "t2", title: "Cthulhu" }),
        ]}
        onTableClick={vi.fn()}
      />
    );
    expect(screen.getByText("Donjon")).toBeInTheDocument();
    expect(screen.getByText("Cthulhu")).toBeInTheDocument();
  });

  it("groups tables by date and shows a heading per date", () => {
    const formatDate = (iso: string) =>
      new Date(iso).toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
    const day1 = "2026-04-10T18:00:00.000Z";
    const day2 = "2026-04-11T18:00:00.000Z";
    render(
      <TimelineView
        tables={[
          makeTable({ id: "t1", title: "Day1", startDateTime: day1 }),
          makeTable({ id: "t2", title: "Day2", startDateTime: day2 }),
        ]}
        onTableClick={vi.fn()}
      />
    );
    expect(screen.getByText(formatDate(day1))).toBeInTheDocument();
    expect(screen.getByText(formatDate(day2))).toBeInTheDocument();
  });

  it("calls onTableClick with the table id when a card is clicked", () => {
    const onTableClick = vi.fn();
    render(
      <TimelineView
        tables={[makeTable({ id: "t-xyz", title: "Donjon" })]}
        onTableClick={onTableClick}
      />
    );
    fireEvent.click(screen.getByText("Donjon"));
    expect(onTableClick).toHaveBeenCalledWith("t-xyz");
  });
});
