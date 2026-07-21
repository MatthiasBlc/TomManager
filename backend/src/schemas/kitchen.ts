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

const isoDatetime = z.string().refine((s) => !isNaN(Date.parse(s)), "Invalid datetime");

const ingredientSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be at most 100 characters"),
  quantity: z.number().positive("Quantity must be positive").max(100000),
  unit: z.enum(["G", "KG", "ML", "CL", "L", "CAS", "CAC", "PIECE"]),
});

const utensilSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be at most 100 characters"),
});

export const createMealSchema = z.object({
  chefUserId: z.string().uuid("Invalid user ID").optional(),
  name: z.string().min(1, "Name is required").max(150, "Name must be at most 150 characters"),
  service: z.enum(["LUNCH", "DINNER"]),
  startDateTime: isoDatetime,
  endDateTime: isoDatetime,
  ingredients: z.array(ingredientSchema).max(50).optional(),
  utensils: z.array(utensilSchema).max(50).optional(),
});

export const updateMealSchema = z
  .object({
    chefUserId: z.string().uuid("Invalid user ID").nullable().optional(),
    name: z.string().min(1).max(150).optional(),
    service: z.enum(["LUNCH", "DINNER"]).optional(),
    startDateTime: isoDatetime.optional(),
    endDateTime: isoDatetime.optional(),
    maxAssistants: z.number().int().min(0).optional(),
    ingredients: z.array(ingredientSchema).max(50).optional(),
    utensils: z.array(utensilSchema).max(50).optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "At least one field is required",
  });
