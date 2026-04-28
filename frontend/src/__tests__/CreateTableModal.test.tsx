import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CreateTableModal from "../components/planning/CreateTableModal";

const apiPostMock = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("../config/api", () => ({
  default: { post: (...args: unknown[]) => apiPostMock(...args), get: vi.fn() },
}));
vi.mock("react-hot-toast", () => ({
  default: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
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
vi.mock("../components/planning/TagInput", () => ({
  default: ({
    value,
    onChange,
  }: {
    value: string[];
    onChange: (v: string[]) => void;
  }) => (
    <div data-testid="tag-input">
      <span>tags:{value.join(",")}</span>
      <button type="button" onClick={() => onChange([...value, "added"])}>
        add-tag
      </button>
    </div>
  ),
}));

describe("CreateTableModal", () => {
  beforeEach(() => {
    apiPostMock.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it("renders nothing when closed", () => {
    render(
      <CreateTableModal
        open={false}
        onClose={vi.fn()}
        onCreated={vi.fn()}
        eventId="ev1"
      />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders the form when open", () => {
    render(
      <CreateTableModal
        open={true}
        onClose={vi.fn()}
        onCreated={vi.fn()}
        eventId="ev1"
      />,
    );
    expect(screen.getByLabelText("Titre")).toBeInTheDocument();
    expect(screen.getByLabelText("Pitch")).toBeInTheDocument();
    expect(screen.getByLabelText("Joueurs max")).toBeInTheDocument();
    expect(screen.getByLabelText("Date")).toBeInTheDocument();
    expect(screen.getByLabelText("Heure de debut")).toBeInTheDocument();
    expect(screen.getByLabelText("Duree")).toBeInTheDocument();
  });

  it("shows the GM-is-player checkbox only for JDR type", () => {
    render(
      <CreateTableModal
        open={true}
        onClose={vi.fn()}
        onCreated={vi.fn()}
        eventId="ev1"
      />,
    );
    // JDR is the default
    expect(screen.getByLabelText(/MJ est aussi joueur/i)).toBeInTheDocument();

    // Switch to JDS
    fireEvent.click(screen.getByLabelText(/JDS/i));
    expect(
      screen.queryByLabelText(/MJ est aussi joueur/i),
    ).not.toBeInTheDocument();
  });

  it("shows validation errors when submitting an empty form", async () => {
    render(
      <CreateTableModal
        open={true}
        onClose={vi.fn()}
        onCreated={vi.fn()}
        eventId="ev1"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Creer$/i }));
    expect(await screen.findByText("Le titre est requis")).toBeInTheDocument();
    expect(apiPostMock).not.toHaveBeenCalled();
  });

  it("submits the table and calls onCreated/onClose on success", async () => {
    apiPostMock.mockResolvedValue({});
    const onCreated = vi.fn();
    const onClose = vi.fn();
    render(
      <CreateTableModal
        open={true}
        onClose={onClose}
        onCreated={onCreated}
        eventId="ev1"
      />,
    );

    fireEvent.input(screen.getByLabelText("Titre"), {
      target: { value: "Donjon" },
    });
    fireEvent.input(screen.getByLabelText("Joueurs max"), {
      target: { value: "5" },
    });
    fireEvent.input(screen.getByLabelText("Date"), {
      target: { value: "2026-04-10" },
    });
    fireEvent.input(screen.getByLabelText("Heure de debut"), {
      target: { value: "18:00" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^Creer$/i }));

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalled();
      expect(onCreated).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });

    const [url, payload] = apiPostMock.mock.calls[0];
    expect(url).toBe("/api/events/ev1/tables");
    expect(payload).toMatchObject({
      title: "Donjon",
      type: "JDR",
      maxPlayers: 5,
    });
    expect(typeof payload.startDateTime).toBe("string");
    expect(typeof payload.endDateTime).toBe("string");
  });

  it("calls onClose when Annuler is clicked", () => {
    const onClose = vi.fn();
    render(
      <CreateTableModal
        open={true}
        onClose={onClose}
        onCreated={vi.fn()}
        eventId="ev1"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Annuler$/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
