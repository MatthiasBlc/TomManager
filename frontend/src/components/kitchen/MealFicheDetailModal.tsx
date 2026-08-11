import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "../../config/api";
import { getErrorMessage } from "../../config/apiErrors";
import ResponsiveModal from "../common/ResponsiveModal";
import IngredientListInput, { type IngredientRow } from "./IngredientListInput";
import UtensilListInput from "./UtensilListInput";
import { slotLabel, unitLabel } from "./units";
import type { MealFiche } from "./MealFichesList";

interface Props {
  eventId: string;
  meal: MealFiche | null;
  onClose: () => void;
  onChanged: () => void;
}

const displayedName = (u: { username: string; displayName?: string | null }) =>
  u.displayName ?? u.username;

const toIngredientRows = (ingredients: MealFiche["ingredients"]): IngredientRow[] =>
  (ingredients ?? []).map((i) => ({
    name: i.name,
    quantity: Number(i.quantity),
    unit: i.unit as IngredientRow["unit"],
    note: i.note ?? "",
  }));

// Modale "details" de la fiche (spec CookV1 5) : lecture seule par defaut, ne porte
// que sur le nom du plat + ingredients + ustensiles (chef/capacite/equipiers
// s'editent directement sur la ligne de liste, cf MealFichesList). "Modifier" passe
// en edition locale ; "Valider" fait un seul PATCH group puis ferme la modale
// (contrairement au pattern auto-save de MealFicheEditor).
export default function MealFicheDetailModal({ eventId, meal, onClose, onChanged }: Props) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [ingredients, setIngredients] = useState<IngredientRow[]>([]);
  const [utensils, setUtensils] = useState<string[]>([]);

  useEffect(() => {
    if (!meal) return;
    setEditing(false);
    setName(meal.name);
    setIngredients(toIngredientRows(meal.ingredients));
    setUtensils((meal.utensils ?? []).map((u) => u.name));
  }, [meal]);

  if (!meal) return null;

  const handleValidate = async () => {
    setSaving(true);
    try {
      await api.patch(`/api/events/${eventId}/kitchen/meals/${meal.id}`, {
        name,
        ingredients: ingredients
          .filter((i) => i.name.trim())
          .map((i) => ({
            name: i.name.trim(),
            quantity: Number(i.quantity),
            unit: i.unit,
            note: i.note?.trim() || null,
          })),
        utensils: utensils.map((n) => ({ name: n })),
      });
      toast.success("Fiche mise à jour");
      onChanged();
      onClose();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Échec de l'enregistrement"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ResponsiveModal open={!!meal} onClose={onClose} title={slotLabel(meal)} size="lg">
      <div className="space-y-4 pt-3">
        {editing ? (
          <>
            <div className="form-control">
              <label className="label py-1" htmlFor={`mfd-name-${meal.id}`}>
                <span className="label-text">Nom du plat</span>
              </label>
              <input
                id={`mfd-name-${meal.id}`}
                type="text"
                className="input input-bordered input-sm w-full"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="form-control">
              <label className="label py-1">
                <span className="label-text">Ingrédients</span>
              </label>
              <IngredientListInput value={ingredients} onChange={setIngredients} />
            </div>
            <div className="form-control">
              <label className="label py-1">
                <span className="label-text">Ustensiles spécifiques</span>
              </label>
              <UtensilListInput value={utensils} onChange={setUtensils} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                className="btn btn-ghost btn-sm"
                disabled={saving}
                onClick={() => setEditing(false)}
              >
                Annuler
              </button>
              <button className="btn btn-primary btn-sm" disabled={saving} onClick={handleValidate}>
                {saving && <span className="loading loading-spinner loading-xs" />}
                Valider
              </button>
            </div>
          </>
        ) : (
          <>
            <div>
              <h4 className="font-semibold text-sm">Plat</h4>
              <p className="text-sm">{meal.name || "Non renseigné"}</p>
            </div>
            <div>
              <h4 className="font-semibold text-sm">Chef</h4>
              <p className="text-sm">{meal.chef ? displayedName(meal.chef) : "Aucun"}</p>
            </div>
            <div>
              <h4 className="font-semibold text-sm">Capacité</h4>
              <p className="text-sm">
                {meal.assistants.length}/{meal.maxAssistants}
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-sm">Équipiers</h4>
              <p className="text-sm">
                {meal.assistants.length > 0
                  ? meal.assistants.map(displayedName).join(", ")
                  : "Aucun"}
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-sm">Ingrédients</h4>
              {meal.ingredients && meal.ingredients.length > 0 ? (
                <ul className="text-sm list-disc list-inside space-y-0.5">
                  {meal.ingredients.map((i, idx) => (
                    <li key={idx}>
                      {i.quantity} {unitLabel(i.unit)} {i.name}
                      {/* Le commentaire est destine a l'equipe courses : affiche sous
                          la ligne, jamais tronque (les precisions du chef peuvent
                          etre longues, ex. une alternative de format ou de variete). */}
                      {i.note && (
                        <span className="block pl-5 text-xs italic opacity-70">{i.note}</span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm opacity-60">Aucun</p>
              )}
            </div>
            <div>
              <h4 className="font-semibold text-sm">Ustensiles</h4>
              {meal.utensils && meal.utensils.length > 0 ? (
                <p className="text-sm">{meal.utensils.map((u) => u.name).join(", ")}</p>
              ) : (
                <p className="text-sm opacity-60">Aucun</p>
              )}
            </div>
            <div className="flex justify-end pt-2">
              <button className="btn btn-primary btn-sm" onClick={() => setEditing(true)}>
                Modifier
              </button>
            </div>
          </>
        )}
      </div>
    </ResponsiveModal>
  );
}
