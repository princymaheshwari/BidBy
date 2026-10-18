// Sends a drafted message from the student's Gmail, only after they text "send", and never to an address
// outside ALLOWED_EMAIL_RECIPIENTS. EMAIL_MODE=log prints instead of sending.
import nodemailer from "nodemailer";
import { config } from "../config.js";
import { getMessages, type Obligation } from "../pipeline/ledger.js";

const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

/** "Name <a@b.edu>" or "a@b.edu" -> "a@b.edu"; null if there is no address. */
export function addressOf(sender: string): string | null {
  const addr = (/<([^>]+)>/.exec(sender)?.[1] ?? sender).trim().toLowerCase();
  return EMAIL.test(addr) ? addr : null;
}

/** Who the draft goes to: AID_OFFICE_EMAIL for aid items, otherwise whoever sent the item's first email. */
export function recipientFor(ob: Obligation): string | null {
  if (ob.domain === "aid" && config.AID_OFFICE_EMAIL) return config.AID_OFFICE_EMAIL.toLowerCase();
  const first = getMessages(ob.source_message_ids).find((m) => m.source === "email");
  return first ? addressOf(first.sender) : null;
}

export const canEmail = (to: string): boolean => config.ALLOWED_EMAIL_RECIPIENTS.includes(to.toLowerCase());

/** The From address shown to the user (null in log mode without a Gmail account). */
export const fromAddress = (): string | null => config.GMAIL_USER ?? null;

/** A head start draft is "Subject: ...", a blank line, then the body. */
export function parseDraft(draft: string): { subject: string; body: string } {
  const m = /^\s*Subject:\s*(.+)\r?\n([\s\S]*)$/i.exec(draft);
  return m ? { subject: m[1]!.trim(), body: m[2]!.trim() } : { subject: "Following up", body: draft.trim() };
}

let transport: nodemailer.Transporter | null = null;

/** Sends one plain-text email. Throws on SMTP errors (the caller tells the user). */
export async function sendEmail(to: string, subject: string, body: string): Promise<{ message_id: string | null }> {
  if (!canEmail(to)) throw new Error(`${to} is not in ALLOWED_EMAIL_RECIPIENTS`);
  if (config.EMAIL_MODE === "log") {
    console.log(`[email → ${to}] ${subject} ⏎ ${body.replace(/\n/g, " ⏎ ")}`);
    return { message_id: null };
  }
  transport ??= nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: config.GMAIL_USER!, pass: config.GMAIL_APP_PASSWORD!.replace(/\s+/g, "") },
  });
  const info = await transport.sendMail({ from: config.GMAIL_USER, to, subject, text: body });
  return { message_id: info.messageId ?? null };
}
