import multer from "multer";
import path from "path";
import crypto from "crypto";

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, "uploads"),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname || "");
        const name = crypto.randomBytes(16).toString("hex") + ext;
        cb(null, name);
    },
});

export const upload = multer({
    storage,
    limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
});
