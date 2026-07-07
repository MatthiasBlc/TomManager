import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import EditTableModal from "../components/planning/EditTableModal";

const apiPatchMock = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("../config/api", () => ({
  default: { patch: (...args: unknown[]) => apiPatchMock(...args), get: vi.fn() },
}));
vi.mock("react-hot-toast", () => ({
  default: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}));
vi.mock("../components/common/ResponsiveModal", () => ({
  default: ({
    open,
    children,
    title,
  }: {
    open: boolean;
    children: React.ReactNode;
    title: string;
  }) =>
    open ? (
      <div role="dialog" aria-label={title}>
        {children}
      </div>
    ) : null,
}));
vi.mock("../components/planning/TagInput", () => ({
  default: ({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) => (
    <div data-testid="tag-input">
      <span>tags:{value.join(",")}</span>
      <button type="button" onClick={() => onChange([...value, "added"])}>
        add-tag
      </button>
    </div>
  ),
}));

const baseTable = {
  id: "t1",
  title: "Donjon",
  type: "JDR" as const,
  gmIsPlayer: false,
  pitch: "Une aventure",
  triggers: null,
  comments: null,
  maxPlayers: 3,
  reservedSeats: 0,
  startDateTime: "2026-04-10T18:00:00.000Z",
  endDateTime: "2026-04-10T22:00:00.000Z",
  tags: [],
  participants: [] as { userId: string; status: string; isOnReservedSeat: boolean }[],
};

describe("EditTableModal", () => {
  beforeEach(() => {
    apiPatchMock.mockReset().mockResolvedValue({});
    toastSuccess.mockReset();
    toastError.mockReset();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the current occupancy summary", () => {
    render(
      <EditTableModal
        open={true}
        onClose={vi.fn()}
        onUpdated={vi.fn()}
        eventId="ev1"
        table={{
          ...baseTable,
          reservedSeats: 1,
          participants: [
            { userId: "u2", status: "CONFIRMED", isOnReservedSeat: true },
            { userId: "u3", status: "WAITLIST", isOnReservedSeat: false },
          ],
        }}
      />
    );
    expect(
      screen.getByText(
        /Actuellement : 1\/3 confirmes \(1 sur place reservee\), 1 en liste d'attente/
      )
    ).toBeInTheDocument();
  });

  it("warns and asks for confirmation when lowering maxPlayers would demote confirmed players", async () => {
    const onUpdated = vi.fn();
    render(
      <EditTableModal
        open={true}
        onClose={vi.fn()}
        onUpdated={onUpdated}
        eventId="ev1"
        table={{
          ...baseTable,
          maxPlayers: 3,
          participants: [
            { userId: "u2", status: "CONFIRMED", isOnReservedSeat: false },
            { userId: "u3", status: "CONFIRMED", isOnReservedSeat: false },
          ],
        }}
      />
    );

    const maxPlayersGroup = screen.getByLabelText("Joueurs max").closest(".join") as HTMLElement;
    const decrement = within(maxPlayersGroup).getByRole("button", { name: "Diminuer" });
    fireEvent.click(decrement);
    fireEvent.click(decrement);
    expect(
      await screen.findByText(/1 joueur confirme sera mis en liste d.attente/)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Enregistrer$/i }));

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalled();
      expect(apiPatchMock).toHaveBeenCalled();
      expect(onUpdated).toHaveBeenCalled();
    });
  });

  it("blocks submission when the demotion warning is declined", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(
      <EditTableModal
        open={true}
        onClose={vi.fn()}
        onUpdated={vi.fn()}
        eventId="ev1"
        table={{
          ...baseTable,
          maxPlayers: 3,
          participants: [
            { userId: "u2", status: "CONFIRMED", isOnReservedSeat: false },
            { userId: "u3", status: "CONFIRMED", isOnReservedSeat: false },
          ],
        }}
      />
    );

    const maxPlayersGroup = screen.getByLabelText("Joueurs max").closest(".join") as HTMLElement;
    const decrement = within(maxPlayersGroup).getByRole("button", { name: "Diminuer" });
    fireEvent.click(decrement);
    fireEvent.click(decrement);
    fireEvent.click(screen.getByRole("button", { name: /^Enregistrer$/i }));

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalled();
    });
    expect(apiPatchMock).not.toHaveBeenCalled();
  });

  it("submits without confirmation when no demotion is caused", async () => {
    const onUpdated = vi.fn();
    render(
      <EditTableModal
        open={true}
        onClose={vi.fn()}
        onUpdated={onUpdated}
        eventId="ev1"
        table={{ ...baseTable, participants: [] }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /^Enregistrer$/i }));

    await waitFor(() => {
      expect(apiPatchMock).toHaveBeenCalled();
      expect(onUpdated).toHaveBeenCalled();
    });
    expect(window.confirm).not.toHaveBeenCalled();
  });
});
