import { Router } from "express";
import { requireSuperAdmin } from "../../middleware/superAdmin.middleware.js";
import { getLogs } from "../../controllers/logs.controller.js";

const router = Router();

router.get("/", requireSuperAdmin, getLogs);

export default router;
