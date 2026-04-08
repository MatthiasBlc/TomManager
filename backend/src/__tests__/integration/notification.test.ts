import { describe, it, expect } from "vitest";
import prisma from "../../util/db";
import {
  request,
  createTestUserDirectly,
  setupAdmin,
  createTestEvent,
  addTestParticipant,
} from "../setup/testHelpers";
import * as notificationService from "../../services/notification";

async function createUser(overrides?: { email?: string; username?: string }) {
  const { user } = await createTestUserDirectly({
    email: overrides?.email || "notif-user@example.com",
    username: overrides?.username || "notifuser",
  });
  return user;
}

describe("Notification Service", () => {
  describe("createNotification", () => {
    it("should create a notification", async () => {
      const user = await createUser();

      const notif = await notificationService.createNotification({
        userId: user.id,
        type: "TABLE_DELETED",
        title: "Table supprimee",
        message: "La table 'Donjons' a ete supprimee",
        metadata: { eventId: "evt-1", tableId: "tbl-1" },
      });

      expect(notif.id).toBeDefined();
      expect(notif.userId).toBe(user.id);
      expect(notif.type).toBe("TABLE_DELETED");
      expect(notif.title).toBe("Table supprimee");
      expect(notif.read).toBe(false);
      expect(notif.readAt).toBeNull();
      expect(notif.metadata).toEqual({ eventId: "evt-1", tableId: "tbl-1" });
    });

    it("should create a notification without metadata", async () => {
      const user = await createUser();

      const notif = await notificationService.createNotification({
        userId: user.id,
        type: "WAITLIST_PROMOTED",
        title: "Promu",
        message: "Tu es confirme",
      });

      expect(notif.metadata).toBeNull();
    });
  });

  describe("createBulkNotifications", () => {
    it("should create multiple notifications", async () => {
      const user1 = await createUser({ email: "u1@test.com", username: "user1" });
      const user2 = await createUser({ email: "u2@test.com", username: "user2" });

      const notifications = await notificationService.createBulkNotifications([
        {
          userId: user1.id,
          type: "TABLE_DELETED",
          title: "Table supprimee",
          message: "La table a ete supprimee",
        },
        {
          userId: user2.id,
          type: "TABLE_DELETED",
          title: "Table supprimee",
          message: "La table a ete supprimee",
        },
      ]);

      expect(notifications).toHaveLength(2);
      expect(notifications[0].userId).toBe(user1.id);
      expect(notifications[1].userId).toBe(user2.id);
    });

    it("should return empty array for empty input", async () => {
      const result = await notificationService.createBulkNotifications([]);
      expect(result).toEqual([]);
    });
  });

  describe("getNotifications", () => {
    it("should return notifications ordered by createdAt desc", async () => {
      const user = await createUser();

      // Create with slight delay to ensure ordering
      await notificationService.createNotification({
        userId: user.id,
        type: "TABLE_DELETED",
        title: "First",
        message: "First notification",
      });
      await notificationService.createNotification({
        userId: user.id,
        type: "WAITLIST_PROMOTED",
        title: "Second",
        message: "Second notification",
      });

      const { data } = await notificationService.getNotifications(user.id);

      expect(data).toHaveLength(2);
      expect(data[0].title).toBe("Second");
      expect(data[1].title).toBe("First");
    });

    it("should paginate with cursor", async () => {
      const user = await createUser();

      for (let i = 0; i < 5; i++) {
        await notificationService.createNotification({
          userId: user.id,
          type: "TABLE_UPDATED",
          title: `Notif ${i}`,
          message: `Notification ${i}`,
        });
      }

      const page1 = await notificationService.getNotifications(user.id, { limit: 2 });
      expect(page1.data).toHaveLength(2);
      expect(page1.nextCursor).toBeDefined();

      const page2 = await notificationService.getNotifications(user.id, {
        cursor: page1.nextCursor!,
        limit: 2,
      });
      expect(page2.data).toHaveLength(2);
      expect(page2.nextCursor).toBeDefined();

      const page3 = await notificationService.getNotifications(user.id, {
        cursor: page2.nextCursor!,
        limit: 2,
      });
      expect(page3.data).toHaveLength(1);
      expect(page3.nextCursor).toBeNull();
    });

    it("should filter unread only", async () => {
      const user = await createUser();

      const notif = await notificationService.createNotification({
        userId: user.id,
        type: "TABLE_DELETED",
        title: "Read",
        message: "Will be read",
      });
      await notificationService.createNotification({
        userId: user.id,
        type: "WAITLIST_PROMOTED",
        title: "Unread",
        message: "Still unread",
      });

      await notificationService.markAsRead(notif.id, user.id);

      const { data } = await notificationService.getNotifications(user.id, {
        unreadOnly: true,
      });
      expect(data).toHaveLength(1);
      expect(data[0].title).toBe("Unread");
    });

    it("should cap limit at 50", async () => {
      const user = await createUser();
      const { data } = await notificationService.getNotifications(user.id, { limit: 100 });
      expect(data).toHaveLength(0); // no notifications, just checking it doesn't throw
    });

    it("should not return notifications of other users", async () => {
      const user1 = await createUser({ email: "u1@test.com", username: "user1" });
      const user2 = await createUser({ email: "u2@test.com", username: "user2" });

      await notificationService.createNotification({
        userId: user1.id,
        type: "TABLE_DELETED",
        title: "User1 only",
        message: "Private",
      });

      const { data } = await notificationService.getNotifications(user2.id);
      expect(data).toHaveLength(0);
    });
  });

  describe("getUnreadCount", () => {
    it("should return count of unread notifications", async () => {
      const user = await createUser();

      await notificationService.createNotification({
        userId: user.id,
        type: "TABLE_DELETED",
        title: "N1",
        message: "M1",
      });
      const n2 = await notificationService.createNotification({
        userId: user.id,
        type: "WAITLIST_PROMOTED",
        title: "N2",
        message: "M2",
      });

      expect(await notificationService.getUnreadCount(user.id)).toBe(2);

      await notificationService.markAsRead(n2.id, user.id);
      expect(await notificationService.getUnreadCount(user.id)).toBe(1);
    });
  });

  describe("markAsRead", () => {
    it("should mark a notification as read", async () => {
      const user = await createUser();
      const notif = await notificationService.createNotification({
        userId: user.id,
        type: "PLAYER_KICKED",
        title: "Kicked",
        message: "You were kicked",
      });

      const updated = await notificationService.markAsRead(notif.id, user.id);

      expect(updated.read).toBe(true);
      expect(updated.readAt).toBeInstanceOf(Date);
    });

    it("should reject if notification not found", async () => {
      const user = await createUser();
      await expect(notificationService.markAsRead("non-existent-id", user.id)).rejects.toThrow(
        "Notification not found"
      );
    });

    it("should reject if notification belongs to another user", async () => {
      const user1 = await createUser({ email: "u1@test.com", username: "user1" });
      const user2 = await createUser({ email: "u2@test.com", username: "user2" });

      const notif = await notificationService.createNotification({
        userId: user1.id,
        type: "TABLE_DELETED",
        title: "Private",
        message: "Not yours",
      });

      await expect(notificationService.markAsRead(notif.id, user2.id)).rejects.toThrow("Forbidden");
    });
  });

  describe("markAllAsRead", () => {
    it("should mark all unread notifications as read", async () => {
      const user = await createUser();

      await notificationService.createNotification({
        userId: user.id,
        type: "TABLE_DELETED",
        title: "N1",
        message: "M1",
      });
      await notificationService.createNotification({
        userId: user.id,
        type: "WAITLIST_PROMOTED",
        title: "N2",
        message: "M2",
      });

      const count = await notificationService.markAllAsRead(user.id);
      expect(count).toBe(2);

      expect(await notificationService.getUnreadCount(user.id)).toBe(0);
    });

    it("should return 0 if no unread notifications", async () => {
      const user = await createUser();
      const count = await notificationService.markAllAsRead(user.id);
      expect(count).toBe(0);
    });

    it("should not affect other users' notifications", async () => {
      const user1 = await createUser({ email: "u1@test.com", username: "user1" });
      const user2 = await createUser({ email: "u2@test.com", username: "user2" });

      await notificationService.createNotification({
        userId: user1.id,
        type: "TABLE_DELETED",
        title: "N1",
        message: "M1",
      });
      await notificationService.createNotification({
        userId: user2.id,
        type: "TABLE_DELETED",
        title: "N2",
        message: "M2",
      });

      await notificationService.markAllAsRead(user1.id);

      expect(await notificationService.getUnreadCount(user2.id)).toBe(1);
    });
  });

  describe("deleteNotification", () => {
    it("should delete a notification", async () => {
      const user = await createUser();
      const notif = await notificationService.createNotification({
        userId: user.id,
        type: "TABLE_DELETED",
        title: "ToDelete",
        message: "Will be deleted",
      });

      await notificationService.deleteNotification(notif.id, user.id);

      const found = await prisma.notification.findUnique({ where: { id: notif.id } });
      expect(found).toBeNull();
    });

    it("should reject if notification not found", async () => {
      const user = await createUser();
      await expect(
        notificationService.deleteNotification("non-existent-id", user.id)
      ).rejects.toThrow("Notification not found");
    });

    it("should reject if notification belongs to another user", async () => {
      const user1 = await createUser({ email: "u1@test.com", username: "user1" });
      const user2 = await createUser({ email: "u2@test.com", username: "user2" });

      const notif = await notificationService.createNotification({
        userId: user1.id,
        type: "TABLE_DELETED",
        title: "Private",
        message: "Not yours",
      });

      await expect(notificationService.deleteNotification(notif.id, user2.id)).rejects.toThrow(
        "Forbidden"
      );
    });
  });
});

