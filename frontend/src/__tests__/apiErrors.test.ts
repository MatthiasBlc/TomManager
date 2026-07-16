import { getErrorMessage, API_ERROR_MESSAGES } from "../config/apiErrors";

function apiError(code?: string, message?: string) {
  return { response: { data: { error: { code, message, status: 400 } } } };
}

describe("getErrorMessage", () => {
  it("maps a known code to its French message", () => {
    expect(getErrorMessage(apiError("NO_OPEN_SEAT", "No open seat available"), "fallback")).toBe(
      "Aucune place libre disponible"
    );
  });

  it("returns the fallback for an unknown code (never the raw English message)", () => {
    expect(getErrorMessage(apiError("SOME_NEW_CODE", "Raw english message"), "Échec")).toBe(
      "Échec"
    );
  });

  it("returns the fallback when the error has no code", () => {
    expect(getErrorMessage(apiError(undefined, "Table not found"), "Échec du chargement")).toBe(
      "Échec du chargement"
    );
  });

  it("returns the fallback when there is no response at all", () => {
    expect(getErrorMessage(new Error("network"), "Hors ligne")).toBe("Hors ligne");
  });

  it("has an accented French message for every code", () => {
    for (const [code, message] of Object.entries(API_ERROR_MESSAGES)) {
      expect(message.length, code).toBeGreaterThan(0);
      // Pas de message anglais brut : chaque entree doit etre redigee en francais
      expect(message).not.toMatch(/not found|must be|cannot/i);
    }
  });
});
