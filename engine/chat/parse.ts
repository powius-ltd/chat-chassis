import type { Locale } from "../contracts/chat-copy";

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type ParsedBody =
  | { locale: Locale; messages: ChatTurn[] }
  | { code: string; status: number };

export type ParseLimits = {
  maxConversationMessages: number;
  maxMessageLength: number;
  maxReplyLength: number;
};

/**
 * Validates the request body from `POST /api/chat`. Pure and framework-free
 * on purpose — this is the one function standing between hostile input and a
 * paid Anthropic call, and it should be exercised directly in
 * `engine/tests/unit/parse.test.ts`, not only through the HTTP route.
 */
export function parseBody(
  body: unknown,
  locales: readonly string[],
  limits: ParseLimits,
): ParsedBody {
  const raw = body as { locale?: unknown; messages?: unknown };

  if (typeof raw.locale !== "string" || !locales.includes(raw.locale)) {
    return { code: "bad_request", status: 400 };
  }

  if (!Array.isArray(raw.messages) || raw.messages.length === 0) {
    return { code: "bad_request", status: 400 };
  }

  if (raw.messages.length > limits.maxConversationMessages) {
    return { code: "limit_reached", status: 400 };
  }

  const messages: ChatTurn[] = [];
  for (const entry of raw.messages) {
    const turn = entry as { role?: unknown; content?: unknown };
    if (turn.role !== "user" && turn.role !== "assistant") {
      return { code: "bad_request", status: 400 };
    }
    if (typeof turn.content !== "string") {
      return { code: "bad_request", status: 400 };
    }
    // The visitor's cap is a UX limit; the assistant's is only a tamper check.
    // Applying the visitor's cap to a reply would reject the model's own
    // previous answer and dead-end the conversation.
    const limit = turn.role === "user" ? limits.maxMessageLength : limits.maxReplyLength;
    const content = turn.content.trim();
    if (!content || content.length > limit) {
      return { code: "bad_request", status: 400 };
    }
    messages.push({ role: turn.role, content });
  }

  // A turn the visitor did not end is not a turn to answer.
  if (messages[messages.length - 1].role !== "user") {
    return { code: "bad_request", status: 400 };
  }

  return { locale: raw.locale, messages };
}
