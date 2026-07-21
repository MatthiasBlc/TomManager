import { describe, it, expect } from "vitest";
import { computeConflicts, type Occupation } from "../../services/conflicts";

// Helper : construit une occupation avec des heures en ms simplifiees (unites arbitraires)
const occ = (sourceId: string, userId: string, start: number, end: number): Occupation => ({
  sourceId,
  userId,
  start,
  end,
});

describe("computeConflicts", () => {
  it("returns no conflict when a user has a single occupation", () => {
    const result = computeConflicts([occ("t1", "alice", 0, 10)]);
    expect(result.size).toBe(0);
  });

  it("returns no conflict when two occupations of a user do not overlap", () => {
    const result = computeConflicts([occ("t1", "alice", 0, 10), occ("t2", "alice", 10, 20)]);
    // Intervalles adjacents (touchent en 10) : jamais un conflit
    expect(result.size).toBe(0);
  });

  it("flags both game tables when a player is confirmed on two overlapping tables (non-regression)", () => {
    const result = computeConflicts([occ("t1", "alice", 0, 10), occ("t2", "alice", 5, 15)]);
    expect(result.get("t1")).toEqual(new Set(["alice"]));
    expect(result.get("t2")).toEqual(new Set(["alice"]));
  });

  it("flags a table and a meal when a chef busy on their meal is also on a table", () => {
    // alice est chef du repas m1 [0,10] ET joueuse de la table t1 [5,15] -> conflit
    const result = computeConflicts([occ("m1", "alice", 0, 10), occ("t1", "alice", 5, 15)]);
    expect(result.get("m1")).toEqual(new Set(["alice"]));
    expect(result.get("t1")).toEqual(new Set(["alice"]));
  });

  it("flags a meal and a table when an equipier registered on a meal overlaps a table", () => {
    // bob est equipier inscrit au repas m1 [12,14] ET joueur de la table t2 [13,16]
    const result = computeConflicts([occ("m1", "bob", 12, 14), occ("t2", "bob", 13, 16)]);
    expect(result.get("m1")).toEqual(new Set(["bob"]));
    expect(result.get("t2")).toEqual(new Set(["bob"]));
  });

  it("does not flag a table/meal pair that do not overlap in time", () => {
    const result = computeConflicts([occ("m1", "alice", 0, 10), occ("t1", "alice", 20, 30)]);
    expect(result.size).toBe(0);
  });

  it("never flags two occupations sharing the same source id", () => {
    // Meme personne apparaissant deux fois sur la meme source (garde-fou) : pas de conflit
    const result = computeConflicts([occ("t1", "alice", 0, 10), occ("t1", "alice", 0, 10)]);
    expect(result.size).toBe(0);
  });

  it("counts every distinct person in conflict on a source (chef/MJ visibility)", () => {
    // Deux equipiers du repas m1 [0,10] jouent aussi a des tables qui le chevauchent.
    // Le chef verra 'conflictingCount' = 2 ; le MJ de chaque table verra 1.
    const result = computeConflicts([
      occ("m1", "alice", 0, 10),
      occ("t1", "alice", 5, 15),
      occ("m1", "bob", 0, 10),
      occ("t2", "bob", 8, 12),
    ]);
    expect(result.get("m1")).toEqual(new Set(["alice", "bob"]));
    expect(result.get("t1")).toEqual(new Set(["alice"]));
    expect(result.get("t2")).toEqual(new Set(["bob"]));
  });

  it("isolates conflicts per user (a table with several players, only one in conflict)", () => {
    // alice et bob sont a la table t1 [0,10]. Seule alice a un autre engagement
    // (repas m1 [5,8]) qui la met en conflit ; bob n'apparait pas.
    const result = computeConflicts([
      occ("t1", "alice", 0, 10),
      occ("t1", "bob", 0, 10),
      occ("m1", "alice", 5, 8),
    ]);
    expect(result.get("t1")).toEqual(new Set(["alice"]));
    expect(result.get("m1")).toEqual(new Set(["alice"]));
  });

  it("handles three overlapping engagements of the same person", () => {
    const result = computeConflicts([
      occ("t1", "alice", 0, 10),
      occ("m1", "alice", 5, 15),
      occ("t2", "alice", 8, 20),
    ]);
    expect(result.get("t1")).toEqual(new Set(["alice"]));
    expect(result.get("m1")).toEqual(new Set(["alice"]));
    expect(result.get("t2")).toEqual(new Set(["alice"]));
  });
});
