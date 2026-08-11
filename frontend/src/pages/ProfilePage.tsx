import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../contexts/AuthContext";
import { useConfirm } from "../contexts/ConfirmContext";
import type { PreferenceKey, Preferences } from "../types/preferences";
import { useTheme } from "../contexts/ThemeContext";
import InfoTooltip from "../components/common/InfoTooltip";
import { usePageTitle } from "../hooks/usePageTitle";
import { getErrorMessage } from "../config/apiErrors";
import { CARD, SectionEyebrow } from "../components/common/ui";
import DiscordIcon from "../components/common/DiscordIcon";
import { UserIcon, MoonIcon, SunIcon, ShieldIcon } from "../components/common/icons";

const ADMIN_RIGHT_ROWS: { key: PreferenceKey; label: string; tip: string }[] = [
  {
    key: "admin.events",
    label: "Gestion des événements",
    tip: "Créer, modifier, supprimer et purger les événements, gérer les participants et le rôle Discord.",
  },
  {
    key: "admin.tables",
    label: "Modération des tables",
    tip: "Modifier ou supprimer les tables des autres MJ, gérer leurs joueurs et déplacer leurs tables dans le calendrier.",
  },
  {
    key: "admin.games",
    label: "Modération des jeux",
    tip: "Retirer d'un événement des jeux apportés par d'autres participants.",
  },
  {
    key: "admin.kitchen",
    label: "Gestion cuisine",
    tip: "Devenir responsable cuisine : lecture et écriture sur toutes les parties cuisine de tous les événements.",
  },
  {
    key: "admin.courses",
    label: "Gestion courses",
    tip: "Accéder à l'onglet Courses : la liste des ingrédients de tous les repas, avec export Excel.",
  },
];

const BETA_ROWS: { key: PreferenceKey; label: string; tip: string }[] = [
  {
    key: "beta.pdfExport",
    label: "Export PDF",
    tip: "Affiche le bouton d'export PDF du planning (sur ordinateur uniquement).",
  },
  {
    key: "beta.gameDb",
    label: "Gestion de la base de jeux",
    tip: "Affiche le panneau de gestion de la base de jeux : édition, fusion et suppression des jeux.",
  },
];

