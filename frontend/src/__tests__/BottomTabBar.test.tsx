import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import BottomTabBar from "../components/layout/BottomTabBar";

const useAuthMock = vi.fn();

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));

function renderAt(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <BottomTabBar />
    </MemoryRouter>
  );
}

describe("BottomTabBar", () => {
  beforeEach(() => {
    useAuthMock.mockReset();
  });

  it("renders nothing when no user is authenticated", () => {
    useAuthMock.mockReturnValue({ user: null });
    const { container } = renderAt("/");
    expect(container.firstChild).toBeNull();
  });

  it("renders only Events tab and profile tab when not on an event route", () => {
    useAuthMock.mockReturnValue({
      user: { id: "u1", username: "Alice" },
    });
    renderAt("/");
    expect(screen.getByRole("link", { name: /Événements/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Planning/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Jeux de société/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Profil/ })).toBeInTheDocument();
  });

  it("shows Planning and Games tabs when on an event route", () => {
    useAuthMock.mockReturnValue({
      user: { id: "u1", username: "Alice" },
    });
    renderAt("/events/ev42/planning");
    expect(screen.getByRole("link", { name: /Événements/ })).toBeInTheDocument();
    const planning = screen.getByRole("link", { name: /Planning/ });
    expect(planning).toHaveAttribute("href", "/events/ev42/planning");
    const games = screen.getByRole("link", { name: /Jeux de société/ });
    expect(games).toHaveAttribute("href", "/events/ev42");
  });

  it("links the profile tab to /profile and marks it active on that route", () => {
    useAuthMock.mockReturnValue({
      user: { id: "u1", username: "Alice" },
    });
    renderAt("/profile");
    const profile = screen.getByRole("link", { name: /Profil/ });
    expect(profile).toHaveAttribute("href", "/profile");
    expect(profile.className).toContain("text-primary");
  });
});
