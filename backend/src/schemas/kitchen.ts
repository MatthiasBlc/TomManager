import { z } from "zod";

export const updateKitchenConfigSchema = z
  .object({
    chefRoleId: z
      .string()
      .regex(/^\d{17,20}$/, "Invalid Discord Snowflake")
      .nullable()
      .optional(),
    allergiesNotes: z
      .string()
      .max(5000, "Allergies notes must be at most 5000 characters")
      .nullable()
      .optional(),
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
  // coerce : filet de securite si une valeur non-normalisee arrive (le frontend
  // normalise deja virgule/point avant envoi, cf IngredientListInput point 8).
  quantity: z.coerce.number().positive("Quantity must be positive").max(100000),
  unit: z.enum(["G", "KG", "ML", "CL", "L", "CAS", "CAC", "PIECE"]),
  // Commentaire libre destine a l'equipe courses. Facultatif ; le frontend envoie
  // null quand le champ est vide, jamais une chaine vide.
  note: z.string().max(300, "Note must be at most 300 characters").nullable().optional(),
});

const utensilSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be at most 100 characters"),
});

export const createSwapRequestSchema = z.object({
  targetMealId: z.string().uuid("Invalid meal ID"),
});

export const updateMealSchema = z
  .object({
    chefUserId: z.string().uuid("Invalid user ID").nullable().optional(),
    name: z.string().min(1).max(150).optional(),
    service: z.enum(["LUNCH", "DINNER"]).optional(),
    startDateTime: isoDatetime.optional(),
    endDateTime: isoDatetime.optional(),
    maxAssistants: z.number().int().min(0).optional(),
    vegeCount: z.number().int().min(0).optional(),
    carneCount: z.number().int().min(0).optional(),
    ingredients: z.array(ingredientSchema).max(50).optional(),
    utensils: z.array(utensilSchema).max(50).optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "At least one field is required",
  });
