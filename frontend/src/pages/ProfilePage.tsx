import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { usePdfExport } from "../hooks/usePdfExport";
import { useGameDbManagement } from "../hooks/useGameDbManagement";

export default function ProfilePage() {
  const { user, logout, initiateDiscordLogin, unlinkDiscord } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { pdfExportEnabled, togglePdfExport } = usePdfExport();
  const { gameDbEnabled, toggleGameDb } = useGameDbManagement();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (searchParams.get("success") === "discord_linked") {
      toast.success("Discord account linked!");
      navigate("/profile", { replace: true });
    }
    if (searchParams.get("error") === "discord_already_linked") {
      toast.error("This Discord account is already linked to another user");
      navigate("/profile", { replace: true });
    }
  }, [searchParams, navigate]);

  if (!user) return null;

  const handleLink = async () => {
    try {
      const completed = await initiateDiscordLogin("/profile");
      // En mode popup : afficher le toast de succes ici (le redirect le gere via searchParams)
      if (completed) toast.success("Discord account linked!");
    } catch (err) {
      const errorKey = (err as Error).message;
      if (errorKey === "discord_already_linked") {
        toast.error("This Discord account is already linked to another user");
      } else {
        toast.error("Discord login unavailable");
      }
    }
  };

  const handleUnlink = async () => {
    try {
      await unlinkDiscord();
      toast.success("Discord account unlinked");
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || "Failed to unlink Discord";
      toast.error(message);
    }
  };

  return (
    <div className="mx-auto max-w-lg p-4 space-y-6">
      <h1 className="text-2xl font-bold">Profile</h1>

      <div className="card bg-base-100 shadow">
        <div className="card-body space-y-2">
          <h2 className="card-title text-base">Account</h2>
          <div className="flex items-center gap-3">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="avatar" className="w-10 h-10 rounded-full" />
            ) : (
              <div className="avatar placeholder">
                <div className="bg-neutral text-neutral-content rounded-full w-10">
                  <span className="text-sm">{user.username.slice(0, 2).toUpperCase()}</span>
                </div>
              </div>
            )}
            <div>
              <p className="font-medium">{user.username}</p>
              {user.email && <p className="text-sm opacity-60">{user.email}</p>}
              <span className="badge badge-sm">{user.role}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <h2 className="card-title text-base">Appearance</h2>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {theme === "dark" ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
                  />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z"
                  />
                </svg>
              )}
              <span className="text-sm">{theme === "dark" ? "Dark mode" : "Light mode"}</span>
            </div>
            <input
              type="checkbox"
              className="toggle toggle-sm"
              checked={theme === "light"}
              onChange={toggleTheme}
              aria-label="Toggle theme"
            />
          </div>
        </div>
      </div>

      {user.role === "ADMIN" && (
        <>
          <div className="card bg-base-100 shadow">
            <div className="card-body space-y-3">
              <h2 className="card-title text-base">Options admin avancees</h2>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm">Activer export PDF</span>
                  <span className="badge badge-warning badge-xs ml-2">Beta</span>
                </div>
                <input
                  type="checkbox"
                  className="toggle toggle-sm"
                  checked={pdfExportEnabled}
                  onChange={togglePdfExport}
                  aria-label="Activer export PDF"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm">Activer la gestion des jeux</span>
                  <span className="badge badge-warning badge-xs ml-2">Beta</span>
                </div>
                <input
                  type="checkbox"
                  className="toggle toggle-sm"
                  checked={gameDbEnabled}
                  onChange={toggleGameDb}
                  aria-label="Activer la gestion des jeux"
                />
              </div>
            </div>
          </div>
        </>
      )}

      <div className="card bg-base-100 shadow">
        <div className="card-body space-y-3">
          <h2 className="card-title text-base">Discord</h2>

          {user.discordId ? (
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 127.14 96.36"
                  fill="currentColor"
                  className="opacity-70"
                >
                  <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
                </svg>
                <span className="text-sm font-medium">{user.discordUsername}</span>
              </div>
              <button
                className="btn btn-sm btn-outline btn-error"
                onClick={handleUnlink}
                disabled={!user.email}
                title={!user.email ? "Cannot unlink: no local account" : undefined}
              >
                Unlink
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm opacity-60">No Discord account linked</p>
              <button className="btn btn-sm btn-outline gap-2" onClick={handleLink}>
                <svg width="16" height="16" viewBox="0 0 127.14 96.36" fill="currentColor">
                  <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
                </svg>
                Link Discord account
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="md:hidden">
        <button
          className="btn btn-outline btn-error w-full"
          onClick={() => logout().then(() => navigate("/"))}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
