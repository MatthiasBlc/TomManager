import { screen } from "@testing-library/react";
import { renderWithRouter } from "../test/renderWithRouter";
import NotFoundPage from "../pages/NotFoundPage";

describe("NotFoundPage", () => {
  it("renders the 404 heading and message", () => {
    renderWithRouter(<NotFoundPage />);
    expect(screen.getByText("404")).toBeInTheDocument();
    expect(screen.getByText("Page introuvable")).toBeInTheDocument();
    expect(screen.getByText(/Cette page n'existe pas/)).toBeInTheDocument();
  });

  it("renders a link back to home", () => {
    renderWithRouter(<NotFoundPage />);
    const link = screen.getByRole("link", { name: /Retour à l'accueil/i });
    expect(link).toHaveAttribute("href", "/");
  });
});
