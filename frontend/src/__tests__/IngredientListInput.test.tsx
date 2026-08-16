import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import IngredientListInput, { type IngredientRow } from "../components/kitchen/IngredientListInput";

const apiGetMock = vi.fn();
vi.mock("../config/api", () => ({
  default: { get: (...args: unknown[]) => apiGetMock(...args) },
}));

const ROW: IngredientRow = { name: "Farine", quantity: 1, unit: "KG" };

beforeEach(() => {
  apiGetMock.mockReset();
});

// Point 8 : la quantite accepte virgule ET point comme separateur decimal, converti
// en nombre pour la sauvegarde. Le champ est controle par le parent (value/onChange),
// donc on rerend avec la valeur mise a jour a chaque etape comme le ferait l'appelant.
describe("IngredientListInput — quantite virgule/point (point 8)", () => {
  it("accepts a dot decimal and reports a number", () => {
    const onChange = vi.fn();
    render(<IngredientListInput value={[ROW]} onChange={onChange} />);
    const qty = screen.getByDisplayValue("1");
    fireEvent.change(qty, { target: { value: "1.5" } });
    expect(onChange).toHaveBeenCalledWith([{ ...ROW, quantity: 1.5 }]);
  });

  it("accepts a comma decimal, normalizing to a number", () => {
    const onChange = vi.fn();
    render(<IngredientListInput value={[ROW]} onChange={onChange} />);
    const qty = screen.getByDisplayValue("1");
    fireEvent.change(qty, { target: { value: "1,5" } });
    expect(onChange).toHaveBeenCalledWith([{ ...ROW, quantity: 1.5 }]);
  });

  it("keeps showing the raw comma input while it has not fully parsed yet", () => {
    const onChange = vi.fn();
    render(<IngredientListInput value={[ROW]} onChange={onChange} />);
    const qty = screen.getByDisplayValue("1");
    fireEvent.change(qty, { target: { value: "1," } });
    // "1," (sans decimale) parse deja a 1 via Number("1.") -> commit possible, mais
    // l'affichage garde le texte brut tape (pas de saut visuel du separateur).
    expect(screen.getByDisplayValue("1,")).toBeInTheDocument();
  });

  it("does not commit an unparsable draft (e.g. a lone comma)", () => {
    const onChange = vi.fn();
    render(<IngredientListInput value={[ROW]} onChange={onChange} />);
    const qty = screen.getByDisplayValue("1");
    fireEvent.change(qty, { target: { value: "," } });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue(",")).toBeInTheDocument();
  });
});

