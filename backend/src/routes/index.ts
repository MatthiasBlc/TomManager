import { Router } from "express";
import authRouter from "./auth";
import eventRouter from "./event";
import participantRouter from "./participant";
import gameTableRouter from "./gameTable";
import tagRouter from "./tag";
import boardGameRouter from "./boardGame";
import eventBoardGameRouter from "./eventBoardGame";
import notificationRouter from "./notification";

const router = Router();

router.use("/auth", authRouter);
router.use("/events", eventRouter);
router.use("/events", participantRouter);
router.use("/events", gameTableRouter);
router.use("/events", eventBoardGameRouter);
router.use("/tags", tagRouter);
router.use("/boardgames", boardGameRouter);
router.use("/notifications", notificationRouter);

export default router;
