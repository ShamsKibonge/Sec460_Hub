import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { createFolder, deleteFile, deleteFolder, getContents, renameFile, renameFolder, searchMyFiles } from "../../controllers/drive.controller.js";
import { upload } from "../../middleware/upload.middleware.js";
import { uploadDriveFile, downloadDriveFile } from "../../controllers/drive.controller.js";


const router = Router();

router.use(requireAuth);

router.post("/folders", createFolder);
router.get("/contents", getContents);
router.post("/files", upload.single("file"), uploadDriveFile);
router.get("/files/:fileId/download", downloadDriveFile);
router.delete("/files/:fileId", requireAuth, deleteFile);
router.patch("/files/:fileId", requireAuth, renameFile);
router.delete("/folders/:folderId", requireAuth, deleteFolder);
router.patch("/folders/:folderId", requireAuth, renameFolder);
router.get("/files/search", requireAuth, searchMyFiles);


export default router;
