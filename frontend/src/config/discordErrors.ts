// Messages utilisateur pour les erreurs du flux OAuth Discord.
// Partage entre HomePage (login direct) et LoginPage (redirect ?error=...).
export const DISCORD_ERROR_MESSAGES: Record<string, string> = {
  discord_denied: "Connexion Discord annulée",
  invalid_state: "Session expirée, veuillez réessayer",
  not_in_guild: "Vous devez être membre du serveur Discord",
  account_disabled: "Ce compte a été désactivé",
  discord_token_exchange: "Échec de l'authentification Discord, veuillez réessayer",
};
