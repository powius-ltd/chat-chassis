import type { Locale } from "./chat-copy";

/**
 * The chassis's one real dependency on a consuming project's business
 * knowledge: a function that returns the chat assistant's system prompt.
 *
 * The chassis does NOT ship a generic prompt template — a system prompt for
 * "front desk assistant at a beauty salon" and one for "concierge at a
 * dental clinic" don't share enough structure to templatize without hiding
 * more than it reveals. What the chassis *does* own is generic:
 * `engine/chat/run.ts` fetches active `chat_faq` rows and hands them to
 * this function as `faqLines`, so a project's prompt builder doesn't need
 * its own Supabase read for that part.
 *
 * A consuming project implements this once, in `src/chat-knowledge.ts`.
 * `docs/CONTRACTS.md` describes how much detail a real implementation
 * (business hours, service catalog, hard rules, tone) needs. No real one is
 * shipped here: its content would be one business's private facts, not a
 * reusable pattern.
 */
export type SystemPromptCtx = {
  /** "question — answer" lines from the active `chat_faq` rows, newest sort_order last. */
  faqLines: string[];
};

export type SystemPromptBuilder = (
  locale: Locale,
  ctx: SystemPromptCtx,
) => Promise<string> | string;
