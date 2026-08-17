import { sendWhatsAppTemplate, templateParam } from "./client";
import type { Locale } from "../contracts/chat-copy";

/**
 * Registered template names. Keep in sync with the bodies registered in
 * Meta Business Manager — see docs/OPERATIONS.md for the exact text and
 * parameter tables to submit.
 */
export const WHATSAPP_TEMPLATES = {
  chatLead: "chat_lead",
  unansweredQuestion: "chat_unanswered",
} as const;

function languageLabel(locale: Locale): string {
  return locale === "es" ? "Spanish" : "English";
}

export async function notifyChatLeadWhatsApp(lead: {
  name: string;
  phone: string;
  question: string;
  locale: Locale;
}): Promise<void> {
  await sendWhatsAppTemplate({
    name: WHATSAPP_TEMPLATES.chatLead,
    params: [
      templateParam(lead.name), // {{1}}
      templateParam(lead.phone), // {{2}}
      templateParam(languageLabel(lead.locale)), // {{3}}
      templateParam(lead.question), // {{4}}
    ],
  });
}

export async function notifyUnansweredQuestionWhatsApp(question: {
  question: string;
  locale: Locale;
}): Promise<void> {
  await sendWhatsAppTemplate({
    name: WHATSAPP_TEMPLATES.unansweredQuestion,
    params: [
      templateParam(question.question), // {{1}}
      templateParam(languageLabel(question.locale)), // {{2}}
    ],
  });
}
