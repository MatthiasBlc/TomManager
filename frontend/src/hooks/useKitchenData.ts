import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "../config/api";
import { useEventSocket } from "./useEventSocket";
import type { MealFiche } from "../components/kitchen/MealFichesList";
import type { SwapRequest } from "../components/kitchen/MealSwapPanel";

export interface KitchenViewData {
  eventKitchenId: string | null;
  chefRoleId: string | null;
  equipierPlanningEnabled: boolean;
  currentUserKitchenRole: "manager" | "chef" | "equipier" | "none";
  isChef: boolean;
  isCoursesMember: boolean;
  meals: MealFiche[];
  allergiesNotes?: string | null;
  chefs?: {
    id: string;
    username: string;
    displayName?: string | null;
    source: "ROLE" | "MANUAL";
  }[];
  coursesMembers?: { id: string; username: string; displayName?: string | null }[];
  unassigned?: { id: string; username: string; displayName?: string | null }[];
  dashboard?: { chefsCount: number; coursesCount: number; unassignedCount: number };
  capacitySummary?: { allocated: number; poolTotal: number };
}

// Fetch + temps reel partages entre l'onglet Infos (KitchenBoard) et l'onglet
// Cuisine (KitchenTab) : un seul GET /kitchen par page evenement, un seul wiring
// socket kitchen:*, et la donnee est disponible des le montage de la page (utile
// pour decider la visibilite de l'onglet Cuisine dans la nav avant meme que l'un
// des deux onglets ne soit actif).
export function useKitchenData(eventId: string | undefined) {
  const [data, setData] = useState<KitchenViewData | null>(null);
  const [swaps, setSwaps] = useState<SwapRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchKitchen = useCallback(async () => {
    try {
      const res = await api.get(`/api/events/${eventId}/kitchen`);
      setData(res.data.data);
    } catch {
      toast.error("Échec du chargement du module cuisine");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  const fetchSwaps = useCallback(async () => {
    try {
      const res = await api.get(`/api/events/${eventId}/kitchen/swaps`);
      setSwaps(Array.isArray(res.data.data) ? res.data.data : []);
    } catch {
      // Silencieux : les demandes d'echange ne bloquent pas l'affichage
    }
  }, [eventId]);

  const refetchAll = useCallback(() => {
    fetchKitchen();
    fetchSwaps();
  }, [fetchKitchen, fetchSwaps]);

  useEffect(() => {
    fetchKitchen();
    fetchSwaps();
  }, [fetchKitchen, fetchSwaps]);

  useEventSocket(eventId, {
    onKitchenConfigUpdated: fetchKitchen,
    onKitchenMealChanged: refetchAll,
    onKitchenAssistantChanged: fetchKitchen,
    onKitchenPlanningGenerated: fetchKitchen,
    onKitchenSwapRequestChanged: fetchSwaps,
    onReconnected: refetchAll,
  });

  return { data, swaps, loading, fetchKitchen, refetchAll };
}
