import bcrypt from "bcryptjs";
import cors from "cors";
import express from "express";
import {
  createAccessToken,
  createAuthMiddleware,
  createOpaqueToken,
  hashOpaqueToken,
  requireRole,
} from "./auth.js";
import {
  createAccountEmail,
  createMailer,
  createPasswordResetEmail,
} from "./email.js";
import { getEffectiveAttendance, isResponseEditable } from "./attendance-rules.js";

const TOKEN_LIFETIME_MS = 24 * 60 * 60 * 1000;
const PASSWORD_MIN_LENGTH = 12;

export function createApp({ pool, jwtSecret, mailer = createMailer(), frontendUrl = "http://localhost:5173" }) {
  if (!pool) {
    throw new Error("A database pool is required.");
  }
  if (!jwtSecret) {
    throw new Error("A JWT secret is required.");
  }

  const app = express();
  const authenticate = createAuthMiddleware(jwtSecret);

  app.use(cors({ origin: frontendUrl }));
  app.use(express.json({ limit: "20kb" }));

  app.get("/api/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  app.post("/api/auth/activate", async (request, response) => {
    const { token, password } = request.body ?? {};
    if (!isValidPassword(password) || typeof token !== "string") {
      return response.status(400).json({ error: "A valid token and password of at least 12 characters are required." });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `UPDATE users
       SET password_hash = $1, is_active = TRUE,
           activation_token_hash = NULL, activation_expires_at = NULL
       WHERE activation_token_hash = $2 AND activation_expires_at > NOW()
       RETURNING id, email, role`,
      [passwordHash, hashOpaqueToken(token)],
    );

    if (result.rowCount === 0) {
      return response.status(400).json({ error: "Activation link is invalid or expired." });
    }

    const user = result.rows[0];
    return response.status(200).json({
      token: createAccessToken(user, jwtSecret),
      user: publicUser(user),
    });
  });

  app.post("/api/auth/login", async (request, response) => {
    const email = normalizeEmail(request.body?.email);
    const password = request.body?.password;
    if (!email || typeof password !== "string") {
      return response.status(400).json({ error: "Email and password are required." });
    }

    const result = await pool.query(
      `SELECT id, full_name, email, role, password_hash, is_active
       FROM users WHERE email = $1`,
      [email],
    );
    const user = result.rows[0];
    const passwordMatches = user?.password_hash
      ? await bcrypt.compare(password, user.password_hash)
      : false;

    if (!user || !user.is_active || !passwordMatches) {
      return response.status(401).json({ error: "Email or password is incorrect." });
    }

    return response.json({
      token: createAccessToken(user, jwtSecret),
      user: publicUser(user),
    });
  });

  app.post("/api/auth/password-reset", async (request, response) => {
    const email = normalizeEmail(request.body?.email);
    if (!email) {
      return response.status(400).json({ error: "A valid email is required." });
    }

    const result = await pool.query(
      "SELECT id, full_name, email FROM users WHERE email = $1 AND is_active = TRUE",
      [email],
    );
    const user = result.rows[0];

    if (user) {
      const token = createOpaqueToken();
      await pool.query(
        `UPDATE users SET reset_token_hash = $1,
           reset_expires_at = NOW() + INTERVAL '1 hour' WHERE id = $2`,
        [hashOpaqueToken(token), user.id],
      );
      await mailer.sendMail(createPasswordResetEmail({
        fullName: user.full_name,
        email: user.email,
        resetUrl: `${frontendUrl}/reset-password?token=${encodeURIComponent(token)}`,
      }));
    }

    return response.status(202).json({ message: "If the account exists, a reset email has been sent." });
  });

  app.post("/api/auth/password-reset/complete", async (request, response) => {
    const { token, password } = request.body ?? {};
    if (typeof token !== "string" || !isValidPassword(password)) {
      return response.status(400).json({ error: "A valid token and password of at least 12 characters are required." });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `UPDATE users SET password_hash = $1, reset_token_hash = NULL, reset_expires_at = NULL
       WHERE reset_token_hash = $2 AND reset_expires_at > NOW() AND is_active = TRUE
       RETURNING id`,
      [passwordHash, hashOpaqueToken(token)],
    );

    if (result.rowCount === 0) {
      return response.status(400).json({ error: "Reset link is invalid or expired." });
    }
    return response.json({ message: "Password updated." });
  });

  app.get("/api/me", authenticate, async (request, response) => {
    const result = await pool.query(
      "SELECT id, full_name, email, role FROM users WHERE id = $1 AND is_active = TRUE",
      [request.user.id],
    );
    if (result.rowCount === 0) {
      return response.status(401).json({ error: "Account is inactive or no longer exists." });
    }
    return response.json({ user: result.rows[0] });
  });

  app.post("/api/members", authenticate, requireRole("coach", "admin"), async (request, response) => {
    const { fullName, email: rawEmail, role = "member" } = request.body ?? {};
    const email = normalizeEmail(rawEmail);
    if (typeof fullName !== "string" || !fullName.trim() || !email) {
      return response.status(400).json({ error: "Full name and a valid email are required." });
    }
    if (role !== "member" && role !== "coach") {
      return response.status(400).json({ error: "Role must be 'member' or 'coach'." });
    }
    if (role === "coach" && request.user.role !== "admin") {
      return response.status(403).json({ error: "Only an admin can create a coach account." });
    }

    const token = createOpaqueToken();
    const result = await pool.query(
      `INSERT INTO users (full_name, email, role, activation_token_hash, activation_expires_at)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '24 hours')
       RETURNING id, full_name, email, role, is_active`,
      [fullName.trim(), email, role, hashOpaqueToken(token)],
    );
    const user = result.rows[0];

    try {
      await mailer.sendMail(createAccountEmail({
        fullName: user.full_name,
        email: user.email,
        activationUrl: `${frontendUrl}/activate?token=${encodeURIComponent(token)}`,
      }));
    } catch {
      await pool.query("DELETE FROM users WHERE id = $1 AND is_active = FALSE", [user.id]);
      return response.status(503).json({
        error: "Account created but activation email could not be sent.",
        accountCreated: false,
      });
    }

    return response.status(201).json({ member: publicUser(user) });
  });

  app.get("/api/trainings", authenticate, async (request, response) => {
    const result = await pool.query(
      `SELECT t.id, t.title, t.discipline, t.starts_at, t.location, t.notes,
              a.status AS response_status
       FROM trainings t
       LEFT JOIN attendance_responses a ON a.training_id = t.id AND a.member_id = $1
       WHERE t.starts_at >= NOW() - INTERVAL '1 day'
       ORDER BY t.starts_at`,
      [request.user.id],
    );
    const now = new Date();
    return response.json({
      trainings: result.rows.map((training) => ({
        ...training,
        effective_status: getEffectiveAttendance(training.response_status, training.starts_at, now),
        response_editable: isResponseEditable(training.starts_at, now),
      })),
    });
  });

  app.post("/api/trainings", authenticate, requireRole("coach", "admin"), async (request, response) => {
    const { title, discipline = null, startsAt, location = null, notes = null } = request.body ?? {};
    const startsAtDate = parseDate(startsAt);
    if (typeof title !== "string" || !title.trim() || !startsAtDate) {
      return response.status(400).json({ error: "Title and a valid start date are required." });
    }
    const result = await pool.query(
      `INSERT INTO trainings (title, discipline, starts_at, location, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, title, discipline, starts_at, location, notes`,
      [title.trim(), discipline, startsAtDate, location, notes, request.user.id],
    );
    return response.status(201).json({ training: result.rows[0] });
  });

  app.put("/api/trainings/:id", authenticate, requireRole("coach", "admin"), async (request, response) => {
    const { title, discipline = null, startsAt, location = null, notes = null } = request.body ?? {};
    const startsAtDate = parseDate(startsAt);
    if (typeof title !== "string" || !title.trim() || !startsAtDate) {
      return response.status(400).json({ error: "Title and a valid start date are required." });
    }
    const result = await pool.query(
      `UPDATE trainings SET title = $1, discipline = $2, starts_at = $3, location = $4, notes = $5
       WHERE id = $6 RETURNING id, title, discipline, starts_at, location, notes`,
      [title.trim(), discipline, startsAtDate, location, notes, request.params.id],
    );
    if (result.rowCount === 0) {
      return response.status(404).json({ error: "Training not found." });
    }
    return response.json({ training: result.rows[0] });
  });

  app.delete("/api/trainings/:id", authenticate, requireRole("coach", "admin"), async (request, response) => {
    const result = await pool.query("DELETE FROM trainings WHERE id = $1 RETURNING id", [request.params.id]);
    if (result.rowCount === 0) {
      return response.status(404).json({ error: "Training not found." });
    }
    return response.status(204).end();
  });

  app.get("/api/trainings/:id/attendance", authenticate, requireRole("coach", "admin"), async (request, response) => {
    const result = await pool.query(
      `SELECT t.id AS training_id, t.starts_at, u.id AS member_id, u.full_name, u.email,
              a.status AS response_status
       FROM trainings t
       JOIN users u ON u.role = 'member' AND u.is_active = TRUE
       LEFT JOIN attendance_responses a ON a.training_id = t.id AND a.member_id = u.id
       WHERE t.id = $1
       ORDER BY u.full_name`,
      [request.params.id],
    );
    if (result.rowCount === 0) {
      const trainingResult = await pool.query("SELECT id FROM trainings WHERE id = $1", [request.params.id]);
      if (trainingResult.rowCount === 0) {
        return response.status(404).json({ error: "Training not found." });
      }
    }

    const startsAt = result.rows[0]?.starts_at;
    const now = new Date();
    const members = result.rows.map((row) => ({
      id: row.member_id,
      full_name: row.full_name,
      email: row.email,
      response: row.response_status ?? null,
      effective_status: getEffectiveAttendance(row.response_status, startsAt, now),
    }));
    return response.json({
      trainingId: request.params.id,
      members,
      counts: {
        present: members.filter((member) => member.effective_status === "present").length,
        absent: members.filter((member) => member.effective_status === "absent").length,
        pending: members.filter((member) => member.effective_status === "pending").length,
      },
    });
  });

  app.put("/api/trainings/:id/attendance", authenticate, requireRole("member"), async (request, response) => {
    const { status } = request.body ?? {};
    if (status !== "present" && status !== "absent") {
      return response.status(400).json({ error: "Status must be 'present' or 'absent'." });
    }
    const trainingResult = await pool.query("SELECT starts_at FROM trainings WHERE id = $1", [request.params.id]);
    if (trainingResult.rowCount === 0) {
      return response.status(404).json({ error: "Training not found." });
    }
    if (!isResponseEditable(trainingResult.rows[0].starts_at, new Date())) {
      return response.status(409).json({ error: "Attendance responses are locked 24 hours before the training." });
    }

    const result = await pool.query(
      `INSERT INTO attendance_responses (member_id, training_id, status)
       VALUES ($1, $2, $3)
       ON CONFLICT (member_id, training_id)
       DO UPDATE SET status = EXCLUDED.status, updated_at = NOW()
       RETURNING training_id, status, updated_at`,
      [request.user.id, request.params.id, status],
    );
    return response.json({ response: result.rows[0] });
  });

  app.use((error, _request, response, _next) => {
    if (error.code === "23505") {
      return response.status(409).json({ error: "An account with this email already exists." });
    }
    return response.status(500).json({ error: "Internal server error." });
  });

  return app;
}

function normalizeEmail(value) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function isValidPassword(value) {
  return typeof value === "string" && value.length >= PASSWORD_MIN_LENGTH && value.length <= 128;
}

function parseDate(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function publicUser(user) {
  return { id: user.id, full_name: user.full_name, email: user.email, role: user.role };
}