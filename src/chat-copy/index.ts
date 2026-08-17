import type { ChatCopy, Locale } from "@/engine/contracts/chat-copy";
import en from "./en";
import es from "./es";

/**
 * One `src/chat-copy/<locale>.ts` per configured locale (`chassis.config.ts`'s
 * `locales`), each `satisfies ChatCopy`. Add an entry here for every new
 * locale — `engine/tests/conformance/chat-contracts.test.ts` checks that
 * this map has one for every configured locale.
 */
export const chatCopy: Record<Locale, ChatCopy> = { en, es };
