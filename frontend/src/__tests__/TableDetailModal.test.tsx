import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import TableDetailModal from "../components/planning/TableDetailModal";

const apiGetMock = vi.fn();
const apiPostMock = vi.fn();
const apiDeleteMock = vi.fn();
const useAuthMock = vi.fn();
const useIsMobileMock = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("../config/api", () => ({
  default: {
    get: (...args: unknown[]) => apiGetMock(...args),
    post: (...args: unknown[]) => apiPostMock(...args),
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

function renderModal(extra: Partial<{ user: { id: string; role: string } | null }> = {}) {
  useAuthMock.mockReturnValue({
    user: extra.user ?? { id: "u2", role: "USER" },
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
    apiDeleteMock.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
    useIsMobileMock.mockReset().mockReturnValue(false);
    useAuthMock.mockReset();
    vi.spyOn(window, "confirm").mockReturnValue(true);
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

  it("shows Modifier and Supprimer buttons for an admin user", async () => {
    renderModal({ user: { id: "u3", role: "ADMIN" } });
    expect(await screen.findByRole("button", { name: /Modifier/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Supprimer/i })).toBeInTheDocument();
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
});
