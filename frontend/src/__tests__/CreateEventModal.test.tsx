import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CreateEventModal from "../components/events/CreateEventModal";

const apiPostMock = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();
const useAuthMock = vi.fn();

vi.mock("../config/api", () => ({
  default: { post: (...args: unknown[]) => apiPostMock(...args) },
}));
vi.mock("react-hot-toast", () => ({
  default: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}));
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => useAuthMock(),
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

describe("CreateEventModal", () => {
  beforeEach(() => {
    apiPostMock.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
    useAuthMock.mockReturnValue({ user: { id: "u1", role: "USER" } });
  });

  it("submits the event and calls onCreated/onClose on success", async () => {
    apiPostMock.mockResolvedValue({});
    const onCreated = vi.fn();
    const onClose = vi.fn();
    render(<CreateEventModal open={true} onClose={onClose} onCreated={onCreated} />);

    fireEvent.input(screen.getByLabelText("Nom"), { target: { value: "Soiree JDR" } });
    fireEvent.input(screen.getByLabelText("Début"), {
      target: { value: "2026-05-01T18:00" },
    });
    fireEvent.input(screen.getByLabelText("Fin"), {
      target: { value: "2026-05-01T22:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Créer$/i }));

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalled();
      expect(onCreated).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("rejects an end date before the start date without calling the API", async () => {
    render(<CreateEventModal open={true} onClose={vi.fn()} onCreated={vi.fn()} />);

    fireEvent.input(screen.getByLabelText("Nom"), { target: { value: "Soiree JDR" } });
    fireEvent.input(screen.getByLabelText("Début"), {
      target: { value: "2026-05-01T18:00" },
    });
    fireEvent.input(screen.getByLabelText("Fin"), {
      target: { value: "2026-05-01T10:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Créer$/i }));

    expect(await screen.findByText("La fin doit être après le début")).toBeInTheDocument();
    expect(apiPostMock).not.toHaveBeenCalled();
  });
});
