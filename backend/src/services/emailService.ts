import nodemailer from "nodemailer";
import { env } from "../config/env";

export const sendEmailVerificationOtp = async (to: string, otp: string) => {
  if (!env.smtp.host) {
    if (process.env.NODE_ENV === "production") {
      throw { status: 500, message: "Email service is not configured" };
    }
    console.log(`[email verification] OTP for ${to}: ${otp}`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: env.smtp.user && env.smtp.pass ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    connectionTimeout: env.smtp.connectionTimeoutMs,
    greetingTimeout: env.smtp.greetingTimeoutMs,
  });

  try {
    await transporter.sendMail({
      from: env.smtp.from || env.smtp.user || "Shopico <no-reply@shopico.local>",
      to,
      subject: "Verify your Shopico email",
      text: `Your Shopico verification code is ${otp}. It expires in 10 minutes.`,
      html: `<p>Your Shopico verification code is <strong>${otp}</strong>.</p><p>It expires in 10 minutes.</p>`,
    });
  } catch (error: any) {
    console.error("[email verification] SMTP send failed", {
      code: error?.code,
      command: error?.command,
      message: error?.message,
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
    });
    throw { status: 502, message: "Email provider did not accept the SMTP connection" };
  }
};
