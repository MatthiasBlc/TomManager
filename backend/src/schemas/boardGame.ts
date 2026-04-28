import { z } from "zod";

export const createBoardGameSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(200, "Name must be at most 200 characters"),
  yearPublished: z.number().int().min(1000).max(9999).optional(),
  minPlayers: z.number().int().min(1).optional(),
  maxPlayers: z.number().int().min(1).optional(),
  playingTime: z.number().int().min(0).optional(),
  description: z.string().optional(),
  imageUrl: z.string().url("Invalid image URL").optional(),
});

export const fromBggSchema = z.object({
  bggId: z.string().min(1, "bggId is required"),
  name: z.string().min(1, "name is required"),
  yearPublished: z.number().int().min(1000).max(9999).optional(),
});

export const updateBoardGameAdminSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(200, "Name must be at most 200 characters")
    .optional(),
  yearPublished: z.number().int().min(1000).max(9999).nullable().optional(),
  minPlayers: z.number().int().min(1).nullable().optional(),
  maxPlayers: z.number().int().min(1).nullable().optional(),
  playingTime: z.number().int().min(0).nullable().optional(),
  imageUrl: z.string().url("Invalid image URL").nullable().optional(),
});

export const mergeSchema = z.object({
  targetId: z.string().uuid("Invalid target board game ID"),
});
