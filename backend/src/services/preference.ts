import createError from "http-errors";
import prisma from "../util/db";
import { PREFERENCE_KEYS, PreferenceKey } from "../schemas/preference";

const RESTRICTED_PREFIXES = ["admin.", "beta."];

// Retourne la map complete des preferences (cle absente en DB = false)
export async function getPreferences(userId: string): Promise<Record<PreferenceKey, boolean>> {
  const rows = await prisma.userPreference.findMany({ where: { userId } });

  const map = Object.fromEntries(PREFERENCE_KEYS.map((key) => [key, false])) as Record<
    PreferenceKey,
    boolean
  >;

  for (const row of rows) {
    if ((PREFERENCE_KEYS as readonly string[]).includes(row.key)) {
      map[row.key as PreferenceKey] = row.value;
    }
  }

  return map;
}

export async function updatePreferences(
  userId: string,
  updates: Partial<Record<PreferenceKey, boolean>>
): Promise<Record<PreferenceKey, boolean>> {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
  });
  if (!user) {
    throw createError(404, "User not found");
  }

  const keys = Object.keys(updates) as PreferenceKey[];
  const touchesRestricted = keys.some((key) =>
    RESTRICTED_PREFIXES.some((prefix) => key.startsWith(prefix))
  );
  if (touchesRestricted && user.role !== "ADMIN") {
    throw createError(403, "Admin access required");
  }

  await prisma.$transaction(
    keys.map((key) =>
      prisma.userPreference.upsert({
        where: { userId_key: { userId, key } },
        update: { value: updates[key]! },
        create: { userId, key, value: updates[key]! },
      })
    )
  );

  return getPreferences(userId);
}
