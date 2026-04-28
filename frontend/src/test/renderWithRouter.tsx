import { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { render } from "@testing-library/react";
import { ThemeProvider } from "../contexts/ThemeContext";

export function renderWithRouter(ui: ReactNode, { route = "/" } = {}) {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </ThemeProvider>,
  );
}
