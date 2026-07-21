import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import * as productController from "../controllers/product";

const router = Router();

router.get("/products", requireAuth, productController.search);

export default router;
