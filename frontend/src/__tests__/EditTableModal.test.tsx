import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import EditTableModal from "../components/planning/EditTableModal";

const apiPatchMock = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();
const confirmDialogMock = vi.fn();

vi.mock("../contexts/ConfirmContext", () => ({
  useConfirm: () => confirmDialogMock,
}));
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
    confirmDialogMock.mockReset().mockResolvedValue(true);
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
        /Actuellement : 1\/3 confirmés \(1 sur place réservée\), 1 en liste d'attente/
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
      await screen.findByText(/1 joueur confirmé sera mis en liste d.attente/)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Enregistrer$/i }));

    await waitFor(() => {
      expect(confirmDialogMock).toHaveBeenCalled();
      expect(apiPatchMock).toHaveBeenCalled();
      expect(onUpdated).toHaveBeenCalled();
    });
  });

  it("blocks submission when the demotion warning is declined", async () => {
    confirmDialogMock.mockResolvedValue(false);
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
      expect(confirmDialogMock).toHaveBeenCalled();
    });
    expect(apiPatchMock).not.toHaveBeenCalled();
  });

  it("does not warn when lowering reservedSeats converts the reserved overflow to a free seat instead of waitlisting", async () => {
    const onUpdated = vi.fn();
    render(
      <EditTableModal
        open={true}
        onClose={vi.fn()}
        onUpdated={onUpdated}
        eventId="ev1"
        table={{
          ...baseTable,
          maxPlayers: 4,
          reservedSeats: 3,
          participants: [
            { userId: "u0", status: "CONFIRMED", isOnReservedSeat: false },
            { userId: "u1", status: "CONFIRMED", isOnReservedSeat: true },
            { userId: "u2", status: "CONFIRMED", isOnReservedSeat: true },
            { userId: "u3", status: "CONFIRMED", isOnReservedSeat: true },
          ],
        }}
      />
    );

    const reservedGroup = screen.getByLabelText("Places réservées").closest(".join") as HTMLElement;
    fireEvent.click(within(reservedGroup).getByRole("button", { name: "Diminuer" }));

    // 3 -> 2 : une place libre s'ouvre exactement pour le joueur reserve en trop, pas de demotion
    expect(screen.queryByText(/mis en liste d.attente/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Enregistrer$/i }));

    await waitFor(() => {
      expect(apiPatchMock).toHaveBeenCalled();
      expect(onUpdated).toHaveBeenCalled();
    });
    expect(confirmDialogMock).not.toHaveBeenCalled();
  });

  it("shows a hint that a seat will be created/deleted when the gmIsPlayer checkbox changes", async () => {
    render(
      <EditTableModal
        open={true}
        onClose={vi.fn()}
        onUpdated={vi.fn()}
        eventId="ev1"
        table={{ ...baseTable, gmIsPlayer: false }}
      />
    );

    expect(screen.queryByText(/sera créée pour le MJ/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/MJ est aussi joueur/i));
    expect(
      await screen.findByText(/Une place supplémentaire sera créée pour le MJ/)
    ).toBeInTheDocument();
  });

  it("caps the reserved seats stepper at maxPlayers - 1 when the GM plays (JDR gmIsPlayer)", () => {
    render(
      <EditTableModal
        open={true}
        onClose={vi.fn()}
        onUpdated={vi.fn()}
        eventId="ev1"
        table={{ ...baseTable, gmIsPlayer: true, maxPlayers: 3 }}
      />
    );

    // Le MJ joueur occupe une place → borne a maxPlayers - 1 = 2
    const reservedGroup = screen.getByLabelText("Places réservées").closest(".join") as HTMLElement;
    const increment = within(reservedGroup).getByRole("button", { name: "Augmenter" });
    for (let i = 0; i < 3; i++) fireEvent.click(increment);
    expect(screen.getByLabelText("Places réservées")).toHaveValue("2");
    expect(increment).toBeDisabled();
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
    expect(confirmDialogMock).not.toHaveBeenCalled();
  });
});
