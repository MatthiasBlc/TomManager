import { renderWithRouter } from "../test/renderWithRouter";
import EventDetailPage from "../pages/EventDetailPage";

const apiGetMock = vi.fn();
const useAuthMock = vi.fn();
const navigateMock = vi.fn();
const toastError = vi.fn();

vi.mock("../config/api", () => ({
  default: { get: (...args: unknown[]) => apiGetMock(...args) },
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
    const { container } = renderWithRouter(<EventDetailPage />, { route: "/events/ev1" });
    expect(container).toBeInTheDocument();
  });

  it("handles undefined params gracefully", () => {
    // useParams returns undefined for eventId when not in a real route
    apiGetMock.mockResolvedValue({ data: { data: baseEvent } });
    useAuthMock.mockReturnValue({ user: { id: "u1", role: "USER" } });
    const { container } = renderWithRouter(<EventDetailPage />);
    // Component should render or show error gracefully
    expect(container.firstChild).toBeInTheDocument();
  });
});
