import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import PrivateRoute from "../components/common/PrivateRoute";

const useAuthMock = vi.fn();
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));

function renderWithRouter() {
  return render(
    <MemoryRouter initialEntries={["/protected"]}>
      <Routes>
        <Route path="/login" element={<div>Login page</div>} />
        <Route
          path="/protected"
          element={
            <PrivateRoute>
              <div>Secret content</div>
            </PrivateRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("PrivateRoute", () => {
  afterEach(() => {
    useAuthMock.mockReset();
  });

  it("shows a loading spinner while auth is resolving", () => {
    useAuthMock.mockReturnValue({ user: null, loading: true });
    const { container } = renderWithRouter();
    expect(container.querySelector(".loading-spinner")).toBeInTheDocument();
    expect(screen.queryByText("Secret content")).not.toBeInTheDocument();
  });

  it("redirects to /login when no user is authenticated", () => {
    useAuthMock.mockReturnValue({ user: null, loading: false });
    renderWithRouter();
    expect(screen.getByText("Login page")).toBeInTheDocument();
    expect(screen.queryByText("Secret content")).not.toBeInTheDocument();
  });

  it("renders the children when a user is authenticated", () => {
    useAuthMock.mockReturnValue({
      user: { id: "u1", username: "Alice" },
      loading: false,
    });
    renderWithRouter();
    expect(screen.getByText("Secret content")).toBeInTheDocument();
  });
});
