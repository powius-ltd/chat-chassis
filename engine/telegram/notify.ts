import { escapeHtml, sendTelegramMessage } from "./client";
import type { Locale } from "../contracts/chat-copy";

/**
 * The two chat-specific notifications. This is only the chat half of what
 * the source project's `lib/telegram/notify.ts` carried — the booking
 * notifications (`notifyNewBooking`, `notifyStatusChange`) and the bot
 * command handler (`/today`, `/cancel`, …) are a booking chassis's concern,
 * not this one's. If a project runs both chassis together, keep one
 * `engine/telegram/client.ts` and merge the notify functions — see
 * docs/OPERATIONS.md.
 */

function languageLabel(locale: Locale): string {
  return locale === "es" ? "Spanish" : "English";
}

export async function notifyChatLead(lead: {
  name: string;
  phone: string;
  question: string;
  locale: Locale;
}): Promise<void> {
  const lines = [
    "<b>New question from the website chat</b>",
    "",
    `👤 ${escapeHtml(lead.name)}`,
    `📞 ${escapeHtml(lead.phone)}`,
    `🌐 ${languageLabel(lead.locale)}`,
    "",
    `❓ ${escapeHtml(lead.question)}`,
  ];

  await sendTelegramMessage(lines.join("\n"));
}

export async function notifyUnansweredQuestion(question: {
  question: string;
  locale: Locale;
}): Promise<void> {
  const lines = [
    "<b>Website chat couldn't answer this</b>",
    "",
    `❓ ${escapeHtml(question.question)}`,
    `🌐 ${languageLabel(question.locale)}`,
    "",
    "The visitor was given the phone number.",
  ];

  await sendTelegramMessage(lines.join("\n"));
}
