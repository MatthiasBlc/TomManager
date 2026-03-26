import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import HomePage from "../../pages/HomePage";
import LoginPage from "../../pages/LoginPage";
import SignupPage from "../../pages/SignupPage";
import InvitationLandingPage from "../../pages/InvitationLandingPage";

// Mock useAuth
vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: null,
    login: vi.fn(),
    signup: vi.fn(),
    logout: vi.fn(),
  }),
}));

describe("HomePage", () => {
  it("should render title and CTA", () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );
    expect(screen.getByText("TomManager")).toBeInTheDocument();
    expect(screen.getByText("Get Started")).toBeInTheDocument();
  });

  it("should have mobile-first responsive classes on title", () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );
    const title = screen.getByText("TomManager");
    expect(title.className).toContain("text-2xl");
    expect(title.className).toContain("md:text-5xl");
  });

  it("should have btn-block on CTA for mobile", () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );
    const cta = screen.getByText("Get Started");
    expect(cta.className).toContain("btn-block");
  });
});

describe("LoginPage", () => {
  it("should render login form", () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );
    expect(screen.getByRole("heading", { name: "Login" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email or username")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("should not have fixed w-96 class on card", () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );
    const card = screen.getByRole("heading", { name: "Login" }).closest(".card");
    expect(card?.className).not.toContain("w-96");
    expect(card?.className).toContain("w-full");
    expect(card?.className).toContain("sm:max-w-sm");
  });

  it("should have inputMode email on identifier field", () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );
    const input = screen.getByLabelText("Email or username");
    expect(input).toHaveAttribute("inputmode", "email");
  });
});

describe("SignupPage", () => {
  it("should show invitation required message when no token", () => {
    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>
    );
    expect(screen.getByText("An invitation is required to sign up.")).toBeInTheDocument();
  });

  it("should have mobile-friendly card without w-96", () => {
    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>
    );
    const card = screen.getByText("Sign Up").closest(".card");
    expect(card?.className).not.toContain("w-96");
    expect(card?.className).toContain("w-full");
  });
});

describe("InvitationLandingPage", () => {
  it("should show loading spinner initially", () => {
    render(
      <MemoryRouter initialEntries={["/invite/some-token"]}>
        <InvitationLandingPage />
      </MemoryRouter>
    );
    expect(document.querySelector(".loading-spinner")).toBeInTheDocument();
  });
});
