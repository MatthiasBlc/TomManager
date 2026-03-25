import { Server as HTTPServer } from "http";
import { Server, Socket } from "socket.io";
import { sessionMiddleware } from "../app";
import env from "../config/env";
import logger from "../util/logger";

let io: Server | null = null;

export function initSocket(server: HTTPServer): Server {
  io = new Server(server, {
    cors: {
      origin: env.CORS_ORIGIN,
      credentials: true,
    },
  });

  // Share Express session with Socket.io
  io.engine.use(sessionMiddleware);

  io.on("connection", (socket: Socket) => {
    const req = socket.request as typeof socket.request & {
      session?: { userId?: string };
    };

    const userId = req.session?.userId;
    if (!userId) {
      socket.disconnect(true);
      return;
    }

    logger.info({ userId, socketId: socket.id }, "Socket connected");

    socket.on("join:event", ({ eventId }: { eventId: string }) => {
      if (eventId) {
        socket.join(`event:${eventId}`);
      }
    });

    socket.on("leave:event", ({ eventId }: { eventId: string }) => {
      if (eventId) {
        socket.leave(`event:${eventId}`);
      }
    });

    socket.on("disconnect", () => {
      logger.info({ userId, socketId: socket.id }, "Socket disconnected");
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) {
    throw new Error("Socket.io not initialized. Call initSocket first.");
  }
  return io;
}
