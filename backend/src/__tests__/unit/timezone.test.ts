import { describe, it, expect } from "vitest";
import { TZ, getZoneOffsetMs, zonedWallClockToUtc, zonedYMD } from "../../util/timezone";

describe("getZoneOffsetMs", () => {
  it("returns +1h (CET) in winter", () => {
    // 2026-01-15 12:00 UTC -> Paris CET = UTC+1
    expect(getZoneOffsetMs(new Date("2026-01-15T12:00:00Z"), TZ)).toBe(60 * 60 * 1000);
  });

  it("returns +2h (CEST) in summer", () => {
    // 2026-07-15 12:00 UTC -> Paris CEST = UTC+2
    expect(getZoneOffsetMs(new Date("2026-07-15T12:00:00Z"), TZ)).toBe(2 * 60 * 60 * 1000);
  });
});

describe("zonedWallClockToUtc", () => {
  it("converts a winter wall-clock time (CET, UTC+1)", () => {
    // 15/01/2026 18h30 Paris = 17h30 UTC
    expect(zonedWallClockToUtc(2026, 1, 15, 18, 30, TZ).toISOString()).toBe(
      "2026-01-15T17:30:00.000Z"
    );
  });

  it("converts a summer wall-clock time (CEST, UTC+2)", () => {
    // 15/07/2026 18h30 Paris = 16h30 UTC
    expect(zonedWallClockToUtc(2026, 7, 15, 18, 30, TZ).toISOString()).toBe(
      "2026-07-15T16:30:00.000Z"
    );
  });

  // Bascule printemps 2026 : dimanche 29/03, 02h00 Paris -> 03h00 Paris (CET -> CEST).
  it("handles the spring DST boundary (2026-03-29, before the jump)", () => {
    // 29/03/2026 01h00 Paris (encore CET, UTC+1) = 00h00 UTC
    expect(zonedWallClockToUtc(2026, 3, 29, 1, 0, TZ).toISOString()).toBe(
      "2026-03-29T00:00:00.000Z"
    );
  });

  it("handles the spring DST boundary (2026-03-29, after the jump)", () => {
    // 29/03/2026 04h00 Paris (deja CEST, UTC+2) = 02h00 UTC
    expect(zonedWallClockToUtc(2026, 3, 29, 4, 0, TZ).toISOString()).toBe(
      "2026-03-29T02:00:00.000Z"
    );
  });

  // Bascule automne 2026 : dimanche 25/10, 03h00 Paris -> 02h00 Paris (CEST -> CET).
  it("handles the fall DST boundary (2026-10-25, before the jump)", () => {
    // 25/10/2026 01h00 Paris (encore CEST, UTC+2) = 23h00 UTC (24/10)
    expect(zonedWallClockToUtc(2026, 10, 25, 1, 0, TZ).toISOString()).toBe(
      "2026-10-24T23:00:00.000Z"
    );
  });

  it("handles the fall DST boundary (2026-10-25, after the jump)", () => {
    // 25/10/2026 04h00 Paris (deja CET, UTC+1) = 03h00 UTC
    expect(zonedWallClockToUtc(2026, 10, 25, 4, 0, TZ).toISOString()).toBe(
      "2026-10-25T03:00:00.000Z"
    );
  });
});

describe("zonedYMD", () => {
  it("returns the Paris calendar day for a UTC instant just after midnight UTC", () => {
    // 2026-06-01T23:30:00Z = 2026-06-02T01:30 Paris (CEST, UTC+2) -> jour suivant en Paris
    expect(zonedYMD(new Date("2026-06-01T23:30:00Z"), TZ)).toEqual({ y: 2026, mo: 6, d: 2 });
  });

  it("returns the Paris calendar day for a winter UTC instant", () => {
    // 2026-01-15T23:00:00Z = 2026-01-16T00:00 Paris (CET, UTC+1)
    expect(zonedYMD(new Date("2026-01-15T23:00:00Z"), TZ)).toEqual({ y: 2026, mo: 1, d: 16 });
  });
});
