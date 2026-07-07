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
        data: [
          {
            id: null,
            name: "External Game",
            externalSource: "BGG",
            externalId: "42",
          },
        ],
      },
    });

    render(<BoardGameSearchInput onSelect={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/search board games/i), {
      target: { value: "ext" },
    });

    expect(await screen.findByText("BGG")).toBeInTheDocument();
  });

  it("shows preview panel when a local game is clicked", async () => {
    const game = { id: "g1", name: "Catan", yearPublished: 1995 };
    apiGetMock.mockResolvedValue({ data: { data: [game] } });

    render(<BoardGameSearchInput onSelect={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/search board games/i), {
      target: { value: "cat" },
    });

    const result = await screen.findByText("Catan");
    fireEvent.click(result);

    expect(await screen.findByRole("button", { name: /selectionner ce jeu/i })).toBeInTheDocument();
  });

  it("calls onSelect after confirming from preview (local game)", async () => {
    const game = { id: "g1", name: "Catan", yearPublished: 1995 };
    apiGetMock.mockResolvedValue({ data: { data: [game] } });
    const onSelect = vi.fn();

    render(<BoardGameSearchInput onSelect={onSelect} />);
    const input = screen.getByPlaceholderText(/search board games/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "cat" } });

    const result = await screen.findByText("Catan");
    fireEvent.click(result);

    const confirmBtn = await screen.findByRole("button", { name: /selectionner ce jeu/i });
    fireEvent.click(confirmBtn);

    expect(onSelect).toHaveBeenCalled();
    expect(input.value).toBe("");
  });

  it("fetches bgg-preview when a BGG result is clicked", async () => {
    apiGetMock
      .mockResolvedValueOnce({
        data: {
          data: [{ id: null, name: "Catan", externalSource: "BGG", externalId: "13" }],
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: {
            bggId: "13",
            name: "Catan",
            minPlayers: 3,
            maxPlayers: 4,
            playingTime: 90,
            description: "Trade and build",
          },
        },
      });

    render(<BoardGameSearchInput onSelect={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/search board games/i), {
      target: { value: "cat" },
    });

    const result = await screen.findByText("Catan");
    fireEvent.click(result);

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith("/api/boardgames/bgg-preview/13");
    });
    expect(await screen.findByText("Trade and build")).toBeInTheDocument();
  });

  it("goes back to results when Retour is clicked", async () => {
    const game = { id: "g1", name: "Catan", yearPublished: 1995 };
    apiGetMock.mockResolvedValue({ data: { data: [game] } });

    render(<BoardGameSearchInput onSelect={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/search board games/i), {
      target: { value: "cat" },
    });

    const result = await screen.findByText("Catan");
    fireEvent.click(result);

    const backBtn = await screen.findByRole("button", { name: /retour/i });
    fireEvent.click(backBtn);

    expect(await screen.findByText("Catan")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /selectionner ce jeu/i })).not.toBeInTheDocument();
  });

  it("shows a no-results message instead of nothing when the search is empty", async () => {
    apiGetMock.mockResolvedValue({ data: { data: [] } });
    render(<BoardGameSearchInput onSelect={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/search board games/i), {
      target: { value: "zzzznotfound" },
    });
    expect(await screen.findByText("Aucun resultat")).toBeInTheDocument();
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
