import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../config/api";
import { useAuth } from "../contexts/AuthContext";
import { DISCORD_ERROR_MESSAGES } from "../config/discordErrors";
import DiscordIcon from "../components/common/DiscordIcon";

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
              <DiscordIcon />
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
