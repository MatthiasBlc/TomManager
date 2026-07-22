import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import KitchenBoard from "../components/kitchen/KitchenBoard";
import type { KitchenViewData } from "../hooks/useKitchenData";

const apiPostMock = vi.fn();
const apiDeleteMock = vi.fn();
const useAuthMock = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("../config/api", () => ({
  default: {
    post: (...args: unknown[]) => apiPostMock(...args),
    delete: (...args: unknown[]) => apiDeleteMock(...args),
  },
}));
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));
vi.mock("react-hot-toast", () => ({
  default: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}));

function mockAuth(user: { id: string; role: string }, preferences?: Record<string, boolean>) {
  useAuthMock.mockReturnValue({ user, preferences });
}

const MEAL = {
  id: "meal1",
  name: "Couscous",
  service: "DINNER" as const,
  startDateTime: "2026-06-01T18:00:00.000Z",
  endDateTime: "2026-06-01T20:00:00.000Z",
  maxAssistants: 2,
  remainingSeats: 1,
  chef: { id: "chef1", username: "Alice" },
  assistants: [{ id: "u2", username: "Bob" }],
};

const ORPHAN_MEAL = {
  ...MEAL,
  id: "meal2",
  name: "Raclette",
  chef: null,
};

function renderBoard(
  data: Partial<KitchenViewData> & { meals: unknown[] },
  assistantSwaps: unknown[] = []
) {
  return render(
    <KitchenBoard
      eventId="ev1"
      data={data as unknown as KitchenViewData}
      assistantSwaps={assistantSwaps as never[]}
      loading={false}
      onChanged={() => {}}
    />
  );
}

// La matrice rend desktop + mobile en parallele (visibilite geree en CSS, pas en
// conditionnel React) : chaque contenu apparait donc 2 fois dans le DOM de test.
// On cible systematiquement la 1re occurrence (comportement identique des deux).
const firstOf = <T,>(els: T[]) => els[0];

beforeEach(() => {
  apiPostMock.mockReset();
  apiDeleteMock.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
});

