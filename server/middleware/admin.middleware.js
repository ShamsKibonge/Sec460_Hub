import jwt from "jsonwebtoken";

export function requireAdmin(req, res, next) {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
        return res.status(401).json({ ok: false, error: "Missing token" });
    }

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        if (!payload.isAdmin) {
            return res.status(403).json({ ok: false, error: "Forbidden" });
        }
        req.user = payload;
        next();
    } catch (e) {
        if (e.name === 'TokenExpiredError') {
            return res.status(401).json({ ok: false, error: "Token expired" });
        } else if (e.name === 'JsonWebTokenError') {
            return res.status(401).json({ ok: false, error: "Invalid token" });
        } else {
            return res.status(500).json({ ok: false, error: "Internal server error" });
        }
    }
}
