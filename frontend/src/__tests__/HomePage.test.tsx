import { screen, waitFor } from "@testing-library/react";
import { renderWithRouter } from "../test/renderWithRouter";
import HomePage from "../pages/HomePage";

const useAuthMock = vi.fn();
const navigateMock = vi.fn();

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

describe("HomePage", () => {
  beforeEach(() => {
    useAuthMock.mockReset();
    navigateMock.mockReset();
  });

  it("renders the welcome message and get started button", () => {
    useAuthMock.mockReturnValue({ user: null, loading: false });
    renderWithRouter(<HomePage />);
    expect(screen.getByText("TomManager")).toBeInTheDocument();
    expect(screen.getByText(/Welcome to TomManager/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Get Started/i })).toBeInTheDocument();
  });

  it("navigates to /events when a user is authenticated", async () => {
    useAuthMock.mockReturnValue({ user: { id: "u1", username: "Alice" }, loading: false });
    renderWithRouter(<HomePage />);
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/events", { replace: true });
    });
  });

  it("does not navigate when still loading auth", () => {
    useAuthMock.mockReturnValue({ user: null, loading: true });
    renderWithRouter(<HomePage />);
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
