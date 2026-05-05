import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { searchBGG, fetchBGGThing, isBggAvailable } from "../../services/bgg";

// vi.hoisted garantit que mockEnv est disponible avant le hoisting de vi.mock
const mockEnv = vi.hoisted(() => ({ BGG_API_TOKEN: "test-token" }));

vi.mock("../../config/env", () => ({ default: mockEnv }));
vi.mock("../../util/logger", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Helpers XML
const SEARCH_XML = `<?xml version="1.0" encoding="utf-8"?>
<items total="2">
  <item type="boardgame" id="13">
    <name type="primary" sortindex="1" value="Catan"/>
    <yearpublished value="1995"/>
  </item>
  <item type="boardgame" id="42">
    <name type="primary" sortindex="1" value="Catan: Seafarers"/>
    <yearpublished value="1997"/>
  </item>
</items>`;

const THING_XML = `<?xml version="1.0" encoding="utf-8"?>
<items>
  <item type="boardgame" id="13">
    <name type="primary" sortindex="1" value="Catan"/>
    <yearpublished value="1995"/>
    <minplayers value="3"/>
    <maxplayers value="4"/>
    <playingtime value="90"/>
    <description>Settle the island of Catan &amp; build. &lt;b&gt;Bold text&lt;/b&gt;</description>
    <image>//cdn.boardgamegeek.com/catan.jpg</image>
  </item>
</items>`;

const EMPTY_XML = `<?xml version="1.0" encoding="utf-8"?><items total="0"></items>`;

function mockResponse(status: number, body: string, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (key: string) => headers[key.toLowerCase()] ?? null },
    text: () => Promise.resolve(body),
  } as unknown as Response;
}

beforeEach(() => {
  mockEnv.BGG_API_TOKEN = "test-token";
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse(200, SEARCH_XML)));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// isBggAvailable
// ---------------------------------------------------------------------------
describe("isBggAvailable", () => {
  it("returns true when token is set", () => {
    mockEnv.BGG_API_TOKEN = "some-token";
    expect(isBggAvailable()).toBe(true);
  });

  it("returns false when token is empty", () => {
    mockEnv.BGG_API_TOKEN = "";
    expect(isBggAvailable()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// searchBGG
// ---------------------------------------------------------------------------
describe("searchBGG", () => {
  it("returns [] when token is absent", async () => {
    mockEnv.BGG_API_TOKEN = "";
    const results = await searchBGG("catan");
    expect(results).toEqual([]);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("sends Authorization Bearer header when token is present", async () => {
    await searchBGG("catan");
    const [, options] = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0];
    expect((options as RequestInit).headers).toMatchObject({
      Authorization: "Bearer test-token",
    });
  });

  it("parses search results correctly", async () => {
    const results = await searchBGG("catan");
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ bggId: "13", name: "Catan", yearPublished: 1995 });
    expect(results[1]).toMatchObject({ bggId: "42", name: "Catan: Seafarers", yearPublished: 1997 });
  });

  it("returns [] when BGG returns 0 results", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse(200, EMPTY_XML)));
    const results = await searchBGG("xyznothing");
    expect(results).toEqual([]);
  });

  it("returns [] on network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    const results = await searchBGG("catan");
    expect(results).toEqual([]);
  });

  it("returns [] on 401", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse(401, "")));
    const results = await searchBGG("catan");
    expect(results).toEqual([]);
  });

  it("retries on 202 then returns results", async () => {
    vi.useFakeTimers();
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls++;
        if (calls <= 2) return mockResponse(202, "");
        return mockResponse(200, SEARCH_XML);
      })
    );

    const promise = searchBGG("catan");
    await vi.runAllTimersAsync();
    const results = await promise;

    expect(calls).toBe(3);
    expect(results).toHaveLength(2);
  });

  it("returns [] after max 202 retries", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse(202, "")));

    const promise = searchBGG("catan");
    await vi.runAllTimersAsync();
    const results = await promise;

    expect(results).toEqual([]);
  });

  it("retries once on 429 then returns results", async () => {
    vi.useFakeTimers();
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls++;
        if (calls === 1) return mockResponse(429, "", { "retry-after": "1" });
        return mockResponse(200, SEARCH_XML);
      })
    );

    const promise = searchBGG("catan");
    await vi.runAllTimersAsync();
    const results = await promise;

    expect(calls).toBe(2);
    expect(results).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// fetchBGGThing
// ---------------------------------------------------------------------------
describe("fetchBGGThing", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse(200, THING_XML)));
  });

  it("returns null when token is absent", async () => {
    mockEnv.BGG_API_TOKEN = "";
    const result = await fetchBGGThing("13");
    expect(result).toBeNull();
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("maps all fields correctly", async () => {
    const result = await fetchBGGThing("13");
    expect(result).toMatchObject({
      bggId: "13",
      name: "Catan",
      yearPublished: 1995,
      minPlayers: 3,
      maxPlayers: 4,
      playingTime: 90,
    });
  });

  it("sanitizes description — decodes HTML entities and strips tags", async () => {
    const result = await fetchBGGThing("13");
    expect(result?.description).toBe("Settle the island of Catan & build. Bold text");
    expect(result?.description).not.toContain("&amp;");
    expect(result?.description).not.toContain("<b>");
  });

  it("normalizes imageUrl from // to https://", async () => {
    const result = await fetchBGGThing("13");
    expect(result?.imageUrl).toBe("https://cdn.boardgamegeek.com/catan.jpg");
  });

  it("returns null on network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    const result = await fetchBGGThing("13");
    expect(result).toBeNull();
  });

  it("returns null on 401 and logs an error", async () => {
    const { default: logger } = await import("../../util/logger");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse(401, "")));
    const result = await fetchBGGThing("13");
    expect(result).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("401"));
  });

  it("returns null when item is missing from response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse(200, EMPTY_XML)));
    const result = await fetchBGGThing("13");
    expect(result).toBeNull();
  });
});
