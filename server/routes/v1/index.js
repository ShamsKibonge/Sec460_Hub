import { Router } from "express";

import healthRoutes from "./health.routes.js";
import authRoutes from "./auth.routes.js";
import usersRoutes from "./users.routes.js";
import messagesRoutes from "./messages.routes.js";
import filesRoutes from "./files.routes.js";
import meRoutes from "./me.routes.js";
import groupsRoutes from "./groups.routes.js";
import driveRoutes from "./drive.routes.js";
import dashboardRoutes from "./dashboard.routes.js";
import monitorRoutes from "./monitor.routes.js";
import logsRoutes from "./logs.routes.js";

const router = Router();
// Add this middleware to log all v1 requests
router.use((req, res, next) => {
  // console.log(`v1 router received request for: ${req.method} ${req.originalUrl}`);
  next();
});

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/users", usersRoutes);
router.use("/messages", messagesRoutes);
router.use("/files", filesRoutes);
router.use("/me", meRoutes);
router.use("/groups", groupsRoutes);
router.use("/drive", driveRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/monitor", monitorRoutes);
router.use("/logs", logsRoutes);

export default router;