describe("KitchenBoard", () => {
  it("renders nothing for a plain equipier when the board is not enabled", () => {
    mockAuth({ id: "u3", role: "USER" });
    const { container } = renderBoard({
      currentUserKitchenRole: "equipier",
      equipierPlanningEnabled: false,
      meals: [],
    });
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing for a plain admin (no admin.kitchen) when the toggle is off", () => {
    // Un admin sans admin.kitchen doit avoir la meme experience qu'un participant
    // lambda sur ce board (onglet Infos) : role backend "equipier"/"none", jamais un
    // bypass sur le simple fait d'etre ADMIN.
    mockAuth({ id: "admin1", role: "ADMIN" }, {});
    const { container } = renderBoard({
      currentUserKitchenRole: "none",
      equipierPlanningEnabled: false,
      meals: [],
    });
    expect(container.firstChild).toBeNull();
  });

  it("shows the board for an equipier when equipierPlanningEnabled is true", () => {
    mockAuth({ id: "u3", role: "USER" });
    renderBoard({
      currentUserKitchenRole: "equipier",
      equipierPlanningEnabled: true,
      meals: [MEAL],
    });
    expect(screen.getAllByText("Couscous").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Alice/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1\/2/).length).toBeGreaterThan(0);
  });

  it("always shows the board for a chef, regardless of the toggle", () => {
    mockAuth({ id: "chef1", role: "USER" });
    renderBoard({ currentUserKitchenRole: "chef", equipierPlanningEnabled: false, meals: [MEAL] });
    expect(screen.getAllByText("Couscous").length).toBeGreaterThan(0);
  });

  it("shows a 'sans chef' label for an orphan meal", () => {
    mockAuth({ id: "u3", role: "USER" });
    renderBoard({
      currentUserKitchenRole: "equipier",
      equipierPlanningEnabled: true,
      meals: [ORPHAN_MEAL],
    });
    expect(screen.getAllByText("Raclette").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Sans chef").length).toBeGreaterThan(0);
  });

  it("joins a meal and shows a success toast", async () => {
    mockAuth({ id: "u3", role: "USER" });
    apiPostMock.mockResolvedValue({ data: { data: {} } });
    renderBoard({
      currentUserKitchenRole: "equipier",
      equipierPlanningEnabled: true,
      meals: [MEAL],
    });

    fireEvent.click(firstOf(screen.getAllByRole("button", { name: "S'inscrire" })));
    await waitFor(() =>
      expect(apiPostMock).toHaveBeenCalledWith("/api/events/ev1/kitchen/meals/meal1/assistants")
    );
    expect(toastSuccess).toHaveBeenCalled();
  });

  it("shows 'Se désinscrire' for the meal the user is registered on, and 'Se déplacer ici' for others", () => {
    mockAuth({ id: "u2", role: "USER" });
    renderBoard({
      currentUserKitchenRole: "equipier",
      equipierPlanningEnabled: true,
      meals: [
        MEAL,
        {
          ...ORPHAN_MEAL,
          service: "LUNCH",
          startDateTime: "2026-06-01T10:30:00.000Z",
          endDateTime: "2026-06-01T13:00:00.000Z",
          remainingSeats: 2,
          assistants: [],
        },
      ],
    });

    expect(screen.getAllByRole("button", { name: "Se désinscrire" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Se déplacer ici" }).length).toBeGreaterThan(0);
  });

  it("disables joining a full meal", () => {
    mockAuth({ id: "u3", role: "USER" });
    renderBoard({
      currentUserKitchenRole: "equipier",
      equipierPlanningEnabled: true,
      meals: [{ ...MEAL, remainingSeats: 0 }],
    });
    expect(firstOf(screen.getAllByRole("button", { name: "Complet" }))).toBeDisabled();
  });

  it("leaves a meal and shows a success toast", async () => {
    mockAuth({ id: "u2", role: "USER" });
    apiDeleteMock.mockResolvedValue({});
    renderBoard({
      currentUserKitchenRole: "equipier",
      equipierPlanningEnabled: true,
      meals: [MEAL],
    });

    fireEvent.click(firstOf(screen.getAllByRole("button", { name: "Se désinscrire" })));
    await waitFor(() =>
      expect(apiDeleteMock).toHaveBeenCalledWith(
        "/api/events/ev1/kitchen/meals/meal1/assistants/me"
      )
    );
    expect(toastSuccess).toHaveBeenCalled();
  });

  it("never shows the join/leave button to a chef, even on their own meal (point 4)", () => {
    mockAuth({ id: "chef1", role: "USER" });
    renderBoard({ currentUserKitchenRole: "chef", equipierPlanningEnabled: false, meals: [MEAL] });
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("never shows the join button to a courses-team member (point 4)", () => {
    mockAuth({ id: "u3", role: "USER" });
    renderBoard({
      currentUserKitchenRole: "equipier",
      isCoursesMember: true,
      equipierPlanningEnabled: true,
      meals: [MEAL],
    });
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows the 'choisis ton créneau' banner to an unassigned equipier only (point 11)", () => {
    mockAuth({ id: "u3", role: "USER" });
    renderBoard({
      currentUserKitchenRole: "equipier",
      equipierPlanningEnabled: true,
      meals: [MEAL],
    });
    expect(screen.getByText(/pas encore choisi ton créneau/i)).toBeInTheDocument();
  });

  it("hides the 'choisis ton créneau' banner once the equipier has a meal", () => {
    mockAuth({ id: "u2", role: "USER" });
    renderBoard({
      currentUserKitchenRole: "equipier",
      equipierPlanningEnabled: true,
      meals: [MEAL],
    });
    expect(screen.queryByText(/pas encore choisi ton créneau/i)).not.toBeInTheDocument();
  });

  it("renders the assistant swap panel for an equipier with a meal (point 4)", () => {
    mockAuth({ id: "u2", role: "USER" });
    renderBoard({
      currentUserKitchenRole: "equipier",
      equipierPlanningEnabled: true,
      meals: [MEAL],
    });
    expect(screen.getByText("Échanger ma place")).toBeInTheDocument();
  });

  it("does not render the assistant swap panel for a chef or courses member (point 4)", () => {
    mockAuth({ id: "chef1", role: "USER" });
    renderBoard({ currentUserKitchenRole: "chef", equipierPlanningEnabled: false, meals: [MEAL] });
    expect(screen.queryByText("Échanger ma place")).not.toBeInTheDocument();
  });

  it("does not render the assistant swap panel for an equipier without a meal yet", () => {
    mockAuth({ id: "u3", role: "USER" });
    renderBoard({
      currentUserKitchenRole: "equipier",
      equipierPlanningEnabled: true,
      meals: [MEAL],
    });
    expect(screen.queryByText("Échanger ma place")).not.toBeInTheDocument();
  });

  it("passes assistantSwaps down to the swap panel", () => {
    mockAuth({ id: "u2", role: "USER" });
    renderBoard(
      { currentUserKitchenRole: "equipier", equipierPlanningEnabled: true, meals: [MEAL] },
      [
        {
          id: "req1",
          status: "PENDING",
          requester: { id: "someoneElse", username: "Zoe" },
          requesterMeal: {
            id: "meal9",
            name: "Autre",
            service: "LUNCH",
            startDateTime: MEAL.startDateTime,
          },
          targetMeal: {
            id: "meal1",
            name: "Couscous",
            service: "DINNER",
            startDateTime: MEAL.startDateTime,
          },
        },
      ]
    );
    expect(screen.getByText(/Zoe/)).toBeInTheDocument();
  });

  it("groups meals in a day x service matrix", () => {
    mockAuth({ id: "u3", role: "USER" });
    const otherDayMeal = {
      ...MEAL,
      id: "meal3",
      name: "Raclette",
      service: "LUNCH" as const,
      startDateTime: "2026-06-02T10:30:00.000Z",
      endDateTime: "2026-06-02T13:00:00.000Z",
    };
    renderBoard({
      currentUserKitchenRole: "equipier",
      equipierPlanningEnabled: true,
      meals: [MEAL, otherDayMeal],
    });
    expect(screen.getAllByText("Midi").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Soir").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Couscous").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Raclette").length).toBeGreaterThan(0);
  });
});
