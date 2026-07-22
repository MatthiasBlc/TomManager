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
