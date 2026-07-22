import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import MealSwapPanel from "../components/kitchen/MealSwapPanel";

const apiPostMock = vi.fn();
const confirmDialogMock = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("../config/api", () => ({
  default: {
    post: (...args: unknown[]) => apiPostMock(...args),
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

const CURRENT_USER = "chef1";

const OWN_MEAL = {
  id: "meal1",
  name: "Tartiflette",
  service: "DINNER" as const,
  startDateTime: "2026-06-01T18:00:00.000Z",
  chef: { id: CURRENT_USER, username: "Alice" },
};

const OTHER_CHEF_MEAL = {
  id: "meal2",
  name: "Raclette",
  service: "LUNCH" as const,
  startDateTime: "2026-06-02T10:30:00.000Z",
  chef: { id: "chef2", username: "Bob" },
};

const ORPHAN_MEAL = {
  id: "meal3",
  name: "",
  service: "DINNER" as const,
  startDateTime: "2026-06-02T18:00:00.000Z",
  chef: null,
};

beforeEach(() => {
  apiPostMock.mockReset();
  confirmDialogMock.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
});

describe("MealSwapPanel", () => {
  it("lists both other chefs' meals and free slots in the dropdown, tagging free ones", () => {
    render(
      <MealSwapPanel
        eventId="ev1"
        meals={[OWN_MEAL, OTHER_CHEF_MEAL, ORPHAN_MEAL]}
        currentUserId={CURRENT_USER}
        swaps={[]}
        onChanged={vi.fn()}
      />
    );
    expect(screen.getByText(/Raclette \(Bob\)/)).toBeInTheDocument();
    expect(screen.getByText(/\(libre\)/)).toBeInTheDocument();
  });

  it("shows the empty state when there is no candidate slot", () => {
    render(
      <MealSwapPanel
        eventId="ev1"
        meals={[OWN_MEAL]}
        currentUserId={CURRENT_USER}
        swaps={[]}
        onChanged={vi.fn()}
      />
    );
    expect(screen.getByText(/Aucun créneau disponible/)).toBeInTheDocument();
  });

  it("proposes a swap request when a claimed meal is selected (no confirmation)", async () => {
    apiPostMock.mockResolvedValue({});
    render(
      <MealSwapPanel
        eventId="ev1"
        meals={[OWN_MEAL, OTHER_CHEF_MEAL]}
        currentUserId={CURRENT_USER}
        swaps={[]}
        onChanged={vi.fn()}
      />
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "meal2" } });
    expect(screen.getByRole("button", { name: "Proposer un échange" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Proposer un échange" }));

    await waitFor(() =>
      expect(apiPostMock).toHaveBeenCalledWith("/api/events/ev1/kitchen/swaps", {
        targetMealId: "meal2",
      })
    );
    expect(confirmDialogMock).not.toHaveBeenCalled();
  });

  it("confirms then instantly moves to a free slot when an orphan meal is selected", async () => {
    confirmDialogMock.mockResolvedValue(true);
    apiPostMock.mockResolvedValue({});
    render(
      <MealSwapPanel
        eventId="ev1"
        meals={[OWN_MEAL, ORPHAN_MEAL]}
        currentUserId={CURRENT_USER}
        swaps={[]}
        onChanged={vi.fn()}
      />
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "meal3" } });
    expect(screen.getByRole("button", { name: "Prendre ce créneau" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Prendre ce créneau" }));

    await waitFor(() => expect(confirmDialogMock).toHaveBeenCalled());
    await waitFor(() =>
      expect(apiPostMock).toHaveBeenCalledWith("/api/events/ev1/kitchen/meals/meal3/move")
    );
  });

  it("does not call the move endpoint when the confirmation is declined", async () => {
    confirmDialogMock.mockResolvedValue(false);
    render(
      <MealSwapPanel
        eventId="ev1"
        meals={[OWN_MEAL, ORPHAN_MEAL]}
        currentUserId={CURRENT_USER}
        swaps={[]}
        onChanged={vi.fn()}
      />
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "meal3" } });
    fireEvent.click(screen.getByRole("button", { name: "Prendre ce créneau" }));

    await waitFor(() => expect(confirmDialogMock).toHaveBeenCalled());
    expect(apiPostMock).not.toHaveBeenCalled();
  });
});
