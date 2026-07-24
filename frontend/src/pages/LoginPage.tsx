import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../config/api";
import { useAuth } from "../contexts/AuthContext";
import { DISCORD_ERROR_MESSAGES } from "../config/discordErrors";
import DiscordIcon from "../components/common/DiscordIcon";
import { usePageTitle } from "../hooks/usePageTitle";
import { CARD } from "../components/common/ui";

export default function LoginPage() {
  usePageTitle("Connexion");
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
    <div
      className="relative flex min-h-[calc(100dvh-3rem)] md:min-h-screen items-center justify-center overflow-hidden bg-base-200 px-4"
      style={{
        backgroundImage:
          "radial-gradient(circle at 50% 35%, oklch(from var(--color-primary) l c h / 0.12), transparent 60%)",
      }}
    >
      <div className={`relative w-full sm:max-w-sm ${CARD}`}>
        <div className="card-body items-center text-center">
          <h2 className="font-serif text-xl font-semibold">Connexion</h2>

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
