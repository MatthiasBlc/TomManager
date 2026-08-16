import { describe, it, expect } from "vitest";
import {
  request,
  setupAdmin,
  createTestEvent,
  addTestParticipant,
  KITCHEN_WIDE_EVENT_BOUNDS,
} from "../setup/testHelpers";
import prisma from "../../util/db";

async function enablePreference(userId: string, key: string) {
  await prisma.userPreference.upsert({
    where: { userId_key: { userId, key } },
    create: { userId, key, value: true },
    update: { value: true },
  });
}

// Un event avec sa cuisine et deux repas : le premier garni, le second vide (un
// creneau sans recette doit rester visible pour l'equipe courses).
async function setupEventWithMeals() {
  const { user: admin, cookie: adminCookie } = await setupAdmin({
    email: "kitchenadmin@example.com",
    username: "kitchenadmin",
  });
  const event = await createTestEvent(adminCookie, KITCHEN_WIDE_EVENT_BOUNDS);
  const eventKitchen = await prisma.eventKitchen.create({ data: { eventId: event.id } });

  const dinner = await prisma.meal.create({
    data: {
      eventKitchenId: eventKitchen.id,
      name: "Dîner du lundi",
      service: "DINNER",
      startDateTime: new Date("2026-06-01T18:30:00Z"),
      endDateTime: new Date("2026-06-01T21:00:00Z"),
    },
  });
  await prisma.mealIngredient.createMany({
    data: [
      // `position` explicite : la vue "par repas" rend la recette dans l'ordre
      // compose par le chef, pas dans l'ordre d'insertion en base.
      { mealId: dinner.id, name: "farine", quantity: 500, unit: "G", note: "type 55", position: 0 },
      { mealId: dinner.id, name: "miel", quantity: 250, unit: "G", note: null, position: 1 },
    ],
  });

  const lunch = await prisma.meal.create({
    data: {
      eventKitchenId: eventKitchen.id,
      name: "Déjeuner du mardi",
      service: "LUNCH",
      startDateTime: new Date("2026-06-02T10:30:00Z"),
      endDateTime: new Date("2026-06-02T13:00:00Z"),
    },
  });
  await prisma.mealIngredient.createMany({
    data: [{ mealId: lunch.id, name: "farine", quantity: 1, unit: "KG", note: null }],
  });

  // Repas sans aucun ingredient
  await prisma.meal.create({
    data: {
      eventKitchenId: eventKitchen.id,
      name: "Dîner du mardi",
      service: "DINNER",
      startDateTime: new Date("2026-06-02T18:30:00Z"),
      endDateTime: new Date("2026-06-02T21:00:00Z"),
    },
  });

  return { admin, adminCookie, event, eventKitchen };
}

