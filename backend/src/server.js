import "dotenv/config";
import { createApp } from "./app.js";
import { createPool, initializeDatabase } from "./database.js";
import { createMailer } from "./email.js";

const pool = createPool();

try {
  await initializeDatabase(pool);
  const app = createApp({
    pool,
    jwtSecret: process.env.JWT_SECRET,
    mailer: createMailer(),
    frontendUrl: process.env.FRONTEND_URL,
  });
  const port = Number(process.env.PORT) || 3000;
  const server = app.listen(port, () => {
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