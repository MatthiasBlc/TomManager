import { render, screen } from "@testing-library/react";
import EmptyState from "../components/common/EmptyState";

describe("EmptyState", () => {
  it("renders the title", () => {
    render(<EmptyState title="Aucun resultat" />);
    expect(screen.getByText("Aucun resultat")).toBeInTheDocument();
  });

  it("renders the description when provided", () => {
    render(<EmptyState title="Vide" description="Essayez un autre filtre" />);
    expect(screen.getByText("Essayez un autre filtre")).toBeInTheDocument();
  });

  it("does not render description block when omitted", () => {
    render(<EmptyState title="Vide" />);
    expect(
      screen.queryByText("Essayez un autre filtre"),
    ).not.toBeInTheDocument();
  });

  it("renders the icon when provided", () => {
    render(
      <EmptyState title="Vide" icon={<span data-testid="icon">📭</span>} />,
    );
    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });

  it("renders the action when provided", () => {
    render(<EmptyState title="Vide" action={<button>Creer</button>} />);
    expect(screen.getByRole("button", { name: "Creer" })).toBeInTheDocument();
  });
});
