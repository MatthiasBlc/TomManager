import { Request, Response, NextFunction } from "express";
import createError from "http-errors";
import * as shoppingListService from "../services/shoppingList";
import { buildShoppingWorkbook, EXPORT_VIEWS, type ExportView } from "../services/shoppingExport";
import { getEventOr404 } from "../services/kitchen";

export async function getShoppingList(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await shoppingListService.getShoppingList(req.params.eventId);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

// Nom de fichier translittere en ASCII pour l'entete `filename` (les entetes HTTP
// ne transportent pas d'accents), avec `filename*` en RFC 5987 a cote pour que les
// navigateurs modernes retrouvent le nom accentue.
function asciiSlug(value: string): string {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 60) || "event"
  );
}

export async function exportShoppingList(req: Request, res: Response, next: NextFunction) {
  try {
    const view = req.query.view as string | undefined;
    if (!view || !EXPORT_VIEWS.includes(view as ExportView)) {
      throw createError(400, "Unknown export view", { code: "INVALID_EXPORT_VIEW" });
    }

    const event = await getEventOr404(req.params.eventId);
    const views = await shoppingListService.getShoppingList(req.params.eventId);
    const workbook = buildShoppingWorkbook(views, view as ExportView);

    const baseName = `courses-${asciiSlug(event.name)}-${view}`;
    const utf8Name = encodeURIComponent(`courses-${event.name}-${view}.xlsx`);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${baseName}.xlsx"; filename*=UTF-8''${utf8Name}`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
}
