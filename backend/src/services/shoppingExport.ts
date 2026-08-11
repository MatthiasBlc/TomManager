import ExcelJS from "exceljs";
import { slotName } from "./kitchenPlanning";
import type { ShoppingViews, Unit } from "./shoppingList";

// Export Excel des trois vues de la liste de courses. Consomme exactement les
// structures produites par `shoppingList.buildShoppingViews` : le fichier ne peut
// donc pas diverger de ce qui est affiche a l'ecran.

export const EXPORT_VIEWS = ["by-meal", "flat", "aggregated"] as const;
export type ExportView = (typeof EXPORT_VIEWS)[number];

// Texte visible par l'utilisateur : accents francais corrects (convention projet).
// Miroir de UNIT_OPTIONS cote frontend (frontend/src/components/kitchen/units.ts).
const UNIT_LABELS: Record<Unit, string> = {
  G: "g",
  KG: "kg",
  ML: "ml",
  CL: "cl",
  L: "L",
  CAS: "càs",
  CAC: "càc",
  PIECE: "pièce(s)",
};

const SHEET_NAMES: Record<ExportView, string> = {
  "by-meal": "Par repas",
  flat: "Ingrédients A-Z",
  aggregated: "Ingrédients regroupés",
};

interface ColumnSpec {
  header: string;
  key: string;
  width: number;
  wrap?: boolean;
  numeric?: boolean;
}

const COLUMNS: Record<ExportView, ColumnSpec[]> = {
  "by-meal": [
    { header: "Repas", key: "meal", width: 28 },
    { header: "Créneau", key: "slot", width: 22 },
    { header: "Ingrédient", key: "name", width: 30 },
    { header: "Quantité", key: "quantity", width: 12, numeric: true },
    { header: "Unité", key: "unit", width: 12 },
    { header: "Commentaire", key: "note", width: 50, wrap: true },
  ],
  flat: [
    { header: "Ingrédient", key: "name", width: 30 },
    { header: "Quantité", key: "quantity", width: 12, numeric: true },
    { header: "Unité", key: "unit", width: 12 },
    { header: "Commentaire", key: "note", width: 50, wrap: true },
    { header: "Repas", key: "meal", width: 28 },
  ],
  aggregated: [
    { header: "Ingrédient", key: "name", width: 30 },
    { header: "Quantité", key: "quantity", width: 12, numeric: true },
    { header: "Unité", key: "unit", width: 12 },
    { header: "Repas", key: "meal", width: 34, wrap: true },
    { header: "Commentaires", key: "note", width: 60, wrap: true },
  ],
};

type Row = Record<string, string | number | null>;

function buildRows(views: ShoppingViews, view: ExportView): Row[] {
  if (view === "by-meal") {
    return views.byMeal.flatMap((meal): Row[] => {
      const slot = slotName(meal.service, meal.startDateTime);
      // Un repas sans ingredient reste visible : une ligne, colonnes ingredient
      // vides. C'est une demande explicite (un creneau non renseigne doit sauter
      // aux yeux de l'equipe courses).
      if (meal.ingredients.length === 0) {
        return [{ meal: meal.mealName, slot, name: null, quantity: null, unit: null, note: null }];
      }
      return meal.ingredients.map((ing) => ({
        meal: meal.mealName,
        slot,
        name: ing.name,
        quantity: ing.quantity,
        unit: UNIT_LABELS[ing.unit],
        note: ing.note,
      }));
    });
  }

  if (view === "flat") {
    return views.flat.map((line) => ({
      name: line.name,
      quantity: line.quantity,
      unit: UNIT_LABELS[line.unit],
      note: line.note,
      meal: line.mealName,
    }));
  }

  return views.aggregated.map((line) => ({
    name: line.name,
    quantity: line.quantity,
    unit: UNIT_LABELS[line.unit],
    meal: line.mealNames.join(", "),
    // Un commentaire par ligne dans la cellule, prefixe de son repas : sans cette
    // attribution, deux precisions contradictoires deviennent intracables.
    note: line.notes.map((n) => `${n.mealName} : ${n.note}`).join("\n") || null,
  }));
}

export function buildShoppingWorkbook(views: ShoppingViews, view: ExportView): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(SHEET_NAMES[view]);
  const columns = COLUMNS[view];

  sheet.columns = columns.map((col) => ({ header: col.header, key: col.key, width: col.width }));

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: "middle" };
  // En-tetes figes : la liste depasse vite un ecran.
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  for (const col of columns) {
    const column = sheet.getColumn(col.key);
    if (col.wrap) {
      column.alignment = { wrapText: true, vertical: "top" };
    }
    if (col.numeric) {
      // Cellule numerique et non texte : une somme doit fonctionner dans le
      // tableur (c'est la raison d'etre du vrai .xlsx plutot qu'un CSV).
      column.numFmt = "0.###";
      column.alignment = { horizontal: "right", vertical: "top" };
    }
  }

  for (const row of buildRows(views, view)) {
    sheet.addRow(row);
  }

  return workbook;
}
