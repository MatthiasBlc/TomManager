// Preferences utilisateur (toggles admin/beta) — miroir de la liste blanche backend
export type PreferenceKey =
  | "admin.events"
  | "admin.tables"
  | "admin.games"
  | "admin.kitchen"
  | "admin.courses"
  | "beta.pdfExport"
  | "beta.gameDb";

export type Preferences = Record<PreferenceKey, boolean>;

export const DEFAULT_PREFERENCES: Preferences = {
  "admin.events": false,
  "admin.tables": false,
  "admin.games": false,
  "admin.kitchen": false,
  "admin.courses": false,
  "beta.pdfExport": false,
  "beta.gameDb": false,
};
