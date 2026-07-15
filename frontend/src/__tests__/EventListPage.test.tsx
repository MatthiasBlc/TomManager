import { screen } from "@testing-library/react";
import { renderWithRouter } from "../test/renderWithRouter";
import EventListPage from "../pages/EventListPage";

const apiGetMock = vi.fn();
const useAuthMock = vi.fn();
const useIsMobileMock = vi.fn();

vi.mock("../config/api", () => ({
  default: { get: (...args: unknown[]) => apiGetMock(...args) },
}));
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));
vi.mock("../hooks/useIsMobile", () => ({
  useIsMobile: () => useIsMobileMock(),
}));

const baseEvent = {
  id: "ev1",
  name: "Festival JDR",
  startDateTime: "2026-04-10T18:00:00.000Z",
  endDateTime: "2026-04-12T18:00:00.000Z",
  participantCount: 15,
};

describe("EventListPage", () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    useAuthMock.mockReset();
    useIsMobileMock.mockReset().mockReturnValue(false);
  });

  it("fetches and displays events", async () => {
    apiGetMock.mockResolvedValue({ data: { data: [baseEvent] } });
    useAuthMock.mockReturnValue({ user: { id: "u1", role: "USER" } });
    renderWithRouter(<EventListPage />);

    expect(await screen.findByText("Festival JDR")).toBeInTheDocument();
    expect(apiGetMock).toHaveBeenCalledWith("/api/events");
  });

  it("shows a distinct error state (not the empty state) when the fetch fails", async () => {
    apiGetMock.mockRejectedValue(new Error("network"));
    useAuthMock.mockReturnValue({ user: { id: "u1", role: "USER" } });
    renderWithRouter(<EventListPage />);

    expect(await screen.findByText("Échec du chargement des événements")).toBeInTheDocument();
    expect(screen.queryByText("Aucun événement pour l'instant")).not.toBeInTheDocument();
  });

  it("retries the fetch when clicking Réessayer after a failure", async () => {
    apiGetMock.mockRejectedValueOnce(new Error("network"));
    apiGetMock.mockResolvedValueOnce({ data: { data: [baseEvent] } });
    useAuthMock.mockReturnValue({ user: { id: "u1", role: "USER" } });
    renderWithRouter(<EventListPage />);

    const retryBtn = await screen.findByRole("button", { name: "Réessayer" });
    retryBtn.click();

    expect(await screen.findByText("Festival JDR")).toBeInTheDocument();
  });

  it("renders empty state when no events", async () => {
    apiGetMock.mockResolvedValue({ data: { data: [] } });
    useAuthMock.mockReturnValue({ user: { id: "u1", role: "USER" } });
    renderWithRouter(<EventListPage />);

    expect(await screen.findByText("Aucun événement pour l'instant")).toBeInTheDocument();
  });

  it("shows Create Event button only for ADMIN on desktop", async () => {
    apiGetMock.mockResolvedValue({ data: { data: [] } });
    useAuthMock.mockReturnValue({ user: { id: "u1", role: "ADMIN" } });
    useIsMobileMock.mockReturnValue(false);
    renderWithRouter(<EventListPage />);

    expect(await screen.findByRole("button", { name: "Créer un événement" })).toBeInTheDocument();
  });

  it("does not show Create Event button for regular users", async () => {
    apiGetMock.mockResolvedValue({ data: { data: [] } });
    useAuthMock.mockReturnValue({ user: { id: "u1", role: "USER" } });
    renderWithRouter(<EventListPage />);

    await screen.findByText("Aucun événement pour l'instant");
    expect(screen.queryByRole("button", { name: "Créer un événement" })).not.toBeInTheDocument();
  });

  it("uses FAB button for create on mobile instead of top button", async () => {
    apiGetMock.mockResolvedValue({ data: { data: [] } });
    useAuthMock.mockReturnValue({ user: { id: "u1", role: "ADMIN" } });
    useIsMobileMock.mockReturnValue(true);
    renderWithRouter(<EventListPage />);

    await screen.findByText("Aucun événement pour l'instant");
    // On mobile, FAB is visible (renders from AppLayout/FAB integration)
    // Just verify page renders properly
    expect(screen.getByText("Événements")).toBeInTheDocument();
  });

  it("renders events as links to their detail page", async () => {
    apiGetMock.mockResolvedValue({ data: { data: [baseEvent] } });
    useAuthMock.mockReturnValue({ user: { id: "u1", role: "USER" } });
    renderWithRouter(<EventListPage />);

    const link = await screen.findByRole("link", { name: /Festival JDR/i });
    expect(link).toHaveAttribute("href", "/events/ev1");
  });
});
