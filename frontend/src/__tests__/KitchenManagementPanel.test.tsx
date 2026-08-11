import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import KitchenManagementPanel from "../components/kitchen/KitchenManagementPanel";

const apiPatchMock = vi.fn();
const apiPostMock = vi.fn();
const apiDeleteMock = vi.fn();
const confirmDialogMock = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("../config/api", () => ({
  default: {
    patch: (...args: unknown[]) => apiPatchMock(...args),
    post: (...args: unknown[]) => apiPostMock(...args),
    delete: (...args: unknown[]) => apiDeleteMock(...args),
  },
}));
vi.mock("../contexts/ConfirmContext", () => ({
  useConfirm: () => confirmDialogMock,
}));
vi.mock("react-hot-toast", () => ({
  default: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}));
// MealFichesList ouvre une modale de details qui tire ResponsiveModal ->
// useIsMobile -> window.matchMedia, absent en jsdom.
vi.mock("../hooks/useIsMobile", () => ({
  useIsMobile: () => false,
}));

const baseProps = {
  eventId: "ev1",
  chefRoleId: null,
  allergiesNotes: null,
  dislikesNotes: null,
  equipierPlanningEnabled: false,
  chefs: [{ id: "chef1", username: "Alice", source: "MANUAL" as const }],
  coursesMembers: [{ id: "courses1", username: "Bob" }],
  unassigned: [{ id: "u3", username: "Charlie" }],
  meals: [],
  onChanged: vi.fn(),
};

beforeEach(() => {
  apiPatchMock.mockReset();
  apiPostMock.mockReset();
  apiDeleteMock.mockReset();
  confirmDialogMock.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
});

