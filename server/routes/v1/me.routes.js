import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware.js";

const router = Router();

router.get("/", requireAuth, (req, res) => {
    res.json({ ok: true, user: req.user });
});

export default router;
