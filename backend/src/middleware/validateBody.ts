import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";

export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join(".") || "body",
        message: issue.message,
      }));
      res
        .status(400)
        .json({ error: { message: "Validation error", status: 400, details } });
      return;
    }
    // Remplacer req.body par les donnees validees et transformees par Zod
    req.body = result.data;
    next();
  };
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateUUID(...paramNames: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    for (const param of paramNames) {
      const value = req.params[param];
      if (value && !UUID_REGEX.test(value)) {
        res.status(400).json({
          error: { message: `Invalid UUID: ${param}`, status: 400 },
        });
        return;
      }
    }
    next();
  };
}
