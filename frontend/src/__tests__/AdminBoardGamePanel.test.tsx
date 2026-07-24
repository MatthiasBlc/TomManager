import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AdminBoardGamePanel from "../components/admin/AdminBoardGamePanel";

const apiGetMock = vi.fn();
const apiPatchMock = vi.fn();
const apiDeleteMock = vi.fn();
const apiPostMock = vi.fn();

vi.mock("../config/api", () => ({
  default: {
    get: (...args: unknown[]) => apiGetMock(...args),
    patch: (...args: unknown[]) => apiPatchMock(...args),
    delete: (...args: unknown[]) => apiDeleteMock(...args),
    post: (...args: unknown[]) => apiPostMock(...args),
  },
}));

vi.mock("../hooks/useIsMobile", () => ({
  useIsMobile: () => false,
}));

const makeBoardGame = (
  id: string,
  name: string,
  overrides: Partial<{
    eventBoardGames: number;
    gameTables: number;
  }> = {}
) => ({
  id,
  name,
  externalSource: null,
  externalId: null,
  yearPublished: 2020,
  minPlayers: 2,
  maxPlayers: 4,
  playingTime: 60,
  imageUrl: null,
  _count: {
    eventBoardGames: overrides.eventBoardGames ?? 0,
    gameTables: overrides.gameTables ?? 0,
  },
});

const defaultListResult = {
  data: {
    data: {
      games: [makeBoardGame("g1", "Wingspan"), makeBoardGame("g2", "Azul")],
      total: 2,
      page: 1,
      limit: 20,
    },
  },
};

beforeEach(() => {
  apiGetMock.mockResolvedValue(defaultListResult);
});

describe("AdminBoardGamePanel", () => {
  it("renders game list after load", async () => {
    render(<AdminBoardGamePanel />);
    await waitFor(() => {
      expect(screen.getByText("Wingspan")).toBeInTheDocument();
      expect(screen.getByText("Azul")).toBeInTheDocument();
    });
  });

  it("shows an empty state when the search has no results", async () => {
    apiGetMock.mockResolvedValue({
      data: { data: { games: [], total: 0, page: 1, limit: 20 } },
    });
    render(<AdminBoardGamePanel />);
    fireEvent.change(screen.getByPlaceholderText("Rechercher un jeu..."), {
      target: { value: "zzznotfound" },
    });
    expect(await screen.findByText("Aucun résultat")).toBeInTheDocument();
    expect(screen.getByText('Aucun jeu ne correspond à "zzznotfound".')).toBeInTheDocument();
  });

  it("shows total count", async () => {
    render(<AdminBoardGamePanel />);
    await waitFor(() => expect(screen.getByText("2 jeux au total")).toBeInTheDocument());
  });

  it("opens edit modal on Éditer click", async () => {
    render(<AdminBoardGamePanel />);
    await waitFor(() => screen.getByText("Wingspan"));
    const editBtns = screen.getAllByText("Éditer");
    fireEvent.click(editBtns[0]);
    expect(screen.getByText("Modifier le jeu")).toBeInTheDocument();
  });

  it("opens delete confirmation modal on Supprimer click", async () => {
    render(<AdminBoardGamePanel />);
    await waitFor(() => screen.getByText("Wingspan"));
    const delBtns = screen.getAllByText("Supprimer");
    fireEvent.click(delBtns[0]);
    expect(screen.getByText("Supprimer le jeu")).toBeInTheDocument();
  });

  it("shows impact warning when game has relations on delete", async () => {
    apiGetMock.mockResolvedValue({
      data: {
        data: {
          games: [makeBoardGame("g1", "Wingspan", { eventBoardGames: 3, gameTables: 2 })],
          total: 1,
          page: 1,
          limit: 20,
        },
      },
    });
    render(<AdminBoardGamePanel />);
    await waitFor(() => screen.getByText("Wingspan"));
    fireEvent.click(screen.getByText("Supprimer"));
    await waitFor(() => expect(screen.getByText(/3 entrée/)).toBeInTheDocument());
  });

  it("calls delete API and refreshes on confirm", async () => {
    apiDeleteMock.mockResolvedValue({});
    render(<AdminBoardGamePanel />);
    await waitFor(() => screen.getByText("Wingspan"));
    fireEvent.click(screen.getAllByText("Supprimer")[0]);
    await waitFor(() => screen.getByText("Supprimer le jeu"));
    const confirmBtns = screen.getAllByText("Supprimer");
    fireEvent.click(confirmBtns[confirmBtns.length - 1]);
    await waitFor(() => expect(apiDeleteMock).toHaveBeenCalledWith("/api/admin/boardgames/g1"));
  });

  it("opens merge modal on Fusionner click", async () => {
    render(<AdminBoardGamePanel />);
    await waitFor(() => screen.getByText("Wingspan"));
    fireEvent.click(screen.getAllByText("Fusionner")[0]);
    expect(screen.getByText("Fusionner le jeu")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Chercher le jeu cible...")).toBeInTheDocument();
  });

  it("calls merge API after selecting target and confirming", async () => {
    apiPostMock.mockResolvedValue({ data: { data: makeBoardGame("g2", "Azul") } });
    // First call: only Wingspan in main list
    // Second call: Azul appears only in merge search results
    const wingspanOnly = {
      data: {
        data: {
          games: [makeBoardGame("g1", "Wingspan")],
          total: 1,
          page: 1,
          limit: 20,
        },
      },
    };
    apiGetMock
      .mockResolvedValueOnce(wingspanOnly)
      .mockResolvedValueOnce({
        data: {
          data: {
            games: [makeBoardGame("g2", "Azul")],
            total: 1,
            page: 1,
            limit: 10,
          },
        },
      })
      .mockResolvedValue(wingspanOnly);

    render(<AdminBoardGamePanel />);
    await waitFor(() => screen.getByText("Wingspan"));

    // Open merge for Wingspan
    fireEvent.click(screen.getByText("Fusionner"));
    await waitFor(() => screen.getByText("Fusionner le jeu"));

    // Search for target
    const searchInput = screen.getByPlaceholderText("Chercher le jeu cible...");
    fireEvent.change(searchInput, { target: { value: "Azul" } });

    // Wait for merge results — Azul only in modal
    await waitFor(() => screen.getByText("Azul"), { timeout: 2000 });
    fireEvent.click(screen.getByText("Azul"));

    // Confirm
    await waitFor(() => screen.getByText("Confirmer la fusion"));
    fireEvent.click(screen.getByText("Confirmer la fusion"));

    await waitFor(() =>
      expect(apiPostMock).toHaveBeenCalledWith("/api/admin/boardgames/g1/merge", {
        targetId: "g2",
        fieldPicks: {
          name: "target",
          yearPublished: "target",
          minPlayers: "target",
          maxPlayers: "target",
          playingTime: "target",
          imageUrl: "target",
          externalRef: "target",
        },
      })
    );
  });
});
