import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import ErrorBoundary from "../../components/common/ErrorBoundary";

// Composant qui leve une erreur lors du rendu
function Exploding(): never {
  throw new Error("test error");
}

describe("ErrorBoundary", () => {
  // Supprimer les logs d'erreur React attendus dans les tests
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("affiche le fallback par defaut quand une erreur est levee", () => {
    render(
      <ErrorBoundary>
        <Exploding />
      </ErrorBoundary>
    );
    expect(screen.getByText("Erreur inattendue")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /recharger/i })).toBeInTheDocument();
  });

  it("affiche le fallback personnalise si fourni", () => {
    render(
      <ErrorBoundary fallback={<div>Fallback custom</div>}>
        <Exploding />
      </ErrorBoundary>
    );
    expect(screen.getByText("Fallback custom")).toBeInTheDocument();
  });

  it("rend les enfants normalement sans erreur", () => {
    render(
      <ErrorBoundary>
        <p>Contenu normal</p>
      </ErrorBoundary>
    );
    expect(screen.getByText("Contenu normal")).toBeInTheDocument();
  });
});
