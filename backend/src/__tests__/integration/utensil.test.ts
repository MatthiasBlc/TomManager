import { describe, it, expect } from "vitest";
import { request, setupAdmin } from "../setup/testHelpers";
import prisma from "../../util/db";

describe("Kitchen utensils API", () => {
  describe("GET /api/kitchen/utensils", () => {
    it("rejects an unauthenticated request", async () => {
      const res = await request.get("/api/kitchen/utensils?q=fou");
      expect(res.status).toBe(401);
    });

    it("returns prefix matches, normalized lowercase (pattern identique a Product/Tag)", async () => {
      const { cookie } = await setupAdmin({
        email: "utensilsearch@example.com",
        username: "utensilsearch",
      });
      // skipDuplicates : Product/Utensil sont des catalogues jamais reinitialises
      // entre runs (globalSetup ne truncate pas ces tables, coherent avec le fait
      // qu'ils survivent aux events comme un vrai catalogue) — idempotent si ces
      // lignes existent deja d'un run precedent.
      await prisma.utensil.createMany({
        data: [{ name: "zesteur-a" }, { name: "zesteur-b" }, { name: "moulinette" }],
        skipDuplicates: true,
      });

      const res = await request.get("/api/kitchen/utensils?q=zesteur").set("Cookie", cookie);
      expect(res.status).toBe(200);
      expect(res.body.data.map((u: { name: string }) => u.name).sort()).toEqual([
        "zesteur-a",
        "zesteur-b",
      ]);
    });

    it("returns an empty array for an empty query", async () => {
      const { cookie } = await setupAdmin({
        email: "utensilempty@example.com",
        username: "utensilempty",
      });
      const res = await request.get("/api/kitchen/utensils?q=").set("Cookie", cookie);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });
});
