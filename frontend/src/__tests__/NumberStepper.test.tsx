import { render, screen, fireEvent } from "@testing-library/react";
import NumberStepper from "../components/common/NumberStepper";

describe("NumberStepper", () => {
  it("renders the current value", () => {
    render(<NumberStepper value={3} onChange={() => {}} />);
    expect(screen.getByDisplayValue("3")).toBeInTheDocument();
  });

  it("calls onChange with value + 1 when incrementing", () => {
    const onChange = vi.fn();
    render(<NumberStepper value={3} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Augmenter" }));
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it("calls onChange with value - 1 when decrementing", () => {
    const onChange = vi.fn();
    render(<NumberStepper value={3} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Diminuer" }));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it("disables the decrement button at min", () => {
    render(<NumberStepper value={0} onChange={() => {}} min={0} />);
    expect(screen.getByRole("button", { name: "Diminuer" })).toBeDisabled();
  });

  it("disables the increment button at max", () => {
    render(<NumberStepper value={5} onChange={() => {}} max={5} />);
    expect(screen.getByRole("button", { name: "Augmenter" })).toBeDisabled();
  });

  it("increments/decrements by the given step", () => {
    const onChange = vi.fn();
    render(<NumberStepper value={90} onChange={onChange} step={15} />);
    fireEvent.click(screen.getByRole("button", { name: "Augmenter" }));
    expect(onChange).toHaveBeenCalledWith(105);
    fireEvent.click(screen.getByRole("button", { name: "Diminuer" }));
    expect(onChange).toHaveBeenCalledWith(75);
  });

  it("clamps to max even when it is not a multiple of step away", () => {
    const onChange = vi.fn();
    render(<NumberStepper value={90} onChange={onChange} max={100} step={15} />);
    fireEvent.click(screen.getByRole("button", { name: "Augmenter" }));
    expect(onChange).toHaveBeenCalledWith(100);
  });

  it("accepts direct keyboard entry", () => {
    const onChange = vi.fn();
    render(<NumberStepper value={3} onChange={onChange} max={26} aria-label="Places" />);
    fireEvent.change(screen.getByLabelText("Places"), { target: { value: "26" } });
    expect(onChange).toHaveBeenCalledWith(26);
  });

  it("clamps a typed value above max", () => {
    const onChange = vi.fn();
    render(<NumberStepper value={3} onChange={onChange} max={26} aria-label="Places" />);
    fireEvent.change(screen.getByLabelText("Places"), { target: { value: "99" } });
    expect(onChange).toHaveBeenCalledWith(26);
  });

  it("allows typing 0", () => {
    const onChange = vi.fn();
    render(<NumberStepper value={12} onChange={onChange} max={26} aria-label="Places" />);
    fireEvent.change(screen.getByLabelText("Places"), { target: { value: "0" } });
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it("tolerates an empty field while typing without emitting a value", () => {
    const onChange = vi.fn();
    render(<NumberStepper value={12} onChange={onChange} aria-label="Places" />);
    const input = screen.getByLabelText("Places");
    fireEvent.change(input, { target: { value: "" } });
    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveValue("");
    // Au blur, l'affichage revient a la derniere valeur retenue (rien n'est perdu).
    fireEvent.blur(input);
    expect(input).toHaveValue("12");
  });

  it("ignores non-numeric characters", () => {
    const onChange = vi.fn();
    render(<NumberStepper value={3} onChange={onChange} aria-label="Places" />);
    fireEvent.change(screen.getByLabelText("Places"), { target: { value: "1a2" } });
    expect(onChange).toHaveBeenCalledWith(12);
  });
});
