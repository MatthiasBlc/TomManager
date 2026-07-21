import { describe, it, expect } from "vitest";
import { computeMealCapacities } from "../../services/kitchenPlanning";

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
