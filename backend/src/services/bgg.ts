import { XMLParser } from "fast-xml-parser";
import he from "he";
import env from "../config/env";
import logger from "../util/logger";

const BGG_BASE_URL = "https://boardgamegeek.com/xmlapi2";
const TIMEOUT_MS = 10000;

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

export function isBggAvailable(): boolean {
  return !!env.BGG_API_TOKEN;
}

function buildHeaders(): HeadersInit {
  if (env.BGG_API_TOKEN) {
    return { Authorization: `Bearer ${env.BGG_API_TOKEN}` };
  }
  return {};
}

function sanitizeDescription(raw: string): string {
  return he
    .decode(raw)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeImageUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("//")) return `https:${url}`;
  return url || undefined;
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal, headers: buildHeaders() });
  } finally {
    clearTimeout(timeoutId);
  }
}

// Retry sur 202 (BGG processing) avec backoff 2s/4s/8s
async function fetchBGGWithRetry(url: string): Promise<string> {
  const backoffs = [2000, 4000, 8000];

  for (let attempt = 0; attempt <= backoffs.length; attempt++) {
    let response: Response;
    try {
      response = await fetchWithTimeout(url);
    } catch {
      return Promise.reject(new Error("BGG network error or timeout"));
    }

    if (response.status === 202) {
      if (attempt < backoffs.length) {
        await new Promise((r) => setTimeout(r, backoffs[attempt]));
        continue;
      }
      throw new Error("BGG API still processing after max retries");
    }

    if (response.status === 401) {
      logger.error("BGG API returned 401 — check BGG_API_TOKEN");
      throw new Error("BGG API unauthorized");
    }

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get("Retry-After") || "10", 10);
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      // Un seul retry apres 429
      let retryResponse: Response;
      try {
        retryResponse = await fetchWithTimeout(url);
      } catch {
        throw new Error("BGG network error on 429 retry");
      }
      if (!retryResponse.ok) {
        throw new Error(`BGG API returned ${retryResponse.status} after 429 retry`);
      }
      return retryResponse.text();
    }

    if (!response.ok) {
      throw new Error(`BGG API returned ${response.status}`);
    }

    return response.text();
  }

  throw new Error("BGG API: max retries exceeded");
}

export async function searchBGG(query: string): Promise<BGGSearchResult[]> {
  if (!env.BGG_API_TOKEN) return [];

  const url = `${BGG_BASE_URL}/search?query=${encodeURIComponent(query)}&type=boardgame`;

  let xml: string;
  try {
    xml = await fetchBGGWithRetry(url);
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
      const primary = nameField.find((n: Record<string, unknown>) => n["@_type"] === "primary");
      name = (primary?.["@_value"] as string) || (nameField[0]?.["@_value"] as string) || "";
    } else if (nameField && typeof nameField === "object") {
      name = ((nameField as Record<string, unknown>)["@_value"] as string) || "";
    }

    const yearField = item.yearpublished;
    const yearPublished =
      yearField && typeof yearField === "object"
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
  if (!env.BGG_API_TOKEN) return null;

  const url = `${BGG_BASE_URL}/thing?id=${encodeURIComponent(bggId)}&stats=1`;

  let xml: string;
  try {
    xml = await fetchBGGWithRetry(url);
  } catch {
    return null;
  }

  const parsed = parser.parse(xml);
  const item = parsed?.items?.item;
  if (!item) return null;

  const nameField = item.name;
  let name = "";
  if (Array.isArray(nameField)) {
    const primary = nameField.find((n: Record<string, unknown>) => n["@_type"] === "primary");
    name = (primary?.["@_value"] as string) || (nameField[0]?.["@_value"] as string) || "";
  } else if (nameField && typeof nameField === "object") {
    name = ((nameField as Record<string, unknown>)["@_value"] as string) || "";
  }

  const getIntAttr = (field: unknown): number | undefined => {
    if (field && typeof field === "object") {
      const val = parseInt((field as Record<string, unknown>)["@_value"] as string, 10);
      return isNaN(val) ? undefined : val;
    }
    return undefined;
  };

  const rawDescription = typeof item.description === "string" ? item.description : undefined;
  const rawImageUrl = typeof item.image === "string" ? item.image : undefined;

  return {
    bggId: String(item["@_id"]),
    name,
    yearPublished: getIntAttr(item.yearpublished),
    minPlayers: getIntAttr(item.minplayers),
    maxPlayers: getIntAttr(item.maxplayers),
    playingTime: getIntAttr(item.playingtime),
    description: rawDescription ? sanitizeDescription(rawDescription) : undefined,
    imageUrl: normalizeImageUrl(rawImageUrl),
  };
}
