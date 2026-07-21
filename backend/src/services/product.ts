import prisma from "../util/db";
import { Prisma } from "@prisma/client";

/**
 * Find or create Product rows by name (normalized lowercase, pattern identique a Tag).
 */
export async function findOrCreateProducts(names: string[], tx?: Prisma.TransactionClient) {
  const client = tx || prisma;
  const normalized = [
    ...new Set(names.map((n) => n.trim().toLowerCase()).filter((n) => n.length > 0)),
  ];

  if (normalized.length === 0) return [];

  const existing = await client.product.findMany({
    where: { name: { in: normalized } },
  });

  const existingNames = new Set(existing.map((p) => p.name));
  const toCreate = normalized.filter((n) => !existingNames.has(n));

  const created = await Promise.all(toCreate.map((name) => client.product.create({ data: { name } })));

  return [...existing, ...created];
}

/**
 * Search products by prefix for autocomplete.
 */
export async function searchProducts(query: string, limit = 10) {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  return prisma.product.findMany({
    where: { name: { startsWith: q } },
    orderBy: { name: "asc" },
    take: limit,
  });
}
