import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requestCode, verifyCodeAndLogin, logout } from "../../controllers/auth.controller.js";
import { requireAuth } from "../../middleware/auth.middleware.js";

const router = Router();

// simple protection against spam
const requestCodeLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
});

router.post("/request-code", requestCodeLimiter, requestCode);
router.post("/verify-code", verifyCodeAndLogin);
router.post("/logout", requireAuth, logout);

export default router;
