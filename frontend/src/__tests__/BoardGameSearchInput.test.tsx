import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import BoardGameSearchInput from "../components/boardgames/BoardGameSearchInput";

const apiGetMock = vi.fn();
vi.mock("../config/api", () => ({
  default: {
    get: (...args: unknown[]) => apiGetMock(...args),
  },
}));

describe("BoardGameSearchInput", () => {
  beforeEach(() => {
    apiGetMock.mockReset();
  });

  it("does not query the API when the input is shorter than 2 characters", async () => {
    render(<BoardGameSearchInput onSelect={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/search board games/i), {
      target: { value: "a" },
    });
    await new Promise((r) => setTimeout(r, 400));
    expect(apiGetMock).not.toHaveBeenCalled();
  });

  it("queries the API after a debounce and shows results", async () => {
    apiGetMock.mockResolvedValue({
      data: { data: [{ id: "g1", name: "Catan", yearPublished: 1995 }] },
    });

    render(<BoardGameSearchInput onSelect={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/search board games/i), {
      target: { value: "cat" },
    });

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith("/api/boardgames/search?q=cat");
    });
    expect(await screen.findByText("Catan")).toBeInTheDocument();
    expect(screen.getByText("(1995)")).toBeInTheDocument();
  });

  it("shows a BGG badge for external results without an id", async () => {
    apiGetMock.mockResolvedValue({
      data: {
        data: [{ id: null, name: "External Game", externalSource: "BGG", externalId: "42" }],
      },
    });

    render(<BoardGameSearchInput onSelect={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/search board games/i), {
      target: { value: "ext" },
    });

    expect(await screen.findByText("BGG")).toBeInTheDocument();
  });

  it("calls onSelect and clears the input when a result is clicked", async () => {
    const game = { id: "g1", name: "Catan", yearPublished: 1995 };
    apiGetMock.mockResolvedValue({ data: { data: [game] } });
    const onSelect = vi.fn();

    render(<BoardGameSearchInput onSelect={onSelect} />);
    const input = screen.getByPlaceholderText(/search board games/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "cat" } });

    const result = await screen.findByText("Catan");
    fireEvent.click(result);
    expect(onSelect).toHaveBeenCalledWith(game);
    expect(input.value).toBe("");
    await waitFor(() => {
      expect(screen.queryByText("Catan")).not.toBeInTheDocument();
    });
  });

  it("clears results when the API call rejects", async () => {
    apiGetMock.mockRejectedValue(new Error("network"));
    render(<BoardGameSearchInput onSelect={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/search board games/i), {
      target: { value: "boom" },
    });

    await waitFor(() => expect(apiGetMock).toHaveBeenCalled());
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});
