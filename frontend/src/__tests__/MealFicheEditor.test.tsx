import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import MealFicheEditor from "../components/kitchen/MealFicheEditor";
import type { MealFiche } from "../components/kitchen/MealFichesList";

const apiPatchMock = vi.fn();
const apiDeleteMock = vi.fn();
const confirmDialogMock = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("../config/api", () => ({
  default: {
    patch: (...args: unknown[]) => apiPatchMock(...args),
    delete: (...args: unknown[]) => apiDeleteMock(...args),
  },
}));
vi.mock("../contexts/ConfirmContext", () => ({
  useConfirm: () => confirmDialogMock,
}));
vi.mock("react-hot-toast", () => ({
  default: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}));

const MEAL: MealFiche = {
  id: "meal1",
  name: "Couscous",
  service: "DINNER",
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
  apiDeleteMock.mockReset();
  confirmDialogMock.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
  vi.useRealTimers();
});

// MealFicheEditor est reserve a "Mon repas" (le chef n'edite que nom/ingredients/
// ustensiles de sa propre fiche) depuis que la Gestion (Admin Chef) utilise
// MealFichesList (liste + modale details), teste separement.
describe("MealFicheEditor", () => {
  it("autosaves the name field after a debounce, with no save button anywhere", async () => {
    vi.useFakeTimers();
    apiPatchMock.mockResolvedValue({});
    render(<MealFicheEditor eventId="ev1" meal={MEAL} onChanged={vi.fn()} />);

    expect(screen.queryByRole("button", { name: /enregistrer/i })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Nom du repas"), {
      target: { value: "Couscous royal" },
    });
    expect(apiPatchMock).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    expect(apiPatchMock).toHaveBeenCalledWith("/api/events/ev1/kitchen/meals/meal1", {
      name: "Couscous royal",
    });
    vi.useRealTimers();
  });

  it("shows a read-only schedule/capacity summary, no editable service/capacity controls", () => {
    render(<MealFicheEditor eventId="ev1" meal={MEAL} onChanged={vi.fn()} />);
    expect(screen.queryByRole("radio", { name: "Soir" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Augmenter")).not.toBeInTheDocument();
    expect(screen.getByText(/Soir/)).toBeInTheDocument();
    expect(screen.getByText(/1\/3/)).toBeInTheDocument();
  });

  it("warns about the number of registered assistants before deleting", async () => {
    confirmDialogMock.mockResolvedValue(true);
    apiDeleteMock.mockResolvedValue({});
    const onChanged = vi.fn();
    render(<MealFicheEditor eventId="ev1" meal={MEAL} onChanged={onChanged} />);

    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));
    await waitFor(() => expect(confirmDialogMock).toHaveBeenCalled());
    expect(confirmDialogMock.mock.calls[0][0].message).toMatch(/1 équipier/);
    await waitFor(() =>
      expect(apiDeleteMock).toHaveBeenCalledWith("/api/events/ev1/kitchen/meals/meal1")
    );
    expect(onChanged).toHaveBeenCalled();
  });

  it("resets fields when switching to a different meal", () => {
    const { rerender } = render(
      <MealFicheEditor eventId="ev1" meal={MEAL} onChanged={vi.fn()} />
    );
    fireEvent.change(screen.getByLabelText("Nom du repas"), {
      target: { value: "Draft non sauvegarde" },
    });

    const otherMeal: MealFiche = { ...MEAL, id: "meal2", name: "Raclette" };
    rerender(<MealFicheEditor eventId="ev1" meal={otherMeal} onChanged={vi.fn()} />);

    expect(screen.getByDisplayValue("Raclette")).toBeInTheDocument();
  });
});