describe("Shopping list API", () => {
  describe("GET /api/events/:eventId/kitchen/shopping", () => {
    it("refuse un participant ordinaire", async () => {
      const { event } = await setupEventWithMeals();
      const { cookie } = await addTestParticipant(event.id);

      const res = await request
        .get(`/api/events/${event.id}/kitchen/shopping`)
        .set("Cookie", cookie);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("COURSES_ACCESS_REQUIRED");
    });

    it("refuse un chef cuisine", async () => {
      const { event, eventKitchen } = await setupEventWithMeals();
      const { user, cookie } = await addTestParticipant(event.id, {
        email: "chef@example.com",
        username: "chef1",
      });
      await prisma.kitchenChef.create({
        data: { eventKitchenId: eventKitchen.id, userId: user.id, source: "MANUAL" },
      });

      const res = await request
        .get(`/api/events/${event.id}/kitchen/shopping`)
        .set("Cookie", cookie);

      expect(res.status).toBe(403);
    });

    it("refuse un admin qui n'a pas coche Gestion courses", async () => {
      const { event, adminCookie } = await setupEventWithMeals();

      const res = await request
        .get(`/api/events/${event.id}/kitchen/shopping`)
        .set("Cookie", adminCookie);

      expect(res.status).toBe(403);
    });

    it("refuse un responsable cuisine : admin.kitchen ne donne pas l'acces courses", async () => {
      const { event, admin, adminCookie } = await setupEventWithMeals();
      await enablePreference(admin.id, "admin.kitchen");

      const res = await request
        .get(`/api/events/${event.id}/kitchen/shopping`)
        .set("Cookie", adminCookie);

      expect(res.status).toBe(403);
    });

    it("autorise un admin ayant coche Gestion courses", async () => {
      const { event, admin, adminCookie } = await setupEventWithMeals();
      await enablePreference(admin.id, "admin.courses");

      const res = await request
        .get(`/api/events/${event.id}/kitchen/shopping`)
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.byMeal).toHaveLength(3);
    });

    it("autorise un membre de l'equipe courses, sans droit admin", async () => {
      const { event, eventKitchen } = await setupEventWithMeals();
      const { user, cookie } = await addTestParticipant(event.id, {
        email: "courses@example.com",
        username: "courses1",
      });
      await prisma.kitchenCoursesMember.create({
        data: { eventKitchenId: eventKitchen.id, userId: user.id },
      });

      const res = await request
        .get(`/api/events/${event.id}/kitchen/shopping`)
        .set("Cookie", cookie);

      expect(res.status).toBe(200);
    });

    it("renvoie les trois vues, le repas sans ingredient n'existant que dans byMeal", async () => {
      const { event, eventKitchen } = await setupEventWithMeals();
      const { user, cookie } = await addTestParticipant(event.id, {
        email: "courses@example.com",
        username: "courses1",
      });
      await prisma.kitchenCoursesMember.create({
        data: { eventKitchenId: eventKitchen.id, userId: user.id },
      });

      const res = await request
        .get(`/api/events/${event.id}/kitchen/shopping`)
        .set("Cookie", cookie);
      const { byMeal, flat, aggregated } = res.body.data;

      // Vue 1 : les 3 repas, dans l'ordre chronologique
      expect(byMeal.map((m: { mealName: string }) => m.mealName)).toEqual([
        "Dîner du lundi",
        "Déjeuner du mardi",
        "Dîner du mardi",
      ]);
      expect(byMeal[2].ingredients).toEqual([]);
      // ... et chaque recette dans l'ordre compose par le chef (position), pas
      // trie par nom : l'equipe courses lit la fiche telle qu'elle a ete ecrite.
      expect(byMeal[0].ingredients.map((i: { name: string }) => i.name)).toEqual([
        "farine",
        "miel",
      ]);

      // Vue 2 : 3 lignes (le repas vide n'en produit aucune), triees par nom
      expect(flat).toHaveLength(3);
      expect(flat.map((l: { name: string }) => l.name)).toEqual(["farine", "farine", "miel"]);

      // Vue 3 : les deux lignes de farine fusionnent, 500 g + 1 kg = 1,5 kg
      expect(aggregated).toHaveLength(2);
      expect(aggregated[0]).toMatchObject({ name: "farine", quantity: 1.5, unit: "KG" });
      expect(aggregated[0].mealNames).toEqual(["Dîner du lundi", "Déjeuner du mardi"]);
      expect(aggregated[0].notes).toEqual([{ mealName: "Dîner du lundi", note: "type 55" }]);
    });

    it("renvoie trois listes vides quand la cuisine n'a jamais ete initialisee", async () => {
      const { user, cookie } = await setupAdmin({
        email: "solo@example.com",
        username: "soloadmin",
      });
      await enablePreference(user.id, "admin.courses");
      const event = await createTestEvent(cookie);

      const res = await request
        .get(`/api/events/${event.id}/kitchen/shopping`)
        .set("Cookie", cookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ byMeal: [], flat: [], aggregated: [] });
    });
  });

  describe("GET /api/events/:eventId/kitchen/shopping/export", () => {
    const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    async function setupExporter() {
      const { event, admin, adminCookie } = await setupEventWithMeals();
      await enablePreference(admin.id, "admin.courses");
      return { event, cookie: adminCookie };
    }

    it.each(["by-meal", "flat", "aggregated"])("exporte la vue %s en xlsx", async (view) => {
      const { event, cookie } = await setupExporter();

      const res = await request
        .get(`/api/events/${event.id}/kitchen/shopping/export?view=${view}`)
        .set("Cookie", cookie)
        .buffer(true)
        .parse((response, callback) => {
          const chunks: Buffer[] = [];
          response.on("data", (chunk: Buffer) => chunks.push(chunk));
          response.on("end", () => callback(null, Buffer.concat(chunks)));
        });

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain(XLSX_MIME);
      expect(res.headers["content-disposition"]).toContain("attachment");
      // Un .xlsx est une archive zip : signature "PK"
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body.subarray(0, 2).toString()).toBe("PK");
    });

    it("rejette une vue inconnue", async () => {
      const { event, cookie } = await setupExporter();

      const res = await request
        .get(`/api/events/${event.id}/kitchen/shopping/export?view=nope`)
        .set("Cookie", cookie);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_EXPORT_VIEW");
    });

    it("rejette l'absence de parametre view", async () => {
      const { event, cookie } = await setupExporter();

      const res = await request
        .get(`/api/events/${event.id}/kitchen/shopping/export`)
        .set("Cookie", cookie);

      expect(res.status).toBe(400);
    });

    it("refuse l'export a qui n'a pas l'acces courses", async () => {
      const { event } = await setupEventWithMeals();
      const { cookie } = await addTestParticipant(event.id);

      const res = await request
        .get(`/api/events/${event.id}/kitchen/shopping/export?view=flat`)
        .set("Cookie", cookie);

      expect(res.status).toBe(403);
    });
  });
});
