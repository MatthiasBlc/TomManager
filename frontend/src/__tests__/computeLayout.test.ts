import {
  formatSeatSummary,
  formatParticipantsHeading,
  formatVacantReservedSeats,
  computeSeatBreakdown,
  type SeatCounts,
} from "../components/planning/computeLayout";

describe("computeSeatBreakdown / formatSeatSummary / formatParticipantsHeading", () => {
  it("table sans reservation, places encore libres", () => {
    const t: SeatCounts = {
      confirmedCount: 3,
      maxPlayers: 5,
      reservedSeats: 0,
      confirmedOnReserved: 0,
    };
    expect(computeSeatBreakdown(t)).toEqual({
      normalSeats: 5,
      confirmedNormal: 3,
      openNormalSeats: 2,
      openReservedSeats: 0,
    });
    expect(formatSeatSummary(t)).toEqual({ total: "3/5 joueurs", normal: null, reserved: null });
    expect(formatParticipantsHeading(t)).toBe("Participants (3/5)");
    expect(formatVacantReservedSeats(computeSeatBreakdown(t).openReservedSeats)).toBeNull();
  });

  it("table sans reservation, complete", () => {
    const t: SeatCounts = {
      confirmedCount: 2,
      maxPlayers: 2,
      reservedSeats: 0,
      confirmedOnReserved: 0,
    };
    expect(computeSeatBreakdown(t).openNormalSeats).toBe(0);
    expect(formatParticipantsHeading(t)).toBe("Participants (2/2)");
  });

  it("reservation partiellement pourvue, places libres restantes (coexistence gap + places ouvertes)", () => {
    const t: SeatCounts = {
      confirmedCount: 2,
      maxPlayers: 5,
      reservedSeats: 2,
      confirmedOnReserved: 1,
    };
    expect(computeSeatBreakdown(t)).toEqual({
      normalSeats: 3,
      confirmedNormal: 1,
      openNormalSeats: 2,
      openReservedSeats: 1,
    });
    expect(formatSeatSummary(t)).toEqual({
      total: "2/5 joueurs",
      normal: "1/3 libres",
      reserved: "1/2 réservées",
    });
    expect(formatParticipantsHeading(t)).toBe("Places de la table (2/5 attribuées)");
    expect(formatVacantReservedSeats(1)).toBe("1 place réservée — pas encore attribuée");
  });

  it("reservation entierement pourvue, places libres restantes (pas de ligne fantome)", () => {
    const t: SeatCounts = {
      confirmedCount: 3,
      maxPlayers: 5,
      reservedSeats: 1,
      confirmedOnReserved: 1,
    };
    expect(computeSeatBreakdown(t).openReservedSeats).toBe(0);
    expect(computeSeatBreakdown(t).openNormalSeats).toBe(2);
    expect(formatParticipantsHeading(t)).toBe("Places de la table (3/5 attribuées)");
    expect(formatVacantReservedSeats(0)).toBeNull();
  });

  it("places normales epuisees mais reserve vacante, meme si reservedSeats < maxPlayers (piege silencieux)", () => {
    const t: SeatCounts = {
      confirmedCount: 2,
      maxPlayers: 4,
      reservedSeats: 2,
      confirmedOnReserved: 0,
    };
    const breakdown = computeSeatBreakdown(t);
    expect(breakdown.openNormalSeats).toBe(0);
    expect(breakdown.openReservedSeats).toBe(2);
    expect(formatVacantReservedSeats(breakdown.openReservedSeats)).toBe(
      "2 places réservées — pas encore attribuées"
    );
  });

  it("table 100% reservation, non entierement attribuee (cas reel signale)", () => {
    const t: SeatCounts = {
      confirmedCount: 3,
      maxPlayers: 4,
      reservedSeats: 4,
      confirmedOnReserved: 3,
    };
    const breakdown = computeSeatBreakdown(t);
    expect(breakdown.normalSeats).toBe(0);
    expect(breakdown.openNormalSeats).toBe(0);
    expect(breakdown.openReservedSeats).toBe(1);
    // "0/0 libre" ne porte aucune information : le badge doit disparaitre
    expect(formatSeatSummary(t)).toEqual({
      total: "3/4 joueurs",
      normal: null,
      reserved: "3/4 réservées",
    });
  });

  it("table 100% reservation, complete (aucune ambiguite a signaler)", () => {
    const t: SeatCounts = {
      confirmedCount: 3,
      maxPlayers: 3,
      reservedSeats: 3,
      confirmedOnReserved: 3,
    };
    const breakdown = computeSeatBreakdown(t);
    expect(breakdown.openNormalSeats).toBe(0);
    expect(breakdown.openReservedSeats).toBe(0);
    expect(formatVacantReservedSeats(breakdown.openReservedSeats)).toBeNull();
  });

  it("singulier vs pluriel dans le message de places vacantes", () => {
    expect(formatVacantReservedSeats(1)).toBe("1 place réservée — pas encore attribuée");
    expect(formatVacantReservedSeats(3)).toBe("3 places réservées — pas encore attribuées");
    expect(formatVacantReservedSeats(0)).toBeNull();
    expect(formatVacantReservedSeats(-1)).toBeNull();
  });
});
