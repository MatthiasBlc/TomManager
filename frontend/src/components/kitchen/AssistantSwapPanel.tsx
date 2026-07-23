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

export interface AssistantSwapRequest {
  id: string;
  status: string;
  requester: Person;
  requesterMeal: SwapMealRef;
  targetMeal: SwapMealRef;
}

interface PanelMeal {
  id: string;
  name: string;
  service: "LUNCH" | "DINNER";
  startDateTime: string;
  remainingSeats: number;
}

interface Props {
  eventId: string;
  meals: PanelMeal[];
  currentUserId: string;
  currentMealId: string | null;
  swaps: AssistantSwapRequest[];
  onChanged: () => void;
}

const displayedName = (u: Person) => u.displayName ?? u.username;

const mealRefLabel = (m: SwapMealRef) =>
  `${serviceLabel(m.service)} ${dayLabel(m.startDateTime)} — ${m.name}`;

// Echange entre equipiers (point 4, Evolutions.md) : la cible est un repas, pas une
// personne — n'importe quel equipier actuellement inscrit sur ce repas peut accepter
// (premier arrive, premier servi). Une demande ne peut viser qu'un repas COMPLET
// (sinon "Se deplacer ici", deja disponible sur le board, suffit).
export default function AssistantSwapPanel({
  eventId,
  meals,
  currentUserId,
  currentMealId,
  swaps,
  onChanged,
}: Props) {
  const [selected, setSelected] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  // Creneaux complets (places = 0), regroupes par jour, hors mon propre creneau.
  const groups = useMemo(() => {
    const map = new Map<string, PanelMeal[]>();
    for (const m of meals) {
      if (m.id === currentMealId || m.remainingSeats > 0) continue;
      const key = dayLabel(m.startDateTime);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return [...map.entries()];
  }, [meals, currentMealId]);

  const hasFullSlots = groups.length > 0;
  const received = swaps.filter(
    (s) => s.targetMeal.id === currentMealId && s.requester.id !== currentUserId
  );
  const mine = swaps.find((s) => s.requester.id === currentUserId);

  const handlePropose = async () => {
    if (!selected) return;
    setPendingAction("propose");
    try {
      await api.post(`/api/events/${eventId}/kitchen/assistant-swaps`, { targetMealId: selected });
      toast.success("Demande d'échange envoyée");
      setSelected("");
      onChanged();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Échec de la demande d'échange"));
    } finally {
      setPendingAction(null);
    }
  };

  const act = async (requestId: string, verb: "accept" | "cancel", successMsg: string) => {
    setPendingAction(`${verb}:${requestId}`);
    try {
      await api.post(`/api/events/${eventId}/kitchen/assistant-swaps/${requestId}/${verb}`);
      toast.success(successMsg);
      onChanged();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Échec de l'opération"));
    } finally {
      setPendingAction(null);
    }
  };

  if (!currentMealId) return null;

  return (
    <div className="card bg-base-200 shadow-none">
      <div className="card-body p-3">
        <h4 className="font-semibold text-sm mb-1">Échanger ma place</h4>

        {received.length > 0 && (
          <div className="mb-3">
            <p className="text-xs font-medium opacity-70 mb-1">Demandes reçues</p>
            <ul className="space-y-2">
              {received.map((s) => (
                <li key={s.id} className="text-xs bg-base-100 rounded p-2">
                  <p className="mb-2">
                    <span className="font-medium">{displayedName(s.requester)}</span> propose
                    d'échanger sa place «&nbsp;{mealRefLabel(s.requesterMeal)}&nbsp;» contre la
                    tienne «&nbsp;{mealRefLabel(s.targetMeal)}&nbsp;».
                  </p>
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
                </li>
              ))}
            </ul>
          </div>
        )}

        {mine && (
          <div className="mb-3">
            <p className="text-xs font-medium opacity-70 mb-1">Ma demande</p>
            <div className="text-xs bg-base-100 rounded p-2 flex items-center justify-between gap-2">
              <span>En attente d'un équipier de «&nbsp;{mealRefLabel(mine.targetMeal)}&nbsp;»</span>
              <button
                className="btn btn-ghost btn-xs"
                disabled={!!pendingAction}
                onClick={() => act(mine.id, "cancel", "Demande annulée")}
              >
                {pendingAction === `cancel:${mine.id}` && (
                  <span className="loading loading-spinner loading-xs" />
                )}
                Annuler
              </button>
            </div>
          </div>
        )}

        {!mine &&
          (!hasFullSlots ? (
            <p className="text-xs opacity-60">Aucun créneau complet à échanger.</p>
          ) : (
            <>
              <p className="text-xs opacity-70 mb-2">
                Tu veux changer de créneau avec un qui est complet ? Propose un échange à un
                équipier de ce créneau. Le premier qui accepte échange avec toi.
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
          ))}
      </div>
    </div>
  );
}
