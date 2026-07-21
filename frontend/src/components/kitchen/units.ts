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
