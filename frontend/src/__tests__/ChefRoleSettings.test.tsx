import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ChefRoleSettings from "../components/kitchen/ChefRoleSettings";

const apiPatchMock = vi.fn();
const confirmDialogMock = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("../config/api", () => ({
  default: {
    patch: (...args: unknown[]) => apiPatchMock(...args),
  },
}));
vi.mock("../contexts/ConfirmContext", () => ({
  useConfirm: () => confirmDialogMock,
}));
vi.mock("react-hot-toast", () => ({
  default: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}));

beforeEach(() => {
  apiPatchMock.mockReset();
  confirmDialogMock.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
});

describe("ChefRoleSettings", () => {
  it("warns before overwriting manual chefs when setting a chefRoleId", async () => {
    confirmDialogMock.mockResolvedValue(true);
    apiPatchMock.mockResolvedValue({});
    render(<ChefRoleSettings eventId="ev1" chefRoleId={null} onChanged={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Paramètres cuisine" }));
    fireEvent.change(screen.getByLabelText(/ID du rôle Discord/i), {
      target: { value: "123456789012345678" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => expect(confirmDialogMock).toHaveBeenCalled());
    expect(confirmDialogMock.mock.calls[0][0].title).toMatch(/rôle Discord/i);
    await waitFor(() =>
      expect(apiPatchMock).toHaveBeenCalledWith(
        "/api/events/ev1/kitchen",
        expect.objectContaining({ chefRoleId: "123456789012345678" })
      )
    );
  });

  it("does not call the API when the chefRoleId overwrite is declined", async () => {
    confirmDialogMock.mockResolvedValue(false);
    render(<ChefRoleSettings eventId="ev1" chefRoleId={null} onChanged={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Paramètres cuisine" }));
    fireEvent.change(screen.getByLabelText(/ID du rôle Discord/i), {
      target: { value: "123456789012345678" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => expect(confirmDialogMock).toHaveBeenCalled());
    expect(apiPatchMock).not.toHaveBeenCalled();
  });

  it("does not warn when saving config without changing chefRoleId", async () => {
    apiPatchMock.mockResolvedValue({});
    render(<ChefRoleSettings eventId="ev1" chefRoleId={null} onChanged={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Paramètres cuisine" }));
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => expect(apiPatchMock).toHaveBeenCalled());
    expect(confirmDialogMock).not.toHaveBeenCalled();
  });
});
