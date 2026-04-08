import prisma from "../util/db";
import { Prisma } from "@prisma/client";

/**
 * Find or create tags by name. Returns Tag records.
 * Names are normalized to lowercase and trimmed.
 */
export async function findOrCreateTags(names: string[], tx?: Prisma.TransactionClient) {
  const client = tx || prisma;
  const normalized = [
    ...new Set(names.map((n) => n.trim().toLowerCase()).filter((n) => n.length > 0)),
  ];

  if (normalized.length === 0) return [];

  const existing = await client.tag.findMany({
    where: { name: { in: normalized } },
  });

  const existingNames = new Set(existing.map((t) => t.name));
  const toCreate = normalized.filter((n) => !existingNames.has(n));

  const created = await Promise.all(toCreate.map((name) => client.tag.create({ data: { name } })));

  return [...existing, ...created];
}

/**
 * Search tags by prefix for autocomplete.
 */
export async function searchTags(query: string, limit = 10) {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  return prisma.tag.findMany({
    where: { name: { startsWith: q } },
    orderBy: { name: "asc" },
    take: limit,
  });
}
