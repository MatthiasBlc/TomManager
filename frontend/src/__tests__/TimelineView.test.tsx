import { render, screen, fireEvent } from "@testing-library/react";
import TimelineView from "../components/planning/TimelineView";
import { computeLayout } from "../components/planning/computeLayout";

const useIsMobileMock = vi.fn().mockReturnValue(false);
vi.mock("../hooks/useIsMobile", () => ({
  useIsMobile: () => useIsMobileMock(),
}));

const makeTable = (
  overrides: Partial<{ id: string; startDateTime: string; title: string }> = {}
) => ({
  id: "t1",
  title: "Donjon",
  type: "JDR" as const,
  pitch: null,
  maxPlayers: 5,
  reservedSeats: 0,
  startDateTime: "2026-04-10T18:00:00.000Z",
  endDateTime: "2026-04-10T22:00:00.000Z",
  creator: { id: "u1", username: "Alice" },
  tags: [],
  players: [],
  confirmedCount: 0,
  waitlistCount: 0,
  confirmedOnReserved: 0,
  currentUserStatus: null,
  isGM: false,
  currentUserConflict: false,
  conflictingPlayerCount: 0,
  ...overrides,
});

// Helper to build minimal TableSummary objects for computeLayout tests
const makeSlot = (id: string, start: string, end: string) => ({
  id,
  title: id,
  type: "JDR" as const,
  pitch: null,
  maxPlayers: 4,
  reservedSeats: 0,
  startDateTime: start,
  endDateTime: end,
  creator: { id: "u1", username: "gm" },
  tags: [],
  players: [],
  confirmedCount: 0,
  waitlistCount: 0,
  confirmedOnReserved: 0,
  currentUserStatus: null,
  isGM: false,
  currentUserConflict: false,
  conflictingPlayerCount: 0,
});

describe("computeLayout", () => {
  it("tables sequentielles : toutes en col 0, rowSpan 1", () => {
    const A = makeSlot("A", "2026-07-16T08:00:00Z", "2026-07-16T11:00:00Z");
    const B = makeSlot("B", "2026-07-16T13:00:00Z", "2026-07-16T17:00:00Z");
    const items = computeLayout([A, B]);
    const byId = Object.fromEntries(items.map((i) => [i.table.id, i]));
    expect(byId["A"].col).toBe(0);
    expect(byId["B"].col).toBe(0);
    expect(byId["A"].rowSpan).toBe(1);
    expect(byId["B"].rowSpan).toBe(1);
  });

  it("2 tables simultanees : colonnes differentes, rowSpan 1", () => {
    const A = makeSlot("A", "2026-07-17T09:00:00Z", "2026-07-17T13:00:00Z");
    const B = makeSlot("B", "2026-07-17T09:00:00Z", "2026-07-17T13:00:00Z");
    const items = computeLayout([A, B]);
    const cols = items.map((i) => i.col);
    expect(new Set(cols).size).toBe(2); // chacune dans sa colonne
    items.forEach((i) => expect(i.rowSpan).toBe(1));
  });

  it("cas A|B / C|B : B longue chevauche A et C", () => {
    // A : 8h-11h, B : 8h-16h, C : 13h-16h
    const A = makeSlot("A", "2026-07-18T08:00:00Z", "2026-07-18T11:00:00Z");
    const B = makeSlot("B", "2026-07-18T08:00:00Z", "2026-07-18T16:00:00Z");
    const C = makeSlot("C", "2026-07-18T13:00:00Z", "2026-07-18T16:00:00Z");
    const items = computeLayout([A, B, C]);
    const byId = Object.fromEntries(items.map((i) => [i.table.id, i]));

    // A et C dans la meme colonne, B dans l'autre
    expect(byId["A"].col).toBe(byId["C"].col);
    expect(byId["B"].col).not.toBe(byId["A"].col);

    // B couvre A et C => rowSpan 2
    expect(byId["B"].rowSpan).toBe(2);

    // A et C rowSpan 1
    expect(byId["A"].rowSpan).toBe(1);
    expect(byId["C"].rowSpan).toBe(1);

    // cssRow de B = 1 (premiere de sa colonne)
    expect(byId["B"].cssRow).toBe(1);

    // cssRow de C = 2 (apres A qui a rowSpan 1)
    expect(byId["C"].cssRow).toBe(2);
  });

  it("3 tables simultanees : 3 colonnes differentes", () => {
    const A = makeSlot("A", "2026-07-19T08:00:00Z", "2026-07-19T12:00:00Z");
    const B = makeSlot("B", "2026-07-19T08:00:00Z", "2026-07-19T12:00:00Z");
    const C = makeSlot("C", "2026-07-19T08:00:00Z", "2026-07-19T12:00:00Z");
    const items = computeLayout([A, B, C]);
    const cols = items.map((i) => i.col);
    expect(new Set(cols).size).toBe(3);
  });
});

describe("TimelineView", () => {
  it("renders the empty state when no tables", () => {
    render(<TimelineView tables={[]} onTableClick={vi.fn()} />);
    expect(screen.getByText("Aucune table pour l'instant")).toBeInTheDocument();
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

  it("stacks overlapping tables in one chronological column on mobile", () => {
    useIsMobileMock.mockReturnValue(true);
    render(
      <TimelineView
        tables={[
          makeTable({
            id: "t2",
            title: "Cthulhu",
            startDateTime: "2026-04-10T19:00:00.000Z",
          }),
          makeTable({ id: "t1", title: "Donjon", startDateTime: "2026-04-10T18:00:00.000Z" }),
        ]}
        onTableClick={vi.fn()}
      />
    );
    useIsMobileMock.mockReturnValue(false);
    const titles = screen.getAllByText(/Donjon|Cthulhu/).map((el) => el.textContent);
    expect(titles).toEqual(["Donjon", "Cthulhu"]);
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
