import { describe, expect, it } from "vitest";
import { parseBody } from "../../chat/parse";

const LOCALES = ["en", "es"];
const LIMITS = { maxConversationMessages: 30, maxMessageLength: 500, maxReplyLength: 4000 };

function turn(role: "user" | "assistant", content: string) {
  return { role, content };
}

describe("parseBody", () => {
  it("accepts a well-formed body", () => {
    const result = parseBody({ locale: "en", messages: [turn("user", "Hi")] }, LOCALES, LIMITS);
    expect(result).toEqual({ locale: "en", messages: [{ role: "user", content: "Hi" }] });
  });

  it("trims message content", () => {
    const result = parseBody({ locale: "en", messages: [turn("user", "  Hi  ")] }, LOCALES, LIMITS);
    expect("code" in result).toBe(false);
    if (!("code" in result)) {
      expect(result.messages[0].content).toBe("Hi");
    }
  });

  it("rejects a missing locale", () => {
    const result = parseBody({ messages: [turn("user", "Hi")] }, LOCALES, LIMITS);
    expect(result).toEqual({ code: "bad_request", status: 400 });
  });

  it("rejects a locale that isn't configured", () => {
    const result = parseBody({ locale: "fr", messages: [turn("user", "Hi")] }, LOCALES, LIMITS);
    expect(result).toEqual({ code: "bad_request", status: 400 });
  });

  it("rejects a missing messages array", () => {
    const result = parseBody({ locale: "en" }, LOCALES, LIMITS);
    expect(result).toEqual({ code: "bad_request", status: 400 });
  });

  it("rejects an empty messages array", () => {
    const result = parseBody({ locale: "en", messages: [] }, LOCALES, LIMITS);
    expect(result).toEqual({ code: "bad_request", status: 400 });
  });

  it("rejects more messages than the conversation cap, distinctly from bad_request", () => {
    const messages = Array.from({ length: LIMITS.maxConversationMessages + 1 }, (_, i) =>
      turn(i % 2 === 0 ? "user" : "assistant", "hi"),
    );
    const result = parseBody({ locale: "en", messages }, LOCALES, LIMITS);
    expect(result).toEqual({ code: "limit_reached", status: 400 });
  });

  it("accepts exactly the conversation cap", () => {
    const messages = Array.from({ length: LIMITS.maxConversationMessages }, (_, i) =>
      turn(i % 2 === 0 ? "assistant" : "user", "hi"),
    );
    messages[messages.length - 1] = turn("user", "hi");
    const result = parseBody({ locale: "en", messages }, LOCALES, LIMITS);
    expect("code" in result).toBe(false);
  });

  it("rejects a turn with an invalid role", () => {
    const result = parseBody(
      { locale: "en", messages: [{ role: "system", content: "Hi" }] },
      LOCALES,
      LIMITS,
    );
    expect(result).toEqual({ code: "bad_request", status: 400 });
  });

  it("rejects a turn whose content isn't a string", () => {
    const result = parseBody(
      { locale: "en", messages: [{ role: "user", content: 42 }] },
      LOCALES,
      LIMITS,
    );
    expect(result).toEqual({ code: "bad_request", status: 400 });
  });

  it("rejects a blank (whitespace-only) message", () => {
    const result = parseBody({ locale: "en", messages: [turn("user", "   ")] }, LOCALES, LIMITS);
    expect(result).toEqual({ code: "bad_request", status: 400 });
  });

  it("rejects a user message over maxMessageLength", () => {
    const result = parseBody(
      { locale: "en", messages: [turn("user", "x".repeat(LIMITS.maxMessageLength + 1))] },
      LOCALES,
      LIMITS,
    );
    expect(result).toEqual({ code: "bad_request", status: 400 });
  });

  it("accepts a user message at exactly maxMessageLength", () => {
    const result = parseBody(
      { locale: "en", messages: [turn("user", "x".repeat(LIMITS.maxMessageLength))] },
      LOCALES,
      LIMITS,
    );
    expect("code" in result).toBe(false);
  });

  it("applies the wider reply cap to assistant turns, not the visitor's cap", () => {
    const longReply = "x".repeat(LIMITS.maxMessageLength + 50);
    expect(longReply.length).toBeLessThanOrEqual(LIMITS.maxReplyLength);
    const result = parseBody(
      { locale: "en", messages: [turn("assistant", longReply), turn("user", "ok")] },
      LOCALES,
      LIMITS,
    );
    expect("code" in result).toBe(false);
  });

  it("rejects an assistant reply over maxReplyLength even though it's not the visitor's cap", () => {
    const result = parseBody(
      {
        locale: "en",
        messages: [turn("assistant", "x".repeat(LIMITS.maxReplyLength + 1)), turn("user", "ok")],
      },
      LOCALES,
      LIMITS,
    );
    expect(result).toEqual({ code: "bad_request", status: 400 });
  });

  it("rejects a conversation that doesn't end on a user turn", () => {
    const result = parseBody(
      { locale: "en", messages: [turn("user", "Hi"), turn("assistant", "Hello")] },
      LOCALES,
      LIMITS,
    );
    expect(result).toEqual({ code: "bad_request", status: 400 });
  });
});
