import { Router } from "express";
import { requireSuperAdmin } from "../../middleware/superAdmin.middleware.js";
import { getAllChats, getChatMessages } from "../../controllers/monitor.controller.js";

const router = Router();

router.get("/chats", requireSuperAdmin, getAllChats);
router.get("/chats/:type/:id", requireSuperAdmin, getChatMessages);

export default router;
