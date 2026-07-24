import {
  getZoneOffsetMs,
  zonedWallClockToUtc,
  parisWallClockParts,
  parisDateInputValue,
  parisTimeInputValue,
  parisDateTimeInputValue,
  parisWallClockToUtcIso,
  dateTimeLocalToParisUtcIso,
  dateAndTimeToParisUtcIso,
  toParisFakeUtc,
  fromParisFakeUtc,
  formatFakeUtcDate,
} from "../utils/dateTime";

const PARIS_TZ = "Europe/Paris";

describe("getZoneOffsetMs", () => {
  it("returns +1h (CET) in winter", () => {
    expect(getZoneOffsetMs(new Date("2026-01-15T12:00:00Z"), PARIS_TZ)).toBe(60 * 60 * 1000);
  });

  it("returns +2h (CEST) in summer", () => {
    expect(getZoneOffsetMs(new Date("2026-07-15T12:00:00Z"), PARIS_TZ)).toBe(2 * 60 * 60 * 1000);
  });
});

describe("zonedWallClockToUtc", () => {
  it("converts a winter wall-clock time (CET, UTC+1)", () => {
    expect(zonedWallClockToUtc(2026, 1, 15, 18, 30, PARIS_TZ).toISOString()).toBe(
      "2026-01-15T17:30:00.000Z"
    );
  });

  it("converts a summer wall-clock time (CEST, UTC+2)", () => {
    expect(zonedWallClockToUtc(2026, 7, 15, 18, 30, PARIS_TZ).toISOString()).toBe(
      "2026-07-15T16:30:00.000Z"
    );
  });

  it("handles the spring DST boundary (2026-03-29, before the jump)", () => {
    expect(zonedWallClockToUtc(2026, 3, 29, 1, 0, PARIS_TZ).toISOString()).toBe(
      "2026-03-29T00:00:00.000Z"
    );
  });

  it("handles the spring DST boundary (2026-03-29, after the jump)", () => {
    expect(zonedWallClockToUtc(2026, 3, 29, 4, 0, PARIS_TZ).toISOString()).toBe(
      "2026-03-29T02:00:00.000Z"
    );
  });

  it("handles the fall DST boundary (2026-10-25, before the jump)", () => {
    expect(zonedWallClockToUtc(2026, 10, 25, 1, 0, PARIS_TZ).toISOString()).toBe(
      "2026-10-24T23:00:00.000Z"
    );
  });

  it("handles the fall DST boundary (2026-10-25, after the jump)", () => {
    expect(zonedWallClockToUtc(2026, 10, 25, 4, 0, PARIS_TZ).toISOString()).toBe(
      "2026-10-25T03:00:00.000Z"
    );
  });
});

describe("parisWallClockParts", () => {
  it("reads Y/M/D/H/Min in Paris time from a UTC instant (summer)", () => {
    expect(parisWallClockParts("2026-07-15T16:30:00.000Z")).toEqual({
      y: 2026,
      mo: 7,
      d: 15,
      h: 18,
      min: 30,
    });
  });

  it("reads Y/M/D/H/Min in Paris time from a UTC instant (winter, crossing midnight)", () => {
    // 23h30 UTC + 1h (CET) = 00h30 le lendemain
    expect(parisWallClockParts("2026-01-15T23:30:00.000Z")).toEqual({
      y: 2026,
      mo: 1,
      d: 16,
      h: 0,
      min: 30,
    });
  });
});

describe("parisDateInputValue / parisTimeInputValue / parisDateTimeInputValue", () => {
  it("formats an input date value in Paris time", () => {
    expect(parisDateInputValue("2026-07-15T16:30:00.000Z")).toBe("2026-07-15");
  });

  it("formats an input time value in Paris time", () => {
    expect(parisTimeInputValue("2026-07-15T16:30:00.000Z")).toBe("18:30");
  });

  it("formats an input datetime-local value in Paris time", () => {
    expect(parisDateTimeInputValue("2026-07-15T16:30:00.000Z")).toBe("2026-07-15T18:30");
  });

  it("rolls over to the next Paris calendar day near midnight (winter)", () => {
    expect(parisDateInputValue("2026-01-15T23:30:00.000Z")).toBe("2026-01-16");
  });
});

describe("parisWallClockToUtcIso / dateTimeLocalToParisUtcIso / dateAndTimeToParisUtcIso", () => {
  it("converts Paris wall-clock parts to a UTC ISO string (summer)", () => {
    expect(parisWallClockToUtcIso(2026, 7, 15, 18, 30)).toBe("2026-07-15T16:30:00.000Z");
  });

  it("converts a datetime-local value assumed to be Paris time (winter)", () => {
    expect(dateTimeLocalToParisUtcIso("2026-01-15T18:30")).toBe("2026-01-15T17:30:00.000Z");
  });

  it("converts separate date + time inputs assumed to be Paris time", () => {
    expect(dateAndTimeToParisUtcIso("2026-07-15", "18:30")).toBe("2026-07-15T16:30:00.000Z");
  });

  it("round-trips across the spring DST boundary", () => {
    expect(dateTimeLocalToParisUtcIso("2026-03-29T04:00")).toBe("2026-03-29T02:00:00.000Z");
  });

  it("round-trips across the fall DST boundary", () => {
    expect(dateTimeLocalToParisUtcIso("2026-10-25T04:00")).toBe("2026-10-25T03:00:00.000Z");
  });
});

describe("toParisFakeUtc / fromParisFakeUtc", () => {
  it("produces a Date whose UTC getters equal the Paris wall-clock time", () => {
    const fake = toParisFakeUtc("2026-07-15T16:30:00.000Z");
    expect(fake.getUTCFullYear()).toBe(2026);
    expect(fake.getUTCMonth()).toBe(6); // 0-index -> juillet
    expect(fake.getUTCDate()).toBe(15);
    expect(fake.getUTCHours()).toBe(18);
    expect(fake.getUTCMinutes()).toBe(30);
  });

  it("round-trips fromParisFakeUtc(toParisFakeUtc(iso)) === iso (summer)", () => {
    const iso = new Date("2026-07-15T16:30:00.000Z").toISOString();
    expect(fromParisFakeUtc(toParisFakeUtc(iso))).toBe(iso);
  });

  it("round-trips fromParisFakeUtc(toParisFakeUtc(iso)) === iso (winter)", () => {
    const iso = new Date("2026-01-15T17:30:00.000Z").toISOString();
    expect(fromParisFakeUtc(toParisFakeUtc(iso))).toBe(iso);
  });

  it("round-trips across the spring DST boundary", () => {
    const iso = new Date("2026-03-29T02:00:00.000Z").toISOString();
    expect(fromParisFakeUtc(toParisFakeUtc(iso))).toBe(iso);
  });

  it("round-trips across the fall DST boundary", () => {
    const iso = new Date("2026-10-25T03:00:00.000Z").toISOString();
    expect(fromParisFakeUtc(toParisFakeUtc(iso))).toBe(iso);
  });
});

describe("formatFakeUtcDate", () => {
  it("formats a fake-UTC Date using its UTC getters, never local ones", () => {
    const fake = toParisFakeUtc("2026-07-15T16:30:00.000Z"); // fake UTC = 15/07/2026 18:30
    expect(formatFakeUtcDate(fake)).toBe("15/07/2026");
  });
});
