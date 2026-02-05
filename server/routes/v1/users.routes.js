import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireAdmin } from "../../middleware/admin.middleware.js";
import { getMe, setMyAlias, getAllUsers, setUserAdminStatus, setUserActiveStatus } from "../../controllers/users.controller.js";

const router = Router();

router.get("/", requireAuth, getAllUsers);
router.post("/admin", requireAdmin, setUserAdminStatus);
router.post("/active", requireAdmin, setUserActiveStatus);
router.get("/me", requireAuth, getMe);
router.post("/me/alias", requireAuth, setMyAlias);

export default router;
