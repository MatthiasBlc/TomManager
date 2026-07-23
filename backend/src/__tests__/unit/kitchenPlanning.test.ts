import { describe, it, expect } from "vitest";
import { computeMealCapacities, computeExpectedSlots } from "../../services/kitchenPlanning";

describe("computeMealCapacities", () => {
  it("returns an empty array when there are no meals", () => {
    expect(computeMealCapacities(10, 0)).toEqual([]);
  });

  it("clamps to 0 for every meal when the pool is empty", () => {
    expect(computeMealCapacities(0, 3)).toEqual([0, 0, 0]);
  });

  it("clamps to 0 for every meal when the pool is negative", () => {
    expect(computeMealCapacities(-5, 3)).toEqual([0, 0, 0]);
  });

  it("distributes evenly when the pool divides the meal count", () => {
    expect(computeMealCapacities(9, 3)).toEqual([3, 3, 3]);
  });

  it("gives the remainder to the first meals (sorted order)", () => {
    // pool=10, nbRepas=3 -> base=3, reste=1 -> [4, 3, 3]
    expect(computeMealCapacities(10, 3)).toEqual([4, 3, 3]);
    // pool=11, nbRepas=3 -> base=3, reste=2 -> [4, 4, 3]
    expect(computeMealCapacities(11, 3)).toEqual([4, 4, 3]);
  });

  it("handles a single meal absorbing the whole pool", () => {
    expect(computeMealCapacities(7, 1)).toEqual([7]);
  });

  it("handles a pool smaller than the meal count", () => {
    // pool=2, nbRepas=5 -> base=0, reste=2 -> [1, 1, 0, 0, 0]
    expect(computeMealCapacities(2, 5)).toEqual([1, 1, 0, 0, 0]);
  });
});

describe("computeExpectedSlots", () => {
  const services = (start: Date, end: Date) =>
    computeExpectedSlots(start, end).map((s) => s.service);

  it("builds diner-only first day, lunch+diner middle days, nothing on the last day", () => {
    // Event du vendredi 31/07 (soir) au mardi 04/08 : 5 jours calendaires (Paris)
    // -> vendredi soir, samedi midi/soir, dimanche midi/soir, lundi midi/soir, mardi rien
    const slots = computeExpectedSlots(
      new Date("2026-07-31T18:00:00Z"),
      new Date("2026-08-04T10:00:00Z")
    );
    expect(slots.map((s) => s.service)).toEqual([
      "DINNER",
      "LUNCH",
      "DINNER",
      "LUNCH",
      "DINNER",
      "LUNCH",
      "DINNER",
    ]);
    // Premier creneau = vendredi 18h30 heure de Paris (ete, UTC+2) = 16h30 UTC
    expect(slots[0].startDateTime.toISOString()).toBe("2026-07-31T16:30:00.000Z");
    expect(slots[0].name).toContain("vendredi");
    expect(slots[0].name.startsWith("Dîner")).toBe(true);
    // Deuxieme creneau = samedi dejeuner 10h30 Paris = 08h30 UTC
    expect(slots[1].startDateTime.toISOString()).toBe("2026-08-01T08:30:00.000Z");
    expect(slots[1].name.startsWith("Déjeuner")).toBe(true);
  });

  it("returns a single diner for an event within one calendar day (first-day rule wins)", () => {
    const slots = computeExpectedSlots(
      new Date("2026-06-01T10:00:00Z"),
      new Date("2026-06-01T18:00:00Z")
    );
    expect(slots).toHaveLength(1);
    expect(slots[0].service).toBe("DINNER");
    // 18h30 Paris (ete) = 16h30 UTC
    expect(slots[0].startDateTime.toISOString()).toBe("2026-06-01T16:30:00.000Z");
    expect(slots[0].endDateTime.toISOString()).toBe("2026-06-01T19:00:00.000Z");
  });

  it("returns only the first day's diner for a two-calendar-day event", () => {
    // jour 1 = diner ; jour 2 = dernier jour = rien
    expect(services(new Date("2026-06-01T18:00:00Z"), new Date("2026-06-02T10:00:00Z"))).toEqual([
      "DINNER",
    ]);
  });
});
