import { screen, waitFor } from "@testing-library/react";
import { renderWithRouter } from "../test/renderWithRouter";
import EventDetailPage from "../pages/EventDetailPage";

const apiGetMock = vi.fn();
const useAuthMock = vi.fn();
const navigateMock = vi.fn();
const toastError = vi.fn();

vi.mock("../config/api", () => ({
  default: { get: (...args: unknown[]) => apiGetMock(...args) },
}));
vi.mock("../contexts/ConfirmContext", () => ({
  useConfirm: () => vi.fn().mockResolvedValue(true),
}));
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));
vi.mock("react-hot-toast", () => ({
  default: { error: (...a: unknown[]) => toastError(...a) },
}));
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});
vi.mock("../components/events/EditEventModal", () => ({
  default: () => null,
}));
vi.mock("../components/events/ParticipantList", () => ({
  default: () => <div>ParticipantList</div>,
}));
vi.mock("../components/boardgames/BoardGameTab", () => ({
  default: () => <div>BoardGameTab</div>,
}));
vi.mock("../components/planning/PlanningTab", () => ({
  default: () => <div>PlanningTab</div>,
}));
vi.mock("../components/kitchen/KitchenTab", () => ({
  default: () => <div>KitchenTab</div>,
}));
vi.mock("../components/kitchen/KitchenBoard", () => ({
  default: () => <div>KitchenBoard</div>,
}));
vi.mock("../hooks/useIsMobile", () => ({
  useIsMobile: () => false,
}));

const baseEvent = {
  id: "ev1",
  name: "Festival JDR",
  startDateTime: "2026-04-10T18:00:00.000Z",
  endDateTime: "2026-04-12T18:00:00.000Z",
  createdBy: "u1",
  participants: [],
};

describe("EventDetailPage", () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    useAuthMock.mockReset();
    navigateMock.mockReset();
    toastError.mockReset();
  });

  it("component renders without crashing", () => {
    apiGetMock.mockResolvedValue({ data: { data: baseEvent } });
    useAuthMock.mockReturnValue({ user: { id: "u1", role: "USER" } });
    const { container } = renderWithRouter(<EventDetailPage />, {
      route: "/events/ev1",
    });
    expect(container).toBeInTheDocument();
  });

  it("shows a skeleton while loading, then the event content", async () => {
    apiGetMock.mockResolvedValue({ data: { data: baseEvent } });
    useAuthMock.mockReturnValue({ user: { id: "u1", role: "USER" } });
    const { container } = renderWithRouter(<EventDetailPage />, {
      route: "/events/ev1",
    });
    expect(container.querySelector(".skeleton")).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText("Festival JDR").length).toBeGreaterThan(0));
    expect(container.querySelector(".skeleton")).not.toBeInTheDocument();
  });

  it("handles undefined params gracefully", () => {
    // useParams returns undefined for eventId when not in a real route
    apiGetMock.mockResolvedValue({ data: { data: baseEvent } });
    useAuthMock.mockReturnValue({ user: { id: "u1", role: "USER" } });
    const { container } = renderWithRouter(<EventDetailPage />);
    // Component should render or show error gracefully
    expect(container.firstChild).toBeInTheDocument();
  });

  function mockApiGet(kitchenData: Record<string, unknown>) {
    apiGetMock.mockImplementation((url: string) => {
      if (url.endsWith("/kitchen")) return Promise.resolve({ data: { data: kitchenData } });
      if (url.endsWith("/kitchen/swaps")) return Promise.resolve({ data: { data: [] } });
      return Promise.resolve({ data: { data: baseEvent } });
    });
  }

  it("hides the Cuisine tab for a plain USER, never chef nor admin (point 10)", async () => {
    mockApiGet({ currentUserKitchenRole: "equipier", isChef: false, meals: [] });
    useAuthMock.mockReturnValue({ user: { id: "u1", role: "USER" } });
    renderWithRouter(<EventDetailPage />, { route: "/events/ev1" });
    await waitFor(() => expect(screen.getAllByText("Festival JDR").length).toBeGreaterThan(0));
    expect(screen.queryByRole("button", { name: "Cuisine" })).not.toBeInTheDocument();
  });

  it("shows the Cuisine tab for an ADMIN even without chef/manager status", async () => {
    mockApiGet({ currentUserKitchenRole: "none", isChef: false, meals: [] });
    useAuthMock.mockReturnValue({ user: { id: "admin1", role: "ADMIN" }, preferences: {} });
    renderWithRouter(<EventDetailPage />, { route: "/events/ev1" });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Cuisine" })).toBeInTheDocument()
    );
  });

  it("shows the Cuisine tab for a chef who is not an admin", async () => {
    mockApiGet({ currentUserKitchenRole: "chef", isChef: true, meals: [] });
    useAuthMock.mockReturnValue({ user: { id: "chef1", role: "USER" } });
    renderWithRouter(<EventDetailPage />, { route: "/events/ev1" });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Cuisine" })).toBeInTheDocument()
    );
  });
});
