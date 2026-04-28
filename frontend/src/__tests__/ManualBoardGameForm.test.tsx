import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ManualBoardGameForm from "../components/boardgames/ManualBoardGameForm";

describe("ManualBoardGameForm", () => {
  it("renders all fields and action buttons", () => {
    render(<ManualBoardGameForm onSubmit={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Year")).toBeInTheDocument();
    expect(screen.getByLabelText("Min Players")).toBeInTheDocument();
    expect(screen.getByLabelText("Max Players")).toBeInTheDocument();
    expect(screen.getByLabelText("Playing Time (min)")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create & add/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /back to search/i }),
    ).toBeInTheDocument();
  });

  it("shows an error message when submitting without a name", async () => {
    const onSubmit = vi.fn();
    render(<ManualBoardGameForm onSubmit={onSubmit} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /create & add/i }));
    expect(await screen.findByText("Name is required")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits parsed numeric fields when valid", async () => {
    const onSubmit = vi.fn();
    render(<ManualBoardGameForm onSubmit={onSubmit} onCancel={vi.fn()} />);
    fireEvent.input(screen.getByLabelText("Name"), {
      target: { value: "Catan" },
    });
    fireEvent.input(screen.getByLabelText("Year"), {
      target: { value: "1995" },
    });
    fireEvent.input(screen.getByLabelText("Min Players"), {
      target: { value: "3" },
    });
    fireEvent.input(screen.getByLabelText("Max Players"), {
      target: { value: "4" },
    });
    fireEvent.input(screen.getByLabelText("Playing Time (min)"), {
      target: { value: "120" },
    });

    fireEvent.click(screen.getByRole("button", { name: /create & add/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      name: "Catan",
      yearPublished: 1995,
      minPlayers: 3,
      maxPlayers: 4,
      playingTime: 120,
    });
  });

  it("calls onCancel when the back button is clicked", () => {
    const onCancel = vi.fn();
    render(<ManualBoardGameForm onSubmit={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: /back to search/i }));
    expect(onCancel).toHaveBeenCalled();
  });
});
