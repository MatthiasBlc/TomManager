import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AddBoardGameModal from "../components/boardgames/AddBoardGameModal";

const apiPostMock = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("../config/api", () => ({
  default: {
    post: (...args: unknown[]) => apiPostMock(...args),
    get: vi.fn(),
  },
}));
vi.mock("react-hot-toast", () => ({
  default: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}));
vi.mock("../components/boardgames/BoardGameSearchInput", () => ({
  default: ({
    onSelect,
  }: {
    onSelect: (g: {
      id: string | null;
      name: string;
      externalSource?: string;
      externalId?: string;
    }) => void;
  }) => (
    <div>
      <button onClick={() => onSelect({ id: "g1", name: "Catan" })}>pick-local</button>
      <button
        onClick={() =>
          onSelect({
            id: null,
            name: "BGGGame",
            externalSource: "BGG",
            externalId: "42",
          })
        }
      >
        pick-bgg
      </button>
    </div>
  ),
}));
vi.mock("../components/common/ResponsiveModal", () => ({
  default: ({
    open,
    children,
    title,
  }: {
    open: boolean;
    children: React.ReactNode;
    title: string;
  }) =>
    open ? (
      <div role="dialog" aria-label={title}>
        {children}
      </div>
    ) : null,
}));

describe("AddBoardGameModal", () => {
  beforeEach(() => {
    apiPostMock.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it("renders nothing when closed", () => {
    render(<AddBoardGameModal open={false} onClose={vi.fn()} onAdded={vi.fn()} eventId="ev1" />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders the search mode by default with a Create manually button", () => {
    render(<AddBoardGameModal open={true} onClose={vi.fn()} onAdded={vi.fn()} eventId="ev1" />);
    expect(screen.getByRole("button", { name: /create manually/i })).toBeInTheDocument();
  });

  it("switches to manual mode when Create manually is clicked", () => {
    render(<AddBoardGameModal open={true} onClose={vi.fn()} onAdded={vi.fn()} eventId="ev1" />);
    fireEvent.click(screen.getByRole("button", { name: /create manually/i }));
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
  });

  it("posts to /events/:id/boardgames when a local game is selected", async () => {
    apiPostMock.mockResolvedValue({});
    const onAdded = vi.fn();
    const onClose = vi.fn();
    render(<AddBoardGameModal open={true} onClose={onClose} onAdded={onAdded} eventId="ev1" />);
    fireEvent.click(screen.getByText("pick-local"));
    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith("/api/events/ev1/boardgames", {
        boardGameId: "g1",
      });
      expect(onAdded).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("imports from BGG then adds to event when a BGG result is selected", async () => {
    apiPostMock
      .mockResolvedValueOnce({ data: { data: { id: "imported-id" } } }) // /from-bgg
      .mockResolvedValueOnce({}); // /events/:id/boardgames
    render(<AddBoardGameModal open={true} onClose={vi.fn()} onAdded={vi.fn()} eventId="ev1" />);
    fireEvent.click(screen.getByText("pick-bgg"));
    await waitFor(() => {
      expect(apiPostMock).toHaveBeenNthCalledWith(1, "/api/boardgames/from-bgg", {
        bggId: "42",
        name: "BGGGame",
        yearPublished: undefined,
        minPlayers: undefined,
        maxPlayers: undefined,
        playingTime: undefined,
        description: undefined,
        imageUrl: undefined,
      });
      expect(apiPostMock).toHaveBeenNthCalledWith(2, "/api/events/ev1/boardgames", {
        boardGameId: "imported-id",
      });
    });
  });

  it("calls onClose when the Close button is clicked", () => {
    const onClose = vi.fn();
    render(<AddBoardGameModal open={true} onClose={onClose} onAdded={vi.fn()} eventId="ev1" />);
    fireEvent.click(screen.getByRole("button", { name: /^close$/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
