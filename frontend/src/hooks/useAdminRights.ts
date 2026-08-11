import { useAuth } from "../contexts/AuthContext";
import { DEFAULT_PREFERENCES } from "../types/preferences";

// Droits admin opt-in : le role ADMIN ne suffit pas, l'admin doit activer
// chaque droit dans ses parametres (toggles stockes en DB via /api/me/preferences).
export function useAdminRights() {
  const { user, preferences } = useAuth();
  const prefs = preferences ?? DEFAULT_PREFERENCES;
  const isAdmin = user?.role === "ADMIN";

  return {
    isAdmin,
    canManageEvents: isAdmin && prefs["admin.events"],
    canModerateTables: isAdmin && prefs["admin.tables"],
    canModerateGames: isAdmin && prefs["admin.games"],
    isKitchenManager: isAdmin && prefs["admin.kitchen"],
    // Onglet Courses : droit autonome, jamais derive de admin.kitchen (cf spec
    // KitchenCourses 2.2). Un membre de l'equipe courses y accede sans etre admin.
    canManageCourses: isAdmin && prefs["admin.courses"],
    pdfExportEnabled: isAdmin && prefs["beta.pdfExport"],
    gameDbEnabled: isAdmin && prefs["beta.gameDb"],
  };
}
