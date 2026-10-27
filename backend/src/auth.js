import { createHash, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";

export function createOpaqueToken() {
  return randomBytes(32).toString("hex");
}

export function hashOpaqueToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function createAccessToken(user, secret) {
  return jwt.sign(
    { role: user.role, email: user.email },
    secret,
    { subject: String(user.id), expiresIn: "12h" },
  );
}

export function createAuthMiddleware(secret) {
  return (request, response, next) => {
    const authorization = request.get("authorization");
    const [scheme, token] = authorization?.split(" ") ?? [];

    if (scheme !== "Bearer" || !token) {
      return response.status(401).json({ error: "Authentication required." });
    }

    try {
      const payload = jwt.verify(token, secret);
      request.user = {
        id: payload.sub,
        role: payload.role,
        email: payload.email,
      };
      return next();
    } catch {
      return response.status(401).json({ error: "Invalid or expired access token." });
    }
  };
}

export function requireRole(...allowedRoles) {
  return (request, response, next) => {
    if (!allowedRoles.includes(request.user?.role)) {
      return response.status(403).json({ error: "Insufficient permissions." });
    }
    return next();
  };
}