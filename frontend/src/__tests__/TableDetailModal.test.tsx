import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import TableDetailModal from "../components/planning/TableDetailModal";

const apiGetMock = vi.fn();
const apiPostMock = vi.fn();
const apiPatchMock = vi.fn();
const apiDeleteMock = vi.fn();
const useAuthMock = vi.fn();
const useIsMobileMock = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();
const confirmDialogMock = vi.fn();

vi.mock("../contexts/ConfirmContext", () => ({
  useConfirm: () => confirmDialogMock,
}));
vi.mock("../config/api", () => ({
  default: {
    get: (...args: unknown[]) => apiGetMock(...args),
    post: (...args: unknown[]) => apiPostMock(...args),
    patch: (...args: unknown[]) => apiPatchMock(...args),
    delete: (...args: unknown[]) => apiDeleteMock(...args),
  },
}));
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));
vi.mock("../hooks/useIsMobile", () => ({
  useIsMobile: () => useIsMobileMock(),
}));
vi.mock("../hooks/useEventSocket", () => ({
  useEventSocket: () => {},
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
vi.mock("../components/planning/EditTableModal", () => ({
  default: ({ open }: { open: boolean }) => (open ? <div data-testid="edit-modal" /> : null),
}));

const baseTable = {
  id: "t1",
  eventId: "ev1",
  createdBy: "u1",
  title: "Donjon",
  type: "JDR" as const,
  gmIsPlayer: false,
  pitch: "Une aventure",
  triggers: null,
  comments: null,
  maxPlayers: 5,
  startDateTime: "2026-04-10T18:00:00.000Z",
  endDateTime: "2026-04-10T22:00:00.000Z",
  creator: { id: "u1", username: "Alice" },
  tags: [{ id: "tag1", name: "horreur" }],
  participants: [
    {
      userId: "u2",
      username: "Bob",
      status: "CONFIRMED",
      joinedAt: "2026-04-09T10:00:00.000Z",
    },
  ],
};

function renderModal(
  extra: Partial<{
    user: { id: string; role: string } | null;
    preferences: Record<string, boolean>;
  }> = {}
) {
  useAuthMock.mockReturnValue({
    user: extra.user ?? { id: "u2", role: "USER" },
    preferences: extra.preferences,
  });
  return render(
    <TableDetailModal
      open={true}
      onClose={vi.fn()}
      tableId="t1"
      eventId="ev1"
      onTableDeleted={vi.fn()}
      onTableUpdated={vi.fn()}
    />
  );
}

describe("TableDetailModal", () => {
  beforeEach(() => {
    apiGetMock.mockReset().mockResolvedValue({ data: { data: baseTable } });
    apiPostMock.mockReset();
    apiPatchMock.mockReset().mockResolvedValue({});
    apiDeleteMock.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
    useIsMobileMock.mockReset().mockReturnValue(false);
    useAuthMock.mockReset();
    confirmDialogMock.mockReset().mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches the table when opened and renders details", async () => {
    renderModal();
    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith("/api/events/ev1/tables/t1");
    });
    expect(await screen.findByText("Une aventure")).toBeInTheDocument();
    expect(screen.getByText(/MJ : Alice/)).toBeInTheDocument();
    expect(screen.getByText("horreur")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("shows the Rejoindre button when current user is not a participant and not the GM", async () => {
    renderModal({ user: { id: "u3", role: "USER" } });
    expect(await screen.findByRole("button", { name: /Rejoindre/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Quitter$/i })).not.toBeInTheDocument();
  });

  it("shows the Quitter button when current user is already a participant", async () => {
    renderModal({ user: { id: "u2", role: "USER" } });
    expect(await screen.findByRole("button", { name: /^Quitter$/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Rejoindre/i })).not.toBeInTheDocument();
  });

  it("shows Modifier and Supprimer buttons for the GM", async () => {
    renderModal({ user: { id: "u1", role: "USER" } });
    expect(await screen.findByRole("button", { name: /Modifier/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Supprimer/i })).toBeInTheDocument();
  });

  it("shows Modifier and Supprimer buttons for an admin with table moderation enabled", async () => {
    renderModal({
      user: { id: "u3", role: "ADMIN" },
      preferences: { "admin.tables": true },
    });
    expect(await screen.findByRole("button", { name: /Modifier/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Supprimer/i })).toBeInTheDocument();
  });

  it("does not show Modifier/Supprimer for an admin without table moderation enabled", async () => {
    renderModal({ user: { id: "u3", role: "ADMIN" } });
    expect(await screen.findByRole("button", { name: /Rejoindre/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Modifier/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Supprimer/i })).not.toBeInTheDocument();
  });

  it("does not show Modifier/Supprimer for a regular non-GM participant", async () => {
    renderModal({ user: { id: "u2", role: "USER" } });
    await screen.findByText("Une aventure");
    expect(screen.queryByRole("button", { name: /Modifier/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Supprimer$/i })).not.toBeInTheDocument();
  });

  it("calls api.post when Rejoindre is clicked", async () => {
    apiPostMock.mockResolvedValue({ data: { data: { status: "CONFIRMED" } } });
    renderModal({ user: { id: "u3", role: "USER" } });
    const joinBtn = await screen.findByRole("button", { name: /Rejoindre/i });
    fireEvent.click(joinBtn);
    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith("/api/events/ev1/tables/t1/join");
    });
  });

  it("calls api.delete when Supprimer is clicked", async () => {
    apiDeleteMock.mockResolvedValue({});
    renderModal({ user: { id: "u1", role: "USER" } });
    const deleteBtn = await screen.findByRole("button", { name: /Supprimer/i });
    fireEvent.click(deleteBtn);
    await waitFor(() => {
      expect(apiDeleteMock).toHaveBeenCalledWith("/api/events/ev1/tables/t1");
    });
  });

  it("shows a 'réservée' badge on a confirmed participant occupying a reserved seat", async () => {
    apiGetMock.mockReset().mockResolvedValue({
      data: {
        data: {
          ...baseTable,
          reservedSeats: 1,
          participants: [
            {
              userId: "u2",
              username: "Bob",
              status: "CONFIRMED",
              isOnReservedSeat: true,
              joinedAt: "2026-04-09T10:00:00.000Z",
            },
          ],
        },
      },
    });
    renderModal({ user: { id: "u1", role: "USER" } });
    await screen.findByText("Bob");
    expect(screen.getByText("réservée")).toBeInTheDocument();
  });

  it("shows both promote buttons when a free seat and a reserved seat are both available", async () => {
    apiGetMock.mockReset().mockResolvedValue({
      data: {
        data: {
          ...baseTable,
          reservedSeats: 1,
          participants: [
            {
              userId: "u3",
              username: "Chloe",
              status: "WAITLIST",
              isOnReservedSeat: false,
              joinedAt: "2026-04-09T10:00:00.000Z",
            },
          ],
        },
      },
    });
    renderModal({ user: { id: "u1", role: "USER" } });
    expect(
      await screen.findByRole("button", { name: /Affecter \(place réservée\)/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ajouter \(place libre\)/i })).toBeInTheDocument();
  });

  it("promotes to a free seat with seat=FREE when the free-seat button is clicked", async () => {
    apiGetMock.mockReset().mockResolvedValue({
      data: {
        data: {
          ...baseTable,
          reservedSeats: 1,
          participants: [
            {
              userId: "u3",
              username: "Chloe",
              status: "WAITLIST",
              isOnReservedSeat: false,
              joinedAt: "2026-04-09T10:00:00.000Z",
            },
          ],
        },
      },
    });
    renderModal({ user: { id: "u1", role: "USER" } });
    const freeBtn = await screen.findByRole("button", { name: /Ajouter \(place libre\)/i });
    fireEvent.click(freeBtn);
    await waitFor(() => {
      expect(apiPatchMock).toHaveBeenCalledWith(
        "/api/events/ev1/tables/t1/participants/u3/status",
        {
          status: "CONFIRMED",
          seat: "FREE",
        }
      );
    });
  });

  it("promotes to a reserved seat with seat=RESERVED when the reserved-seat button is clicked", async () => {
    apiGetMock.mockReset().mockResolvedValue({
      data: {
        data: {
          ...baseTable,
          reservedSeats: 1,
          participants: [
            {
              userId: "u3",
              username: "Chloe",
              status: "WAITLIST",
              isOnReservedSeat: false,
              joinedAt: "2026-04-09T10:00:00.000Z",
            },
          ],
        },
      },
    });
    renderModal({ user: { id: "u1", role: "USER" } });
    const reservedBtn = await screen.findByRole("button", { name: /Affecter \(place réservée\)/i });
    fireEvent.click(reservedBtn);
    await waitFor(() => {
      expect(apiPatchMock).toHaveBeenCalledWith(
        "/api/events/ev1/tables/t1/participants/u3/status",
        {
          status: "CONFIRMED",
          seat: "RESERVED",
        }
      );
    });
  });

  it("shows a single 'Ajouter à la table' button when only a free seat is available", async () => {
    apiGetMock.mockReset().mockResolvedValue({
      data: {
        data: {
          ...baseTable,
          reservedSeats: 0,
          participants: [
            {
              userId: "u3",
              username: "Chloe",
              status: "WAITLIST",
              isOnReservedSeat: false,
              joinedAt: "2026-04-09T10:00:00.000Z",
            },
          ],
        },
      },
    });
    renderModal({ user: { id: "u1", role: "USER" } });
    expect(
      await screen.findByRole("button", { name: /^Ajouter à la table$/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Affecter \(place réservée\)/i })
    ).not.toBeInTheDocument();
  });

  it("shows a disabled 'Aucune place disponible' button when the table is entirely full", async () => {
    apiGetMock.mockReset().mockResolvedValue({
      data: {
        data: {
          ...baseTable,
          maxPlayers: 1,
          reservedSeats: 0,
          participants: [
            {
              userId: "u2",
              username: "Bob",
              status: "CONFIRMED",
              isOnReservedSeat: false,
              joinedAt: "2026-04-09T10:00:00.000Z",
            },
            {
              userId: "u3",
              username: "Chloe",
              status: "WAITLIST",
              isOnReservedSeat: false,
              joinedAt: "2026-04-09T10:00:00.000Z",
            },
          ],
        },
      },
    });
    renderModal({ user: { id: "u1", role: "USER" } });
    const disabledBtn = await screen.findByRole("button", { name: /Aucune place disponible/i });
    expect(disabledBtn).toBeDisabled();
  });

  it("shows 'Passer en place libre' for a confirmed participant on a reserved seat, and converts it", async () => {
    apiGetMock.mockReset().mockResolvedValue({
      data: {
        data: {
          ...baseTable,
          reservedSeats: 0,
          participants: [
            {
              userId: "u2",
              username: "Bob",
              status: "CONFIRMED",
              isOnReservedSeat: true,
              joinedAt: "2026-04-09T10:00:00.000Z",
            },
          ],
        },
      },
    });
    renderModal({ user: { id: "u1", role: "USER" } });
    const convertBtn = await screen.findByRole("button", { name: /Passer en place libre/i });
    fireEvent.click(convertBtn);
    await waitFor(() => {
      expect(apiPatchMock).toHaveBeenCalledWith(
        "/api/events/ev1/tables/t1/participants/u2/status",
        {
          status: "CONFIRMED",
          seat: "FREE",
        }
      );
    });
  });

  it("shows 'Passer en place réservée' for a confirmed participant on a free seat when reserved seats remain", async () => {
    apiGetMock.mockReset().mockResolvedValue({
      data: {
        data: {
          ...baseTable,
          reservedSeats: 1,
          participants: [
            {
              userId: "u2",
              username: "Bob",
              status: "CONFIRMED",
              isOnReservedSeat: false,
              joinedAt: "2026-04-09T10:00:00.000Z",
            },
          ],
        },
      },
    });
    renderModal({ user: { id: "u1", role: "USER" } });
    const convertBtn = await screen.findByRole("button", { name: /Passer en place réservée/i });
    fireEvent.click(convertBtn);
    await waitFor(() => {
      expect(apiPatchMock).toHaveBeenCalledWith(
        "/api/events/ev1/tables/t1/participants/u2/status",
        {
          status: "CONFIRMED",
          seat: "RESERVED",
        }
      );
    });
  });

  it("still offers the free-seat promotion when a reserved seat is occupied (regression : places libres sous-comptees)", async () => {
    apiGetMock.mockReset().mockResolvedValue({
      data: {
        data: {
          ...baseTable,
          maxPlayers: 2,
          reservedSeats: 1,
          participants: [
            {
              userId: "u2",
              username: "Bob",
              status: "CONFIRMED",
              isOnReservedSeat: true,
              joinedAt: "2026-04-09T10:00:00.000Z",
            },
            {
              userId: "u3",
              username: "Chloe",
              status: "WAITLIST",
              isOnReservedSeat: false,
              joinedAt: "2026-04-09T11:00:00.000Z",
            },
          ],
        },
      },
    });
    renderModal({ user: { id: "u1", role: "USER" } });
    // 1 place libre reste disponible (l'occupant de la place réservée ne compte pas dedans)
    expect(
      await screen.findByRole("button", { name: /^Ajouter à la table$/i })
    ).toBeInTheDocument();
    // La seule place réservée est occupee : pas de bouton Affecter
    expect(
      screen.queryByRole("button", { name: /Affecter \(place réservée\)/i })
    ).not.toBeInTheDocument();
  });

  it("does not offer demote/kick/convert actions on the GM's own participant row", async () => {
    apiGetMock.mockReset().mockResolvedValue({
      data: {
        data: {
          ...baseTable,
          type: "JDS",
          reservedSeats: 1,
          participants: [
            {
              userId: "u1",
              username: "Alice",
              status: "CONFIRMED",
              isOnReservedSeat: false,
              joinedAt: "2026-04-09T09:00:00.000Z",
            },
            {
              userId: "u2",
              username: "Bob",
              status: "CONFIRMED",
              isOnReservedSeat: false,
              joinedAt: "2026-04-09T10:00:00.000Z",
            },
          ],
        },
      },
    });
    renderModal({ user: { id: "u1", role: "USER" } });
    await screen.findByText("Bob");
    // Seule la ligne de Bob propose les actions, pas celle du MJ (Alice)
    expect(screen.getAllByRole("button", { name: /Mettre sur liste d'attente/i })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /^Retirer$/i })).toHaveLength(1);
    // Le MJ n'est jamais sur une place réservée : pas de conversion sur sa ligne
    expect(screen.getAllByRole("button", { name: /Passer en place réservée/i })).toHaveLength(1);
  });

  it("labels the join button as joining the waitlist when no free seat is left", async () => {
    apiGetMock.mockReset().mockResolvedValue({
      data: {
        data: {
          ...baseTable,
          maxPlayers: 1,
          reservedSeats: 0,
          participants: [
            {
              userId: "u2",
              username: "Bob",
              status: "CONFIRMED",
              isOnReservedSeat: false,
              joinedAt: "2026-04-09T10:00:00.000Z",
            },
          ],
        },
      },
    });
    renderModal({ user: { id: "u3", role: "USER" } });
    expect(
      await screen.findByRole("button", { name: /^Rejoindre la liste d'attente$/i })
    ).toBeInTheDocument();
  });

  it("hides 'Passer en place libre' when no free seat is open (prevents overbooking)", async () => {
    apiGetMock.mockReset().mockResolvedValue({
      data: {
        data: {
          ...baseTable,
          maxPlayers: 2,
          reservedSeats: 1,
          participants: [
            {
              userId: "u2",
              username: "Bob",
              status: "CONFIRMED",
              isOnReservedSeat: false,
              joinedAt: "2026-04-09T10:00:00.000Z",
            },
            {
              userId: "u3",
              username: "Chloe",
              status: "CONFIRMED",
              isOnReservedSeat: true,
              joinedAt: "2026-04-09T11:00:00.000Z",
            },
          ],
        },
      },
    });
    renderModal({ user: { id: "u1", role: "USER" } });
    await screen.findByText("Chloe");
    // Table 2/2 : liberer la place réservée de Chloe ferait deborder les places libres
    expect(
      screen.queryByRole("button", { name: /Passer en place libre/i })
    ).not.toBeInTheDocument();
  });

  it("keeps the 'Participants' heading when the table has no reserved seats", async () => {
    renderModal({ user: { id: "u1", role: "USER" } });
    expect(await screen.findByText("Participants (1/5)")).toBeInTheDocument();
  });

  it("renames the heading to 'Places de la table' as soon as the table has reserved seats", async () => {
    apiGetMock.mockReset().mockResolvedValue({
      data: { data: { ...baseTable, reservedSeats: 1 } },
    });
    renderModal({ user: { id: "u1", role: "USER" } });
    expect(await screen.findByText("Places de la table (1/5 attribuées)")).toBeInTheDocument();
    expect(screen.queryByText(/^Participants \(/)).not.toBeInTheDocument();
  });

  it("shows a vacant-reserved-seat notice when a reserved seat has no participant on it (the reported bug)", async () => {
    apiGetMock.mockReset().mockResolvedValue({
      data: {
        data: {
          ...baseTable,
          maxPlayers: 4,
          reservedSeats: 4,
          participants: [
            {
              userId: "u2",
              username: "Bob",
              status: "CONFIRMED",
              isOnReservedSeat: true,
              joinedAt: "2026-04-09T10:00:00.000Z",
            },
          ],
        },
      },
    });
    renderModal({ user: { id: "u1", role: "USER" } });
    await screen.findByText("Bob");
    expect(screen.getByText("3 places réservées — pas encore attribuées")).toBeInTheDocument();
    expect(
      screen.getByText("À attribuer depuis la liste d'attente ci-dessous.")
    ).toBeInTheDocument();
  });

  it("phrases the vacant-reserved-seat notice for a non-GM visitor without an admin action", async () => {
    apiGetMock.mockReset().mockResolvedValue({
      data: {
        data: {
          ...baseTable,
          maxPlayers: 4,
          reservedSeats: 4,
          participants: [
            {
              userId: "u2",
              username: "Bob",
              status: "CONFIRMED",
              isOnReservedSeat: true,
              joinedAt: "2026-04-09T10:00:00.000Z",
            },
          ],
        },
      },
    });
    renderModal({ user: { id: "u3", role: "USER" } });
    await screen.findByText("Bob");
    expect(screen.getByText("Le MJ les attribuera depuis la liste d'attente.")).toBeInTheDocument();
  });

  it("elides correctly ('l'attribuera', not 'la attribuera') when a single reserved seat is vacant", async () => {
    apiGetMock.mockReset().mockResolvedValue({
      data: {
        data: {
          ...baseTable,
          maxPlayers: 4,
          reservedSeats: 4,
          participants: [
            {
              userId: "u2",
              username: "Bob",
              status: "CONFIRMED",
              isOnReservedSeat: true,
              joinedAt: "2026-04-09T10:00:00.000Z",
            },
            {
              userId: "u4",
              username: "Chloe",
              status: "CONFIRMED",
              isOnReservedSeat: true,
              joinedAt: "2026-04-09T10:00:00.000Z",
            },
            {
              userId: "u5",
              username: "Dan",
              status: "CONFIRMED",
              isOnReservedSeat: true,
              joinedAt: "2026-04-09T10:00:00.000Z",
            },
          ],
        },
      },
    });
    renderModal({ user: { id: "u3", role: "USER" } });
    await screen.findByText("Bob");
    expect(screen.getByText("Le MJ l'attribuera depuis la liste d'attente.")).toBeInTheDocument();
  });

  it("shows the vacant-reserved-seat notice even when no one has joined yet, instead of the empty state", async () => {
    apiGetMock.mockReset().mockResolvedValue({
      data: {
        data: { ...baseTable, maxPlayers: 4, reservedSeats: 2, participants: [] },
      },
    });
    renderModal({ user: { id: "u1", role: "USER" } });
    expect(
      await screen.findByText("2 places réservées — pas encore attribuées")
    ).toBeInTheDocument();
    expect(screen.queryByText("Aucun participant pour l'instant")).not.toBeInTheDocument();
  });

  it("does not show any vacant-reserved-seat notice when every reserved seat is filled", async () => {
    apiGetMock.mockReset().mockResolvedValue({
      data: {
        data: {
          ...baseTable,
          reservedSeats: 1,
          participants: [
            {
              userId: "u2",
              username: "Bob",
              status: "CONFIRMED",
              isOnReservedSeat: true,
              joinedAt: "2026-04-09T10:00:00.000Z",
            },
          ],
        },
      },
    });
    renderModal({ user: { id: "u1", role: "USER" } });
    await screen.findByText("Bob");
    expect(screen.queryByText(/pas encore attribuée/)).not.toBeInTheDocument();
  });

  it("explains the reservation-only situation next to the join button when a reserved seat is vacant", async () => {
    apiGetMock.mockReset().mockResolvedValue({
      data: {
        data: {
          ...baseTable,
          maxPlayers: 4,
          reservedSeats: 4,
          participants: [
            {
              userId: "u2",
              username: "Bob",
              status: "CONFIRMED",
              isOnReservedSeat: true,
              joinedAt: "2026-04-09T10:00:00.000Z",
            },
          ],
        },
      },
    });
    renderModal({ user: { id: "u3", role: "USER" } });
    expect(
      await screen.findByRole("button", { name: /^Rejoindre la liste d'attente$/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/fonctionne sur réservation/)).toBeInTheDocument();
  });

  it("does not show the reservation-only explanation when the table is simply full (no reserved seat involved)", async () => {
    apiGetMock.mockReset().mockResolvedValue({
      data: {
        data: {
          ...baseTable,
          maxPlayers: 1,
          reservedSeats: 0,
          participants: [
            {
              userId: "u2",
              username: "Bob",
              status: "CONFIRMED",
              isOnReservedSeat: false,
              joinedAt: "2026-04-09T10:00:00.000Z",
            },
          ],
        },
      },
    });
    renderModal({ user: { id: "u3", role: "USER" } });
    await screen.findByRole("button", { name: /^Rejoindre la liste d'attente$/i });
    expect(screen.queryByText(/fonctionne sur réservation/)).not.toBeInTheDocument();
  });

  it("hides the convert-to-reserved action for a confirmed player on a free seat when reservedSeats=0", async () => {
    apiGetMock.mockReset().mockResolvedValue({
      data: {
        data: {
          ...baseTable,
          reservedSeats: 0,
          participants: [
            {
              userId: "u2",
              username: "Bob",
              status: "CONFIRMED",
              isOnReservedSeat: false,
              joinedAt: "2026-04-09T10:00:00.000Z",
            },
          ],
        },
      },
    });
    renderModal({ user: { id: "u1", role: "USER" } });
    await screen.findByText("Bob");
    expect(
      screen.queryByRole("button", { name: /Passer en place réservée/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Passer en place libre/i })
    ).not.toBeInTheDocument();
  });
});
