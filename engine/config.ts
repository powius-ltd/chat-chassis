export type ChatChassisConfig = {
  brand: {
    name: string;
    /** Noun used in tool reply copy, e.g. "the studio", "the clinic". */
    noun: string;
    phoneDisplay: string;
    smsLink: string;
    telLink: string;
  };
  locales: readonly string[];
  defaultLocale: string;
  booking: {
    linkUrl: string;
    linkLabel: string;
  };
  chat: {
    model: string;
    maxTokens: number;
    maxToolRounds: number;
    maxMessageLength: number;
    maxReplyLength: number;
    maxConversationMessages: number;
    messagesPerWindow: number;
    windowSeconds: number;
  };
  admin: {
    basePath: string;
  };
};

/**
 * One aggregated Error over every problem found, so a misconfigured project
 * fails once, loudly, with a full list, instead of one cryptic error at a
 * time.
 */
export function validateConfig(config: ChatChassisConfig): void {
  const problems: string[] = [];

  if (config.locales.length === 0) problems.push("locales must not be empty");
  if (!config.locales.includes(config.defaultLocale)) {
    problems.push("defaultLocale must be one of locales");
  }
  if (!config.admin.basePath.startsWith("/")) {
    problems.push("admin.basePath must start with /");
  }
  if (config.chat.maxTokens <= 0) problems.push("chat.maxTokens must be positive");
  if (config.chat.maxToolRounds <= 0) problems.push("chat.maxToolRounds must be positive");
  if (config.chat.maxMessageLength <= 0) {
    problems.push("chat.maxMessageLength must be positive");
  }
  if (config.chat.maxReplyLength < config.chat.maxMessageLength) {
    problems.push("chat.maxReplyLength must be at least maxMessageLength");
  }
  if (config.chat.maxConversationMessages <= 0) {
    problems.push("chat.maxConversationMessages must be positive");
  }
  if (config.chat.messagesPerWindow <= 0) {
    problems.push("chat.messagesPerWindow must be positive");
  }
  if (config.chat.windowSeconds <= 0) problems.push("chat.windowSeconds must be positive");

  if (problems.length > 0) {
    throw new Error(`Invalid chat-chassis config:\n- ${problems.join("\n- ")}`);
  }
}
