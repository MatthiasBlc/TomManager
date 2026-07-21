// Mapping code d'erreur backend -> message francais affichable.
// Le backend renvoie { error: { message, status, code? } } : `message` reste en
// anglais (logs/tests), seul `code` est destine a l'affichage via ce mapping.
// Ne JAMAIS afficher le message anglais brut.
export const API_ERROR_MESSAGES: Record<string, string> = {
  // Ressources introuvables
  EVENT_NOT_FOUND: "Événement introuvable",
  TABLE_NOT_FOUND: "Table introuvable",
  BOARD_GAME_NOT_FOUND: "Jeu introuvable",
  USER_NOT_FOUND: "Utilisateur introuvable",
  PARTICIPANT_NOT_FOUND: "Participant introuvable",
  NOTIFICATION_NOT_FOUND: "Notification introuvable",
  NOT_TABLE_PARTICIPANT: "Ce joueur ne participe pas à cette table",
  NOT_EVENT_PARTICIPANT: "Ce participant ne fait pas partie de l'événement",

  // Droits
  FORBIDDEN: "Droits insuffisants",
  ADMIN_REQUIRED: "Accès administrateur requis",
  BOARD_GAME_REMOVE_FORBIDDEN: "Seul le propriétaire ou un admin peut retirer ce jeu",
  INVALID_CREDENTIALS: "Identifiants invalides",

  // Places & inscriptions
  NO_OPEN_SEAT: "Aucune place libre disponible",
  NO_RESERVED_SEAT: "Aucune place réservée disponible",
  ALREADY_TABLE_PARTICIPANT: "Vous participez déjà à cette table",
  ALREADY_ON_WAITLIST: "Ce participant est déjà en liste d'attente",
  SEAT_REQUIRED: "Le type de place est requis",

  // Regles MJ
  GM_CANNOT_JOIN: "Le MJ ne peut pas rejoindre sa propre table",
  GM_CANNOT_BE_KICKED: "Le MJ ne peut pas être retiré de sa propre table",
  GM_CANNOT_WAITLIST: "Le MJ ne peut pas être mis en liste d'attente de sa propre table",
  GM_SEAT_NOT_RESERVABLE: "La place du MJ ne peut pas être une place réservée",
  GM_PLAYER_EXCEEDS_MAX: "Ajouter le MJ comme joueur dépasserait la limite de 20 joueurs",
  GM_PLAYER_NO_SEAT: "Retirer le MJ joueur laisserait la table sans aucune place",

  // Validation
  END_BEFORE_START: "La fin doit être après le début",
  INVALID_START_DATETIME: "Date de début invalide",
  INVALID_END_DATETIME: "Date de fin invalide",
  TABLE_START_OUT_OF_BOUNDS: "Le début de la table doit être dans les dates de l'événement",
  TABLE_END_OUT_OF_BOUNDS: "La fin de la table doit être dans les dates de l'événement",
  MAX_PLAYERS_INVALID: "Le nombre de joueurs max doit être entre 1 et 20",
  RESERVED_SEATS_INVALID: "Nombre de places réservées invalide",
  TITLE_LENGTH: "Le titre doit faire entre 1 et 150 caractères",
  NAME_LENGTH: "Le nom doit faire entre 1 et 100 caractères",
  NAME_REQUIRED: "Le nom est obligatoire",
  PITCH_TOO_LONG: "Le pitch ne doit pas dépasser 2000 caractères",
  TRIGGERS_TOO_LONG: "Les triggers ne doivent pas dépasser 1000 caractères",
  COMMENTS_TOO_LONG: "Les commentaires ne doivent pas dépasser 1000 caractères",

  // Events & jeux
  EVENT_CREATOR_CANNOT_LEAVE: "Le créateur de l'événement ne peut pas le quitter",
  CANNOT_REMOVE_EVENT_CREATOR: "Impossible de retirer le créateur de l'événement",
  BOARD_GAME_DUPLICATE: "Vous avez déjà ajouté ce jeu à cet événement",
  CANNOT_MERGE_SELF: "Impossible de fusionner un jeu avec lui-même",
  DISCORD_ROLE_ALREADY_LINKED: "Ce rôle Discord est déjà lié à un autre événement",

  // Module cuisine
  KITCHEN_MANAGER_REQUIRED: "Droits de responsable cuisine requis",
  CHEF_ROLE_MODE_ACTIVE: "Le roster des chefs est géré par le rôle Discord",
  ALREADY_CHEF: "Cette personne est déjà chef",
  NOT_IN_CHEF_ROSTER: "Cette personne n'est pas dans la liste des chefs",
  ALREADY_COURSES_MEMBER: "Cette personne est déjà dans l'équipe courses",
  NOT_COURSES_MEMBER: "Cette personne n'est pas dans l'équipe courses",
  ROLE_EXCLUSIVITY: "Cette personne a déjà un rôle cuisine incompatible",
  MEAL_ALREADY_EXISTS: "Cette personne a déjà un repas",
  MEAL_FULL: "Ce repas est complet",
  ALLERGIES_TOO_LONG: "Le texte des allergies ne doit pas dépasser 5000 caractères",
  MEAL_NOT_FOUND: "Repas introuvable",
  MEAL_NOT_ORPHAN: "Ce repas a déjà un chef",
  ALREADY_MEAL_ASSISTANT: "Vous êtes déjà inscrit à ce repas",
  NOT_MEAL_ASSISTANT: "Vous n'êtes pas inscrit à ce repas",
  MEAL_START_OUT_OF_BOUNDS: "Le début du repas doit être dans les dates de l'événement",
  MEAL_END_OUT_OF_BOUNDS: "La fin du repas doit être dans les dates de l'événement",
};

interface ApiErrorShape {
  response?: { data?: { error?: { code?: string; message?: string } } };
}

// Extrait un message affichable d'une erreur API : code connu -> francais,
// sinon le fallback fourni par le call site (jamais le message anglais brut).
export function getErrorMessage(err: unknown, fallback: string): string {
  const code = (err as ApiErrorShape)?.response?.data?.error?.code;
  if (code && API_ERROR_MESSAGES[code]) return API_ERROR_MESSAGES[code];
  return fallback;
}
