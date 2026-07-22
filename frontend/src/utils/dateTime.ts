// Toute l'application raisonne en heure de Paris (memes conventions cote backend,
// cf backend/src/services/kitchenPlanning.ts) : un horaire saisi ou affiche quelque
// part signifie toujours "heure de Paris", jamais le fuseau du navigateur qui
// l'affiche. `timeZone` est donc toujours fixe explicitement, jamais laisse a
// l'ambiant du systeme/navigateur.
const PARIS_TZ = "Europe/Paris";

export function formatParisDate(iso: string, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(iso).toLocaleDateString("fr-FR", { timeZone: PARIS_TZ, ...opts });
}

export function formatParisTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    timeZone: PARIS_TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatParisDateTime(iso: string, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(iso).toLocaleString("fr-FR", { timeZone: PARIS_TZ, ...opts });
}

// Cle de jour calendaire Europe/Paris (tri/regroupement), independante du fuseau
// serveur/navigateur.
export function parisDayKey(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: PARIS_TZ });
}

// --- Conversions heure murale Paris <-> instant UTC reel ---------------------
// Port direct des fonctions equivalentes de backend/src/util/timezone.ts (pas de
// mecanisme de partage frontend/backend dans ce repo : duplication volontaire et
// minimale). Cf docs/features/ParisTimezone/SPEC_PARIS_TIMEZONE.md.

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

// Convertit une heure murale (y, mo, d, h, min) exprimee dans `timeZone` en instant UTC.
// Double passe : corrige le cas ou l'heure murale demandee coincide numeriquement
// avec l'heure d'une bascule DST (ex: 01h-03h autour des bascules Europe/Paris), ou
// une estimation en une seule passe tomberait du mauvais cote. Port direct de
// backend/src/util/timezone.ts (meme algorithme).
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

// Y/M/D/H/Min vus depuis Paris pour un instant UTC donne (brique commune aux
// helpers d'input ci-dessous), via un seul Intl.DateTimeFormat + formatToParts.
export function parisWallClockParts(iso: string): {
  y: number;
  mo: number;
  d: number;
  h: number;
  min: number;
} {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: PARIS_TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = dtf.formatToParts(new Date(iso));
  const m: Record<string, number> = {};
  for (const p of parts) if (p.type !== "literal") m[p.type] = Number(p.value);
  return { y: m.year, mo: m.month, d: m.day, h: m.hour, min: m.minute };
}

// Valeur pour un input `date` (`YYYY-MM-DD`), en heure de Paris.
export function parisDateInputValue(iso: string): string {
  return parisDayKey(iso);
}

// Valeur pour un input `time` (`HH:MM`), en heure de Paris.
export function parisTimeInputValue(iso: string): string {
  const { h, min } = parisWallClockParts(iso);
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

// Valeur pour un input `datetime-local` (`YYYY-MM-DDTHH:MM`), en heure de Paris.
export function parisDateTimeInputValue(iso: string): string {
  return `${parisDateInputValue(iso)}T${parisTimeInputValue(iso)}`;
}

// Heure murale Paris (y, mo, d, h, min) -> ISO UTC reel.
export function parisWallClockToUtcIso(
  y: number,
  mo: number,
  d: number,
  h: number,
  min: number
): string {
  return zonedWallClockToUtc(y, mo, d, h, min, PARIS_TZ).toISOString();
}

// Parse une valeur brute d'input `datetime-local` (`YYYY-MM-DDTHH:MM`), interpretee
// comme heure de Paris, et retourne l'ISO UTC correct. Remplace
// `new Date(value).toISOString()` (qui interpretait `value` dans le fuseau ambiant
// du navigateur).
export function dateTimeLocalToParisUtcIso(value: string): string {
  const [datePart, timePart] = value.split("T");
  const [y, mo, d] = datePart.split("-").map(Number);
  const [h, min] = timePart.split(":").map(Number);
  return parisWallClockToUtcIso(y, mo, d, h, min);
}

// Meme conversion pour des inputs `date` + `time` separes (`YYYY-MM-DD` / `HH:MM`).
export function dateAndTimeToParisUtcIso(dateStr: string, timeStr: string): string {
  return dateTimeLocalToParisUtcIso(`${dateStr}T${timeStr}`);
}

// --- "Fake UTC" pour FullCalendar (timeZone="UTC") ---------------------------
// FullCalendar (sans le plugin moment-timezone) ne supporte nativement que
// timeZone="local" ou "UTC". On le configure en "UTC" et on lui donne des Date
// dont les GETTERS UTC valent l'heure murale de Paris ("fake UTC"), de facon a
// ce que son rendu/interactions (drag, resize, now) affichent l'heure de Paris
// sans jamais dependre du fuseau du navigateur.

// Instant reel -> Date "fake UTC" (getters UTC = heure murale Paris).
export function toParisFakeUtc(iso: string): Date {
  const { y, mo, d, h, min } = parisWallClockParts(iso);
  const seconds = new Date(iso).getUTCSeconds();
  return new Date(Date.UTC(y, mo - 1, d, h, min, seconds));
}

// Inverse de `toParisFakeUtc` : lit les getters **UTC** (jamais locaux) d'un Date
// "fake UTC" renvoye par FullCalendar, et retourne l'ISO UTC reel correspondant.
export function fromParisFakeUtc(fakeDate: Date): string {
  return parisWallClockToUtcIso(
    fakeDate.getUTCFullYear(),
    fakeDate.getUTCMonth() + 1,
    fakeDate.getUTCDate(),
    fakeDate.getUTCHours(),
    fakeDate.getUTCMinutes()
  );
}

// "Maintenant" en fake-UTC, pour piloter le `now` de FullCalendar.
export function parisFakeUtcNow(): Date {
  return toParisFakeUtc(new Date().toISOString());
}

// Formatte un Date "fake UTC" en forcant timeZone: "UTC" explicitement (evite un
// double-decalage si utilise par erreur avec formatParisDate/DateTime, qui
// reappliqueraient le decalage Paris sur une date deja "fake Paris-as-UTC").
export function formatFakeUtcDate(fakeDate: Date, opts?: Intl.DateTimeFormatOptions): string {
  return fakeDate.toLocaleDateString("fr-FR", { timeZone: "UTC", ...opts });
}
