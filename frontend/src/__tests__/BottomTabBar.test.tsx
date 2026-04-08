import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import BottomTabBar from "../components/layout/BottomTabBar";

const useAuthMock = vi.fn();
const navigateMock = vi.fn();
const logoutMock = vi.fn();

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

function renderAt(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <BottomTabBar />
    </MemoryRouter>
  );
}

describe("BottomTabBar", () => {
  beforeEach(() => {
    logoutMock.mockReset().mockResolvedValue(undefined);
    navigateMock.mockReset();
    useAuthMock.mockReset();
  });

  it("renders nothing when no user is authenticated", () => {
    useAuthMock.mockReturnValue({ user: null, logout: logoutMock });
    const { container } = renderAt("/");
    expect(container.firstChild).toBeNull();
  });

  it("renders only Events tab and username when not on an event route", () => {
    useAuthMock.mockReturnValue({
      user: { id: "u1", username: "Alice" },
      logout: logoutMock,
    });
    renderAt("/");
    expect(screen.getByRole("link", { name: /Events/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Planning/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Games/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Alice/ })).toBeInTheDocument();
  });

  it("shows Planning and Games tabs when on an event route", () => {
    useAuthMock.mockReturnValue({
      user: { id: "u1", username: "Alice" },
      logout: logoutMock,
    });
    renderAt("/events/ev42/planning");
    expect(screen.getByRole("link", { name: /Events/ })).toBeInTheDocument();
    const planning = screen.getByRole("link", { name: /Planning/ });
    expect(planning).toHaveAttribute("href", "/events/ev42/planning");
    const games = screen.getByRole("link", { name: /Games/ });
    expect(games).toHaveAttribute("href", "/events/ev42");
  });

  it("logs out and navigates home when the username button is clicked", async () => {
    useAuthMock.mockReturnValue({
      user: { id: "u1", username: "Alice" },
      logout: logoutMock,
    });
    renderAt("/");
    fireEvent.click(screen.getByRole("button", { name: /Alice/ }));
    await waitFor(() => {
      expect(logoutMock).toHaveBeenCalled();
      expect(navigateMock).toHaveBeenCalledWith("/");
    });
  });
});
