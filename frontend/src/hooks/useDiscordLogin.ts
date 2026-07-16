import { useState } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../contexts/AuthContext";
import { DISCORD_ERROR_MESSAGES } from "../config/discordErrors";

// Login Discord en un clic (HomePage, Navbar, ...) : lance l'OAuth directement,
// gere les erreurs du flux popup et l'indisponibilite du service (503).
export function useDiscordLogin(returnTo = "/") {
  const { initiateDiscordLogin } = useAuth();
  const [connecting, setConnecting] = useState(false);
  const [discordAvailable, setDiscordAvailable] = useState(true);

  const login = async () => {
    setConnecting(true);
    try {
      await initiateDiscordLogin(returnTo);
      // Popup : succes -> checkAuth met user a jour et les pages redirigent.
      // Redirect : la page navigue, on n'arrive jamais ici.
    } catch (err) {
      if ((err as { response?: { status?: number } })?.response?.status === 503) {
        setDiscordAvailable(false);
        toast.error("La connexion est momentanément indisponible");
      } else {
        const errorKey = (err as Error).message;
        toast.error(DISCORD_ERROR_MESSAGES[errorKey] ?? "Connexion Discord indisponible");
      }
    } finally {
      setConnecting(false);
    }
  };

  return { login, connecting, discordAvailable };
}
