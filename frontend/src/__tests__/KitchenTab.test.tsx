import { render, screen, waitFor } from "@testing-library/react";
import KitchenTab from "../components/kitchen/KitchenTab";

const apiGetMock = vi.fn();
const useAuthMock = vi.fn();

vi.mock("../config/api", () => ({
  default: { get: (...args: unknown[]) => apiGetMock(...args) },
}));
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));
vi.mock("../hooks/useEventSocket", () => ({
  useEventSocket: () => {},
}));
vi.mock("react-hot-toast", () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));
vi.mock("../contexts/ConfirmContext", () => ({
  useConfirm: () => vi.fn().mockResolvedValue(true),
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

function mockAuth(user: { id: string; role: string }, preferences?: Record<string, boolean>) {
  useAuthMock.mockReturnValue({ user, preferences });
}

beforeEach(() => {
  apiGetMock.mockReset();
});

describe("KitchenTab — visibility matrix", () => {
  it("hides all content from a plain equipier (never chef, never admin)", async () => {
    mockAuth({ id: "u1", role: "USER" });
    apiGetMock.mockResolvedValue({
      data: {
        data: { currentUserKitchenRole: "equipier", equipierPlanningEnabled: true, meals: [] },
      },
    });
    render(<KitchenTab eventId="ev1" />);
    await waitFor(() =>
      expect(screen.getByText(/réservée aux chefs et responsables/i)).toBeInTheDocument()
    );
    expect(screen.queryByText("Fiches repas")).not.toBeInTheDocument();
  });

  it("shows the 'create my meal' CTA for a chef without a meal yet, but no management panel", async () => {
    mockAuth({ id: "chef1", role: "USER" });
    apiGetMock.mockResolvedValue({
      data: {
        data: {
          currentUserKitchenRole: "chef",
          equipierPlanningEnabled: false,
          meals: [],
          chefRoleId: null,
        },
      },
    });
    render(<KitchenTab eventId="ev1" />);
    await waitFor(() => expect(screen.getByText("Fiches repas")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Créer mon repas" })).toBeInTheDocument();
    expect(screen.queryByText("Configuration")).not.toBeInTheDocument();
  });

  it("does not show the 'create my meal' CTA once the chef already has a meal", async () => {
    mockAuth({ id: "chef1", role: "USER" });
    apiGetMock.mockResolvedValue({
      data: {
        data: {
          currentUserKitchenRole: "chef",
          equipierPlanningEnabled: false,
          chefRoleId: null,
          meals: [
            {
              id: "meal1",
              name: "Tartiflette",
              service: "DINNER",
              startDateTime: "2026-06-01T18:00:00.000Z",
              endDateTime: "2026-06-01T20:00:00.000Z",
              maxAssistants: 2,
              remainingSeats: 2,
              chef: { id: "chef1", username: "Alice" },
              assistants: [],
              ingredients: [],
              utensils: [],
            },
          ],
        },
      },
    });
    render(<KitchenTab eventId="ev1" />);
    await waitFor(() => expect(screen.getByText("Tartiflette")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Créer mon repas" })).not.toBeInTheDocument();
  });

  it("shows the management panel for a kitchen manager", async () => {
    mockAuth({ id: "admin1", role: "ADMIN" }, { "admin.kitchen": true });
    apiGetMock.mockResolvedValue({
      data: {
        data: {
          currentUserKitchenRole: "manager",
          equipierPlanningEnabled: false,
          chefRoleId: null,
          allergiesNotes: null,
          chefs: [],
          coursesMembers: [],
          unassigned: [],
          meals: [],
        },
      },
    });
    render(<KitchenTab eventId="ev1" />);
    await waitFor(() => expect(screen.getByText("Configuration")).toBeInTheDocument());
    expect(screen.getByText("Fiches repas")).toBeInTheDocument();
  });

  it("shows the management panel in read context for a plain admin (not kitchen manager)", async () => {
    // Un admin sans admin.kitchen n'est pas "manager" cote backend (currentUserKitchenRole
    // reste equipier/none) mais garde acces via isAdmin cote front (lecture) — la gestion
    // reste visible car useAdminRights().isAdmin est vrai.
    mockAuth({ id: "admin2", role: "ADMIN" }, {});
    apiGetMock.mockResolvedValue({
      data: {
        data: {
          currentUserKitchenRole: "none",
          equipierPlanningEnabled: false,
          chefRoleId: null,
          allergiesNotes: null,
          chefs: [],
          coursesMembers: [],
          unassigned: [],
          meals: [],
        },
      },
    });
    render(<KitchenTab eventId="ev1" />);
    await waitFor(() => expect(screen.getByText("Configuration")).toBeInTheDocument());
  });
});
