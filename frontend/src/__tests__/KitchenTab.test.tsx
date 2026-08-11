import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import KitchenTab from "../components/kitchen/KitchenTab";
import type { KitchenViewData } from "../hooks/useKitchenData";

const useAuthMock = vi.fn();

vi.mock("../config/api", () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));
vi.mock("react-hot-toast", () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));
vi.mock("../contexts/ConfirmContext", () => ({
  useConfirm: () => vi.fn().mockResolvedValue(true),
}));
// KitchenNotesPanels (fiches allergies/aversions) tire useIsMobile ->
// window.matchMedia, absent en jsdom.
vi.mock("../hooks/useIsMobile", () => ({
  useIsMobile: () => false,
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

function renderTab(data: Partial<KitchenViewData> & { meals: unknown[] }) {
  return render(
    <KitchenTab
      eventId="ev1"
      data={data as unknown as KitchenViewData}
      swaps={[]}
      loading={false}
      onChanged={() => {}}
    />
  );
}

describe("KitchenTab — visibility matrix", () => {
  it("hides all content from a plain equipier (never chef, never admin)", () => {
    mockAuth({ id: "u1", role: "USER" });
    renderTab({
      currentUserKitchenRole: "equipier",
      isChef: false,
      equipierPlanningEnabled: true,
      meals: [],
    });
    expect(screen.getByText(/réservée aux chefs et responsables/i)).toBeInTheDocument();
    expect(screen.queryByText("Fiches repas")).not.toBeInTheDocument();
  });

  it("shows the claim-slot picker for a chef without a meal yet, but no management panel", () => {
    mockAuth({ id: "chef1", role: "USER" });
    renderTab({
      currentUserKitchenRole: "chef",
      isChef: true,
      equipierPlanningEnabled: false,
      meals: [],
      chefRoleId: null,
    });
    // Point 6 : "Mon repas" ne montre jamais la liste complete des fiches (Gestion only).
    expect(screen.queryByText("Fiches repas")).not.toBeInTheDocument();
    expect(screen.getByText("Choisir mon créneau")).toBeInTheDocument();
    expect(screen.queryByText("État du planning")).not.toBeInTheDocument();
  });

  it("shows allergies and dislikes as two distinct blocks at the top of 'Mon repas'", () => {
    mockAuth({ id: "chef1", role: "USER" });
    renderTab({
      currentUserKitchenRole: "chef",
      isChef: true,
      equipierPlanningEnabled: false,
      meals: [],
      chefRoleId: null,
      allergiesNotes: "Vrael : Noix",
      dislikesNotes: "Thory : Oignon",
    });
    expect(screen.getByText("Allergies")).toBeInTheDocument();
    expect(screen.getByText("Vrael : Noix")).toBeInTheDocument();
    expect(screen.getByText("N'aime vraiment pas")).toBeInTheDocument();
    expect(screen.getByText("Thory : Oignon")).toBeInTheDocument();
  });

  it("shows the swap panel (not the claim picker) once the chef already has a meal", () => {
    mockAuth({ id: "chef1", role: "USER" });
    renderTab({
      currentUserKitchenRole: "chef",
      isChef: true,
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
    });
    // La fiche s'affiche desormais en edition inline (input), pas en texte statique.
    expect(screen.getByDisplayValue("Tartiflette")).toBeInTheDocument();
    expect(screen.queryByText("Choisir mon créneau")).not.toBeInTheDocument();
    expect(screen.getByText("Échanger mon créneau")).toBeInTheDocument();
  });

  it("shows the management panel for a kitchen manager", () => {
    mockAuth({ id: "admin1", role: "ADMIN" }, { "admin.kitchen": true });
    renderTab({
      currentUserKitchenRole: "manager",
      isChef: false,
      equipierPlanningEnabled: false,
      chefRoleId: null,
      allergiesNotes: null,
      chefs: [],
      coursesMembers: [],
      unassigned: [],
      meals: [],
    });
    expect(screen.getByText("État du planning")).toBeInTheDocument();
    expect(screen.getByText("Fiches repas")).toBeInTheDocument();
  });

  it("shows a read-only dashboard (counts + meals, no management panel) for a plain admin", () => {
    mockAuth({ id: "admin2", role: "ADMIN" }, {});
    renderTab({
      currentUserKitchenRole: "none",
      isChef: false,
      equipierPlanningEnabled: false,
      chefRoleId: null,
      dashboard: {
        chefsCount: 2,
        coursesCount: 1,
        unassignedCount: 3,
        chefs: [],
        coursesMembers: [],
        unassigned: [],
      },
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
        },
      ],
    });
    expect(screen.getByText("Tartiflette")).toBeInTheDocument();
    expect(screen.queryByText("État du planning")).not.toBeInTheDocument();
    expect(screen.queryByText("Fiches repas")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("lands on 'Mon repas' by default for an admin-manager who is also a chef (point 5)", async () => {
    mockAuth({ id: "chefadmin1", role: "ADMIN" }, { "admin.kitchen": true });
    renderTab({
      currentUserKitchenRole: "manager",
      isChef: true,
      equipierPlanningEnabled: false,
      chefRoleId: null,
      allergiesNotes: null,
      chefs: [],
      coursesMembers: [],
      unassigned: [],
      meals: [],
    });

    // Point 5 : chef + responsable atterrit directement sur "Mon repas", pas "Gestion".
    await waitFor(() => expect(screen.getByText("Choisir mon créneau")).toBeInTheDocument());
    expect(screen.queryByText("État du planning")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Gestion" }));
    await waitFor(() => expect(screen.getByText("État du planning")).toBeInTheDocument());
    expect(screen.queryByText("Choisir mon créneau")).not.toBeInTheDocument();
  });

  it("gives an admin who is also chef both 'Vue d'ensemble' and 'Mon repas' (cumulative, not exclusive)", async () => {
    mockAuth({ id: "adminchef1", role: "ADMIN" }, {});
    renderTab({
      currentUserKitchenRole: "chef",
      isChef: true,
      equipierPlanningEnabled: false,
      chefRoleId: null,
      allergiesNotes: null,
      dashboard: {
        chefsCount: 1,
        coursesCount: 0,
        unassignedCount: 1,
        chefs: [],
        coursesMembers: [],
        unassigned: [],
      },
      meals: [],
    });

    // Point 5 etendu : admin+chef atterrit sur "Mon repas" en premier, pas la vue d'ensemble.
    await waitFor(() => expect(screen.getByText("Choisir mon créneau")).toBeInTheDocument());
    expect(screen.queryByText("Équipe cuisine")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Vue d'ensemble" }));
    await waitFor(() => expect(screen.getByText("Équipe cuisine")).toBeInTheDocument());
    expect(screen.queryByText("Choisir mon créneau")).not.toBeInTheDocument();
    // Pas la gestion complete (pas responsable) : pas d'"État du planning".
    expect(screen.queryByText("État du planning")).not.toBeInTheDocument();
  });
});
