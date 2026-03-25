import { Router } from "express";
import authRouter from "./auth";
import eventRouter from "./event";
import invitationRouter from "./invitation";
import participantRouter from "./participant";
import gameTableRouter from "./gameTable";
import tagRouter from "./tag";
import boardGameRouter from "./boardGame";
import eventBoardGameRouter from "./eventBoardGame";

const router = Router();

router.use("/auth", authRouter);
router.use("/events", eventRouter);
router.use("/events", participantRouter);
router.use("/events", gameTableRouter);
router.use("/events", eventBoardGameRouter);
router.use("/tags", tagRouter);
router.use("/boardgames", boardGameRouter);
// Invitation routes are mounted at root level since they span /events and /invitations
router.use(invitationRouter);

export default router;
