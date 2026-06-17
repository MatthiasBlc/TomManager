import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import TagInput from "../components/planning/TagInput";

const apiGetMock = vi.fn();
vi.mock("../config/api", () => ({
  default: { get: (...args: unknown[]) => apiGetMock(...args) },
}));

describe("TagInput", () => {
  beforeEach(() => {
    apiGetMock.mockReset();
  });

  it("renders existing tags as removable badges", () => {
    render(<TagInput value={["jdr", "horreur"]} onChange={vi.fn()} />);
    expect(screen.getByText("jdr")).toBeInTheDocument();
    expect(screen.getByText("horreur")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retirer le tag jdr" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retirer le tag horreur" })).toBeInTheDocument();
  });

  it("removes a tag when the badge button is clicked", () => {
    const onChange = vi.fn();
    render(<TagInput value={["jdr", "horreur"]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Retirer le tag jdr" }));
    expect(onChange).toHaveBeenCalledWith(["horreur"]);
  });

  it("adds a tag (lowercased, trimmed) when Enter is pressed", () => {
    const onChange = vi.fn();
    render(<TagInput value={[]} onChange={onChange} />);
    const input = screen.getByPlaceholderText("Ajouter des tags...");
    fireEvent.change(input, { target: { value: "  Donjon  " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(["donjon"]);
  });

  it("adds a tag when comma is pressed", () => {
    const onChange = vi.fn();
    render(<TagInput value={[]} onChange={onChange} />);
    const input = screen.getByPlaceholderText("Ajouter des tags...");
    fireEvent.change(input, { target: { value: "epee" } });
    fireEvent.keyDown(input, { key: "," });
    expect(onChange).toHaveBeenCalledWith(["epee"]);
  });

  it("does not add a duplicate tag", () => {
    const onChange = vi.fn();
    render(<TagInput value={["jdr"]} onChange={onChange} />);
    const input = screen.getByPlaceholderText("");
    fireEvent.change(input, { target: { value: "jdr" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("removes the last tag when Backspace is pressed on an empty input", () => {
    const onChange = vi.fn();
    render(<TagInput value={["jdr", "horreur"]} onChange={onChange} />);
    const input = screen.getByPlaceholderText("");
    fireEvent.keyDown(input, { key: "Backspace" });
    expect(onChange).toHaveBeenCalledWith(["jdr"]);
  });

  it("queries suggestions from the API after a debounce", async () => {
    apiGetMock.mockResolvedValue({
      data: { data: [{ id: "t1", name: "donjon" }] },
    });
    render(<TagInput value={[]} onChange={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("Ajouter des tags..."), {
      target: { value: "don" },
    });
    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith("/api/tags?q=don");
    });
    expect(await screen.findByText("donjon")).toBeInTheDocument();
  });
});
