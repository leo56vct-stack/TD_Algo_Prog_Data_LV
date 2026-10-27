import nodemailer from "nodemailer";

export function createMailer(env = process.env) {
  const required = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_APP_PASSWORD", "MAIL_FROM"];
  const missing = required.filter((key) => !env[key]);

  if (missing.length > 0) {
    return {
      sendMail: async () => {
        throw new Error(`Email settings are missing: ${missing.join(", ")}`);
      },
    };
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT),
    secure: Number(env.SMTP_PORT) === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_APP_PASSWORD,
    },
  });

  return {
    sendMail: (message) => transporter.sendMail({ from: env.MAIL_FROM, ...message }),
  };
}

export function createAccountEmail({ fullName, email, activationUrl }) {
  return {
    to: email,
    subject: "Activez votre compte du club de triathlon",
    text: `Bonjour ${fullName},\n\nVotre compte a été créé après validation de votre licence. Pour choisir votre mot de passe, ouvrez ce lien : ${activationUrl}\n\nSi vous n'êtes pas à l'origine de cette demande, contactez le club.`,
    html: `<p>Bonjour ${escapeHtml(fullName)},</p><p>Votre compte a été créé après validation de votre licence. Pour choisir votre mot de passe, utilisez le lien ci-dessous :</p><p><a href="${escapeHtml(activationUrl)}">Activer mon compte</a></p><p>Si vous n'êtes pas à l'origine de cette demande, contactez le club.</p>`,
  };
}

export function createPasswordResetEmail({ fullName, email, resetUrl }) {
  return {
    to: email,
    subject: "Réinitialisation de votre mot de passe",
    text: `Bonjour ${fullName},\n\nPour choisir un nouveau mot de passe, ouvrez ce lien : ${resetUrl}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.`,
    html: `<p>Bonjour ${escapeHtml(fullName)},</p><p>Pour choisir un nouveau mot de passe, utilisez le lien ci-dessous :</p><p><a href="${escapeHtml(resetUrl)}">Réinitialiser mon mot de passe</a></p><p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.</p>`,
  };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}