import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "http";
import { Server } from "socket.io";
import { io as ioClient, Socket as ClientSocket } from "socket.io-client";
import app from "../../app";
import { initSocket } from "../../socket";
import { setupAdmin, createTestEvent } from "../setup/testHelpers";

let httpServer: http.Server;
let ioServer: Server;
let port: number;

beforeAll(async () => {
  httpServer = http.createServer(app);
  ioServer = initSocket(httpServer);
  await new Promise<void>((resolve) => {
    httpServer.listen(0, () => {
      const addr = httpServer.address();
      port = typeof addr === "object" && addr ? addr.port : 0;
      resolve();
    });
  });
});

afterAll(async () => {
  ioServer.close();
  httpServer.close();
});

function connectClient(cookie: string | string[]): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const cookieStr = Array.isArray(cookie) ? cookie.join("; ") : cookie;
    const client = ioClient(`http://localhost:${port}`, {
      extraHeaders: { cookie: cookieStr },
      transports: ["websocket"],
    });
    client.on("connect", () => resolve(client));
    client.on("connect_error", (err) => reject(err));
    setTimeout(() => reject(new Error("Connection timeout")), 5000);
  });
}

describe("Socket.io", () => {
  it("should connect with valid session", async () => {
    const { cookie } = await setupAdmin();
    const client = await connectClient(cookie);

    expect(client.connected).toBe(true);
    client.disconnect();
  });

  it("should reject connection without session", async () => {
    await expect(
      new Promise<ClientSocket>((resolve, reject) => {
        const client = ioClient(`http://localhost:${port}`, {
          transports: ["websocket"],
        });
        client.on("connect", () => {
          // If it connects, wait a bit to see if it gets disconnected
          setTimeout(() => {
            if (client.connected) {
              reject(new Error("Should have been disconnected"));
            } else {
              resolve(client);
            }
          }, 500);
        });
        client.on("disconnect", () => resolve(client));
        client.on("connect_error", () => resolve(client as ClientSocket));
        setTimeout(() => reject(new Error("Timeout")), 5000);
      }),
    ).resolves.toBeDefined();
  });

  it("should join and leave event room", async () => {
    const { cookie } = await setupAdmin();
    const client = await connectClient(cookie);

    // Join room
    client.emit("join:event", { eventId: "test-event-id" });

    // Small delay to let the server process
    await new Promise((r) => setTimeout(r, 100));

    // Leave room
    client.emit("leave:event", { eventId: "test-event-id" });

    await new Promise((r) => setTimeout(r, 100));

    client.disconnect();
  });

  it("should receive events in room from another client", async () => {
    const admin = await setupAdmin();
    const event = await createTestEvent(admin.cookie);

    const client1 = await connectClient(admin.cookie);

    // Client1 joins event room
    client1.emit("join:event", { eventId: event.id });
    await new Promise((r) => setTimeout(r, 100));

    // Listen for a custom event
    const receivedPromise = new Promise<Record<string, unknown>>((resolve) => {
      client1.on("table:created", (data: Record<string, unknown>) =>
        resolve(data),
      );
    });

    // Emit from server to test room broadcast
    ioServer
      .to(`event:${event.id}`)
      .emit("table:created", { table: { id: "test", title: "Test" } });

    const received = await receivedPromise;
    expect(received.table).toBeDefined();

    client1.disconnect();
  });
});
