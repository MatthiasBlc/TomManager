import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AssistantSwapPanel from "../components/kitchen/AssistantSwapPanel";

const apiPostMock = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("../config/api", () => ({
  default: {
    post: (...args: unknown[]) => apiPostMock(...args),
  },
}));
vi.mock("react-hot-toast", () => ({
  default: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}));

const CURRENT_USER = "eq1";

const OWN_MEAL = {
  id: "meal1",
  name: "Tartiflette",
  service: "DINNER" as const,
  startDateTime: "2026-06-01T18:00:00.000Z",
  remainingSeats: 0,
};

const FULL_OTHER_MEAL = {
  id: "meal2",
  name: "Raclette",
  service: "LUNCH" as const,
  startDateTime: "2026-06-02T10:30:00.000Z",
  remainingSeats: 0,
};

const FREE_OTHER_MEAL = {
  id: "meal3",
  name: "Fondue",
  service: "DINNER" as const,
  startDateTime: "2026-06-02T18:00:00.000Z",
  remainingSeats: 2,
};

beforeEach(() => {
  apiPostMock.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
});

describe("AssistantSwapPanel", () => {
  it("renders nothing when the user has no current meal", () => {
    const { container } = render(
      <AssistantSwapPanel
        eventId="ev1"
        meals={[FULL_OTHER_MEAL]}
        currentUserId={CURRENT_USER}
        currentMealId={null}
        swaps={[]}
        onChanged={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("only lists full slots (not free ones) as swap candidates", () => {
    render(
      <AssistantSwapPanel
        eventId="ev1"
        meals={[OWN_MEAL, FULL_OTHER_MEAL, FREE_OTHER_MEAL]}
        currentUserId={CURRENT_USER}
        currentMealId="meal1"
        swaps={[]}
        onChanged={vi.fn()}
      />
    );
    expect(screen.getByText(/Raclette/)).toBeInTheDocument();
    expect(screen.queryByText(/Fondue/)).not.toBeInTheDocument();
  });

  it("shows the empty state when no other slot is full", () => {
    render(
      <AssistantSwapPanel
        eventId="ev1"
        meals={[OWN_MEAL, FREE_OTHER_MEAL]}
        currentUserId={CURRENT_USER}
        currentMealId="meal1"
        swaps={[]}
        onChanged={vi.fn()}
      />
    );
    expect(screen.getByText(/Aucun créneau complet/)).toBeInTheDocument();
  });

  it("proposes an assistant swap request", async () => {
    apiPostMock.mockResolvedValue({});
    render(
      <AssistantSwapPanel
        eventId="ev1"
        meals={[OWN_MEAL, FULL_OTHER_MEAL]}
        currentUserId={CURRENT_USER}
        currentMealId="meal1"
        swaps={[]}
        onChanged={vi.fn()}
      />
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "meal2" } });
    fireEvent.click(screen.getByRole("button", { name: "Proposer un échange" }));

    await waitFor(() =>
      expect(apiPostMock).toHaveBeenCalledWith("/api/events/ev1/kitchen/assistant-swaps", {
        targetMealId: "meal2",
      })
    );
  });

  it("shows my own pending request instead of the propose form", () => {
    render(
      <AssistantSwapPanel
        eventId="ev1"
        meals={[OWN_MEAL, FULL_OTHER_MEAL]}
        currentUserId={CURRENT_USER}
        currentMealId="meal1"
        swaps={[
          {
            id: "req1",
            status: "PENDING",
            requester: { id: CURRENT_USER, username: "Me" },
            requesterMeal: OWN_MEAL,
            targetMeal: FULL_OTHER_MEAL,
          },
        ]}
        onChanged={vi.fn()}
      />
    );
    expect(screen.getByText(/En attente d'un équipier/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Proposer un échange" })).not.toBeInTheDocument();
  });

  it("cancels my own pending request", async () => {
    apiPostMock.mockResolvedValue({});
    render(
      <AssistantSwapPanel
        eventId="ev1"
        meals={[OWN_MEAL, FULL_OTHER_MEAL]}
        currentUserId={CURRENT_USER}
        currentMealId="meal1"
        swaps={[
          {
            id: "req1",
            status: "PENDING",
            requester: { id: CURRENT_USER, username: "Me" },
            requesterMeal: OWN_MEAL,
            targetMeal: FULL_OTHER_MEAL,
          },
        ]}
        onChanged={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    await waitFor(() =>
      expect(apiPostMock).toHaveBeenCalledWith(
        "/api/events/ev1/kitchen/assistant-swaps/req1/cancel"
      )
    );
  });

  it("shows a received request targeting my current meal, and accepts it", async () => {
    apiPostMock.mockResolvedValue({});
    render(
      <AssistantSwapPanel
        eventId="ev1"
        meals={[OWN_MEAL, FULL_OTHER_MEAL]}
        currentUserId={CURRENT_USER}
        currentMealId="meal1"
        swaps={[
          {
            id: "req2",
            status: "PENDING",
            requester: { id: "eq2", username: "Bob" },
            requesterMeal: FULL_OTHER_MEAL,
            targetMeal: OWN_MEAL,
          },
        ]}
        onChanged={vi.fn()}
      />
    );
    expect(screen.getByText(/Bob/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Accepter" }));
    await waitFor(() =>
      expect(apiPostMock).toHaveBeenCalledWith(
        "/api/events/ev1/kitchen/assistant-swaps/req2/accept"
      )
    );
  });
});
