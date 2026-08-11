import { z } from "zod";

// Liste blanche des cles de preferences.
// Les cles admin.* et beta.* sont reservees aux utilisateurs ADMIN.
export const PREFERENCE_KEYS = [
  "admin.events",
  "admin.tables",
  "admin.games",
  "admin.kitchen",
  "admin.courses",
  "beta.pdfExport",
  "beta.gameDb",
] as const;

export type PreferenceKey = (typeof PREFERENCE_KEYS)[number];

export const updatePreferencesSchema = z
  .partialRecord(z.enum(PREFERENCE_KEYS), z.boolean())
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "At least one preference is required",
  });
