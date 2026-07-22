import { describe, it, expect } from "vitest";
import {
  request,
  setupAdmin,
  createTestEvent,
  addTestParticipant,
  KITCHEN_WIDE_EVENT_BOUNDS,
} from "../setup/testHelpers";
import prisma from "../../util/db";

async function enableKitchenManager(userId: string) {
  await prisma.userPreference.upsert({
    where: { userId_key: { userId, key: "admin.kitchen" } },
    create: { userId, key: "admin.kitchen", value: true },
    update: { value: true },
  });
}

async function setupManager(suffix: string) {
  const { user, cookie } = await setupAdmin({
    email: `swapmgr-${suffix}@example.com`,
    username: `swapmgr${suffix}`,
  });
  await enableKitchenManager(user.id);
  return { user, cookie };
}

async function setupChef(
  eventId: string,
  managerCookie: string[],
  overrides: { email: string; username: string }
) {
  const { user, cookie } = await addTestParticipant(eventId, overrides);
  await request
    .post(`/api/events/${eventId}/kitchen/chefs`)
    .set("Cookie", managerCookie)
    .send({ userId: user.id });
  return { user, cookie };
}

interface MealOpts {
  date: string;
  service: "LUNCH" | "DINNER";
  name: string;
  ingredients?: { name: string; quantity: number; unit: string }[];
  utensils?: { name: string }[];
}

// Cree un repas deja assigne au chef directement en base (la creation manuelle
// hors-grille a ete retiree, cf Admin Chef point 3 ; tous les repas naissent
// desormais de generatePlanning). Le nom/ingredients/ustensiles passent par un
// PATCH via l'API pour conserver la resolution find-or-create des catalogues
// Product/Utensil. Les horaires approximatifs (LUNCH/DINNER) suffisent ici :
// l'anti-collision de generatePlanning est cle par (startDateTime, service), donc
// deux services differents ne collisionnent jamais quelle que soit l'heure exacte.
async function createMeal(eventId: string, chefCookie: string[], opts: MealOpts) {
  const meResult = await request.get("/api/auth/me").set("Cookie", chefCookie);
  const chefUserId = meResult.body.user.id;
  const eventKitchen = await prisma.eventKitchen.upsert({
    where: { eventId },
    create: { eventId },
    update: {},
  });
  const hours = opts.service === "LUNCH" ? ["10:30:00", "13:00:00"] : ["18:30:00", "21:00:00"];
  const meal = await prisma.meal.create({
    data: {
      eventKitchenId: eventKitchen.id,
      chefUserId,
      name: opts.name,
      service: opts.service,
      startDateTime: new Date(`${opts.date}T${hours[0]}Z`),
      endDateTime: new Date(`${opts.date}T${hours[1]}Z`),
      maxAssistants: 0,
    },
  });

  const patchRes = await request
    .patch(`/api/events/${eventId}/kitchen/meals/${meal.id}`)
    .set("Cookie", chefCookie)
    .send({
      name: opts.name,
      ...(opts.ingredients ? { ingredients: opts.ingredients } : {}),
      ...(opts.utensils ? { utensils: opts.utensils } : {}),
    });
  return patchRes.body.data;
}

async function getMeal(eventId: string, cookie: string[], mealId: string) {
  const res = await request.get(`/api/events/${eventId}/kitchen`).set("Cookie", cookie);
  return res.body.data.meals.find((m: { id: string }) => m.id === mealId);
}

