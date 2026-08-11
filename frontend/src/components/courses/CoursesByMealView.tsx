import { CARD } from "../common/ui";
import { useIsMobile } from "../../hooks/useIsMobile";
import { slotLabel, unitLabel } from "../kitchen/units";
import { formatQuantity, quantityWithUnit } from "./format";
import type { ShoppingMealGroup } from "../../hooks/useShoppingList";

// Vue 1 : un bloc par repas, ingredients dans l'ordre de la recette du chef (pas
// de tri alphabetique : le chef a range sa liste, on ne la reorganise pas).
export default function CoursesByMealView({ meals }: { meals: ShoppingMealGroup[] }) {
  const isMobile = useIsMobile();

  return (
    <div className="space-y-4">
      {meals.map((meal) => (
        <div key={meal.mealId} className={`${CARD} p-4`}>
          <div className="mb-3">
            <h3 className="font-semibold text-base-content">{meal.mealName}</h3>
            <p className="text-xs text-base-content/50 mt-0.5">{slotLabel(meal)}</p>
          </div>

          {meal.ingredients.length === 0 ? (
            <p className="text-sm italic text-base-content/50">Aucun ingrédient renseigné</p>
          ) : isMobile ? (
            <ul className="space-y-2">
              {meal.ingredients.map((ing, i) => (
                <li key={i} className="border-b border-base-300 pb-2 last:border-0 last:pb-0">
                  <div className="flex justify-between gap-3">
                    <span className="font-medium">{ing.name}</span>
                    <span className="shrink-0 tabular-nums">
                      {quantityWithUnit(ing.quantity, ing.unit)}
                    </span>
                  </div>
                  {ing.note && (
                    <p className="text-xs italic text-base-content/60 mt-1">{ing.note}</p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Ingrédient</th>
                  <th className="text-right w-24">Quantité</th>
                  <th className="w-24">Unité</th>
                  <th>Commentaire</th>
                </tr>
              </thead>
              <tbody>
                {meal.ingredients.map((ing, i) => (
                  <tr key={i}>
                    <td className="font-medium">{ing.name}</td>
                    <td className="text-right tabular-nums">{formatQuantity(ing.quantity)}</td>
                    <td>{unitLabel(ing.unit)}</td>
                    <td className="italic text-base-content/60">{ing.note ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  );
}
