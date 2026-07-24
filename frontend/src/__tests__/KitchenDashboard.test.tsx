import { render, screen } from "@testing-library/react";
import KitchenDashboard from "../components/kitchen/KitchenDashboard";

const baseProps = {
  chefsCount: 1,
  coursesCount: 1,
  unassignedCount: 1,
  equipierPlanningEnabled: true,
  meals: [
    {
      id: "meal1",
      name: "Couscous",
      service: "DINNER" as const,
      startDateTime: "2026-06-01T18:00:00.000Z",
      endDateTime: "2026-06-01T20:00:00.000Z",
      maxAssistants: 3,
      remainingSeats: 1,
      chef: { id: "chef1", username: "Alice" },
      assistants: [{ id: "u2", username: "Bob" }],
    },
  ],
  chefs: [{ id: "chef1", username: "Alice", source: "MANUAL" as const }],
  coursesMembers: [{ id: "courses1", username: "Charlie" }],
  unassigned: [{ id: "u3", username: "Dan" }],
};

describe("KitchenDashboard", () => {
  it("shows nominative chefs/courses/unassigned lists (point 5, Evolutions.md)", () => {
    render(<KitchenDashboard {...baseProps} />);
    // Alice apparait deux fois (roster Chefs + chef assigne sur la fiche repas)
    expect(screen.getAllByText("Alice").length).toBeGreaterThan(0);
    expect(screen.getByText("Charlie")).toBeInTheDocument();
    expect(screen.getByText("Dan")).toBeInTheDocument();
  });

  it("shows nominative assistants per meal, read-only (no action buttons)", () => {
    render(<KitchenDashboard {...baseProps} />);
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows a green 'Publié' badge when the equipier planning is enabled", () => {
    render(<KitchenDashboard {...baseProps} equipierPlanningEnabled={true} />);
    const badge = screen.getByText("Publié");
    expect(badge).toHaveClass("badge-success");
  });

  it("shows a warning 'Non publié' badge when the equipier planning is disabled", () => {
    render(<KitchenDashboard {...baseProps} equipierPlanningEnabled={false} />);
    const badge = screen.getByText("Non publié");
    expect(badge).toHaveClass("badge-warning");
  });

  it("renders roster blocks and meal cards in a responsive grid", () => {
    const { container } = render(<KitchenDashboard {...baseProps} />);
    const grids = container.querySelectorAll(".grid.md\\:grid-cols-2.lg\\:grid-cols-3");
    expect(grids.length).toBeGreaterThanOrEqual(2);
  });

  it("shows an empty state when there are no meals", () => {
    render(<KitchenDashboard {...baseProps} meals={[]} />);
    expect(screen.getByText("Aucun repas planifié pour l'instant")).toBeInTheDocument();
  });

  it("shows vege/carne badges read-only, with no warning when it matches eventParticipantsCount", () => {
    const meals = [{ ...baseProps.meals[0], vegeCount: 4, carneCount: 6 }];
    render(<KitchenDashboard {...baseProps} meals={meals} eventParticipantsCount={10} />);
    expect(screen.getByText("🌱 4")).toBeInTheDocument();
    expect(screen.getByText("🥩 6")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows a warning badge when vege+carne does not match eventParticipantsCount", () => {
    const meals = [{ ...baseProps.meals[0], vegeCount: 3, carneCount: 7 }];
    const { container } = render(
      <KitchenDashboard {...baseProps} meals={meals} eventParticipantsCount={6} />
    );
    expect(container.querySelector(".badge-warning")).not.toBeNull();
  });
});