describe("KitchenManagementPanel", () => {
  it("warns before generating the planning", async () => {
    confirmDialogMock.mockResolvedValue(true);
    apiPostMock.mockResolvedValue({ data: { data: { pool: 3, overCapacity: [] } } });
    render(<KitchenManagementPanel {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Générer le planning" }));

    await waitFor(() => expect(confirmDialogMock).toHaveBeenCalled());
    expect(confirmDialogMock.mock.calls[0][0].title).toMatch(/générer le planning/i);
    await waitFor(() =>
      expect(apiPostMock).toHaveBeenCalledWith("/api/events/ev1/kitchen/generate")
    );
  });

  it("does not generate when declined", async () => {
    confirmDialogMock.mockResolvedValue(false);
    render(<KitchenManagementPanel {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Générer le planning" }));

    await waitFor(() => expect(confirmDialogMock).toHaveBeenCalled());
    expect(apiPostMock).not.toHaveBeenCalled();
  });

  it("hides manual chef management buttons in role mode (courses team keeps its own)", () => {
    render(<KitchenManagementPanel {...baseProps} chefRoleId="123456789012345678" />);
    expect(screen.getByText("rôle Discord")).toBeInTheDocument();
    // Seuls les boutons de l'equipe courses restent (le chef roster est en lecture seule)
    expect(screen.getAllByRole("button", { name: "Ajouter" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Retirer" })).toHaveLength(1);
  });

  it("warns before removing a chef", async () => {
    confirmDialogMock.mockResolvedValue(true);
    apiDeleteMock.mockResolvedValue({});
    render(<KitchenManagementPanel {...baseProps} />);

    // Le bouton "Retirer" du roster chef (Alice) est le premier de la page
    fireEvent.click(screen.getAllByRole("button", { name: "Retirer" })[0]);
    await waitFor(() => expect(confirmDialogMock).toHaveBeenCalled());
    await waitFor(() =>
      expect(apiDeleteMock).toHaveBeenCalledWith("/api/events/ev1/kitchen/chefs/chef1")
    );
  });

  const ONE_MEAL = [
    {
      id: "meal1",
      name: "Repas",
      service: "DINNER" as const,
      startDateTime: "2026-06-01T18:00:00.000Z",
      endDateTime: "2026-06-01T20:00:00.000Z",
      maxAssistants: 2,
      remainingSeats: 2,
      chef: null,
      assistants: [],
    },
  ];

  it("shows Reset instead of Generate once meals exist", () => {
    render(<KitchenManagementPanel {...baseProps} meals={ONE_MEAL} />);
    expect(screen.queryByRole("button", { name: "Générer le planning" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Réinitialiser le planning" })).toBeInTheDocument();
  });

  it("warns before resetting the planning and calls the reset endpoint", async () => {
    confirmDialogMock.mockResolvedValue(true);
    apiPostMock.mockResolvedValue({});
    render(<KitchenManagementPanel {...baseProps} meals={ONE_MEAL} />);

    fireEvent.click(screen.getByRole("button", { name: "Réinitialiser le planning" }));

    await waitFor(() => expect(confirmDialogMock).toHaveBeenCalled());
    expect(confirmDialogMock.mock.calls[0][0].variant).toBe("danger");
    await waitFor(() => expect(apiPostMock).toHaveBeenCalledWith("/api/events/ev1/kitchen/reset"));
  });

  it("does not reset when declined", async () => {
    confirmDialogMock.mockResolvedValue(false);
    render(<KitchenManagementPanel {...baseProps} meals={ONE_MEAL} />);

    fireEvent.click(screen.getByRole("button", { name: "Réinitialiser le planning" }));

    await waitFor(() => expect(confirmDialogMock).toHaveBeenCalled());
    expect(apiPostMock).not.toHaveBeenCalled();
  });

  it("displays the allocated/pool capacity summary when provided", () => {
    render(
      <KitchenManagementPanel
        {...baseProps}
        meals={ONE_MEAL}
        capacitySummary={{ allocated: 10, poolTotal: 12 }}
      />
    );
    expect(screen.getByTestId("capacity-summary").textContent).toMatch(/10\s*\/\s*12/);
    expect(screen.queryByText(/sur-allocation/i)).not.toBeInTheDocument();
  });

  it("shows an over-allocation warning badge when allocated exceeds the pool", () => {
    render(
      <KitchenManagementPanel
        {...baseProps}
        meals={ONE_MEAL}
        capacitySummary={{ allocated: 13, poolTotal: 12 }}
      />
    );
    expect(screen.getByTestId("capacity-summary").textContent).toMatch(/13\s*\/\s*12/);
    expect(screen.getByText(/sur-allocation/i)).toBeInTheDocument();
  });

  it("renders the Chefs/Équipe courses/Sans affectation blocks in a responsive grid", () => {
    const { container } = render(<KitchenManagementPanel {...baseProps} />);
    expect(container.querySelector(".grid.md\\:grid-cols-2.lg\\:grid-cols-3")).not.toBeNull();
  });

  it("offers two separate note cards, allergies above dislikes", () => {
    render(<KitchenManagementPanel {...baseProps} />);

    expect(screen.getByText("Notes allergies")).toBeInTheDocument();
    expect(screen.getByText("Aucune allergie renseignée pour le moment.")).toBeInTheDocument();
    expect(screen.getByText("N'aime vraiment pas")).toBeInTheDocument();
    expect(screen.getByText("Aucune aversion renseignée pour le moment.")).toBeInTheDocument();

    // L'ordre a l'ecran compte : le medical avant la preference.
    const allergiesButton = screen.getByRole("button", { name: "Modifier les notes allergies" });
    const dislikesButton = screen.getByRole("button", { name: "Modifier les aversions" });
    expect(
      allergiesButton.compareDocumentPosition(dislikesButton) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("saves dislikes without touching allergies, and keeps line breaks", async () => {
    apiPatchMock.mockResolvedValue({ data: {} });
    render(<KitchenManagementPanel {...baseProps} allergiesNotes="Vrael : Noix" />);

    fireEvent.click(screen.getByRole("button", { name: "Modifier les aversions" }));
    fireEvent.change(screen.getByLabelText("N'aime vraiment pas"), {
      target: { value: "  Thory : Oignon\nJojo : Oeufs  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => expect(apiPatchMock).toHaveBeenCalled());
    // `trim` ne rase que les extremites : le saut de ligne interne survit.
    expect(apiPatchMock).toHaveBeenCalledWith("/api/events/ev1/kitchen", {
      dislikesNotes: "Thory : Oignon\nJojo : Oeufs",
    });
    expect(toastSuccess).toHaveBeenCalledWith("Aversions mises à jour");
  });

  it("renders saved notes with their line breaks preserved", () => {
    const { container } = render(
      <KitchenManagementPanel {...baseProps} allergiesNotes={"Vrael : Noix\nKaroo : Crevettes"} />
    );
    const notes = Array.from(container.querySelectorAll("p")).find((p) =>
      p.textContent?.includes("Karoo : Crevettes")
    );
    expect(notes).toBeDefined();
    expect(notes).toHaveClass("whitespace-pre-line");
  });
});
