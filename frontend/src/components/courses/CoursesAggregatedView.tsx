import { CARD } from "../common/ui";
import { useIsMobile } from "../../hooks/useIsMobile";
import { unitLabel } from "../kitchen/units";
import { formatQuantity, quantityWithUnit } from "./format";
import type { ShoppingAggregatedLine } from "../../hooks/useShoppingList";

// Chaque commentaire reste attribue a son repas : sans cette precision, deux
// consignes contradictoires sur la meme denree deviennent intracables (exigence
// posee par la spec KitchenRecipeNotes).
function Notes({ notes }: { notes: ShoppingAggregatedLine["notes"] }) {
  if (notes.length === 0) return null;
  return (
    <ul className="space-y-0.5">
      {notes.map((n, i) => (
        <li key={i} className="text-xs italic text-base-content/60">
          <span className="not-italic text-base-content/45">{n.mealName} : </span>
          {n.note}
        </li>
      ))}
    </ul>
  );
}

// Vue 3 : lignes de meme nom et meme dimension fusionnees, quantites sommees.
// cas / cac / piece ne se convertissent en rien et gardent donc leur propre ligne.
export default function CoursesAggregatedView({ lines }: { lines: ShoppingAggregatedLine[] }) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className={`${CARD} p-4`}>
        <ul className="space-y-3">
          {lines.map((line, i) => (
            <li key={i} className="border-b border-base-300 pb-3 last:border-0 last:pb-0">
              <div className="flex justify-between gap-3">
                <span className="font-medium">{line.name}</span>
                <span className="shrink-0 tabular-nums font-semibold">
                  {quantityWithUnit(line.quantity, line.unit)}
                </span>
              </div>
              <p className="text-xs text-base-content/50 mt-0.5">{line.mealNames.join(", ")}</p>
              <div className="mt-1">
                <Notes notes={line.notes} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className={`${CARD} p-4`}>
      <table className="table table-sm">
        <thead>
          <tr>
            <th>Ingrédient</th>
            <th className="text-right w-24">Quantité</th>
            <th className="w-24">Unité</th>
            <th>Repas</th>
            <th>Commentaires</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => (
            <tr key={i}>
              <td className="font-medium">{line.name}</td>
              <td className="text-right tabular-nums font-semibold">
                {formatQuantity(line.quantity)}
              </td>
              <td>{unitLabel(line.unit)}</td>
              <td className="text-base-content/70">{line.mealNames.join(", ")}</td>
              <td>
                <Notes notes={line.notes} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
