import { z } from "zod";

const isoDatetime = z.string().refine((s) => !isNaN(Date.parse(s)), "Invalid datetime");

export const createTableSchema = z.object({
  title: z.string().min(1, "Title is required").max(150, "Title must be at most 150 characters"),
  type: z.enum(["JDR", "JDS"]).optional(),
  gmIsPlayer: z.boolean().optional(),
  pitch: z.string().max(2000, "Pitch must be at most 2000 characters").optional(),
  triggers: z.string().max(1000, "Triggers must be at most 1000 characters").optional(),
  comments: z.string().max(1000, "Comments must be at most 1000 characters").optional(),
  maxPlayers: z
    .number()
    .int("maxPlayers must be an integer")
    .min(1, "maxPlayers must be at least 1")
    .max(20, "maxPlayers must be at most 20"),
  startDateTime: isoDatetime,
  endDateTime: isoDatetime,
  tags: z.array(z.string().min(1).max(50)).max(10, "At most 10 tags").optional(),
});

export const updateTableSchema = z.object({
  title: z.string().min(1).max(150).optional(),
  gmIsPlayer: z.boolean().optional(),
  pitch: z.string().max(2000).optional().nullable(),
  triggers: z.string().max(1000).optional().nullable(),
  comments: z.string().max(1000).optional().nullable(),
  maxPlayers: z.number().int().min(1).max(20).optional(),
  startDateTime: isoDatetime.optional(),
  endDateTime: isoDatetime.optional(),
  tags: z.array(z.string().min(1).max(50)).max(10).optional(),
});
