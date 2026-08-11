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
