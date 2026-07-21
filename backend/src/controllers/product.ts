import { Request, Response, NextFunction } from "express";
import * as productService from "../services/product";

export async function search(req: Request, res: Response, next: NextFunction) {
  try {
    const q = (req.query.q as string) || "";
    const products = await productService.searchProducts(q);
    res.json({ data: products });
  } catch (err) {
    next(err);
  }
}
