import { formatParisDate } from "../../utils/dateTime";

export const UNIT_OPTIONS = [
  { value: "G", label: "g" },
  { value: "KG", label: "kg" },
  { value: "ML", label: "ml" },
  { value: "CL", label: "cl" },
  { value: "L", label: "L" },
  { value: "CAS", label: "càs" },
  { value: "CAC", label: "càc" },
  { value: "PIECE", label: "pièce(s)" },
] as const;

export type Unit = (typeof UNIT_OPTIONS)[number]["value"];

export function unitLabel(unit: string): string {
  return UNIT_OPTIONS.find((u) => u.value === unit)?.label ?? unit;
}

export const SERVICE_OPTIONS = [
  { value: "LUNCH", label: "Midi" },
  { value: "DINNER", label: "Soir" },
] as const;

export function serviceLabel(service: string): string {
  return SERVICE_OPTIONS.find((s) => s.value === service)?.label ?? service;
}

export const SERVICE_ICONS: Record<string, string> = { LUNCH: "☀️", DINNER: "🌙" };

// Libelle de jour pour regrouper les creneaux repas (ex: "samedi 1 aout"), toujours
// en heure de Paris (cf frontend/src/utils/dateTime.ts).
export function dayLabel(iso: string): string {
  return formatParisDate(iso, { weekday: "long", day: "numeric", month: "long" });
}

// Libelle de creneau non-editable pour la liste Admin Chef (ex: "Dîner - vendredi") :
// identifie la fiche sans exposer de champ jour/debut/fin editable (spec CookV1 5).
export function slotLabel(meal: { service: string; startDateTime: string }): string {
  const weekday = formatParisDate(meal.startDateTime, { weekday: "long" });
  return `${serviceLabel(meal.service)} - ${weekday}`;
}
