import { render, screen } from "@testing-library/react";
import AppLayout from "../components/layout/AppLayout";

const useAuthMock = vi.fn();
const useIsMobileMock = vi.fn();
const useOnlineStatusMock = vi.fn();

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));
vi.mock("../hooks/useIsMobile", () => ({
  useIsMobile: () => useIsMobileMock(),
}));
vi.mock("../hooks/useOnlineStatus", () => ({
  useOnlineStatus: () => useOnlineStatusMock(),
}));

describe("AppLayout", () => {
  beforeEach(() => {
    useOnlineStatusMock.mockReturnValue(true);
  });

  afterEach(() => {
    useAuthMock.mockReset();
    useIsMobileMock.mockReset();
    useOnlineStatusMock.mockReset();
  });

  it("renders children inside a main element", () => {
    useIsMobileMock.mockReturnValue(false);
    useAuthMock.mockReturnValue({ user: null });
    render(
      <AppLayout>
        <p>Hello</p>
      </AppLayout>
    );
    const main = screen.getByRole("main");
    expect(main).toContainElement(screen.getByText("Hello"));
  });

  it("uses no top/bottom padding on desktop", () => {
    useIsMobileMock.mockReturnValue(false);
    useAuthMock.mockReturnValue({ user: { id: "u1", username: "Alice" } });
    render(
      <AppLayout>
        <p>Hello</p>
      </AppLayout>
    );
    const main = screen.getByRole("main");
    expect(main.className).not.toContain("pt-12");
    expect(main.className).not.toContain("pb-20");
  });

  it("adds top padding on mobile, no bottom padding when not authenticated", () => {
    useIsMobileMock.mockReturnValue(true);
    useAuthMock.mockReturnValue({ user: null });
    render(
      <AppLayout>
        <p>Hello</p>
      </AppLayout>
    );
    const main = screen.getByRole("main");
    expect(main.className).toContain("pt-12");
    expect(main.className).not.toContain("pb-20");
  });

  it("adds top and bottom padding on mobile when authenticated", () => {
    useIsMobileMock.mockReturnValue(true);
    useAuthMock.mockReturnValue({ user: { id: "u1", username: "Alice" } });
    render(
      <AppLayout>
        <p>Hello</p>
      </AppLayout>
    );
    const main = screen.getByRole("main");
    expect(main.className).toContain("pt-12");
    expect(main.className).toContain("pb-20");
  });

  it("adds extra top padding on mobile when offline (banner + header)", () => {
    useIsMobileMock.mockReturnValue(true);
    useOnlineStatusMock.mockReturnValue(false);
    useAuthMock.mockReturnValue({ user: null });
    render(
      <AppLayout>
        <p>Hello</p>
      </AppLayout>
    );
    const main = screen.getByRole("main");
    expect(main.className).toContain("pt-[5.5rem]");
    expect(main.className).not.toContain("pt-12");
  });
});