// Deux chefs avec chacun un repas (recette + 1 equipier). Retourne tout le contexte.
async function setupTwoChefsWithMeals(suffix: string) {
  const { cookie: managerCookie } = await setupManager(suffix);
  const event = await createTestEvent(managerCookie, KITCHEN_WIDE_EVENT_BOUNDS);

  const chef1 = await setupChef(event.id, managerCookie, {
    email: `swapchef1-${suffix}@example.com`,
    username: `swapchef1${suffix}`,
  });
  const chef2 = await setupChef(event.id, managerCookie, {
    email: `swapchef2-${suffix}@example.com`,
    username: `swapchef2${suffix}`,
  });

  const meal1 = await createMeal(event.id, chef1.cookie, {
    date: "2026-06-01",
    service: "DINNER",
    name: "Tartiflette",
    ingredients: [{ name: "Reblochon", quantity: 1, unit: "PIECE" }],
    utensils: [{ name: "Plat a gratin" }],
  });
  const meal2 = await createMeal(event.id, chef2.cookie, {
    date: "2026-06-01",
    service: "LUNCH",
    name: "Raclette",
    ingredients: [{ name: "Fromage a raclette", quantity: 2, unit: "KG" }],
    utensils: [{ name: "Appareil a raclette" }],
  });

  // Capacite + 1 equipier par repas
  await request
    .patch(`/api/events/${event.id}/kitchen/meals/${meal1.id}`)
    .set("Cookie", managerCookie)
    .send({ maxAssistants: 2 });
  await request
    .patch(`/api/events/${event.id}/kitchen/meals/${meal2.id}`)
    .set("Cookie", managerCookie)
    .send({ maxAssistants: 2 });

  const eq1 = await addTestParticipant(event.id, {
    email: `swapeq1-${suffix}@example.com`,
    username: `swapeq1${suffix}`,
  });
  const eq2 = await addTestParticipant(event.id, {
    email: `swapeq2-${suffix}@example.com`,
    username: `swapeq2${suffix}`,
  });
  await request
    .post(`/api/events/${event.id}/kitchen/meals/${meal1.id}/assistants`)
    .set("Cookie", eq1.cookie);
  await request
    .post(`/api/events/${event.id}/kitchen/meals/${meal2.id}/assistants`)
    .set("Cookie", eq2.cookie);

  return { event, managerCookie, chef1, chef2, meal1, meal2, eq1, eq2 };
}

