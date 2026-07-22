import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CreateMealSlotModal from "../components/kitchen/CreateMealSlotModal";

const apiPostMock = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("../config/api", () => ({
  default: { post: (...args: unknown[]) => apiPostMock(...args) },
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

beforeEach(() => {
  apiPostMock.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
});

describe("CreateMealSlotModal", () => {
  it("creates a slot from just a date and a service (no name/chef fields)", async () => {
    apiPostMock.mockResolvedValue({ data: { data: { id: "meal1" } } });
    const onSaved = vi.fn();
    const onClose = vi.fn();
    render(
      <CreateMealSlotModal
        open
        onClose={onClose}
        onSaved={onSaved}
        eventId="ev1"
        eventStartDate="2026-06-01"
        eventEndDate="2026-06-03"
      />
    );

    expect(screen.queryByLabelText(/nom/i)).not.toBeInTheDocument();

    fireEvent.input(screen.getByLabelText("Jour"), { target: { value: "2026-06-02" } });
    fireEvent.click(screen.getByRole("radio", { name: "Midi" }));
    fireEvent.click(screen.getByRole("button", { name: "Créer" }));

    await waitFor(() =>
      expect(apiPostMock).toHaveBeenCalledWith("/api/events/ev1/kitchen/meals", {
        date: "2026-06-02",
        service: "LUNCH",
      })
    );
    expect(onSaved).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("shows an error toast and keeps the modal open on failure", async () => {
    apiPostMock.mockRejectedValue({
      response: { data: { error: { code: "SLOT_ALREADY_EXISTS" } } },
    });
    const onClose = vi.fn();
    render(
      <CreateMealSlotModal
        open
        onClose={onClose}
        onSaved={vi.fn()}
        eventId="ev1"
        eventStartDate="2026-06-01"
        eventEndDate="2026-06-03"
      />
    );

    fireEvent.input(screen.getByLabelText("Jour"), { target: { value: "2026-06-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Créer" }));

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
  });
});
