import { z } from "zod";

export const createInvitationSchema = z.object({
  identifier: z.string().min(1, "Email or username is required"),
});