describe("Meal swap API", () => {
  it("swaps recipe + chef but keeps assistants and schedule on the original slots", async () => {
    const { event, managerCookie, chef1, chef2, meal1, meal2, eq1, eq2 } =
      await setupTwoChefsWithMeals("s1");

    const proposeRes = await request
      .post(`/api/events/${event.id}/kitchen/swaps`)
      .set("Cookie", chef1.cookie)
      .send({ targetMealId: meal2.id });
    expect(proposeRes.status).toBe(201);
    const swapId = proposeRes.body.data.id;

    const acceptRes = await request
      .post(`/api/events/${event.id}/kitchen/swaps/${swapId}/accept`)
      .set("Cookie", chef2.cookie);
    expect(acceptRes.status).toBe(200);

    const meal1After = await getMeal(event.id, managerCookie, meal1.id);
    const meal2After = await getMeal(event.id, managerCookie, meal2.id);

    // La recette (chef + nom + ingredients + ustensiles) a suivi le chef.
    expect(meal1After.chef.id).toBe(chef2.user.id);
    expect(meal1After.name).toBe("Raclette");
    expect(meal1After.ingredients.map((i: { name: string }) => i.name)).toEqual([
      "Fromage a raclette",
    ]);
    expect(meal1After.utensils.map((u: { name: string }) => u.name)).toEqual([
      "Appareil a raclette",
    ]);

    expect(meal2After.chef.id).toBe(chef1.user.id);
    expect(meal2After.name).toBe("Tartiflette");
    expect(meal2After.ingredients.map((i: { name: string }) => i.name)).toEqual(["Reblochon"]);
    expect(meal2After.utensils.map((u: { name: string }) => u.name)).toEqual(["Plat a gratin"]);

    // Les horaires/service et les equipiers restent attaches au creneau d'origine.
    expect(meal1After.service).toBe("DINNER");
    expect(meal1After.startDateTime).toBe(meal1.startDateTime);
    expect(meal1After.assistants.map((a: { id: string }) => a.id)).toEqual([eq1.user.id]);
    expect(meal2After.service).toBe("LUNCH");
    expect(meal2After.startDateTime).toBe(meal2.startDateTime);
    expect(meal2After.assistants.map((a: { id: string }) => a.id)).toEqual([eq2.user.id]);

    // La demande est marquee ACCEPTED.
    const swap = await prisma.mealSwapRequest.findUnique({ where: { id: swapId } });
    expect(swap?.status).toBe("ACCEPTED");
  });

  it("rejects a second pending request on the same meals", async () => {
    const { event, chef1, meal2 } = await setupTwoChefsWithMeals("s2");

    await request
      .post(`/api/events/${event.id}/kitchen/swaps`)
      .set("Cookie", chef1.cookie)
      .send({ targetMealId: meal2.id });
    const res = await request
      .post(`/api/events/${event.id}/kitchen/swaps`)
      .set("Cookie", chef1.cookie)
      .send({ targetMealId: meal2.id });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("SWAP_ALREADY_PENDING");
  });

  it("lets only the target chef accept the request", async () => {
    const { event, chef1, meal2 } = await setupTwoChefsWithMeals("s3");

    const proposeRes = await request
      .post(`/api/events/${event.id}/kitchen/swaps`)
      .set("Cookie", chef1.cookie)
      .send({ targetMealId: meal2.id });
    const swapId = proposeRes.body.data.id;

    // Le demandeur ne peut pas accepter sa propre demande.
    const res = await request
      .post(`/api/events/${event.id}/kitchen/swaps/${swapId}/accept`)
      .set("Cookie", chef1.cookie);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("lets the target reject a request without swapping", async () => {
    const { event, managerCookie, chef1, chef2, meal1, meal2 } =
      await setupTwoChefsWithMeals("s4");

    const proposeRes = await request
      .post(`/api/events/${event.id}/kitchen/swaps`)
      .set("Cookie", chef1.cookie)
      .send({ targetMealId: meal2.id });
    const swapId = proposeRes.body.data.id;

    const rejectRes = await request
      .post(`/api/events/${event.id}/kitchen/swaps/${swapId}/reject`)
      .set("Cookie", chef2.cookie);
    expect(rejectRes.status).toBe(200);

    const meal1After = await getMeal(event.id, managerCookie, meal1.id);
    expect(meal1After.chef.id).toBe(chef1.user.id);
    expect(meal1After.name).toBe("Tartiflette");

    const swap = await prisma.mealSwapRequest.findUnique({ where: { id: swapId } });
    expect(swap?.status).toBe("REJECTED");
  });

  it("lets the requester cancel their own pending request", async () => {
    const { event, chef1, chef2, meal2 } = await setupTwoChefsWithMeals("s5");

    const proposeRes = await request
      .post(`/api/events/${event.id}/kitchen/swaps`)
      .set("Cookie", chef1.cookie)
      .send({ targetMealId: meal2.id });
    const swapId = proposeRes.body.data.id;

    // La cible ne peut pas annuler ; seul le demandeur le peut.
    const forbidden = await request
      .post(`/api/events/${event.id}/kitchen/swaps/${swapId}/cancel`)
      .set("Cookie", chef2.cookie);
    expect(forbidden.status).toBe(403);

    const cancelRes = await request
      .post(`/api/events/${event.id}/kitchen/swaps/${swapId}/cancel`)
      .set("Cookie", chef1.cookie);
    expect(cancelRes.status).toBe(200);

    const swap = await prisma.mealSwapRequest.findUnique({ where: { id: swapId } });
    expect(swap?.status).toBe("CANCELLED");
  });

  it("rejects proposing a swap against an orphan meal", async () => {
    const { cookie: managerCookie } = await setupManager("s6");
    const event = await createTestEvent(managerCookie, KITCHEN_WIDE_EVENT_BOUNDS);

    const chef1 = await setupChef(event.id, managerCookie, {
      email: "swapchef1-s6@example.com",
      username: "swapchef1s6",
    });
    // Service LUNCH pour ne pas entrer en collision avec le creneau DINNER que la
    // grille va generer pour le 1er jour (regle "premier jour = diner seul").
    await createMeal(event.id, chef1.cookie, {
      date: "2026-06-01",
      service: "LUNCH",
      name: "Tartiflette",
    });

    // Cree un creneau orphelin via la generation de la grille.
    await request.post(`/api/events/${event.id}/kitchen/generate`).set("Cookie", managerCookie);
    const kitchen = await request
      .get(`/api/events/${event.id}/kitchen`)
      .set("Cookie", managerCookie);
    const orphan = kitchen.body.data.meals.find((m: { chef: unknown }) => m.chef === null);
    expect(orphan).toBeDefined();

    const res = await request
      .post(`/api/events/${event.id}/kitchen/swaps`)
      .set("Cookie", chef1.cookie)
      .send({ targetMealId: orphan.id });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("TARGET_MEAL_ORPHAN");
  });
});
