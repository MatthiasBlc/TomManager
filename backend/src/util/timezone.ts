// Fuseau de reference de l'app : franco-centree, toute heure saisie/affichee
// signifie "heure de Paris", jamais le fuseau ambiant du serveur/navigateur.
// Extrait de services/kitchenPlanning.ts (deja teste DST) pour partage avec le
// reste du backend (cf docs/features/ParisTimezone/SPEC_PARIS_TIMEZONE.md).
export const TZ = "Europe/Paris";

// Decalage (ms) entre `timeZone` et UTC a l'instant `date`.
export function getZoneOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(date);
  const m: Record<string, number> = {};
  for (const p of parts) if (p.type !== "literal") m[p.type] = Number(p.value);
  const asUTC = Date.UTC(m.year, m.month - 1, m.day, m.hour, m.minute, m.second);
  return asUTC - date.getTime();
}

// Convertit une heure murale (y, m, d, h, min) exprimee dans `timeZone` en instant UTC.
// Double passe : une premiere estimation d'offset (a l'instant devine) peut tomber du
// mauvais cote d'une bascule DST si l'heure murale demandee coincide numeriquement
// avec l'heure de bascule (ex: 01h-03h autour des bascules Europe/Paris) ; on
// reinterroge l'offset a l'instant candidat obtenu pour corriger ce cas. N'a aucun
// effet hors de cette fenetre (les deux passes donnent alors le meme offset), donc
// aucun changement pour les heures de repas (10h30/18h30), loin de toute bascule.
export function zonedWallClockToUtc(
  y: number,
  mo: number,
  d: number,
  h: number,
  min: number,
  timeZone: string
): Date {
  const utcGuess = Date.UTC(y, mo - 1, d, h, min, 0);
  const firstOffset = getZoneOffsetMs(new Date(utcGuess), timeZone);
  const candidate = utcGuess - firstOffset;
  const offset = getZoneOffsetMs(new Date(candidate), timeZone);
  return new Date(utcGuess - offset);
}

// Annee/mois/jour calendaires de `date` dans `timeZone`.
export function zonedYMD(date: Date, timeZone: string): { y: number; mo: number; d: number } {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [y, mo, d] = dtf.format(date).split("-").map(Number);
  return { y, mo, d };
}
