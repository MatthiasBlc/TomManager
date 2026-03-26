import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import BottomTabBar from "../../components/layout/BottomTabBar";

// Mock useAuth
vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u1", username: "testuser", role: "USER", email: "test@test.com" },
    logout: vi.fn(),
  }),
}));

// Mock useSocket
vi.mock("../../hooks/useSocket", () => ({
  useSocket: () => null,
}));

function renderWithRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/events" element={<BottomTabBar />} />
        <Route path="/events/:eventId/*" element={<BottomTabBar />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("BottomTabBar", () => {
  it("should render Events tab", () => {
    renderWithRoute("/events");
    expect(screen.getByText("Events")).toBeInTheDocument();
  });

  it("should render username in profile tab", () => {
    renderWithRoute("/events");
    expect(screen.getByText("testuser")).toBeInTheDocument();
  });

  it("should show Planning and Games tabs when inside an event", () => {
    renderWithRoute("/events/evt-1/planning");
    expect(screen.getByText("Planning")).toBeInTheDocument();
    expect(screen.getByText("Games")).toBeInTheDocument();
  });

  it("should hide Planning and Games tabs when not inside an event", () => {
    renderWithRoute("/events");
    expect(screen.queryByText("Planning")).not.toBeInTheDocument();
    expect(screen.queryByText("Games")).not.toBeInTheDocument();
  });
});