export default function ProfilePage() {
  usePageTitle("Profil");
  const { user, preferences, updatePreferences, logout, initiateDiscordLogin, unlinkDiscord } =
    useAuth();
  const { theme, toggleTheme } = useTheme();
  const confirmDialog = useConfirm();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  useEffect(() => {
    if (searchParams.get("success") === "discord_linked") {
      toast.success("Compte Discord lié !");
      navigate("/profile", { replace: true });
    }
    if (searchParams.get("error") === "discord_already_linked") {
      toast.error("Ce compte Discord est déjà lié à un autre utilisateur");
      navigate("/profile", { replace: true });
    }
  }, [searchParams, navigate]);

  if (!user) return null;

  const handlePreferenceToggle = async (key: PreferenceKey, value: boolean) => {
    try {
      await updatePreferences({ [key]: value });
    } catch {
      toast.error("Échec de la mise à jour des options");
    }
  };

  const allRightsEnabled = ADMIN_RIGHT_ROWS.every((row) => preferences[row.key]);

  const handleMasterToggle = async () => {
    const enabling = !allRightsEnabled;
    if (enabling) {
      const ok = await confirmDialog({
        title: "Droits d'administration",
        message:
          "Activer tous les droits d'administration ?\n\nLes options Beta ne sont pas concernées.",
        confirmLabel: "Tout activer",
        variant: "warning",
      });
      if (!ok) return;
    }
    try {
      // Derive de ADMIN_RIGHT_ROWS : ajouter un droit admin suffit, le bouton
      // maitre le couvre sans edition supplementaire (les cles beta restent hors).
      await updatePreferences(
        Object.fromEntries(
          ADMIN_RIGHT_ROWS.map((row) => [row.key, enabling])
        ) as Partial<Preferences>
      );
    } catch {
      toast.error("Échec de la mise à jour des options");
    }
  };

  const handleLink = async () => {
    setLinking(true);
    try {
      const completed = await initiateDiscordLogin("/profile");
      // En mode popup : afficher le toast de succes ici (le redirect le gere via searchParams)
      if (completed) toast.success("Compte Discord lié !");
    } catch (err) {
      const errorKey = (err as Error).message;
      if (errorKey === "discord_already_linked") {
        toast.error("Ce compte Discord est déjà lié à un autre utilisateur");
      } else {
        toast.error("Connexion Discord indisponible");
      }
    } finally {
      setLinking(false);
    }
  };

  const handleUnlink = async () => {
    const ok = await confirmDialog({
      title: "Délier Discord",
      message:
        "Délier votre compte Discord ? Vous ne pourrez plus vous connecter avec Discord tant qu'il n'est pas relié.",
      confirmLabel: "Délier",
      variant: "warning",
    });
    if (!ok) return;
    setUnlinking(true);
    try {
      await unlinkDiscord();
      toast.success("Compte Discord délié");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Échec du déliage du compte Discord"));
    } finally {
      setUnlinking(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg p-4 space-y-6">
      <h1 className="font-serif text-2xl font-bold">Profil</h1>

      <div>
        <SectionEyebrow icon={<UserIcon className="w-3.5 h-3.5" />}>Compte</SectionEyebrow>
        <div className={CARD}>
          <div className="card-body p-4">
            <div className="flex items-center gap-3">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="avatar" className="w-10 h-10 rounded-full" />
              ) : (
                <span className="w-10 h-10 rounded-full bg-primary/15 text-primary text-sm font-bold flex items-center justify-center shrink-0">
                  {(user.displayName ?? user.username).slice(0, 2).toUpperCase()}
                </span>
              )}
              <div>
                <p className="font-medium">{user.displayName ?? user.username}</p>
                {user.email && <p className="text-sm opacity-60">{user.email}</p>}
                <span className="badge badge-sm mt-1">{user.role}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <SectionEyebrow icon={<SunIcon className="w-3.5 h-3.5" />}>Apparence</SectionEyebrow>
        <div className={CARD}>
          <div className="card-body p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {theme === "dark" ? (
                  <MoonIcon className="h-5 w-5" />
                ) : (
                  <SunIcon className="h-5 w-5" />
                )}
                <span className="text-sm">{theme === "dark" ? "Mode sombre" : "Mode clair"}</span>
              </div>
              <input
                type="checkbox"
                className="toggle toggle-sm"
                checked={theme === "dark"}
                onChange={toggleTheme}
                aria-label="Activer le mode sombre"
              />
            </div>
          </div>
        </div>
      </div>

      {user.role === "ADMIN" && (
        <div>
          <SectionEyebrow icon={<ShieldIcon className="w-3.5 h-3.5" />}>
            Droits d'administration
          </SectionEyebrow>
          <div className={CARD}>
            <div className="card-body p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium">Activer tous les droits</span>
                  <InfoTooltip text="Active ou désactive d'un coup tous les droits d'administration ci-dessous. Les options Beta ne sont pas concernées." />
                </div>
                <input
                  type="checkbox"
                  className="toggle toggle-sm toggle-primary"
                  checked={allRightsEnabled}
                  onChange={handleMasterToggle}
                  aria-label="Activer tous les droits"
                />
              </div>
              <div className="h-px bg-base-300" />
              {ADMIN_RIGHT_ROWS.map((row) => (
                <div key={row.key} className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <span className="text-sm">{row.label}</span>
                    <InfoTooltip text={row.tip} />
                  </div>
                  <input
                    type="checkbox"
                    className="toggle toggle-sm"
                    checked={preferences[row.key]}
                    onChange={(e) => handlePreferenceToggle(row.key, e.target.checked)}
                    aria-label={row.label}
                  />
                </div>
              ))}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[0.68rem] uppercase tracking-wider font-bold opacity-50">
                  Beta
                </span>
                <div className="h-px flex-1 bg-base-300" />
              </div>
              {BETA_ROWS.map((row) => (
                <div key={row.key} className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <span className="text-sm">{row.label}</span>
                    <span className="badge badge-warning badge-xs">Beta</span>
                    <InfoTooltip text={row.tip} />
                  </div>
                  <input
                    type="checkbox"
                    className="toggle toggle-sm"
                    checked={preferences[row.key]}
                    onChange={(e) => handlePreferenceToggle(row.key, e.target.checked)}
                    aria-label={row.label}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div>
        <SectionEyebrow icon={<DiscordIcon size={14} />}>Discord</SectionEyebrow>
        <div className={CARD}>
          <div className="card-body p-4 space-y-3">
            {user.discordId ? (
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <DiscordIcon size={20} />
                  <span className="text-sm font-medium">{user.discordUsername}</span>
                </div>
                <button
                  className="btn btn-sm btn-outline btn-error"
                  onClick={handleUnlink}
                  disabled={!user.email || unlinking}
                  title={!user.email ? "Impossible de délier : aucun compte local" : undefined}
                >
                  {unlinking && <span className="loading loading-spinner loading-xs" />}
                  Délier
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm opacity-60">Aucun compte Discord lié</p>
                <button
                  className="btn btn-sm btn-outline gap-2"
                  onClick={handleLink}
                  disabled={linking}
                >
                  <DiscordIcon size={16} />
                  Lier un compte Discord
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="md:hidden">
        <button
          className="btn btn-outline btn-error w-full"
          onClick={() => logout().then(() => navigate("/"))}
        >
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
