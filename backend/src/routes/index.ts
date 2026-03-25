import { Router } from "express";
import authRouter from "./auth";
import eventRouter from "./event";
import invitationRouter from "./invitation";

const router = Router();

router.use("/auth", authRouter);
router.use("/events", eventRouter);
// Invitation routes are mounted at root level since they span /events and /invitations
router.use(invitationRouter);

export default router;
