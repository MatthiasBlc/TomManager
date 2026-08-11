import { render, screen } from "@testing-library/react";
import KitchenNotesPanels from "../components/kitchen/KitchenNotesPanels";

const isMobileMock = vi.fn(() => false);

vi.mock("../hooks/useIsMobile", () => ({
  useIsMobile: () => isMobileMock(),
}));

const ALLERGIES = "Vrael : Noix, Tofu\nKaroo : Crevettes";
const DISLIKES = "Thory : Oignon\nJojo : Oeufs";

beforeEach(() => {
  isMobileMock.mockReturnValue(false);
});

describe("KitchenNotesPanels", () => {
  it("renders nothing when both fields are empty or blank", () => {
    const { container } = render(<KitchenNotesPanels allergiesNotes="   " dislikesNotes={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows both blocks side by side on desktop", () => {
    const { container } = render(
      <KitchenNotesPanels allergiesNotes={ALLERGIES} dislikesNotes={DISLIKES} />
    );

    expect(screen.getByText("Allergies")).toBeInTheDocument();
    expect(screen.getByText("N'aime vraiment pas")).toBeInTheDocument();
    // Deux colonnes seulement quand les deux fiches sont remplies.
    expect(container.querySelector(".md\\:grid-cols-2")).not.toBeNull();
    // Pas d'accordeon sur desktop : tout est lisible d'un coup d'oeil.
    expect(container.querySelector("details")).toBeNull();
  });

  it("keeps the line breaks entered by the manager", () => {
    const { container } = render(<KitchenNotesPanels allergiesNotes={ALLERGIES} />);
    const notes = Array.from(container.querySelectorAll("p")).find((p) =>
      p.textContent?.includes("Karoo : Crevettes")
    );
    expect(notes).toHaveClass("whitespace-pre-line");
    expect(notes?.textContent).toBe(ALLERGIES);
  });

  it("gives the single filled block the full width", () => {
    const { container } = render(<KitchenNotesPanels allergiesNotes={ALLERGIES} />);
    expect(screen.queryByText("N'aime vraiment pas")).not.toBeInTheDocument();
    expect(container.querySelector(".md\\:grid-cols-2")).toBeNull();
  });

  it("collapses only the dislikes block on mobile", () => {
    isMobileMock.mockReturnValue(true);
    const { container } = render(
      <KitchenNotesPanels allergiesNotes={ALLERGIES} dislikesNotes={DISLIKES} />
    );

    // Les allergies restent toujours depliees.
    expect(screen.getByText("Allergies")).toBeInTheDocument();
    expect(screen.getByText(/Karoo : Crevettes/)).toBeInTheDocument();

    const details = container.querySelectorAll("details");
    expect(details).toHaveLength(1);
    expect(details[0].open).toBe(false);
    expect(details[0].textContent).toContain("N'aime vraiment pas");
  });
});
