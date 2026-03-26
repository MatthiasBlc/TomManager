import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import * as notificationController from "../controllers/notification";

const router = Router();

router.get("/", requireAuth, notificationController.list);
router.get("/unread-count", requireAuth, notificationController.unreadCount);
router.patch("/:id/read", requireAuth, notificationController.markAsRead);
router.patch("/read-all", requireAuth, notificationController.markAllAsRead);
router.delete("/:id", requireAuth, notificationController.remove);

export default router;
