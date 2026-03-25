import { Router } from "express";
import authRouter from "./auth";
import eventRouter from "./event";
import invitationRouter from "./invitation";
import participantRouter from "./participant";

const router = Router();

router.use("/auth", authRouter);
router.use("/events", eventRouter);
router.use("/events", participantRouter);
// Invitation routes are mounted at root level since they span /events and /invitations
router.use(invitationRouter);

export default router;
