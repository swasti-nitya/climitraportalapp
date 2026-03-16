import cron from "node-cron";
import nodemailer from "nodemailer";
import { storage } from "./storage";

type MailConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
};

function getMailConfig(): MailConfig | null {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 0);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;
  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  if (!host || !port || !user || !pass || !from) {
    return null;
  }

  return { host, port, secure, user, pass, from };
}

function getTransporter(config: MailConfig) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });
}

async function sendEmail(
  to: string | string[],
  subject: string,
  text: string,
  html?: string,
): Promise<void> {
  const config = getMailConfig();
  if (!config) {
    console.warn("[email-jobs] SMTP not configured. Skipping email.");
    return;
  }

  const transporter = getTransporter(config);

  await transporter.sendMail({
    from: config.from,
    to,
    subject,
    text,
    html,
  });
}

function daysSinceEpoch(date: Date): number {
  const utcDate = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor(utcDate / (1000 * 60 * 60 * 24));
}

function isOperationalReminderDay(today: Date): boolean {
  const anchorRaw = process.env.OPS_REMINDER_ANCHOR_DATE || "2026-01-01";
  const anchor = new Date(anchorRaw);
  if (Number.isNaN(anchor.getTime())) return false;

  const delta = daysSinceEpoch(today) - daysSinceEpoch(anchor);
  return delta >= 0 && delta % 10 === 0;
}

async function sendOperationalPayoutReminder(): Promise<void> {
  const users = await storage.getUsers();
  const expenses = await storage.getExpenses();

  const ayushEmail =
    process.env.AYUSH_EMAIL ||
    users.find((u) => u.username.toLowerCase().includes("ayush") || u.name.toLowerCase().includes("ayush"))?.username;

  if (!ayushEmail) {
    console.warn("[email-jobs] Ayush email not found. Skipping operational reminder.");
    return;
  }

  const pendingOperationalPayouts = expenses.filter(
    (e) => e.category.startsWith("Operational") && e.status === "Approved",
  ).length;

  const subject = "Operational Payout Reminder";
  const text = `Hi Ayush,\n\nThis is your 10-day reminder to process operational payouts.\nPending operational payouts awaiting payment: ${pendingOperationalPayouts}.\n\n- Expense Approver`;

  await sendEmail(ayushEmail, subject, text);
  console.log(`[email-jobs] Sent operational payout reminder to ${ayushEmail}`);
}

async function sendMonthlyPayoutReminder(): Promise<void> {
  const users = await storage.getUsers();
  const expenses = await storage.getExpenses();

  const ayushEmail =
    process.env.AYUSH_EMAIL ||
    users.find((u) => u.username.toLowerCase().includes("ayush") || u.name.toLowerCase().includes("ayush"))?.username;

  if (!ayushEmail) {
    console.warn("[email-jobs] Ayush email not found. Skipping monthly reminder.");
    return;
  }

  const pendingMonthlyPayouts = expenses.filter(
    (e) => !e.category.startsWith("Operational") && e.status === "Approved",
  ).length;

  const subject = "Monthly Payout Reminder";
  const text = `Hi Ayush,\n\nThis is your 1st-of-month reminder to process monthly payouts.\nPending monthly payouts awaiting payment: ${pendingMonthlyPayouts}.\n\n- Expense Approver`;

  await sendEmail(ayushEmail, subject, text);
  console.log(`[email-jobs] Sent monthly payout reminder to ${ayushEmail}`);
}

async function sendAdminHighPendingReminder(): Promise<void> {
  const users = await storage.getUsers();
  const expenses = await storage.getExpenses();
  const leaves = await storage.getLeaves();

  const adminEmails = users
    .filter((u) => u.role === "Super Admin")
    .map((u) => u.username)
    .filter(Boolean);

  if (adminEmails.length === 0) {
    return;
  }

  const pendingExpenseApprovals = expenses.filter((e) => e.status === "Pending").length;
  const pendingLeaveApprovals = leaves.filter(
    (l) => l.status === "Pending" && l.type === "Leave" && (l.leaveCategory ?? "Planned") === "Planned",
  ).length;

  const totalPendingApprovals = pendingExpenseApprovals + pendingLeaveApprovals;

  if (totalPendingApprovals <= 10) {
    return;
  }

  const subject = `High Pending Approvals Alert (${totalPendingApprovals})`;
  const text = `Hi Admin,\n\nYou currently have more than 10 requests pending approval.\n\nPending expense approvals: ${pendingExpenseApprovals}\nPending planned leave approvals: ${pendingLeaveApprovals}\nTotal pending approvals: ${totalPendingApprovals}\n\nPlease review pending requests.\n\n- Expense Approver`;

  await sendEmail(adminEmails, subject, text);
  console.log(`[email-jobs] Sent high pending approvals alert to ${adminEmails.length} admin(s)`);
}

export function startEmailJobs() {
  const enabled = process.env.EMAIL_JOBS_ENABLED !== "false";
  if (!enabled) {
    console.log("[email-jobs] Disabled via EMAIL_JOBS_ENABLED=false");
    return;
  }

  // Daily at 9:00 AM: send every-10-day operational reminder if today is due.
  cron.schedule("0 9 * * *", async () => {
    try {
      const now = new Date();
      if (isOperationalReminderDay(now)) {
        await sendOperationalPayoutReminder();
      }
    } catch (error) {
      console.error("[email-jobs] Operational reminder failed:", error);
    }
  });

  // 1st of every month at 9:05 AM.
  cron.schedule("5 9 1 * *", async () => {
    try {
      await sendMonthlyPayoutReminder();
    } catch (error) {
      console.error("[email-jobs] Monthly reminder failed:", error);
    }
  });

  // Daily at 9:10 AM if pending approvals > 10.
  cron.schedule("10 9 * * *", async () => {
    try {
      await sendAdminHighPendingReminder();
    } catch (error) {
      console.error("[email-jobs] Admin pending reminder failed:", error);
    }
  });

  console.log("[email-jobs] Scheduled reminder jobs initialized");
}
