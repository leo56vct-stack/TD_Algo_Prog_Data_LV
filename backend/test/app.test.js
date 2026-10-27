import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { after, test } from "node:test";
import { newDb } from "pg-mem";
import request from "supertest";
import { createAccessToken } from "../src/auth.js";
import { createApp } from "../src/app.js";
import { initializeDatabase } from "../src/database.js";
import { demoAccounts, initializeDemoData } from "../src/demo-seed.js";

const JWT_SECRET = "test-only-secret";
const pools = [];

after(async () => {
  await Promise.all(pools.map((pool) => pool.end()));
});

async function setup({ demoMode = false } = {}) {
  const database = newDb({ autoCreateForeignKeyIndices: true });
  const { Pool } = database.adapters.createPg();
  const pool = new Pool();
  pools.push(pool);
  await initializeDatabase(pool);

  const emails = [];
  const mailer = { sendMail: async (message) => emails.push(message) };
  const app = createApp({
    pool,
    jwtSecret: JWT_SECRET,
    mailer,
    frontendUrl: "http://localhost:5173",
    demoMode,
  });
  return { app, pool, emails, mailer };
}

async function addUser(pool, { fullName, email, role, active = true }) {
  const result = await pool.query(
    `INSERT INTO users (full_name, email, role, password_hash, is_active)
     VALUES ($1, $2, $3, $4, $5) RETURNING id, full_name, email, role`,
    [fullName, email, role, active ? await bcrypt.hash("test-password-123", 4) : null, active],
  );
  return result.rows[0];
}

function authHeader(user) {
  return `Bearer ${createAccessToken(user, JWT_SECRET)}`;
}

test("health endpoint is public", async (t) => {
  const { app, pool } = await setup();
  t.after(() => pool.end());

  const response = await request(app).get("/api/health");
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: "ok" });
});

test("staff creates an account and the member activates it from the emailed link", async (t) => {
  const { app, pool, emails } = await setup();
  t.after(() => pool.end());
  const admin = await addUser(pool, {
    fullName: "Administrateur",
    email: "admin@club.example",
    role: "admin",
  });

  const created = await request(app)
    .post("/api/members")
    .set("Authorization", authHeader(admin))
    .send({ fullName: "Alex Martin", email: "ALEX@EXAMPLE.COM" });

  assert.equal(created.status, 201);
  assert.equal(created.body.member.email, "alex@example.com");
  assert.equal(emails.length, 1);

  const activationUrl = new URL(emails[0].html.match(/href="([^"]+)"/)[1]);
  const token = activationUrl.searchParams.get("token");
  const stored = await pool.query("SELECT activation_token_hash FROM users WHERE id = $1", [created.body.member.id]);
  assert.notEqual(stored.rows[0].activation_token_hash, token);

  const activated = await request(app)
    .post("/api/auth/activate")
    .send({ token, password: "correct-horse-battery" });
  assert.equal(activated.status, 200);
  assert.equal(activated.body.user.email, "alex@example.com");
  assert.equal(activated.body.user.role, "member");

  const login = await request(app)
    .post("/api/auth/login")
    .send({ email: "alex@example.com", password: "correct-horse-battery" });
  assert.equal(login.status, 200);
  assert.ok(login.body.token);
});

test("removes an unactivated account if its invitation email cannot be sent", async (t) => {
  const { app, pool, mailer } = await setup();
  t.after(() => pool.end());
  const admin = await addUser(pool, {
    fullName: "Administrateur",
    email: "admin@club.example",
    role: "admin",
  });
  mailer.sendMail = async () => { throw new Error("SMTP unavailable"); };

  const response = await request(app)
    .post("/api/members")
    .set("Authorization", authHeader(admin))
    .send({ fullName: "Alex Martin", email: "alex@example.com" });

  assert.equal(response.status, 503);
  assert.equal(response.body.accountCreated, false);
  const member = await pool.query("SELECT id FROM users WHERE email = $1", ["alex@example.com"]);
  assert.equal(member.rowCount, 0);
});

test("only staff can manage trainings and a member can submit one editable response", async (t) => {
  const { app, pool } = await setup();
  t.after(() => pool.end());
  const coach = await addUser(pool, {
    fullName: "Coach",
    email: "coach@club.example",
    role: "coach",
  });
  const member = await addUser(pool, {
    fullName: "Membre",
    email: "member@club.example",
    role: "member",
  });

  const denied = await request(app)
    .post("/api/trainings")
    .set("Authorization", authHeader(member))
    .send({ title: "Natation", startsAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString() });
  assert.equal(denied.status, 403);

  const created = await request(app)
    .post("/api/trainings")
    .set("Authorization", authHeader(coach))
    .send({
      title: "Natation",
      discipline: "Natation",
      startsAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
      location: "Piscine municipale",
    });
  assert.equal(created.status, 201);

  const trainingId = created.body.training.id;
  const firstAnswer = await request(app)
    .put(`/api/trainings/${trainingId}/attendance`)
    .set("Authorization", authHeader(member))
    .send({ status: "present" });
  assert.equal(firstAnswer.status, 200);

  const changedAnswer = await request(app)
    .put(`/api/trainings/${trainingId}/attendance`)
    .set("Authorization", authHeader(member))
    .send({ status: "absent" });
  assert.equal(changedAnswer.status, 200);
  const responses = await pool.query("SELECT * FROM attendance_responses WHERE training_id = $1", [trainingId]);
  assert.equal(responses.rowCount, 1);
  assert.equal(responses.rows[0].status, "absent");
});

