import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "../config/api";
import { useEventSocket } from "./useEventSocket";
import type { Unit } from "../components/kitchen/units";

export interface ShoppingIngredient {
  name: string;
  quantity: number;
  unit: Unit;
  note: string | null;
}

export interface ShoppingMealGroup {
  mealId: string;
  mealName: string;
  service: "LUNCH" | "DINNER";
  startDateTime: string;
  ingredients: ShoppingIngredient[];
}

export interface ShoppingFlatLine extends ShoppingIngredient {
  mealId: string;
  mealName: string;
}

export interface ShoppingAggregatedLine {
  name: string;
  quantity: number;
  unit: Unit;
  mealNames: string[];
  notes: { mealName: string; note: string }[];
}

export interface ShoppingViews {
  byMeal: ShoppingMealGroup[];
  flat: ShoppingFlatLine[];
  aggregated: ShoppingAggregatedLine[];
}

// Les trois vues sont calculees par le backend (services/shoppingList.ts) et non
// ici : l'export Excel consomme exactement les memes structures, donc l'ecran et
// le fichier ne peuvent pas diverger.
export function useShoppingList(eventId: string | undefined) {
  const [data, setData] = useState<ShoppingViews | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchShoppingList = useCallback(async () => {
    if (!eventId) return;
    try {
      const res = await api.get(`/api/events/${eventId}/kitchen/shopping`);
      setData(res.data.data);
    } catch {
      toast.error("Échec du chargement de la liste de courses");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  // Pas de garde de droit ici : `CoursesTab` n'est monte que si l'utilisateur a
  // acces a l'onglet, et le backend refuse de toute facon (403).
  useEffect(() => {
    fetchShoppingList();
  }, [fetchShoppingList]);

  // Une recette modifiee par un chef doit se voir sans rechargement de page.
  useEventSocket(eventId, {
    onKitchenMealChanged: fetchShoppingList,
    onKitchenPlanningGenerated: fetchShoppingList,
    onKitchenConfigUpdated: fetchShoppingList,
    onReconnected: fetchShoppingList,
  });

  return { data, loading, refetch: fetchShoppingList };
}
