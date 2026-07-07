import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import EditEventModal from "../components/events/EditEventModal";

const apiPatchMock = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();
const useAuthMock = vi.fn();

vi.mock("../config/api", () => ({
  default: { patch: (...args: unknown[]) => apiPatchMock(...args), post: vi.fn() },
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

const baseEvent = {
  id: "ev1",
  name: "Soiree JDR",
  startDateTime: "2026-05-01T18:00:00.000Z",
  endDateTime: "2026-05-01T22:00:00.000Z",
  discordRoleId: null,
};

describe("EditEventModal", () => {
  beforeEach(() => {
    apiPatchMock.mockReset().mockResolvedValue({});
    toastSuccess.mockReset();
    toastError.mockReset();
    useAuthMock.mockReturnValue({ user: { id: "u1", role: "USER" } });
  });

  it("submits the update and calls onUpdated/onClose on success", async () => {
    const onUpdated = vi.fn();
    const onClose = vi.fn();
    render(
      <EditEventModal open={true} onClose={onClose} onUpdated={onUpdated} event={baseEvent} />
    );

    fireEvent.click(screen.getByRole("button", { name: /^Enregistrer$/i }));

    await waitFor(() => {
      expect(apiPatchMock).toHaveBeenCalled();
      expect(onUpdated).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("rejects an end date before the start date without calling the API", async () => {
    render(<EditEventModal open={true} onClose={vi.fn()} onUpdated={vi.fn()} event={baseEvent} />);

    fireEvent.input(screen.getByLabelText("Fin"), {
      target: { value: "2026-05-01T10:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Enregistrer$/i }));

    expect(await screen.findByText("La fin doit etre apres le debut")).toBeInTheDocument();
    expect(apiPatchMock).not.toHaveBeenCalled();
  });
});
