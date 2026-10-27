import bcrypt from "bcryptjs";

export const demoAccounts = {
  member: {
    fullName: "Membre Démo",
    email: "membre.demo@example.invalid",
    password: "TriathlonDemo2026!",
    role: "member",
  },
  coach: {
    fullName: "Entraîneur Démo",
    email: "coach.demo@example.invalid",
    password: "CoachDemo2026!",
    role: "coach",
  },
};

export async function initializeDemoData(pool) {
  const accounts = {};
  for (const [key, account] of Object.entries(demoAccounts)) {
    const passwordHash = await bcrypt.hash(account.password, 10);
    const result = await pool.query(
      `INSERT INTO users (full_name, email, role, password_hash, is_active)
       VALUES ($1, $2, $3, $4, TRUE)
       ON CONFLICT (email) DO UPDATE SET
         full_name = EXCLUDED.full_name,
         role = EXCLUDED.role,
         password_hash = EXCLUDED.password_hash,
         is_active = TRUE
       RETURNING id`,
      [account.fullName, account.email, account.role, passwordHash],
    );
    accounts[key] = result.rows[0].id;
  }

  const trainingResult = await pool.query(
    `INSERT INTO trainings (title, discipline, starts_at, location, notes, created_by)
     SELECT 'Séance découverte', 'Triathlon', NOW() + INTERVAL '3 days',
            'Stade municipal', 'Séance de démonstration avec données fictives.', $1::BIGINT
     WHERE NOT EXISTS (
       SELECT 1 FROM trainings
       WHERE title = 'Séance découverte' AND starts_at > NOW()
     )
     RETURNING id`,
    [accounts.coach],
  );
  const trainingId = trainingResult.rows[0]?.id ?? (await pool.query(
    `SELECT id FROM trainings
     WHERE title = 'Séance découverte' AND starts_at > NOW()
     ORDER BY starts_at LIMIT 1`,
  )).rows[0].id;

  await pool.query(
    `INSERT INTO attendance_responses (member_id, training_id, status)
     VALUES ($1, $2, 'present')
     ON CONFLICT (member_id, training_id)
     DO UPDATE SET status = EXCLUDED.status`,
    [accounts.member, trainingId],
  );
}