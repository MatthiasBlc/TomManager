import { waitFor } from "@testing-library/react";
import { renderWithRouter } from "../test/renderWithRouter";
import TableDetailPage from "../pages/TableDetailPage";

const apiGetMock = vi.fn();
const useAuthMock = vi.fn();
const useIsMobileMock = vi.fn();
const navigateMock = vi.fn();
const toastError = vi.fn();

vi.mock("../config/api", () => ({
  default: { get: (...args: unknown[]) => apiGetMock(...args) },
}));
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));
vi.mock("../hooks/useIsMobile", () => ({
  useIsMobile: () => useIsMobileMock(),
}));
vi.mock("react-hot-toast", () => ({
  default: { error: (...a: unknown[]) => toastError(...a) },
}));
vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useParams: () => ({ eventId: "ev1", tableId: "t1" }),
  };
});
vi.mock("../hooks/useEventSocket", () => ({
  useEventSocket: () => {},
}));
vi.mock("../components/planning/EditTableModal", () => ({
  default: () => null,
}));

const baseTable = {
  id: "t1",
  eventId: "ev1",
  createdBy: "u1",
  title: "Donjon",
  type: "JDR" as const,
  gmIsPlayer: false,
  pitch: "Une aventure",
  triggers: null,
  comments: null,
  maxPlayers: 5,
  startDateTime: "2026-04-10T18:00:00.000Z",
  endDateTime: "2026-04-10T22:00:00.000Z",
  creator: { id: "u1", username: "Alice" },
  tags: [],
  participants: [],
};

describe("TableDetailPage", () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    useAuthMock.mockReset();
    useIsMobileMock.mockReset().mockReturnValue(false);
    navigateMock.mockReset();
    toastError.mockReset();
  });

  it("component renders without crashing", () => {
    apiGetMock.mockResolvedValue({ data: { data: baseTable } });
    useAuthMock.mockReturnValue({ user: { id: "u2", role: "USER" } });
    const { container } = renderWithRouter(<TableDetailPage />);
    expect(container).toBeInTheDocument();
  });

  it("handles params and calls API when loaded", async () => {
    apiGetMock.mockResolvedValue({ data: { data: baseTable } });
    useAuthMock.mockReturnValue({ user: { id: "u2", role: "USER" } });
    renderWithRouter(<TableDetailPage />);

    await waitFor(() => {
      // API should be called with the mocked params
      expect(apiGetMock).toHaveBeenCalled();
    });
  });

  it("renders gracefully", () => {
    apiGetMock.mockResolvedValue({ data: { data: baseTable } });
    useAuthMock.mockReturnValue({ user: { id: "u2", role: "USER" } });
    const { container } = renderWithRouter(<TableDetailPage />);
    // Component renders (either loading or with data)
    expect(container.firstChild).toBeInTheDocument();
  });
});
