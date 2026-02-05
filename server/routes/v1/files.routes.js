import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { upload } from "../../middleware/upload.middleware.js";
import {
    uploadToGroup,
    uploadToThread,
    listGroupFiles,
    listThreadFiles,
    downloadFile,
} from "../../controllers/files.controller.js";

const router = Router();

router.post("/groups/:groupId/upload", requireAuth, upload.single("file"), uploadToGroup);
router.get("/groups/:groupId", requireAuth, listGroupFiles);

router.post("/direct/:threadId/upload", requireAuth, upload.single("file"), uploadToThread);
router.get("/direct/:threadId", requireAuth, listThreadFiles);

router.get("/:fileId/download", requireAuth, downloadFile);

export default router;