// Commentaire par ligne d'ingredient : precision du chef a destination de l'equipe
// courses (ex. "de preference agrume ou acacia").
describe("IngredientListInput — commentaire par ingredient", () => {
  const noteLabel = "Commentaire sur Farine";

  it("hides the comment field until it is requested", () => {
    render(<IngredientListInput value={[ROW]} onChange={vi.fn()} />);
    expect(screen.queryByLabelText(noteLabel)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Ajouter un commentaire sur Farine")).toBeInTheDocument();
  });

  it("opens the comment field on demand and reports what is typed", () => {
    const onChange = vi.fn();
    render(<IngredientListInput value={[ROW]} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Ajouter un commentaire sur Farine"));
    fireEvent.change(screen.getByLabelText(noteLabel), { target: { value: "T65 de préférence" } });
    expect(onChange).toHaveBeenCalledWith([{ ...ROW, note: "T65 de préférence" }]);
  });

  it("shows an existing comment without having to reopen it", () => {
    render(<IngredientListInput value={[{ ...ROW, note: "T65" }]} onChange={vi.fn()} />);
    expect(screen.getByLabelText(noteLabel)).toHaveValue("T65");
    // Le bouton d'ajout disparait : le champ est deja la.
    expect(screen.queryByLabelText("Ajouter un commentaire sur Farine")).not.toBeInTheDocument();
  });

  it("clears the comment when it is removed", () => {
    const onChange = vi.fn();
    render(<IngredientListInput value={[{ ...ROW, note: "T65" }]} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Retirer le commentaire sur Farine"));
    expect(onChange).toHaveBeenCalledWith([{ ...ROW, note: "" }]);
  });

  it("folds the comment field back after removal, offering to add one again", () => {
    // Le parent est la source de verite : on rerend avec la valeur videe, comme il
    // le ferait. Le champ ne doit pas rester ouvert sur du vide.
    const { rerender } = render(
      <IngredientListInput value={[{ ...ROW, note: "T65" }]} onChange={vi.fn()} />
    );
    fireEvent.click(screen.getByLabelText("Retirer le commentaire sur Farine"));
    rerender(<IngredientListInput value={[{ ...ROW, note: "" }]} onChange={vi.fn()} />);
    expect(screen.queryByLabelText(noteLabel)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Ajouter un commentaire sur Farine")).toBeInTheDocument();
  });
});

// L'ordre des lignes est porte jusqu'a la liste de courses (MealIngredient.position) :
// le chef range sa recette dans son ordre de preparation ou par rayon.
describe("IngredientListInput — reorganisation des lignes", () => {
  const ROWS: IngredientRow[] = [
    { name: "Farine", quantity: 1, unit: "KG" },
    { name: "Sucre", quantity: 200, unit: "G" },
    { name: "Beurre", quantity: 250, unit: "G" },
  ];

  it("moves a row up with the arrow button", () => {
    const onChange = vi.fn();
    render(<IngredientListInput value={ROWS} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Monter Beurre"));
    expect(onChange).toHaveBeenCalledWith([ROWS[0], ROWS[2], ROWS[1]]);
  });

  it("moves a row down with the arrow button", () => {
    const onChange = vi.fn();
    render(<IngredientListInput value={ROWS} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Descendre Farine"));
    expect(onChange).toHaveBeenCalledWith([ROWS[1], ROWS[0], ROWS[2]]);
  });

  it("disables the arrows that would move a row out of the list", () => {
    render(<IngredientListInput value={ROWS} onChange={vi.fn()} />);
    expect(screen.getByLabelText("Monter Farine")).toBeDisabled();
    expect(screen.getByLabelText("Descendre Beurre")).toBeDisabled();
    expect(screen.getByLabelText("Descendre Farine")).toBeEnabled();
  });

  it("keeps the comment attached to its row after a move", () => {
    // Les commentaires deplies sont suivis par rang de ligne : sans reindexation,
    // deplacer une ligne ouvrirait le commentaire de la voisine.
    const onChange = vi.fn();
    const rows = [ROWS[0], { ...ROWS[1], note: "en poudre" }];
    const { rerender } = render(<IngredientListInput value={rows} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Monter Sucre"));
    const moved = onChange.mock.calls[0][0] as IngredientRow[];
    expect(moved.map((r) => r.name)).toEqual(["Sucre", "Farine"]);
    rerender(<IngredientListInput value={moved} onChange={onChange} />);
    expect(screen.getByLabelText("Commentaire sur Sucre")).toHaveValue("en poudre");
    expect(screen.queryByLabelText("Commentaire sur Farine")).not.toBeInTheDocument();
  });

  it("reorders on drop when a row is dragged onto another", () => {
    const onChange = vi.fn();
    const { container } = render(<IngredientListInput value={ROWS} onChange={onChange} />);
    const rows = container.querySelectorAll<HTMLElement>(":scope > div > div[draggable]");
    // 3 lignes rendues, chacune porte les handlers de glisser-deposer.
    expect(rows).toHaveLength(3);
    const dataTransfer = {
      effectAllowed: "",
      dropEffect: "",
      setData: vi.fn(),
      getData: () => "2",
    };
    fireEvent.dragStart(rows[2], { dataTransfer });
    fireEvent.dragOver(rows[0], { dataTransfer });
    fireEvent.drop(rows[0], { dataTransfer });
    expect(onChange).toHaveBeenCalledWith([ROWS[2], ROWS[0], ROWS[1]]);
  });
});

// Retour prod : la recherche partait des le 1er caractere avec 200 ms de debounce,
// donc une requete par syllabe tapee (cascade de 429 cote serveur).
describe("IngredientListInput — debit de l'autocompletion", () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  const flush = async (ms: number) => {
    await act(async () => {
      vi.advanceTimersByTime(ms);
    });
  };

  it("does not search on a single character", async () => {
    render(<IngredientListInput value={[{ ...ROW, name: "c" }]} onChange={vi.fn()} />);
    await flush(1000);
    expect(apiGetMock).not.toHaveBeenCalled();
  });

  it("issues a single search for a name typed continuously", async () => {
    apiGetMock.mockResolvedValue({ data: { data: [] } });
    const { rerender } = render(
      <IngredientListInput value={[{ ...ROW, name: "co" }]} onChange={vi.fn()} />
    );
    for (const name of ["con", "conc", "conco", "concombre"]) {
      await flush(100);
      rerender(<IngredientListInput value={[{ ...ROW, name }]} onChange={vi.fn()} />);
    }
    await flush(400);
    await waitFor(() => expect(apiGetMock).toHaveBeenCalledTimes(1));
    expect(apiGetMock).toHaveBeenCalledWith("/api/kitchen/products?q=concombre");
  });
});
