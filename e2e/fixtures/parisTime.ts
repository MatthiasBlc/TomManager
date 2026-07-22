/**
 * Port minimal de backend/src/util/timezone.ts (meme algorithme, meme double
 * passe pour les bascules DST), duplique volontairement ici : les tests e2e
 * tournent EN LOCAL (pas dans Docker) et ne partagent pas de module avec le
 * backend/frontend. Sert a construire des instants UTC a partir d'une heure
 * murale Paris connue, independamment du fuseau de la machine qui execute
 * Playwright — indispensable pour le test de regression fuseau non-Paris
 * (cf docs/features/ParisTimezone).
 */

const PARIS_TZ = "Europe/Paris";

function getZoneOffsetMs(date: Date, timeZone: string): number {
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

export function parisWallClockToUtcIso(
  y: number,
  mo: number,
  d: number,
  h: number,
  min: number
): string {
  const utcGuess = Date.UTC(y, mo - 1, d, h, min, 0);
  const firstOffset = getZoneOffsetMs(new Date(utcGuess), PARIS_TZ);
  const candidate = utcGuess - firstOffset;
  const offset = getZoneOffsetMs(new Date(candidate), PARIS_TZ);
  return new Date(utcGuess - offset).toISOString();
}

export function parisWallClockHourMinute(iso: string): { h: number; min: number } {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: PARIS_TZ,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = dtf.formatToParts(new Date(iso));
  const m: Record<string, number> = {};
  for (const p of parts) if (p.type !== "literal") m[p.type] = Number(p.value);
  return { h: m.hour, min: m.minute };
}
