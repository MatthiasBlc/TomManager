import { getIO } from "./index";

function safeEmit(room: string, event: string, data: unknown) {
  try {
    getIO().to(room).emit(event, data);
  } catch {
    // Socket.io not initialized (e.g., in tests) — silently ignore
  }
}

export function emitToEvent(eventId: string, event: string, data: unknown) {
  safeEmit(`event:${eventId}`, event, data);
}

export function emitToUser(userId: string, event: string, data: unknown) {
  safeEmit(`user:${userId}`, event, data);
}
