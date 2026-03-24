import prisma from "../util/db";
import createError from "http-errors";

export async function createEvent(
  name: string,
  startDateTime: string,
  endDateTime: string,
  userId: string
) {
  if (!name || name.trim().length === 0 || name.trim().length > 100) {
    throw createError(400, "Name must be between 1 and 100 characters");
  }

  const start = new Date(startDateTime);
  const end = new Date(endDateTime);

  if (isNaN(start.getTime())) {
    throw createError(400, "Invalid startDateTime");
  }
  if (isNaN(end.getTime())) {
    throw createError(400, "Invalid endDateTime");
  }
  if (end <= start) {
    throw createError(400, "endDateTime must be after startDateTime");
  }

  const event = await prisma.event.create({
    data: {
      name: name.trim(),
      startDateTime: start,
      endDateTime: end,
      createdBy: userId,
      participations: {
        create: {
          userId,
        },
      },
    },
    include: {
      participations: true,
    },
  });

  return event;
}
