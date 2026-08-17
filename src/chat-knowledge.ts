import config from "@/chassis.config";
import type { SystemPromptBuilder } from "@/engine/contracts/chat-knowledge";

/**
 * Placeholder implementation of `SystemPromptBuilder` (see
 * `engine/contracts/chat-knowledge.ts`). Replace the body of this function
 * with the real business facts: hours, services/prices, hard rules (what
 * the assistant must never claim), and tone.
 *
 * docs/CONTRACTS.md describes how much detail a real prompt needs. No real
 * one ships here, because its content would be one business's private
 * facts, not a reusable pattern: real hours, a real price list, and a
 * business-specific "hard rules" section (what the model may and may never
 * claim) belong in a project's own git history, not in this chassis.
 *
 * Imports `@/chassis.config` directly rather than `@/engine/registry` — the
 * registry imports this file, so importing it back here would be a
 * circular import.
 */
export const buildSystemPrompt: SystemPromptBuilder = (locale, { faqLines }) => {
  const language = locale === config.defaultLocale ? "the visitor's language" : locale;

  const lines = [
    `You are the front-desk assistant for ${config.brand.name}.`,
    "",
    "# Hard rules",
    "- Answer only from the facts below. Never invent hours, prices, or policies.",
    `- You cannot book appointments. Point the visitor to: ${config.booking.linkUrl}`,
    "- Keep replies to three sentences or fewer. No markdown.",
    `- Reply in ${language}.`,
    "",
    "# Facts",
    "TODO: business hours, services and prices, and anything else the assistant needs.",
  ];

  if (faqLines.length > 0) {
    lines.push("", "# Frequently asked questions", ...faqLines);
  }

  return lines.join("\n");
};
