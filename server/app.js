import express from "express";
import cors from "cors";

import path from "path";
import { fileURLToPath } from "url";

import v1Routes from "./routes/v1/index.js";


const app = express();

// Set trust proxy to true if you are behind a reverse proxy
app.set('trust proxy', 1); // trust first proxy

// ====== REQUIRED FOR __dirname IN ES MODULES ======
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ====== MIDDLEWARE ======
app.use(cors());
app.use(express.json());

// ✅ STEP 8.3 — serve uploaded files
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

// ====== ROUTES ======
app.get("/health", (req, res) => {
    res.json({ ok: true, where: "node", time: new Date().toISOString() });
});
app.use("/api/v1", v1Routes);


// NOTE: Client build is served separately in production (e.g. via webserver/host).
// The API should only expose endpoints. Removed serving of ../client/build to avoid ENOENT in deployed hosts.


app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500).json({ ok: false, error: err.message || "Internal Server Error" });
});

export default app;
