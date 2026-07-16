import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../config/api";
import { useAuth } from "../contexts/AuthContext";

const DISCORD_ERROR_MESSAGES: Record<string, string> = {
  discord_denied: "Connexion Discord annulée",
  invalid_state: "Session expirée, veuillez réessayer",
  not_in_guild: "Vous devez être membre du serveur Discord",
  account_disabled: "Ce compte a été désactivé",
  discord_token_exchange: "Échec de l'authentification Discord, veuillez réessayer",
};

export default function LoginPage() {
  const { user, loading, initiateDiscordLogin } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [discordAvailable, setDiscordAvailable] = useState(true);
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/events";

  const redirectAfterLogin = async (destination: string) => {
    try {
      const res = await api.get("/api/events");
      const events = res.data.data;
      if (events.length === 1) {
        navigate(`/events/${events[0].id}`, { replace: true });
        return;
      }
    } catch {
      // en cas d'erreur on redirige normalement
    }
    navigate(destination, { replace: true });
  };

  useEffect(() => {
    if (!loading && user) {
      redirectAfterLogin(from);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading]);

  useEffect(() => {
    const error = searchParams.get("error");
    if (error && DISCORD_ERROR_MESSAGES[error]) {
      toast.error(DISCORD_ERROR_MESSAGES[error]);
    }
  }, [searchParams]);

  useEffect(() => {
    api.get("/api/auth/discord").catch((err) => {
      if (err?.response?.status === 503) setDiscordAvailable(false);
    });
  }, []);

  const handleDiscordLogin = async () => {
    try {
      await initiateDiscordLogin(from);
      // Si popup : l'utilisateur a annule silencieusement, rien a faire
      // Si redirect : la page navigue, on n'arrive jamais ici
    } catch (err) {
      const errorKey = (err as Error).message;
      const message = DISCORD_ERROR_MESSAGES[errorKey] ?? "Connexion Discord indisponible";
      toast.error(message);
    }
  };

  return (
    <div className="flex min-h-[calc(100dvh-3rem)] md:min-h-screen items-center justify-center bg-base-200 px-4">
      <div className="card w-full bg-base-100 shadow-xl sm:max-w-sm">
        <div className="card-body">
          <h2 className="card-title justify-center">Connexion</h2>

          {discordAvailable ? (
            <button
              type="button"
              className="btn btn-primary btn-block gap-2"
              onClick={handleDiscordLogin}
            >
              <svg width="20" height="20" viewBox="0 0 127.14 96.36" fill="currentColor">
                <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
              </svg>
              Se connecter avec Discord
            </button>
          ) : (
            <p className="text-center text-sm opacity-70">
              La connexion est momentanément indisponible. Contactez un administrateur.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
