import { render, screen, fireEvent } from "@testing-library/react";
import FAB from "../components/common/FAB";

describe("FAB", () => {
  it("renders a button with the provided aria label", () => {
    render(<FAB onClick={() => {}} label="Ajouter une table" />);
    expect(screen.getByRole("button", { name: "Ajouter une table" })).toBeInTheDocument();
  });

  it("calls onClick when the button is clicked", () => {
    const onClick = vi.fn();
    render(<FAB onClick={onClick} label="Ajouter" />);
    fireEvent.click(screen.getByRole("button", { name: "Ajouter" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
