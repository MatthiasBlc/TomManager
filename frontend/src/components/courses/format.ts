import { unitLabel } from "../kitchen/units";

// Quantite affichee a l'utilisateur : virgule decimale francaise, jamais de zeros
// de fin (le backend a deja arrondi a 3 decimales, precision de la colonne).
export function formatQuantity(quantity: number): string {
  return quantity.toLocaleString("fr-FR", { maximumFractionDigits: 3 });
}

export function quantityWithUnit(quantity: number, unit: string): string {
  return `${formatQuantity(quantity)} ${unitLabel(unit)}`;
}
