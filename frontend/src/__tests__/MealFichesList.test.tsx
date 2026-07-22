import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import MealFichesList from "../components/kitchen/MealFichesList";

const apiPatchMock = vi.fn();
const apiPostMock = vi.fn();
const apiDeleteMock = vi.fn();

vi.mock("../config/api", () => ({
  default: {
    patch: (...args: unknown[]) => apiPatchMock(...args),
    post: (...args: unknown[]) => apiPostMock(...args),
    delete: (...args: unknown[]) => apiDeleteMock(...args),
  },
}));
vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("../hooks/useIsMobile", () => ({
  useIsMobile: () => false,
}));

const CHEFS = [{ id: "chef1", username: "Alice", source: "MANUAL" as const }];
const UNASSIGNED = [{ id: "u3", username: "Chris" }];

const ASSIGNED_MEAL = {
  id: "meal1",
  name: "Couscous",
  service: "DINNER" as const,
  startDateTime: "2026-06-01T18:00:00.000Z",
  endDateTime: "2026-06-01T20:00:00.000Z",
  maxAssistants: 3,
  remainingSeats: 2,
  chef: { id: "chef1", username: "Alice" },
  assistants: [{ id: "u2", username: "Bob" }],
  ingredients: [{ name: "Semoule", quantity: 1, unit: "KG" }],
  utensils: [{ name: "Couscoussier" }],
};

const ORPHAN_MEAL = {
  id: "meal2",
  name: "",
  service: "LUNCH" as const,
  startDateTime: "2026-06-02T10:30:00.000Z",
  endDateTime: "2026-06-02T13:00:00.000Z",
  maxAssistants: 2,
  remainingSeats: 2,
  chef: null,
  assistants: [],
  ingredients: [],
  utensils: [],
};

beforeEach(() => {
  apiPatchMock.mockReset();
  apiPostMock.mockReset();
  apiDeleteMock.mockReset();
});

describe("MealFichesList", () => {
  it("shows an empty state when there are no meals", () => {
    render(
      <MealFichesList
        eventId="ev1"
        meals={[]}
        chefs={CHEFS}
        unassigned={UNASSIGNED}
        onChanged={vi.fn()}
      />
    );
    expect(screen.getByText("Aucune fiche repas pour l'instant")).toBeInTheDocument();
  });

  it("shows no day/start/end fields, only a non-editable slot label", () => {
    render(
      <MealFichesList
        eventId="ev1"
        meals={[ASSIGNED_MEAL]}
        chefs={CHEFS}
        unassigned={UNASSIGNED}
        onChanged={vi.fn()}
      />
    );
    expect(screen.queryByLabelText(/jour/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/début/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/fin/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /supprimer/i })).not.toBeInTheDocument();
  });

  it("offers a chef picker on an orphan meal and assigns via PATCH", async () => {
    apiPatchMock.mockResolvedValue({});
    render(
      <MealFichesList
        eventId="ev1"
        meals={[ORPHAN_MEAL]}
        chefs={CHEFS}
        unassigned={UNASSIGNED}
        onChanged={vi.fn()}
      />
    );
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "chef1" } });
    fireEvent.click(screen.getByRole("button", { name: "Assigner" }));

    await waitFor(() =>
      expect(apiPatchMock).toHaveBeenCalledWith("/api/events/ev1/kitchen/meals/meal2", {
        chefUserId: "chef1",
      })
    );
  });

  it("adds an available equipier to a meal with free seats", async () => {
    apiPostMock.mockResolvedValue({});
    render(
      <MealFichesList
        eventId="ev1"
        meals={[ASSIGNED_MEAL]}
        chefs={CHEFS}
        unassigned={UNASSIGNED}
        onChanged={vi.fn()}
      />
    );
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[selects.length - 1], { target: { value: "u3" } });
    fireEvent.click(screen.getByRole("button", { name: "Ajouter" }));

    await waitFor(() =>
      expect(apiPostMock).toHaveBeenCalledWith(
        "/api/events/ev1/kitchen/meals/meal1/assistants/u3"
      )
    );
  });

  it("removes an assigned equipier via DELETE", async () => {
    apiDeleteMock.mockResolvedValue({});
    render(
      <MealFichesList
        eventId="ev1"
        meals={[ASSIGNED_MEAL]}
        chefs={CHEFS}
        unassigned={UNASSIGNED}
        onChanged={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /retirer bob/i }));

    await waitFor(() =>
      expect(apiDeleteMock).toHaveBeenCalledWith(
        "/api/events/ev1/kitchen/meals/meal1/assistants/u2"
      )
    );
  });

  it("opens a read-only details modal on row click, then Modifier switches to edit and Valider PATCHes once and closes", async () => {
    apiPatchMock.mockResolvedValue({});
    const onChanged = vi.fn();
    render(
      <MealFichesList
        eventId="ev1"
        meals={[ASSIGNED_MEAL]}
        chefs={CHEFS}
        unassigned={UNASSIGNED}
        onChanged={onChanged}
      />
    );

    fireEvent.click(screen.getByText("Couscous"));
    expect(screen.getByRole("button", { name: "Modifier", hidden: true })).toBeInTheDocument();
    expect(screen.queryByLabelText("Nom du plat")).not.toBeInTheDocument();
    expect(screen.getAllByText("Alice").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Modifier", hidden: true }));
    const nameInput = screen.getByLabelText("Nom du plat");
    fireEvent.change(nameInput, { target: { value: "Couscous royal" } });

    fireEvent.click(screen.getByRole("button", { name: "Valider", hidden: true }));

    await waitFor(() =>
      expect(apiPatchMock).toHaveBeenCalledWith("/api/events/ev1/kitchen/meals/meal1", {
        name: "Couscous royal",
        ingredients: [{ name: "Semoule", quantity: 1, unit: "KG" }],
        utensils: [{ name: "Couscoussier" }],
      })
    );
    expect(apiPatchMock).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByLabelText("Nom du plat")).not.toBeInTheDocument());
  });
});