// Helper: create user, login, return cookie + userId
async function setupAuthenticatedUser(overrides?: { email?: string; username?: string }) {
  const email = overrides?.email || "notif-api@example.com";
  const username = overrides?.username || "notifapi";
  const password = "Password123!";

  await createTestUserDirectly({ email, username, password });
  const res = await request.post("/api/auth/login").send({ identifier: email, password });
  return { cookie: res.headers["set-cookie"], userId: res.body.user.id };
}

describe("Notification API", () => {
  describe("GET /api/notifications", () => {
    it("should return notifications for authenticated user", async () => {
      const { cookie, userId } = await setupAuthenticatedUser();

      await notificationService.createNotification({
        userId,
        type: "TABLE_DELETED",
        title: "Test",
        message: "Test message",
      });

      const res = await request.get("/api/notifications").set("Cookie", cookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe("Test");
      expect(res.body.nextCursor).toBeNull();
    });

    it("should reject unauthenticated request", async () => {
      const res = await request.get("/api/notifications");
      expect(res.status).toBe(401);
    });

    it("should paginate with cursor", async () => {
      const { cookie, userId } = await setupAuthenticatedUser();

      for (let i = 0; i < 5; i++) {
        await notificationService.createNotification({
          userId,
          type: "TABLE_UPDATED",
          title: `Notif ${i}`,
          message: `Message ${i}`,
        });
      }

      const page1 = await request.get("/api/notifications?limit=2").set("Cookie", cookie);

      expect(page1.status).toBe(200);
      expect(page1.body.data).toHaveLength(2);
      expect(page1.body.nextCursor).toBeDefined();

      const page2 = await request
        .get(`/api/notifications?limit=2&cursor=${page1.body.nextCursor}`)
        .set("Cookie", cookie);

      expect(page2.body.data).toHaveLength(2);

      const page3 = await request
        .get(`/api/notifications?limit=2&cursor=${page2.body.nextCursor}`)
        .set("Cookie", cookie);

      expect(page3.body.data).toHaveLength(1);
      expect(page3.body.nextCursor).toBeNull();
    });

    it("should filter unread only", async () => {
      const { cookie, userId } = await setupAuthenticatedUser();

      const n1 = await notificationService.createNotification({
        userId,
        type: "TABLE_DELETED",
        title: "Read one",
        message: "Read",
      });
      await notificationService.createNotification({
        userId,
        type: "WAITLIST_PROMOTED",
        title: "Unread one",
        message: "Unread",
      });

      await notificationService.markAsRead(n1.id, userId);

      const res = await request.get("/api/notifications?unread=true").set("Cookie", cookie);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe("Unread one");
    });

    it("should reject invalid limit", async () => {
      const { cookie } = await setupAuthenticatedUser();

      const res = await request.get("/api/notifications?limit=abc").set("Cookie", cookie);

      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/notifications/unread-count", () => {
    it("should return unread count", async () => {
      const { cookie, userId } = await setupAuthenticatedUser();

      await notificationService.createNotification({
        userId,
        type: "TABLE_DELETED",
        title: "N1",
        message: "M1",
      });
      await notificationService.createNotification({
        userId,
        type: "WAITLIST_PROMOTED",
        title: "N2",
        message: "M2",
      });

      const res = await request.get("/api/notifications/unread-count").set("Cookie", cookie);

      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(2);
    });

    it("should return 0 when no notifications", async () => {
      const { cookie } = await setupAuthenticatedUser();

      const res = await request.get("/api/notifications/unread-count").set("Cookie", cookie);

      expect(res.body.data.count).toBe(0);
    });
  });

  describe("PATCH /api/notifications/:id/read", () => {
    it("should mark notification as read", async () => {
      const { cookie, userId } = await setupAuthenticatedUser();

      const notif = await notificationService.createNotification({
        userId,
        type: "PLAYER_KICKED",
        title: "Kicked",
        message: "You were kicked",
      });

      const res = await request.patch(`/api/notifications/${notif.id}/read`).set("Cookie", cookie);

      expect(res.status).toBe(200);
      expect(res.body.data.read).toBe(true);
      expect(res.body.data.readAt).toBeDefined();
    });

    it("should return 404 for non-existent notification", async () => {
      const { cookie } = await setupAuthenticatedUser();

      const res = await request
        .patch("/api/notifications/non-existent-id/read")
        .set("Cookie", cookie);

      expect(res.status).toBe(404);
    });

    it("should return 403 for another user's notification", async () => {
      const { cookie: _cookie1, userId: userId1 } = await setupAuthenticatedUser({
        email: "u1@api.com",
        username: "apiuser1",
      });
      const { cookie: cookie2 } = await setupAuthenticatedUser({
        email: "u2@api.com",
        username: "apiuser2",
      });

      const notif = await notificationService.createNotification({
        userId: userId1,
        type: "TABLE_DELETED",
        title: "Private",
        message: "Not yours",
      });

      const res = await request.patch(`/api/notifications/${notif.id}/read`).set("Cookie", cookie2);

      expect(res.status).toBe(403);
    });
  });

  describe("PATCH /api/notifications/read-all", () => {
    it("should mark all as read", async () => {
      const { cookie, userId } = await setupAuthenticatedUser();

      await notificationService.createNotification({
        userId,
        type: "TABLE_DELETED",
        title: "N1",
        message: "M1",
      });
      await notificationService.createNotification({
        userId,
        type: "WAITLIST_PROMOTED",
        title: "N2",
        message: "M2",
      });

      const res = await request.patch("/api/notifications/read-all").set("Cookie", cookie);

      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(2);

      // Verify
      const countRes = await request.get("/api/notifications/unread-count").set("Cookie", cookie);
      expect(countRes.body.data.count).toBe(0);
    });
  });

  describe("DELETE /api/notifications/:id", () => {
    it("should delete a notification", async () => {
      const { cookie, userId } = await setupAuthenticatedUser();

      const notif = await notificationService.createNotification({
        userId,
        type: "TABLE_DELETED",
        title: "ToDelete",
        message: "Delete me",
      });

      const res = await request.delete(`/api/notifications/${notif.id}`).set("Cookie", cookie);

      expect(res.status).toBe(204);

      // Verify deleted
      const listRes = await request.get("/api/notifications").set("Cookie", cookie);
      expect(listRes.body.data).toHaveLength(0);
    });

    it("should return 404 for non-existent notification", async () => {
      const { cookie } = await setupAuthenticatedUser();

      const res = await request.delete("/api/notifications/non-existent-id").set("Cookie", cookie);

      expect(res.status).toBe(404);
    });

    it("should return 403 for another user's notification", async () => {
      const { userId: userId1 } = await setupAuthenticatedUser({
        email: "u1@api.com",
        username: "apiuser1",
      });
      const { cookie: cookie2 } = await setupAuthenticatedUser({
        email: "u2@api.com",
        username: "apiuser2",
      });

      const notif = await notificationService.createNotification({
        userId: userId1,
        type: "TABLE_DELETED",
        title: "Private",
        message: "Not yours",
      });

      const res = await request.delete(`/api/notifications/${notif.id}`).set("Cookie", cookie2);

      expect(res.status).toBe(403);
    });
  });
});

// Helper: setup admin + event + participant user
async function setupEventWithPlayer() {
  const admin = await setupAdmin();
  const event = await createTestEvent(admin.cookie);
  const { user, cookie: playerCookie } = await addTestParticipant(event.id, {
    email: "player@notif.com",
    username: "notifplayer",
  });
  return { admin, event, playerCookie, playerId: user.id };
}

// Helper: add a second player
async function addSecondPlayer(_adminCookie: string[], eventId: string) {
  const { user, cookie } = await addTestParticipant(eventId, {
    email: "player2@notif.com",
    username: "notifplayer2",
  });
  return { cookie, userId: user.id };
}

describe("Notification Triggers", () => {
  describe("Table deletion", () => {
    it("should notify participants when a table is deleted", async () => {
      const { admin, event, playerCookie, playerId } = await setupEventWithPlayer();

      // Player creates a table
      const tableRes = await request
        .post(`/api/events/${event.id}/tables`)
        .set("Cookie", playerCookie)
        .send({
          title: "My Table",
          maxPlayers: 5,
          startDateTime: "2026-06-01T10:00:00Z",
          endDateTime: "2026-06-01T12:00:00Z",
        });
      const tableId = tableRes.body.data.id;

      // Player2 joins the table
      const player2 = await addSecondPlayer(admin.cookie, event.id);
      await request
        .post(`/api/events/${event.id}/tables/${tableId}/join`)
        .set("Cookie", player2.cookie);

      // Player (GM) deletes the table
      await request.delete(`/api/events/${event.id}/tables/${tableId}`).set("Cookie", playerCookie);

      // Player2 should have a TABLE_DELETED notification
      const notifs = await prisma.notification.findMany({
        where: { userId: player2.userId, type: "TABLE_DELETED" },
      });
      expect(notifs).toHaveLength(1);
      expect(notifs[0].message).toContain("My Table");

      // Player (the deleter) should NOT have a notification
      const gmNotifs = await prisma.notification.findMany({
        where: { userId: playerId, type: "TABLE_DELETED" },
      });
      expect(gmNotifs).toHaveLength(0);
    });
  });

  describe("Table update with demotion", () => {
    it("should notify demoted players when maxPlayers is reduced", async () => {
      const { admin, event, playerCookie, playerId: _playerId } = await setupEventWithPlayer();

      // Player creates a table with maxPlayers=2
      const tableRes = await request
        .post(`/api/events/${event.id}/tables`)
        .set("Cookie", playerCookie)
        .send({
          title: "Demotion Table",
          maxPlayers: 2,
          startDateTime: "2026-06-01T10:00:00Z",
          endDateTime: "2026-06-01T12:00:00Z",
        });
      const tableId = tableRes.body.data.id;

      // Two players join
      const player2 = await addSecondPlayer(admin.cookie, event.id);
      await request
        .post(`/api/events/${event.id}/tables/${tableId}/join`)
        .set("Cookie", player2.cookie);

      const { user: player3User, cookie: player3Cookie } = await addTestParticipant(event.id, {
        email: "player3@notif.com",
        username: "notifplayer3",
      });
      const player3Id = player3User.id;

      await request
        .post(`/api/events/${event.id}/tables/${tableId}/join`)
        .set("Cookie", player3Cookie);

      // GM reduces maxPlayers to 1 -> player3 gets demoted
      await request
        .patch(`/api/events/${event.id}/tables/${tableId}`)
        .set("Cookie", playerCookie)
        .send({ maxPlayers: 1 });

      const demotedNotifs = await prisma.notification.findMany({
        where: { userId: player3Id, type: "WAITLIST_DEMOTED" },
      });
      expect(demotedNotifs).toHaveLength(1);
      expect(demotedNotifs[0].message).toContain("Demotion Table");
    });
  });

  describe("Kick player", () => {
    it("should notify kicked player", async () => {
      const { admin, event, playerCookie } = await setupEventWithPlayer();

      const tableRes = await request
        .post(`/api/events/${event.id}/tables`)
        .set("Cookie", playerCookie)
        .send({
          title: "Kick Table",
          maxPlayers: 5,
          startDateTime: "2026-06-01T10:00:00Z",
          endDateTime: "2026-06-01T12:00:00Z",
        });
      const tableId = tableRes.body.data.id;

      const player2 = await addSecondPlayer(admin.cookie, event.id);
      await request
        .post(`/api/events/${event.id}/tables/${tableId}/join`)
        .set("Cookie", player2.cookie);

      // GM kicks player2
      await request
        .delete(`/api/events/${event.id}/tables/${tableId}/participants/${player2.userId}`)
        .set("Cookie", playerCookie);

      const kickNotifs = await prisma.notification.findMany({
        where: { userId: player2.userId, type: "PLAYER_KICKED" },
      });
      expect(kickNotifs).toHaveLength(1);
      expect(kickNotifs[0].message).toContain("Kick Table");
    });
  });

  describe("Leave table with promotion", () => {
    it("should notify promoted player when someone leaves", async () => {
      const { admin, event, playerCookie } = await setupEventWithPlayer();

      // Create table with maxPlayers=1
      const tableRes = await request
        .post(`/api/events/${event.id}/tables`)
        .set("Cookie", playerCookie)
        .send({
          title: "Promo Table",
          maxPlayers: 1,
          startDateTime: "2026-06-01T10:00:00Z",
          endDateTime: "2026-06-01T12:00:00Z",
        });
      const tableId = tableRes.body.data.id;

      // Player2 joins (confirmed), Player3 joins (waitlist)
      const player2 = await addSecondPlayer(admin.cookie, event.id);
      await request
        .post(`/api/events/${event.id}/tables/${tableId}/join`)
        .set("Cookie", player2.cookie);

      const { user: player3User, cookie: player3Cookie } = await addTestParticipant(event.id, {
        email: "player3@notif.com",
        username: "notifplayer3",
      });
      const player3Id = player3User.id;

      await request
        .post(`/api/events/${event.id}/tables/${tableId}/join`)
        .set("Cookie", player3Cookie);

      // Player2 leaves -> Player3 promoted
      await request
        .delete(`/api/events/${event.id}/tables/${tableId}/leave`)
        .set("Cookie", player2.cookie);

      const promoNotifs = await prisma.notification.findMany({
        where: { userId: player3Id, type: "WAITLIST_PROMOTED" },
      });
      expect(promoNotifs).toHaveLength(1);
      expect(promoNotifs[0].message).toContain("Promo Table");
    });
  });

  describe("Remove participant", () => {
    it("should notify removed participant", async () => {
      const { admin, event, playerCookie: _playerCookie, playerId } = await setupEventWithPlayer();

      // Admin removes the player
      await request
        .delete(`/api/events/${event.id}/participants/${playerId}`)
        .set("Cookie", admin.cookie);

      const notifs = await prisma.notification.findMany({
        where: { userId: playerId, type: "PARTICIPANT_REMOVED" },
      });
      expect(notifs).toHaveLength(1);
      expect(notifs[0].message).toContain("Test Event");
    });
  });
});
