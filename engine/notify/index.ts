/**
 * One place that decides *where* a chat notification goes. Each channel is
 * a self-contained module that knows nothing about the others; both are
 * best-effort and neither throws, so `Promise.allSettled` means Telegram
 * still buzzes when Meta rejects a template, and vice versa. Adding a third
 * channel later is one more entry in each array, not another edit to
 * `engine/chat/tools.ts`.
 */

import {
  notifyChatLead as telegramChatLead,
  notifyUnansweredQuestion as telegramUnansweredQuestion,
} from "../telegram/notify";
import {
  notifyChatLeadWhatsApp,
  notifyUnansweredQuestionWhatsApp,
} from "../whatsapp/notify";
import type { Locale } from "../contracts/chat-copy";
import type { ChatNotifiers } from "../chat/tools";

export async function notifyChatLead(lead: {
  name: string;
  phone: string;
  question: string;
  locale: Locale;
}): Promise<void> {
  await Promise.allSettled([telegramChatLead(lead), notifyChatLeadWhatsApp(lead)]);
}

export async function notifyUnansweredQuestion(question: {
  question: string;
  locale: Locale;
}): Promise<void> {
  await Promise.allSettled([
    telegramUnansweredQuestion(question),
    notifyUnansweredQuestionWhatsApp(question),
  ]);
}

export const notifiers: ChatNotifiers = { notifyChatLead, notifyUnansweredQuestion };