test("a coach can create a competition as a distinct event kind", async (t) => {
  const { app, pool } = await setup();
  t.after(() => pool.end());
  const coach = await addUser(pool, {
    fullName: "Coach",
    email: "coach@club.example",
    role: "coach",
  });

  const created = await request(app)
    .post("/api/trainings")
    .set("Authorization", authHeader(coach))
    .send({
      title: "Triathlon de Vannes",
      kind: "competition",
      discipline: "Triathlon",
      startsAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
      location: "Vannes",
    });

  assert.equal(created.status, 201);
  assert.equal(created.body.training.kind, "competition");
});

test("an unanswered member is counted absent after the 24-hour deadline", async (t) => {
  const { app, pool } = await setup();
  t.after(() => pool.end());
  const coach = await addUser(pool, {
    fullName: "Coach",
    email: "coach@club.example",
    role: "coach",
  });
  await addUser(pool, {
    fullName: "Membre",
    email: "member@club.example",
    role: "member",
  });

  const created = await request(app)
    .post("/api/trainings")
    .set("Authorization", authHeader(coach))
    .send({ title: "Course à pied", startsAt: new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString() });
  assert.equal(created.status, 201);

  const attendance = await request(app)
    .get(`/api/trainings/${created.body.training.id}/attendance`)
    .set("Authorization", authHeader(coach));
  assert.equal(attendance.status, 200);
  assert.deepEqual(attendance.body.counts, { present: 0, absent: 1, pending: 0 });
});

test("responses are locked within 24 hours of the training", async (t) => {
  const { app, pool } = await setup();
  t.after(() => pool.end());
  const coach = await addUser(pool, {
    fullName: "Coach",
    email: "coach@club.example",
    role: "coach",
  });
  const member = await addUser(pool, {
    fullName: "Membre",
    email: "member@club.example",
    role: "member",
  });
  const created = await request(app)
    .post("/api/trainings")
    .set("Authorization", authHeader(coach))
    .send({ title: "Vélo", startsAt: new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString() });

  const answer = await request(app)
    .put(`/api/trainings/${created.body.training.id}/attendance`)
    .set("Authorization", authHeader(member))
    .send({ status: "present" });
  assert.equal(answer.status, 409);
});

test("classroom demo seeds fictional accounts and disables email workflows", async (t) => {
  const { app, pool, emails } = await setup({ demoMode: true });
  t.after(() => pool.end());
  await initializeDemoData(pool);

  const memberLogin = await request(app)
    .post("/api/auth/login")
    .send({ email: demoAccounts.member.email, password: demoAccounts.member.password });
  assert.equal(memberLogin.status, 200);
  assert.equal(memberLogin.body.user.role, "member");

  const coachLogin = await request(app)
    .post("/api/auth/login")
    .send({ email: demoAccounts.coach.email, password: demoAccounts.coach.password });
  assert.equal(coachLogin.status, 200);

  const invite = await request(app)
    .post("/api/members")
    .set("Authorization", `Bearer ${coachLogin.body.token}`)
    .send({ fullName: "Ne doit pas être créé", email: "real@example.com" });
  assert.equal(invite.status, 403);

  const reset = await request(app)
    .post("/api/auth/password-reset")
    .send({ email: demoAccounts.member.email });
  assert.equal(reset.status, 202);
  assert.equal(emails.length, 0);

  const trainings = await request(app)
    .get("/api/trainings")
    .set("Authorization", `Bearer ${memberLogin.body.token}`);
  assert.equal(trainings.status, 200);
  assert.equal(trainings.body.trainings.length, 6);
  const competition = trainings.body.trainings.find((event) => event.kind === "competition");
  assert.equal(competition.title, "Triathlon de Vannes - équipe démo");

  const competitionRoster = await request(app)
    .get(`/api/trainings/${competition.id}/attendance`)
    .set("Authorization", `Bearer ${coachLogin.body.token}`);
  assert.equal(competitionRoster.status, 200);
  assert.deepEqual(competitionRoster.body.counts, { present: 4, absent: 1, pending: 0 });
  const swimTraining = trainings.body.trainings.find((training) => training.title === "Natation technique");
  assert.equal(swimTraining.effective_status, "present");

  const coachAttendance = await request(app)
    .get(`/api/trainings/${swimTraining.id}/attendance`)
    .set("Authorization", `Bearer ${coachLogin.body.token}`);
  assert.equal(coachAttendance.status, 200);
  assert.equal(coachAttendance.body.members.length, 5);
  assert.deepEqual(coachAttendance.body.counts, { present: 3, absent: 1, pending: 1 });
});