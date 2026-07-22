import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import api from "../../config/api";
import { getErrorMessage } from "../../config/apiErrors";
import { serviceLabel, dayLabel } from "./units";

interface Person {
  id: string;
  username: string;
  displayName?: string | null;
}

interface ClaimMeal {
  id: string;
  name: string;
  service: "LUNCH" | "DINNER";
  startDateTime: string;
  chef: Person | null;
}

interface Props {
  eventId: string;
  meals: ClaimMeal[];
  onClaimed: () => void;
}

const displayedName = (u: Person) => u.displayName ?? u.username;

export default function MealClaimSelect({ eventId, meals, onClaimed }: Props) {
  const [selected, setSelected] = useState("");
  const [pending, setPending] = useState(false);

  // Les repas arrivent deja tries par startDateTime : le regroupement conserve
  // l'ordre chronologique par jour.
  const groups = useMemo(() => {
    const map = new Map<string, ClaimMeal[]>();
    for (const m of meals) {
      const key = dayLabel(m.startDateTime);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return [...map.entries()];
  }, [meals]);

  const selectedMeal = meals.find((m) => m.id === selected);
  const canClaim = !!selectedMeal && !selectedMeal.chef;

  const handleClaim = async () => {
    if (!canClaim) return;
    setPending(true);
    try {
      await api.post(`/api/events/${eventId}/kitchen/meals/${selected}/claim`);
      toast.success("Créneau choisi !");
      setSelected("");
      onClaimed();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Échec du choix du créneau"));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="card bg-base-200 shadow-none">
      <div className="card-body p-3">
        <h4 className="font-semibold text-sm mb-1">Choisir mon créneau</h4>
        {meals.length === 0 ? (
          <p className="text-xs opacity-60">
            Aucun créneau disponible. Le responsable doit générer le planning.
          </p>
        ) : (
          <>
            <p className="text-xs opacity-70 mb-2">
              Sélectionne un repas dans la grille. Les créneaux déjà pris sont grisés.
            </p>
            <div className="flex gap-2">
              <select
                className="select select-bordered select-sm flex-1"
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
              >
                <option value="">Choisir un créneau...</option>
                {groups.map(([label, dayMeals]) => (
                  <optgroup key={label} label={label}>
                    {dayMeals.map((m) => (
                      <option key={m.id} value={m.id} disabled={!!m.chef}>
                        {serviceLabel(m.service)} — {m.name}
                        {m.chef ? ` (pris par ${displayedName(m.chef)})` : ""}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <button
                className="btn btn-primary btn-sm"
                disabled={!canClaim || pending}
                onClick={handleClaim}
              >
                {pending && <span className="loading loading-spinner loading-xs" />}
                Choisir ce créneau
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
