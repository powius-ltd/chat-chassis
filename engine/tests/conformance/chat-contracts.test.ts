import { describe, expect, it } from "vitest";
import config from "@/chassis.config";
import { chatCopy } from "@/src/chat-copy";
import { buildSystemPrompt } from "@/src/chat-knowledge";

/**
 * Run by a consuming project (`npm run verify`) to check its own
 * src/chat-knowledge.ts and src/chat-copy/* against the chassis contracts —
 * every silent-drift bug (a locale missing a copy file, a builder that
 * forgets a locale branch) is exactly the class of thing this catches.
 */

const COPY_KEYS = [
  "heading",
  "subheading",
  "greeting",
  "teaser",
  "suggestions",
  "placeholder",
  "send",
  "thinking",
  "error",
  "rateLimited",
  "limitReached",
  "disclaimer",
  "callCta",
  "textCta",
  "textMessage",
  "bubbleLabel",
  "dismissTeaser",
] as const;

describe("chat-copy conformance", () => {
  it("has one entry per configured locale", () => {
    for (const locale of config.locales) {
      expect(chatCopy[locale], `missing src/chat-copy for locale "${locale}"`).toBeDefined();
    }
  });

  it("every locale's copy has every ChatCopy key, non-empty", () => {
    for (const locale of config.locales) {
      const copy = chatCopy[locale];
      for (const key of COPY_KEYS) {
        const value = copy[key];
        if (Array.isArray(value)) {
          expect(value.length, `${locale}.${key} must not be empty`).toBeGreaterThan(0);
        } else {
          expect(value, `${locale}.${key} must be a non-empty string`).toBeTruthy();
        }
      }
    }
  });
});

describe("chat-knowledge conformance", () => {
  it("builds a non-empty prompt for every configured locale", async () => {
    for (const locale of config.locales) {
      const prompt = await buildSystemPrompt(locale, { faqLines: [] });
      expect(prompt.length, `buildSystemPrompt("${locale}") returned an empty prompt`).toBeGreaterThan(
        0,
      );
    }
  });

  it("includes given FAQ lines in the built prompt", async () => {
    const locale = config.defaultLocale;
    const prompt = await buildSystemPrompt(locale, { faqLines: ["Q — A"] });
    expect(prompt).toContain("Q — A");
  });
});
