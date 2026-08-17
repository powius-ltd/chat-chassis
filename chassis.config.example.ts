import type { ChatChassisConfig } from "@/engine/config";

// Copy this file to chassis.config.ts and fill in the real project facts.
// `satisfies` (not `: ChatChassisConfig`) keeps literal types narrow —
// e.g. `locales` stays a tuple of string literals instead of widening to
// `string[]`, which is what lets `defaultLocale` be checked against it.
export default {
  brand: {
    name: "Example Studio",
    noun: "the studio",
    phoneDisplay: "(555) 555-0100",
    smsLink: "sms:+15555550100",
    telLink: "tel:+15555550100",
  },
  locales: ["en", "es"],
  defaultLocale: "en",
  booking: {
    linkUrl: "https://example.com/book",
    linkLabel: "Book online",
  },
  chat: {
    model: "claude-haiku-4-5",
    maxTokens: 700,
    maxToolRounds: 3,
    maxMessageLength: 500,
    maxReplyLength: 4000,
    maxConversationMessages: 30,
    messagesPerWindow: 20,
    windowSeconds: 60 * 60,
  },
  admin: {
    basePath: "/admin",
  },
} satisfies ChatChassisConfig;
