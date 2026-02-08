/* semgrep-disable javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal */
import path from "path";

export function safeJoin(baseDir, filename) {
    // 1) Only allow a simple filename (no folders)
    const baseName = path.basename(filename);

    // Optional: strict allowlist (recommended)
    // Adjust allowed chars to your storage naming pattern
    if (!/^[a-zA-Z0-9._-]+$/.test(baseName)) {
        const err = new Error("Invalid filename");
        err.status = 400;
        throw err;
    }

    // 2) Build absolute paths and verify it stays inside baseDir
    const base = path.resolve(baseDir);
    const target = path.resolve(baseDir, baseName);

    if (!target.startsWith(base + path.sep)) {
        const err = new Error("Path traversal detected");
        err.status = 400;
        throw err;
    }

    return target;
}

export default { safeJoin };
