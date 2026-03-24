import { Router } from "express";
import authRouter from "./auth";
import eventRouter from "./event";

const router = Router();

router.use("/auth", authRouter);
router.use("/events", eventRouter);

export default router;
