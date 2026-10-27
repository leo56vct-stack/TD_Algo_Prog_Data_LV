import "dotenv/config";
import bcrypt from "bcryptjs";
import { createPool, initializeDatabase } from "../src/database.js";

const fullName = process.env.INITIAL_ADMIN_NAME?.trim();
const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.INITIAL_ADMIN_PASSWORD;

if (!fullName || !email || !password || password.length < 12) {
  console.error("Set INITIAL_ADMIN_NAME, INITIAL_ADMIN_EMAIL, and a password of at least 12 characters in backend/.env.");
  process.exit(1);
}

const pool = createPool();

try {
  await initializeDatabase(pool);
  const passwordHash = await bcrypt.hash(password, 12);
  await pool.query(
    `INSERT INTO users (full_name, email, role, password_hash, is_active)
     VALUES ($1, $2, 'admin', $3, TRUE)`,
    [fullName, email, passwordHash],
  );
  console.log(`Administrator account created for ${email}.`);
} catch (error) {
  if (error.code === "23505") {
    console.error(`An account already exists for ${email}.`);
  } else {
    console.error("Could not create the administrator account.", error);
  }
  process.exitCode = 1;
} finally {
  await pool.end();
}