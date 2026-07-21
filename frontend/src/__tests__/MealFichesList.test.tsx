import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import MealFichesList from "../components/kitchen/MealFichesList";

const apiDeleteMock = vi.fn();
const apiPatchMock = vi.fn();
const confirmDialogMock = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("../config/api", () => ({
  default: {
    delete: (...args: unknown[]) => apiDeleteMock(...args),
    patch: (...args: unknown[]) => apiPatchMock(...args),
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

const MEAL_WITH_ASSISTANTS = {
  id: "meal1",
  name: "Couscous",
  service: "DINNER" as const,
  startDateTime: "2026-06-01T18:00:00.000Z",
  endDateTime: "2026-06-01T20:00:00.000Z",
  maxAssistants: 3,
  remainingSeats: 1,
  chef: { id: "chef1", username: "Alice" },
  assistants: [
    { id: "u2", username: "Bob" },
    { id: "u3", username: "Charlie" },
  ],
  ingredients: [],
  utensils: [],
};

beforeEach(() => {
  apiDeleteMock.mockReset();
  apiPatchMock.mockReset();
  confirmDialogMock.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
});

describe("MealFichesList", () => {
  it("warns about the number of registered assistants before deleting", async () => {
    confirmDialogMock.mockResolvedValue(true);
    apiDeleteMock.mockResolvedValue({});
    render(
      <MealFichesList
        eventId="ev1"
        meals={[MEAL_WITH_ASSISTANTS]}
        currentUserId="chef1"
        isKitchenManager={false}
        onChanged={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));
    await waitFor(() => expect(confirmDialogMock).toHaveBeenCalled());
    expect(confirmDialogMock.mock.calls[0][0].message).toMatch(/2 équipier/);
    await waitFor(() =>
      expect(apiDeleteMock).toHaveBeenCalledWith("/api/events/ev1/kitchen/meals/meal1")
    );
  });

  it("does not show edit/delete actions to a user who is neither the owner nor a manager", () => {
    render(
      <MealFichesList
        eventId="ev1"
        meals={[MEAL_WITH_ASSISTANTS]}
        currentUserId="someone-else"
        isKitchenManager={false}
        onChanged={vi.fn()}
      />
    );
    expect(screen.queryByRole("button", { name: "Modifier" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Supprimer" })).not.toBeInTheDocument();
  });

  it("shows edit/delete actions to the owning chef", () => {
    render(
      <MealFichesList
        eventId="ev1"
        meals={[MEAL_WITH_ASSISTANTS]}
        currentUserId="chef1"
        isKitchenManager={false}
        onChanged={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: "Modifier" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Supprimer" })).toBeInTheDocument();
  });

  it("shows edit/delete actions and the capacity stepper to a kitchen manager who does not own the meal", () => {
    render(
      <MealFichesList
        eventId="ev1"
        meals={[MEAL_WITH_ASSISTANTS]}
        currentUserId="manager1"
        isKitchenManager={true}
        onChanged={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: "Modifier" })).toBeInTheDocument();
    expect(screen.getByLabelText("Augmenter")).toBeInTheDocument();
  });

  it("does not show the capacity stepper to a non-manager owning chef", () => {
    render(
      <MealFichesList
        eventId="ev1"
        meals={[MEAL_WITH_ASSISTANTS]}
        currentUserId="chef1"
        isKitchenManager={false}
        onChanged={vi.fn()}
      />
    );
    expect(screen.queryByLabelText("Augmenter")).not.toBeInTheDocument();
  });

  it("shows an empty state when there are no meals", () => {
    render(
      <MealFichesList eventId="ev1" meals={[]} isKitchenManager={false} onChanged={vi.fn()} />
    );
    expect(screen.getByText("Aucune fiche repas pour l'instant")).toBeInTheDocument();
  });
});
