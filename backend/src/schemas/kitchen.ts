import { z } from "zod";

export const updateKitchenConfigSchema = z
  .object({
    chefRoleId: z
      .string()
      .regex(/^\d{17,20}$/, "Invalid Discord Snowflake")
      .nullable()
      .optional(),
    allergiesNotes: z.string().max(5000, "Allergies notes must be at most 5000 characters").nullable().optional(),
    equipierPlanningEnabled: z.boolean().optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "At least one field is required",
  });

export const addKitchenChefSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
});

export const addKitchenCoursesMemberSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
});
