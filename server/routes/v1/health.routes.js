import { Router } from "express";

const router = Router();

router.get("/", (req, res) => {
    res.json({ ok: true, message: "API v1 is running ✅" });
});

export default router;
