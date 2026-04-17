import nodemailer from "nodemailer";

type VerificationEmailInput = {
  toEmail: string;
  firstName?: string | null;
  otpCode?: string | null;
  otpExpiresAt?: Date | null;
  verificationUrl?: string;
};

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
};

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (!value || value.trim().length === 0) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
  if (normalized === "false" || normalized === "0" || normalized === "no") return false;
  return fallback;
}

function parseNumber(value: string | undefined, fallback: number) {
  if (!value || value.trim().length === 0) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getSmtpConfig(): SmtpConfig {
  const user = (process.env.SMTP_USER ?? "").trim();
  const pass = (process.env.SMTP_PASS ?? "").trim();
  const host = (process.env.SMTP_HOST ?? "smtp.gmail.com").trim();
  const port = parseNumber(process.env.SMTP_PORT, 465);
  const secure = parseBoolean(process.env.SMTP_SECURE, port === 465);
  const fromEmail = (process.env.SMTP_FROM_EMAIL ?? user ?? "dealbazaar.pvt@gmail.com").trim();
  const fromName = (process.env.SMTP_FROM_NAME ?? "Deal Bazaar").trim();

  return {
    host,
    port,
    secure,
    user,
    pass,
    fromEmail,
    fromName,
  };
}

function assertSmtpConfig(config: SmtpConfig) {
  if (!config.user || !config.pass) {
    throw new Error("SMTP is not configured. Set SMTP_USER and SMTP_PASS.");
  }
}

let cachedTransporter: nodemailer.Transporter | null = null;
let cachedTransporterKey = "";

function getTransporter(config: SmtpConfig) {
  const key = `${config.host}:${config.port}:${config.secure}:${config.user}`;
  if (!cachedTransporter || cachedTransporterKey !== key) {
    cachedTransporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });
    cachedTransporterKey = key;
  }
  return cachedTransporter;
}

function formatMinutesDifference(from: Date, to: Date) {
  const minutes = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 60_000));
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

export async function sendVerificationEmail(input: VerificationEmailInput) {
  const config = getSmtpConfig();
  assertSmtpConfig(config);

  const transporter = getTransporter(config);
  const greetingName = input.firstName?.trim() || "there";
  const hasOtp = Boolean(input.otpCode);
  const expiresInText =
    input.otpExpiresAt instanceof Date
      ? formatMinutesDifference(new Date(), input.otpExpiresAt)
      : "a short time";

  const subject = "Deal Bazaar - Verify your email";
  const textParts = [
    `Hi ${greetingName},`,
    "",
    "Welcome to Deal Bazaar. Please verify your email address to activate your account.",
  ];

  if (hasOtp) {
    textParts.push("", `Your OTP code: ${input.otpCode}`, `This code expires in ${expiresInText}.`);
  }

  if (input.verificationUrl) {
    textParts.push("", "You can also verify using this link:", input.verificationUrl);
  }

  textParts.push("", "If you did not create this account, you can ignore this email.", "", "Deal Bazaar Team");

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827; max-width: 560px;">
      <h2 style="margin: 0 0 12px;">Welcome to Deal Bazaar</h2>
      <p style="margin: 0 0 12px;">Hi ${greetingName},</p>
      <p style="margin: 0 0 12px;">
        Please verify your email address to complete your registration.
      </p>
      ${
        hasOtp
          ? `<div style="margin: 16px 0; padding: 16px; border: 1px solid #e5e7eb; border-radius: 10px; background: #f9fafb;">
              <p style="margin: 0 0 8px; font-size: 13px; color: #6b7280;">Verification OTP</p>
              <p style="margin: 0; font-size: 28px; letter-spacing: 6px; font-weight: 700; color: #dc2626;">${input.otpCode}</p>
              <p style="margin: 8px 0 0; font-size: 12px; color: #6b7280;">Expires in ${expiresInText}.</p>
            </div>`
          : ""
      }
      ${
        input.verificationUrl
          ? `<p style="margin: 12px 0;">Or verify instantly using this link:</p>
             <p style="margin: 0 0 12px;">
               <a href="${input.verificationUrl}" style="color: #dc2626; word-break: break-all;">${input.verificationUrl}</a>
             </p>`
          : ""
      }
      <p style="margin: 16px 0 0; font-size: 12px; color: #6b7280;">
        If you did not create this account, you can safely ignore this message.
      </p>
    </div>
  `;

  await transporter.sendMail({
    from: `"${config.fromName}" <${config.fromEmail}>`,
    to: input.toEmail,
    subject,
    text: textParts.join("\n"),
    html,
  });
}

