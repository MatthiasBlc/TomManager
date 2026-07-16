import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useAdminRights } from "../hooks/useAdminRights";
import { useDiscordLogin } from "../hooks/useDiscordLogin";
import api from "../config/api";
import DiscordIcon from "../components/common/DiscordIcon";

export default function HomePage() {
  const { user, loading } = useAuth();
  const { canManageEvents } = useAdminRights();
  const navigate = useNavigate();
  // Login en un clic : OAuth Discord lance directement depuis la home.
  // /login reste la cible des redirections d'erreur du callback OAuth.
  const { login, connecting, discordAvailable } = useDiscordLogin("/");

  useEffect(() => {
    if (loading || !user) return;

    const redirect = async () => {
      // Un utilisateur qui ne gere pas les evenements (membre, ou admin sans
      // le toggle de gestion) n'a qu'a voir ses propres evenements : s'il n'y
      // en a qu'un, autant y aller directement plutot que de passer par la liste.
      if (!canManageEvents) {
        try {
          const res = await api.get("/api/events?mine=true");
          const events = res.data.data as { id: string }[];
          if (events.length === 1) {
            navigate(`/events/${events[0].id}`, { replace: true });
            return;
          }
        } catch {
          // en cas d'erreur on redirige normalement vers la liste
        }
      }
      navigate("/events", { replace: true });
    };

    redirect();
  }, [user, loading, canManageEvents, navigate]);

  return (
    /* calc(100dvh - 3rem) : hauteur visible sous le header mobile (dvh evite le
       decalage du 100vh iOS avec la barre d'adresse) */
    <div className="hero min-h-[calc(100dvh-3rem)] md:min-h-screen bg-base-200">
      <div className="hero-content text-center px-4">
        <div className="max-w-md">
          <h1 className="text-2xl font-bold md:text-5xl">TomManager</h1>
          <p className="py-4 text-sm md:py-6 md:text-base">
            Organisez vos soirées jeux : événements, tables de jeu de rôle et de société,
            inscriptions et listes d'attente.
          </p>
          {discordAvailable ? (
            <button
              type="button"
              className="btn btn-primary btn-block sm:btn-wide gap-2"
              onClick={login}
              disabled={connecting}
            >
              {connecting ? (
                <span className="loading loading-spinner loading-sm" />
              ) : (
                <DiscordIcon />
              )}
              Se connecter avec Discord
            </button>
          ) : (
            <p className="text-sm opacity-70">
              La connexion est momentanément indisponible. Contactez un administrateur.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
