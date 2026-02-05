import jwt from "jsonwebtoken";

export function requireAuth(req, res, next) {
    // console.log("requireAuth middleware invoked");
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
        console.log("requireAuth: Missing token");
        return res.status(401).json({ ok: false, error: "Missing token" });
    }

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.user = payload;
        // console.log("requireAuth: req.user set", req.user);
        next();
    } catch (e) {
        if (e.name === 'TokenExpiredError') {
            console.log("requireAuth: Token expired");
            return res.status(401).json({ ok: false, error: "Token expired" });
        } else if (e.name === 'JsonWebTokenError') {
            console.log("requireAuth: Invalid token (JsonWebTokenError)", e.message);
            return res.status(401).json({ ok: false, error: "Invalid token" });
        } else {
            console.error("requireAuth: Unknown JWT error", e);
            return res.status(500).json({ ok: false, error: "Internal server error" });
        }
    }
}
