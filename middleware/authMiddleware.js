const jwt = require("jsonwebtoken");

// Protects routes: reads Authorization: Bearer <token>, verifies the JWT,
// and attaches the decoded payload to req.user. Invalid tokens must not crash the server.
function authMiddleware(req, res, next) {
    try {
        // Secret lives in .env so it is never hardcoded in source
        if (!process.env.JWT_SECRET) {
            return res.status(500).json({
                success: false,
                message: "Server configuration error"
            });
        }

        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        // Expected format: "Bearer <token>" (reject Basic, missing parts, empty token)
        const parts = authHeader.split(" ");

        if (parts.length !== 2 || parts[0] !== "Bearer" || !parts[1]) {
            return res.status(401).json({
                success: false,
                message: "Invalid or expired token"
            });
        }

        const token = parts[1];

        // jwt.verify throws on invalid signature or expiry — caught below
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Payload from login: { id, iat, exp }
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired token"
        });
    }
}

module.exports = authMiddleware;
