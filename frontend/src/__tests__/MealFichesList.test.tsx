import { render, screen } from "@testing-library/react";
import MealFichesList from "../components/kitchen/MealFichesList";

const apiPatchMock = vi.fn();

vi.mock("../config/api", () => ({
  default: { patch: (...args: unknown[]) => apiPatchMock(...args) },
}));
vi.mock("../contexts/ConfirmContext", () => ({
  useConfirm: () => vi.fn().mockResolvedValue(true),
}));
vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const MEAL = {
  id: "meal1",
  name: "Couscous",
  service: "DINNER" as const,
  startDateTime: "2026-06-01T18:00:00.000Z",
  endDateTime: "2026-06-01T20:00:00.000Z",
  maxAssistants: 3,
  remainingSeats: 1,
  chef: { id: "chef1", username: "Alice" },
  assistants: [{ id: "u2", username: "Bob" }],
  ingredients: [],
  utensils: [],
};

beforeEach(() => {
  apiPatchMock.mockReset();
});

// MealFichesList (Gestion, manager only) est desormais un simple wrapper : chaque
// repas est rendu via MealFicheEditor (canEditSchedule=true), teste separement
// dans MealFicheEditor.test.tsx. Ce fichier verifie juste le wrapper (liste/vide).
describe("MealFichesList", () => {
  it("shows an empty state when there are no meals", () => {
    render(<MealFichesList eventId="ev1" meals={[]} onChanged={vi.fn()} />);
    expect(screen.getByText("Aucune fiche repas pour l'instant")).toBeInTheDocument();
  });

  it("renders an editable fiche (name field + schedule fields) for each meal", () => {
    render(<MealFichesList eventId="ev1" meals={[MEAL]} onChanged={vi.fn()} />);
    expect(screen.getByDisplayValue("Couscous")).toBeInTheDocument();
    // canEditSchedule=true en Gestion : le service est editable (radios), pas en lecture seule.
    expect(screen.getByRole("radio", { name: "Soir" })).toBeChecked();
  });
});
