import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import api from "../../config/api";
import { useConfirm } from "../../contexts/ConfirmContext";
import { getErrorMessage } from "../../config/apiErrors";
import { GearIcon } from "./icons";

interface Props {
  eventId: string;
  chefRoleId: string | null;
  onChanged: () => void;
}

// Reglage ID du role Discord des chefs, en icone engrenage dans l'en-tete de la
// page (maquette Cuisine) plutot qu'un formulaire de config permanent.
export default function ChefRoleSettings({ eventId, chefRoleId, onChanged }: Props) {
  const confirmDialog = useConfirm();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(chefRoleId ?? "");
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const openPopover = () => {
    setDraft(chefRoleId ?? "");
    setOpen(true);
  };

  const handleSave = async () => {
    const next = draft.trim() || null;
    if (next && next !== chefRoleId) {
      const ok = await confirmDialog({
        title: "Activer le mode rôle Discord",
        message:
          "Les chefs ajoutés manuellement seront remplacés par les membres du rôle Discord. Leurs repas éventuels deviendront orphelins (conservés, à réassigner).",
        confirmLabel: "Activer",
        variant: "warning",
      });
      if (!ok) return;
    }
    setSaving(true);
    try {
      await api.patch(`/api/events/${eventId}/kitchen`, { chefRoleId: next });
      toast.success("Configuration mise à jour");
      setOpen(false);
      onChanged();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Échec de la mise à jour de la configuration"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="btn btn-ghost btn-square btn-sm"
        onClick={() => (open ? setOpen(false) : openPopover())}
        aria-label="Paramètres cuisine"
        aria-haspopup="true"
        aria-expanded={open}
        title="Paramètres"
      >
        <GearIcon />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 z-20 w-72 card bg-base-100 shadow-lg border border-base-300">
          <div className="card-body p-3 space-y-2">
            <label className="label-text text-xs font-medium" htmlFor="chef-role-id">
              ID du rôle Discord des chefs
            </label>
            <input
              id="chef-role-id"
              type="text"
              className="input input-bordered input-sm w-full"
              placeholder="Snowflake Discord"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <p className="text-xs opacity-60">Laisser vide pour attribuer les rôles à la main.</p>
            <div className="flex justify-end">
              <button
                type="button"
                className="btn btn-primary btn-xs"
                disabled={saving}
                onClick={handleSave}
              >
                {saving && <span className="loading loading-spinner loading-xs" />}
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
