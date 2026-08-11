import { CARD } from "../common/ui";
import { useIsMobile } from "../../hooks/useIsMobile";
import { unitLabel } from "../kitchen/units";
import { formatQuantity, quantityWithUnit } from "./format";
import type { ShoppingFlatLine } from "../../hooks/useShoppingList";

// Vue 2 : toutes les lignes de tous les repas, sans regroupement, triees par nom
// (tri fait cote backend, insensible a la casse et aux accents).
export default function CoursesFlatView({ lines }: { lines: ShoppingFlatLine[] }) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className={`${CARD} p-4`}>
        <ul className="space-y-3">
          {lines.map((line, i) => (
            <li key={i} className="border-b border-base-300 pb-3 last:border-0 last:pb-0">
              <div className="flex justify-between gap-3">
                <span className="font-medium">{line.name}</span>
                <span className="shrink-0 tabular-nums">
                  {quantityWithUnit(line.quantity, line.unit)}
                </span>
              </div>
              <p className="text-xs text-base-content/50 mt-0.5">{line.mealName}</p>
              {line.note && <p className="text-xs italic text-base-content/60 mt-1">{line.note}</p>}
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
            <th>Commentaire</th>
            <th>Repas</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => (
            <tr key={i}>
              <td className="font-medium">{line.name}</td>
              <td className="text-right tabular-nums">{formatQuantity(line.quantity)}</td>
              <td>{unitLabel(line.unit)}</td>
              <td className="italic text-base-content/60">{line.note ?? ""}</td>
              <td className="text-base-content/70">{line.mealName}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
