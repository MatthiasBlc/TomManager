import { z } from "zod";

const isoDatetime = z.string().refine((s) => !isNaN(Date.parse(s)), "Invalid datetime");

export const createEventSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be at most 100 characters"),
  startDateTime: isoDatetime,
  endDateTime: isoDatetime,
  discordRoleId: z.string().regex(/^\d{17,20}$/, "Invalid Discord Snowflake").nullable().optional(),
});

export const updateEventSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  startDateTime: isoDatetime.optional(),
  endDateTime: isoDatetime.optional(),
  discordRoleId: z.string().regex(/^\d{17,20}$/, "Invalid Discord Snowflake").nullable().optional(),
});
