import { XMLParser } from "fast-xml-parser";

const BGG_BASE_URL = "https://boardgamegeek.com/xmlapi2";
const TIMEOUT_MS = 5000;
const MAX_RETRIES = 1;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

export interface BGGSearchResult {
  bggId: string;
  name: string;
  yearPublished?: number;
}

export interface BGGThingDetail {
  bggId: string;
  name: string;
  yearPublished?: number;
  minPlayers?: number;
  maxPlayers?: number;
  playingTime?: number;
  description?: string;
  imageUrl?: string;
}

async function fetchWithRetry(url: string): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`BGG API returned ${response.status}`);
      }

      return await response.text();
    } catch (err) {
      lastError = err as Error;
    }
  }

  throw lastError;
}

export async function searchBGG(query: string): Promise<BGGSearchResult[]> {
  const url = `${BGG_BASE_URL}/search?query=${encodeURIComponent(query)}&type=boardgame`;

  let xml: string;
  try {
    xml = await fetchWithRetry(url);
  } catch {
    return [];
  }

  const parsed = parser.parse(xml);
  const items = parsed?.items?.item;
  if (!items) return [];

  const list = Array.isArray(items) ? items : [items];

  return list.slice(0, 20).map((item: Record<string, unknown>) => {
    const nameField = item.name;
    let name = "";
    if (Array.isArray(nameField)) {
      const primary = nameField.find(
        (n: Record<string, unknown>) => n["@_type"] === "primary"
      );
      name = (primary?.["@_value"] as string) || (nameField[0]?.["@_value"] as string) || "";
    } else if (nameField && typeof nameField === "object") {
      name = (nameField as Record<string, unknown>)["@_value"] as string || "";
    }

    const yearField = item.yearpublished;
    const yearPublished = yearField && typeof yearField === "object"
      ? parseInt((yearField as Record<string, unknown>)["@_value"] as string, 10)
      : undefined;

    return {
      bggId: String((item as Record<string, unknown>)["@_id"]),
      name,
      yearPublished: yearPublished && !isNaN(yearPublished) ? yearPublished : undefined,
    };
  });
}

export async function fetchBGGThing(bggId: string): Promise<BGGThingDetail | null> {
  const url = `${BGG_BASE_URL}/thing?id=${encodeURIComponent(bggId)}&stats=1`;

  let xml: string;
  try {
    xml = await fetchWithRetry(url);
  } catch {
    return null;
  }

  const parsed = parser.parse(xml);
  const item = parsed?.items?.item;
  if (!item) return null;

  const nameField = item.name;
  let name = "";
  if (Array.isArray(nameField)) {
    const primary = nameField.find(
      (n: Record<string, unknown>) => n["@_type"] === "primary"
    );
    name = (primary?.["@_value"] as string) || (nameField[0]?.["@_value"] as string) || "";
  } else if (nameField && typeof nameField === "object") {
    name = (nameField as Record<string, unknown>)["@_value"] as string || "";
  }

  const getIntAttr = (field: unknown): number | undefined => {
    if (field && typeof field === "object") {
      const val = parseInt((field as Record<string, unknown>)["@_value"] as string, 10);
      return isNaN(val) ? undefined : val;
    }
    return undefined;
  };

  return {
    bggId: String(item["@_id"]),
    name,
    yearPublished: getIntAttr(item.yearpublished),
    minPlayers: getIntAttr(item.minplayers),
    maxPlayers: getIntAttr(item.maxplayers),
    playingTime: getIntAttr(item.playingtime),
    description: typeof item.description === "string" ? item.description : undefined,
    imageUrl: typeof item.image === "string" ? item.image : undefined,
  };
}
