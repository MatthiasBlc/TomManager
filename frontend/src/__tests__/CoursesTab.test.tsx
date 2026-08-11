import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CoursesTab from "../components/courses/CoursesTab";
import type { ShoppingViews } from "../hooks/useShoppingList";

const apiGetMock = vi.fn();
const downloadFileMock = vi.fn();
const toastError = vi.fn();
const useIsMobileMock = vi.fn();

vi.mock("../hooks/useIsMobile", () => ({
  useIsMobile: () => useIsMobileMock(),
}));

vi.mock("../config/api", () => ({
  default: { get: (...args: unknown[]) => apiGetMock(...args) },
  downloadFile: (...args: unknown[]) => downloadFileMock(...args),
}));
vi.mock("../hooks/useEventSocket", () => ({ useEventSocket: () => {} }));
vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: (...a: unknown[]) => toastError(...a) },
}));

const VIEWS: ShoppingViews = {
  byMeal: [
    {
      mealId: "m1",
      mealName: "Dîner du vendredi",
      service: "DINNER",
      startDateTime: "2026-06-01T18:30:00.000Z",
      ingredients: [
        { name: "farine", quantity: 500, unit: "G", note: "type 55" },
        { name: "miel", quantity: 250, unit: "G", note: null },
      ],
    },
    {
      mealId: "m2",
      mealName: "Déjeuner du samedi",
      service: "LUNCH",
      startDateTime: "2026-06-02T10:30:00.000Z",
      ingredients: [{ name: "farine", quantity: 1, unit: "KG", note: null }],
    },
    {
      mealId: "m3",
      mealName: "Dîner du samedi",
      service: "DINNER",
      startDateTime: "2026-06-02T18:30:00.000Z",
      ingredients: [],
    },
  ],
  flat: [
    {
      name: "farine",
      quantity: 500,
      unit: "G",
      note: "type 55",
      mealId: "m1",
      mealName: "Dîner du vendredi",
    },
    {
      name: "farine",
      quantity: 1,
      unit: "KG",
      note: null,
      mealId: "m2",
      mealName: "Déjeuner du samedi",
    },
    {
      name: "miel",
      quantity: 250,
      unit: "G",
      note: null,
      mealId: "m1",
      mealName: "Dîner du vendredi",
    },
  ],
  aggregated: [
    {
      name: "farine",
      quantity: 1.5,
      unit: "KG",
      mealNames: ["Dîner du vendredi", "Déjeuner du samedi"],
      notes: [{ mealName: "Dîner du vendredi", note: "type 55" }],
    },
    { name: "miel", quantity: 250, unit: "G", mealNames: ["Dîner du vendredi"], notes: [] },
  ],
};

async function renderTab(data: ShoppingViews = VIEWS) {
  apiGetMock.mockResolvedValue({ data: { data } });
  render(<CoursesTab eventId="e1" />);
  await waitFor(() => expect(apiGetMock).toHaveBeenCalled());
}

describe("CoursesTab", () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    downloadFileMock.mockReset().mockResolvedValue(undefined);
    toastError.mockReset();
    useIsMobileMock.mockReset().mockReturnValue(false);
    localStorage.clear();
  });

  it("affiche la vue par repas par defaut, repas sans ingredient inclus", async () => {
    await renderTab();

    expect(await screen.findByText("Dîner du vendredi")).toBeInTheDocument();
    expect(screen.getByText("Déjeuner du samedi")).toBeInTheDocument();
    expect(screen.getByText("Dîner du samedi")).toBeInTheDocument();
    expect(screen.getByText("Aucun ingrédient renseigné")).toBeInTheDocument();
  });

  it("bascule sur la vue a plat et affiche le repas de chaque ligne", async () => {
    await renderTab();

    fireEvent.click(screen.getByLabelText("Tous les ingrédients (A-Z)"));

    // Les 3 lignes a plat, sans regroupement : deux "farine" distinctes
    await waitFor(() => expect(screen.getAllByText("farine")).toHaveLength(2));
    expect(screen.queryByText("Aucun ingrédient renseigné")).not.toBeInTheDocument();
  });

  it("bascule sur la vue regroupee, somme affichee et commentaire attribue", async () => {
    await renderTab();

    fireEvent.click(screen.getByLabelText("Ingrédients regroupés"));

    // 500 g + 1 kg = 1,5 kg (virgule decimale francaise)
    expect(await screen.findByText("1,5")).toBeInTheDocument();
    expect(screen.getAllByText("farine")).toHaveLength(1);
    // Le commentaire reste attribue a son repas d'origine
    expect(
      screen.getByText(
        (_, el) => el?.tagName === "LI" && el.textContent === "Dîner du vendredi : type 55"
      )
    ).toBeInTheDocument();
  });

  it("memorise la vue choisie dans localStorage", async () => {
    await renderTab();

    fireEvent.click(screen.getByLabelText("Ingrédients regroupés"));

    expect(localStorage.getItem("courses_view_preference")).toBe("aggregated");
  });

  it("exporte la vue affichee", async () => {
    await renderTab();

    fireEvent.click(screen.getByLabelText("Tous les ingrédients (A-Z)"));
    fireEvent.click(screen.getByRole("button", { name: /Exporter en Excel/ }));

    await waitFor(() =>
      expect(downloadFileMock).toHaveBeenCalledWith(
        "/api/events/e1/kitchen/shopping/export?view=flat",
        expect.stringContaining("flat")
      )
    );
  });

  it("affiche un etat vide et desactive l'export sans repas", async () => {
    await renderTab({ byMeal: [], flat: [], aggregated: [] });

    expect(await screen.findByText("Aucun repas planifié pour le moment")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Exporter en Excel/ })).toBeDisabled();
  });

  it("rend des cartes empilees sur mobile, sans tableau", async () => {
    useIsMobileMock.mockReturnValue(true);
    await renderTab();

    expect(await screen.findByText("Dîner du vendredi")).toBeInTheDocument();
    expect(document.querySelector("table")).toBeNull();
  });

  it("signale un echec d'export sans casser la page", async () => {
    downloadFileMock.mockRejectedValue(new Error("boom"));
    await renderTab();

    fireEvent.click(screen.getByRole("button", { name: /Exporter en Excel/ }));

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(screen.getByText("Dîner du vendredi")).toBeInTheDocument();
  });
});
