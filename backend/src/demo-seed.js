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

const demoRoster = [
  { fullName: "Camille Martin", email: "camille.demo@example.invalid" },
  { fullName: "Noah Bernard", email: "noah.demo@example.invalid" },
  { fullName: "Inès Laurent", email: "ines.demo@example.invalid" },
  { fullName: "Hugo Petit", email: "hugo.demo@example.invalid" },
];

const demoSchedule = [
  { title: "Natation technique", discipline: "Natation", daysFromNow: 2, hour: 18, minute: 30, location: "Piscine municipale", notes: "Éducatifs et travail d'allure. Données de démonstration." },
  { title: "Course à pied fractionnée", discipline: "Course à pied", daysFromNow: 3, hour: 18, minute: 0, location: "Stade municipal", notes: "Séance fictive : séries courtes et récupération." },
  { title: "Vélo endurance", discipline: "Vélo", daysFromNow: 4, hour: 9, minute: 0, location: "Parking du stade", notes: "Sortie fictive en groupe, allure régulière." },
  { title: "Renforcement et mobilité", discipline: "Renforcement", daysFromNow: 5, hour: 19, minute: 0, location: "Salle du club", notes: "Matériel léger, séance accessible à tous." },
  { title: "Enchaînement vélo-course", discipline: "Triathlon", daysFromNow: 6, hour: 10, minute: 0, location: "Base de loisirs", notes: "Atelier fictif de transition vélo-course." },
];

const demoResponseMatrix = [
  ["present", "present", "absent", "present", "absent"],
  ["present", "present", "present", "present", "absent"],
  ["present", "absent", "present", null, "present"],
  ["absent", "present", null, "present", "present"],
  [null, "present", "present", "absent", "present"],
];

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

  const memberIds = [accounts.member];
  for (const member of demoRoster) {
    const passwordHash = await bcrypt.hash(demoAccounts.member.password, 10);
    const result = await pool.query(
      `INSERT INTO users (full_name, email, role, password_hash, is_active)
       VALUES ($1, $2, 'member', $3, TRUE)
       ON CONFLICT (email) DO UPDATE SET
         full_name = EXCLUDED.full_name,
         role = EXCLUDED.role,
         password_hash = EXCLUDED.password_hash,
         is_active = TRUE
       RETURNING id`,
      [member.fullName, member.email, passwordHash],
    );
    memberIds.push(result.rows[0].id);
  }

  for (let index = 0; index < demoSchedule.length; index += 1) {
    const session = demoSchedule[index];
    const startsAt = new Date(Date.now() + session.daysFromNow * 24 * 60 * 60 * 1000);
    startsAt.setHours(session.hour, session.minute, 0, 0);

    const existing = await pool.query(
      `SELECT id FROM trainings WHERE title = $1 AND starts_at > NOW()
       ORDER BY starts_at LIMIT 1`,
      [session.title],
    );
    const trainingId = existing.rows[0]?.id ?? (await pool.query(
      `INSERT INTO trainings (title, discipline, starts_at, location, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [session.title, session.discipline, startsAt, session.location, session.notes, accounts.coach],
    )).rows[0].id;

    for (let memberIndex = 0; memberIndex < memberIds.length; memberIndex += 1) {
      const status = demoResponseMatrix[memberIndex][index];
      if (!status) continue;
      await pool.query(
        `INSERT INTO attendance_responses (member_id, training_id, status)
         VALUES ($1, $2, $3)
         ON CONFLICT (member_id, training_id)
         DO UPDATE SET status = EXCLUDED.status`,
        [memberIds[memberIndex], trainingId, status],
      );
    }
  }
}