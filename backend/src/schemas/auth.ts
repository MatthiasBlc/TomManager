import { z } from "zod";

export const signupSchema = z.object({
  email: z.string().email("Invalid email"),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must be at most 30 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers and underscores"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  invitationToken: z.string().uuid("Invalid invitation token"),
});

export const loginSchema = z.object({
  identifier: z.string().min(1, "Identifier is required"),
  password: z.string().min(1, "Password is required"),
  invitationToken: z.string().uuid("Invalid invitation token").optional(),
});
