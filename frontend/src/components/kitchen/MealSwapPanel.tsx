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

interface SwapMealRef {
  id: string;
  name: string;
  service: "LUNCH" | "DINNER";
  startDateTime: string;
}

export interface SwapRequest {
  id: string;
  status: string;
  requester: Person;
  target: Person;
  requesterMeal: SwapMealRef;
  targetMeal: SwapMealRef;
}

interface PanelMeal {
  id: string;
  name: string;
  service: "LUNCH" | "DINNER";
  startDateTime: string;
  chef: Person | null;
}

interface Props {
  eventId: string;
  meals: PanelMeal[];
  currentUserId: string;
  swaps: SwapRequest[];
  onChanged: () => void;
}

const displayedName = (u: Person) => u.displayName ?? u.username;

const mealRefLabel = (m: SwapMealRef) =>
  `${serviceLabel(m.service)} ${dayLabel(m.startDateTime)} — ${m.name}`;

export default function MealSwapPanel({ eventId, meals, currentUserId, swaps, onChanged }: Props) {
  const [selected, setSelected] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  // Creneaux des AUTRES chefs, regroupes par jour (ordre chronologique conserve).
  const groups = useMemo(() => {
    const map = new Map<string, PanelMeal[]>();
    for (const m of meals) {
      if (!m.chef || m.chef.id === currentUserId) continue;
      const key = dayLabel(m.startDateTime);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return [...map.entries()];
  }, [meals, currentUserId]);

  const hasOtherChefs = groups.length > 0;
  const received = swaps.filter((s) => s.target.id === currentUserId);
  const sent = swaps.filter((s) => s.requester.id === currentUserId);

  const handlePropose = async () => {
    if (!selected) return;
    setPendingAction("propose");
    try {
      await api.post(`/api/events/${eventId}/kitchen/swaps`, { targetMealId: selected });
      toast.success("Demande d'échange envoyée");
      setSelected("");
      onChanged();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Échec de la demande d'échange"));
    } finally {
      setPendingAction(null);
    }
  };

  const act = async (swapId: string, verb: "accept" | "reject" | "cancel", successMsg: string) => {
    setPendingAction(`${verb}:${swapId}`);
    try {
      await api.post(`/api/events/${eventId}/kitchen/swaps/${swapId}/${verb}`);
      toast.success(successMsg);
      onChanged();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Échec de l'opération"));
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <div className="card bg-base-200 shadow-none">
      <div className="card-body p-3">
        <h4 className="font-semibold text-sm mb-1">Échanger mon créneau</h4>

        {received.length > 0 && (
          <div className="mb-3">
            <p className="text-xs font-medium opacity-70 mb-1">Demandes reçues</p>
            <ul className="space-y-2">
              {received.map((s) => (
                <li key={s.id} className="text-xs bg-base-100 rounded p-2">
                  <p className="mb-2">
                    <span className="font-medium">{displayedName(s.requester)}</span> propose
                    d'échanger son créneau «&nbsp;{mealRefLabel(s.requesterMeal)}&nbsp;» contre le
                    tien «&nbsp;{mealRefLabel(s.targetMeal)}&nbsp;».
                  </p>
                  <div className="flex gap-2">
                    <button
                      className="btn btn-primary btn-xs"
                      disabled={!!pendingAction}
                      onClick={() => act(s.id, "accept", "Échange accepté")}
                    >
                      {pendingAction === `accept:${s.id}` && (
                        <span className="loading loading-spinner loading-xs" />
                      )}
                      Accepter
                    </button>
                    <button
                      className="btn btn-ghost btn-xs text-error"
                      disabled={!!pendingAction}
                      onClick={() => act(s.id, "reject", "Échange refusé")}
                    >
                      {pendingAction === `reject:${s.id}` && (
                        <span className="loading loading-spinner loading-xs" />
                      )}
                      Refuser
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {sent.length > 0 && (
          <div className="mb-3">
            <p className="text-xs font-medium opacity-70 mb-1">Demandes envoyées</p>
            <ul className="space-y-2">
              {sent.map((s) => (
                <li
                  key={s.id}
                  className="text-xs bg-base-100 rounded p-2 flex items-center justify-between gap-2"
                >
                  <span>
                    En attente de <span className="font-medium">{displayedName(s.target)}</span> pour
                    «&nbsp;{mealRefLabel(s.targetMeal)}&nbsp;»
                  </span>
                  <button
                    className="btn btn-ghost btn-xs"
                    disabled={!!pendingAction}
                    onClick={() => act(s.id, "cancel", "Demande annulée")}
                  >
                    {pendingAction === `cancel:${s.id}` && (
                      <span className="loading loading-spinner loading-xs" />
                    )}
                    Annuler
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!hasOtherChefs ? (
          <p className="text-xs opacity-60">Aucun autre chef n'a de créneau à échanger.</p>
        ) : (
          <>
            <p className="text-xs opacity-70 mb-2">
              Propose un échange à un autre chef. Ta recette suit ton créneau ; les équipiers déjà
              inscrits restent sur leur repas.
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
                      <option key={m.id} value={m.id}>
                        {serviceLabel(m.service)} — {m.name}
                        {m.chef ? ` (${displayedName(m.chef)})` : ""}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <button
                className="btn btn-sm"
                disabled={!selected || !!pendingAction}
                onClick={handlePropose}
              >
                {pendingAction === "propose" && (
                  <span className="loading loading-spinner loading-xs" />
                )}
                Proposer un échange
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
