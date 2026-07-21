import { Router } from "express";
import authRouter from "./auth";
import adminRouter from "./admin";
import eventRouter from "./event";
import participantRouter from "./participant";
import gameTableRouter from "./gameTable";
import tagRouter from "./tag";
import boardGameRouter from "./boardGame";
import eventBoardGameRouter from "./eventBoardGame";
import notificationRouter from "./notification";
import preferenceRouter from "./preference";
import kitchenRouter from "./kitchen";
import productRouter from "./product";

const router = Router();

router.use("/auth", authRouter);
router.use("/admin", adminRouter);
router.use("/events", eventRouter);
router.use("/events", participantRouter);
router.use("/events", gameTableRouter);
router.use("/events", eventBoardGameRouter);
router.use("/events", kitchenRouter);
router.use("/kitchen", productRouter);
router.use("/tags", tagRouter);
router.use("/boardgames", boardGameRouter);
router.use("/notifications", notificationRouter);
router.use("/me", preferenceRouter);

export default router;
