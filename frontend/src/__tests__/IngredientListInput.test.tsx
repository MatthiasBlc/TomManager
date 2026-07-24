import { render, screen, fireEvent } from "@testing-library/react";
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
