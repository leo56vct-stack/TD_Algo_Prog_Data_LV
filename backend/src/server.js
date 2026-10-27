import "dotenv/config";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { createPool, initializeDatabase } from "./database.js";
import { createMailer } from "./email.js";
import { initializeDemoData } from "./demo-seed.js";

const pool = createPool();
const demoMode = process.env.COURSE_DEMO_MODE === "true";

try {
  await initializeDatabase(pool);
  if (demoMode) {
    await initializeDemoData(pool);
  }
  const app = createApp({
    pool,
    jwtSecret: process.env.JWT_SECRET || (demoMode ? randomBytes(32).toString("base64url") : undefined),
    mailer: createMailer(),
    frontendUrl: process.env.PUBLIC_ORIGIN || process.env.FRONTEND_URL || "http://localhost:5173",
    frontendDist: process.env.FRONTEND_DIST || fileURLToPath(new URL("../../frontend/dist", import.meta.url)),
    demoMode,
  });
  const port = Number(process.env.PORT) || 3000;
  const server = app.listen(port, "0.0.0.0", () => {
    console.log(`Attendance API listening on port ${port}`);
  });

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      server.close(async () => {
        await pool.end();
        process.exit(0);
      });
    });
  }
} catch (error) {
  console.error("Failed to start the attendance API.", error);
  await pool.end();
  process.exitCode = 1;
}