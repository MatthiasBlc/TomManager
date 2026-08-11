import { describe, it, expect } from "vitest";
import {
  buildShoppingViews,
  type ShoppingSourceMeal,
  type Unit,
} from "../../services/shoppingList";

// Helpers : les repas sont attendus deja tries chronologiquement (c'est le contrat
// de buildShoppingViews, garanti par l'orderBy de getShoppingList).
let clock = 0;
const meal = (
  name: string,
  ingredients: [string, number, Unit, string?][]
): ShoppingSourceMeal => ({
  id: `meal-${name}-${clock}`,
  name,
  service: "DINNER",
  startDateTime: new Date(2026, 7, 14, 18, 30 + clock++),
  ingredients: ingredients.map(([iname, quantity, unit, note]) => ({
    name: iname,
    quantity,
    unit,
    note: note ?? null,
  })),
});

describe("buildShoppingViews", () => {
  describe("vue 1 - par repas", () => {
    it("garde l'ordre des repas et l'ordre de saisie des ingredients", () => {
      const { byMeal } = buildShoppingViews([
        meal("Diner du vendredi", [
          ["sel", 2, "CAC"],
          ["farine", 500, "G"],
        ]),
        meal("Dejeuner du samedi", [["miel", 250, "G"]]),
      ]);

      expect(byMeal.map((m) => m.mealName)).toEqual(["Diner du vendredi", "Dejeuner du samedi"]);
      expect(byMeal[0].ingredients.map((i) => i.name)).toEqual(["sel", "farine"]);
    });

    it("conserve un repas sans ingredient", () => {
      const { byMeal } = buildShoppingViews([meal("Dejeuner du samedi", [])]);

      expect(byMeal).toHaveLength(1);
      expect(byMeal[0].ingredients).toEqual([]);
    });
  });

  describe("vue 2 - a plat, alphabetique", () => {
    it("trie par nom sans tenir compte de la casse ni des accents", () => {
      const { flat } = buildShoppingViews([
        meal("R1", [
          ["zeste", 1, "PIECE"],
          ["Echalote", 2, "PIECE"],
          ["ail", 3, "PIECE"],
          ["echalote", 4, "PIECE"],
        ]),
      ]);

      expect(flat.map((l) => l.name)).toEqual(["ail", "Echalote", "echalote", "zeste"]);
    });

    it("ne regroupe rien et porte le repas d'origine sur chaque ligne", () => {
      const { flat } = buildShoppingViews([
        meal("Diner", [["farine", 500, "G"]]),
        meal("Dejeuner", [["farine", 1, "KG"]]),
      ]);

      expect(flat).toHaveLength(2);
      expect(flat.map((l) => [l.quantity, l.unit, l.mealName])).toEqual([
        [500, "G", "Diner"],
        [1, "KG", "Dejeuner"],
      ]);
    });

    it("exclut les repas sans ingredient", () => {
      const { flat } = buildShoppingViews([meal("Vide", []), meal("Plein", [["riz", 1, "KG"]])]);

      expect(flat).toHaveLength(1);
      expect(flat[0].mealName).toBe("Plein");
    });
  });

  describe("vue 3 - agregee", () => {
    it("somme une masse et rend le total en kg au-dela de 1000 g", () => {
      const { aggregated } = buildShoppingViews([
        meal("Diner", [["farine", 500, "G"]]),
        meal("Dejeuner", [["farine", 1, "KG"]]),
      ]);

      expect(aggregated).toHaveLength(1);
      expect(aggregated[0]).toMatchObject({ name: "farine", quantity: 1.5, unit: "KG" });
    });

    it("garde le gramme sous le seuil de 1000", () => {
      const { aggregated } = buildShoppingViews([
        meal("Diner", [["miel", 250, "G"]]),
        meal("Dejeuner", [["miel", 300, "G"]]),
      ]);

      expect(aggregated[0]).toMatchObject({ quantity: 550, unit: "G" });
    });

    it("convertit les volumes vers le ml, et vers le L au-dela de 1000", () => {
      const petit = buildShoppingViews([
        meal("R", [
          ["huile", 25, "CL"],
          ["huile", 300, "ML"],
        ]),
      ]);
      expect(petit.aggregated[0]).toMatchObject({ quantity: 550, unit: "ML" });

      const grand = buildShoppingViews([
        meal("R", [
          ["lait", 1, "L"],
          ["lait", 50, "CL"],
        ]),
      ]);
      expect(grand.aggregated[0]).toMatchObject({ quantity: 1.5, unit: "L" });
    });

    it("ne convertit pas cas / cac / piece : une ligne par dimension", () => {
      const { aggregated } = buildShoppingViews([
        meal("R", [
          ["sel", 2, "CAC"],
          ["sel", 10, "G"],
          ["sel", 1, "CAS"],
        ]),
      ]);

      expect(aggregated).toHaveLength(3);
      expect(aggregated.map((l) => [l.quantity, l.unit]).sort()).toEqual(
        [
          [2, "CAC"],
          [10, "G"],
          [1, "CAS"],
        ].sort()
      );
    });

    it("regroupe malgre la casse et les espaces, et garde la premiere graphie", () => {
      const { aggregated } = buildShoppingViews([
        meal("Diner", [["Huile  d'olive", 100, "ML"]]),
        meal("Dejeuner", [["huile d'olive", 200, "ML"]]),
      ]);

      expect(aggregated).toHaveLength(1);
      expect(aggregated[0].name).toBe("Huile  d'olive");
      expect(aggregated[0].quantity).toBe(300);
    });

    it("liste les repas contributeurs sans doublon, dans l'ordre chronologique", () => {
      const { aggregated } = buildShoppingViews([
        meal("Diner", [
          ["oeuf", 6, "PIECE"],
          ["oeuf", 2, "PIECE"],
        ]),
        meal("Dejeuner", [["oeuf", 4, "PIECE"]]),
      ]);

      expect(aggregated[0].quantity).toBe(12);
      expect(aggregated[0].mealNames).toEqual(["Diner", "Dejeuner"]);
    });

    it("conserve chaque commentaire attribue a son repas (exigence KitchenRecipeNotes)", () => {
      const { aggregated } = buildShoppingViews([
        meal("Diner", [["miel", 250, "G", "liquide, de preference acacia"]]),
        meal("Dejeuner", [["miel", 300, "G", "prenez-en 300 si le prix suit"]]),
      ]);

      expect(aggregated[0].notes).toEqual([
        { mealName: "Diner", note: "liquide, de preference acacia" },
        { mealName: "Dejeuner", note: "prenez-en 300 si le prix suit" },
      ]);
    });

    it("ecarte les commentaires vides ou composes d'espaces", () => {
      const { aggregated } = buildShoppingViews([
        meal("Diner", [
          ["riz", 1, "KG", "   "],
          ["pates", 1, "KG", ""],
        ]),
      ]);

      expect(aggregated.every((l) => l.notes.length === 0)).toBe(true);
    });

    it("trie les lignes agregees par nom", () => {
      const { aggregated } = buildShoppingViews([
        meal("R", [
          ["zeste", 1, "PIECE"],
          ["ail", 1, "PIECE"],
          ["miel", 1, "KG"],
        ]),
      ]);

      expect(aggregated.map((l) => l.name)).toEqual(["ail", "miel", "zeste"]);
    });

    it("arrondit a 3 decimales sans trainer de zeros", () => {
      const { aggregated } = buildShoppingViews([
        meal("R", [
          ["epice", 0.1, "G"],
          ["epice", 0.2, "G"],
        ]),
      ]);

      expect(aggregated[0].quantity).toBe(0.3);
    });
  });

  it("renvoie trois tableaux vides pour un event sans repas", () => {
    expect(buildShoppingViews([])).toEqual({ byMeal: [], flat: [], aggregated: [] });
  });
});
