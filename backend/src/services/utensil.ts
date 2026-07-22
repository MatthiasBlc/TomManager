import prisma from "../util/db";
import { Prisma } from "@prisma/client";

/**
 * Find or create Utensil rows by name (normalized lowercase, pattern identique a Product/Tag).
 */
export async function findOrCreateUtensils(names: string[], tx?: Prisma.TransactionClient) {
  const client = tx || prisma;
  const normalized = [
    ...new Set(names.map((n) => n.trim().toLowerCase()).filter((n) => n.length > 0)),
  ];

  if (normalized.length === 0) return [];

  const existing = await client.utensil.findMany({
    where: { name: { in: normalized } },
  });

  const existingNames = new Set(existing.map((u) => u.name));
  const toCreate = normalized.filter((n) => !existingNames.has(n));

  const created = await Promise.all(
    toCreate.map((name) => client.utensil.create({ data: { name } }))
  );

  return [...existing, ...created];
}

/**
 * Search utensils by prefix for autocomplete.
 */
export async function searchUtensils(query: string, limit = 10) {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  return prisma.utensil.findMany({
    where: { name: { startsWith: q } },
    orderBy: { name: "asc" },
    take: limit,
  });
}
