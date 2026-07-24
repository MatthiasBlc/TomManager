import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import UtensilListInput from "../components/kitchen/UtensilListInput";

const apiGetMock = vi.fn();
vi.mock("../config/api", () => ({
  default: { get: (...args: unknown[]) => apiGetMock(...args) },
}));

describe("UtensilListInput", () => {
  beforeEach(() => {
    apiGetMock.mockReset();
  });

  it("renders existing utensils as removable badges", () => {
    render(<UtensilListInput value={["fouet", "plat à gratin"]} onChange={vi.fn()} />);
    expect(screen.getByText("fouet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retirer l'ustensile fouet" })).toBeInTheDocument();
  });

  it("adds a utensil (lowercased, trimmed) when Enter is pressed", () => {
    const onChange = vi.fn();
    render(<UtensilListInput value={[]} onChange={onChange} />);
    const input = screen.getByPlaceholderText("Ajouter des ustensiles...");
    fireEvent.change(input, { target: { value: "  Wok  " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(["wok"]);
  });

  it("queries the kitchen utensils autocomplete endpoint after a debounce", async () => {
    apiGetMock.mockResolvedValue({
      data: { data: [{ id: "u1", name: "mandoline" }] },
    });
    render(<UtensilListInput value={[]} onChange={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("Ajouter des ustensiles..."), {
      target: { value: "mand" },
    });
    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith("/api/kitchen/utensils?q=mand");
    });
    expect(await screen.findByText("mandoline")).toBeInTheDocument();
  });
});
