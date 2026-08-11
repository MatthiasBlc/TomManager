import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import api from "../config/api";
import { useEventSocket } from "./useEventSocket";
import type { MealFiche } from "../components/kitchen/MealFichesList";
import type { SwapRequest } from "../components/kitchen/MealSwapPanel";
import type { AssistantSwapRequest } from "../components/kitchen/AssistantSwapPanel";

export interface KitchenViewData {
  eventKitchenId: string | null;
  chefRoleId: string | null;
  equipierPlanningEnabled: boolean;
  currentUserKitchenRole: "manager" | "chef" | "equipier" | "none";
  isChef: boolean;
  isCoursesMember: boolean;
  meals: MealFiche[];
  // Cible du total vege+carne (participants confirmes de l'evenement entier) : absent
  // si l'utilisateur ne voit pas la repartition (equipier).
  eventParticipantsCount?: number;
  allergiesNotes?: string | null;
  chefs?: {
    id: string;
    username: string;
    displayName?: string | null;
    source: "ROLE" | "MANUAL";
  }[];
  coursesMembers?: { id: string; username: string; displayName?: string | null }[];
  unassigned?: { id: string; username: string; displayName?: string | null }[];
  dashboard?: {
    chefsCount: number;
    coursesCount: number;
    unassignedCount: number;
    chefs: {
      id: string;
      username: string;
      displayName?: string | null;
      source: "ROLE" | "MANUAL";
    }[];
    coursesMembers: { id: string; username: string; displayName?: string | null }[];
    unassigned: { id: string; username: string; displayName?: string | null }[];
  };
  capacitySummary?: { allocated: number; poolTotal: number };
}

// Coalescence des refetch (retour prod : rafale de 429). Une seule action de chef
// declenche plusieurs demandes de rafraichissement quasi simultanees : la reponse du
// PATCH (onChanged) ET l'evenement socket diffuse a toute la room — et un echange de
// creneaux emet meme deux `kitchen:meal-changed` d'affilee. Sans regroupement, chaque
// client connecte multipliait donc les GET pour une seule modification. Ce delai
// fusionne les demandes rapprochees en un seul appel, sans changer la reactivite
// percue (30 ms est sous le seuil de perception).
const REFETCH_COALESCE_MS = 30;

// Fetch + temps reel partages entre l'onglet Infos (KitchenBoard) et l'onglet
// Cuisine (KitchenTab) : un seul GET /kitchen par page evenement, un seul wiring
// socket kitchen:*, et la donnee est disponible des le montage de la page (utile
// pour decider la visibilite de l'onglet Cuisine dans la nav avant meme que l'un
// des deux onglets ne soit actif).
export function useKitchenData(eventId: string | undefined) {
  const [data, setData] = useState<KitchenViewData | null>(null);
  const [swaps, setSwaps] = useState<SwapRequest[]>([]);
  const [assistantSwaps, setAssistantSwaps] = useState<AssistantSwapRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchKitchenNow = useCallback(async () => {
    try {
      const res = await api.get(`/api/events/${eventId}/kitchen`);
      setData(res.data.data);
    } catch {
      toast.error("Échec du chargement du module cuisine");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  const fetchSwapsNow = useCallback(async () => {
    try {
      const res = await api.get(`/api/events/${eventId}/kitchen/swaps`);
      setSwaps(Array.isArray(res.data.data) ? res.data.data : []);
    } catch {
      // Silencieux : les demandes d'echange ne bloquent pas l'affichage
    }
  }, [eventId]);

  const fetchAssistantSwapsNow = useCallback(async () => {
    try {
      const res = await api.get(`/api/events/${eventId}/kitchen/assistant-swaps`);
      setAssistantSwaps(Array.isArray(res.data.data) ? res.data.data : []);
    } catch {
      // Silencieux : les demandes d'echange ne bloquent pas l'affichage
    }
  }, [eventId]);

  // Un timer par ressource : deux demandes rapprochees sur la meme ressource ne font
  // qu'un GET, mais une demande "kitchen" ne retarde pas une demande "swaps".
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const schedule = useCallback((key: string, run: () => void) => {
    clearTimeout(timersRef.current[key]);
    timersRef.current[key] = setTimeout(() => {
      delete timersRef.current[key];
      run();
    }, REFETCH_COALESCE_MS);
  }, []);

  const fetchKitchen = useCallback(
    () => schedule("kitchen", fetchKitchenNow),
    [schedule, fetchKitchenNow]
  );
  const fetchSwaps = useCallback(() => schedule("swaps", fetchSwapsNow), [schedule, fetchSwapsNow]);
  const fetchAssistantSwaps = useCallback(
    () => schedule("assistantSwaps", fetchAssistantSwapsNow),
    [schedule, fetchAssistantSwapsNow]
  );

  const refetchAll = useCallback(() => {
    fetchKitchen();
    fetchSwaps();
    fetchAssistantSwaps();
  }, [fetchKitchen, fetchSwaps, fetchAssistantSwaps]);

  useEffect(() => {
    fetchKitchenNow();
    fetchSwapsNow();
    fetchAssistantSwapsNow();
  }, [fetchKitchenNow, fetchSwapsNow, fetchAssistantSwapsNow]);

  // Nettoyage des timers en attente au demontage (changement d'evenement, sortie de
  // page) : un refetch programme ne doit pas partir pour un composant disparu.
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of Object.values(timers)) clearTimeout(timer);
    };
  }, []);

  useEventSocket(eventId, {
    onKitchenConfigUpdated: fetchKitchen,
    // Pas de refetchAll ici : une modification de repas ne change pas les listes
    // d'echanges, et les operations qui touchent les deux (accepter/refuser un
    // echange) emettent toujours `kitchen:swap-request-changed` en plus.
    onKitchenMealChanged: fetchKitchen,
    onKitchenAssistantChanged: fetchKitchen,
    onKitchenPlanningGenerated: fetchKitchen,
    onKitchenSwapRequestChanged: fetchSwaps,
    onKitchenAssistantSwapChanged: fetchAssistantSwaps,
    onReconnected: refetchAll,
  });

  return { data, swaps, assistantSwaps, loading, fetchKitchen, refetchAll };
}
