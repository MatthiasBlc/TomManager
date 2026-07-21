import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import KitchenBoard from "../components/kitchen/KitchenBoard";

const apiGetMock = vi.fn();
const apiPostMock = vi.fn();
const apiDeleteMock = vi.fn();
const useAuthMock = vi.fn();
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
vi.mock("../hooks/useEventSocket", () => ({
  useEventSocket: () => {},
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

beforeEach(() => {
  apiGetMock.mockReset();
  apiPostMock.mockReset();
  apiDeleteMock.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
});

describe("KitchenBoard", () => {
  it("renders nothing for a plain equipier when the board is not enabled", async () => {
    mockAuth({ id: "u3", role: "USER" });
    apiGetMock.mockResolvedValue({
      data: { data: { currentUserKitchenRole: "equipier", equipierPlanningEnabled: false, meals: [] } },
    });
    const { container } = render(<KitchenBoard eventId="ev1" />);
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled());
    await waitFor(() => expect(container.querySelector(".skeleton")).not.toBeInTheDocument());
    expect(container.firstChild).toBeNull();
  });

  it("shows the board for an equipier when equipierPlanningEnabled is true", async () => {
    mockAuth({ id: "u3", role: "USER" });
    apiGetMock.mockResolvedValue({
      data: {
        data: { currentUserKitchenRole: "equipier", equipierPlanningEnabled: true, meals: [MEAL] },
      },
    });
    render(<KitchenBoard eventId="ev1" />);
    await waitFor(() => expect(screen.getByText("Couscous")).toBeInTheDocument());
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
    expect(screen.getByText(/1\/2 places/)).toBeInTheDocument();
  });

  it("always shows the board for a chef, regardless of the toggle", async () => {
    mockAuth({ id: "chef1", role: "USER" });
    apiGetMock.mockResolvedValue({
      data: { data: { currentUserKitchenRole: "chef", equipierPlanningEnabled: false, meals: [MEAL] } },
    });
    render(<KitchenBoard eventId="ev1" />);
    await waitFor(() => expect(screen.getByText("Couscous")).toBeInTheDocument());
  });

  it("shows a 'sans chef' badge for an orphan meal", async () => {
    mockAuth({ id: "u3", role: "USER" });
    apiGetMock.mockResolvedValue({
      data: {
        data: {
          currentUserKitchenRole: "equipier",
          equipierPlanningEnabled: true,
          meals: [ORPHAN_MEAL],
        },
      },
    });
    render(<KitchenBoard eventId="ev1" />);
    await waitFor(() => expect(screen.getByText("Raclette")).toBeInTheDocument());
    expect(screen.getByText("sans chef")).toBeInTheDocument();
  });

  it("joins a meal and shows a success toast", async () => {
    mockAuth({ id: "u3", role: "USER" });
    apiGetMock.mockResolvedValue({
      data: {
        data: { currentUserKitchenRole: "equipier", equipierPlanningEnabled: true, meals: [MEAL] },
      },
    });
    apiPostMock.mockResolvedValue({ data: { data: {} } });
    render(<KitchenBoard eventId="ev1" />);
    await waitFor(() => expect(screen.getByText("Couscous")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "S'inscrire" }));
    await waitFor(() =>
      expect(apiPostMock).toHaveBeenCalledWith("/api/events/ev1/kitchen/meals/meal1/assistants")
    );
    expect(toastSuccess).toHaveBeenCalled();
  });

  it("shows 'Se désinscrire' for the meal the user is registered on, and 'Se déplacer ici' for others", async () => {
    mockAuth({ id: "u2", role: "USER" });
    apiGetMock.mockResolvedValue({
      data: {
        data: {
          currentUserKitchenRole: "equipier",
          equipierPlanningEnabled: true,
          meals: [MEAL, { ...ORPHAN_MEAL, remainingSeats: 2, assistants: [] }],
        },
      },
    });
    render(<KitchenBoard eventId="ev1" />);
    await waitFor(() => expect(screen.getByText("Couscous")).toBeInTheDocument());

    expect(screen.getByRole("button", { name: "Se désinscrire" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Se déplacer ici" })).toBeInTheDocument();
  });

  it("disables joining a full meal", async () => {
    mockAuth({ id: "u3", role: "USER" });
    apiGetMock.mockResolvedValue({
      data: {
        data: {
          currentUserKitchenRole: "equipier",
          equipierPlanningEnabled: true,
          meals: [{ ...MEAL, remainingSeats: 0 }],
        },
      },
    });
    render(<KitchenBoard eventId="ev1" />);
    await waitFor(() => expect(screen.getByText("Couscous")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Complet" })).toBeDisabled();
  });

  it("leaves a meal and shows a success toast", async () => {
    mockAuth({ id: "u2", role: "USER" });
    apiGetMock.mockResolvedValue({
      data: {
        data: { currentUserKitchenRole: "equipier", equipierPlanningEnabled: true, meals: [MEAL] },
      },
    });
    apiDeleteMock.mockResolvedValue({});
    render(<KitchenBoard eventId="ev1" />);
    await waitFor(() => expect(screen.getByText("Couscous")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Se désinscrire" }));
    await waitFor(() =>
      expect(apiDeleteMock).toHaveBeenCalledWith("/api/events/ev1/kitchen/meals/meal1/assistants/me")
    );
    expect(toastSuccess).toHaveBeenCalled();
  });
});
