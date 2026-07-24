// Creneau cuisine rendu dans l'onglet Planning (spec CookV1, section 6).
// Alimente par GET /api/events/:id/kitchen (memes donnees que le board de l'onglet
// Info, enrichies des champs de conflit du moteur unifie).

export interface SlotPerson {
  id: string;
  username: string;
  displayName?: string | null;
}

export interface MealSlot {
  id: string;
  name: string;
  service: "LUNCH" | "DINNER";
  startDateTime: string;
  endDateTime: string;
  maxAssistants: number;
  remainingSeats: number;
  chef: SlotPerson | null;
  assistants: SlotPerson[];
  // Conflits (moteur unifie) : l'utilisateur courant est occupe ailleurs sur ce
  // creneau (chef de ce repas, ou equipier inscrit)
  currentUserConflict: boolean;
  // Nombre de personnes en conflit sur ce repas — destine au chef du repas
  conflictingCount: number;
}
