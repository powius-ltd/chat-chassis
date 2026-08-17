/**
 * Default length/count limits, overridable per project via
 * `chassis.config.ts`'s `chat` section (`engine/registry.ts` resolves the
 * final numbers — this file only ships the chassis's defaults and the type).
 *
 * Deliberately import-free: the chat widget is a Client Component, and
 * pulling in anything server-side from here would drag the Anthropic SDK
 * and the service-role Supabase client into the browser bundle.
 */
export const DEFAULT_MAX_MESSAGE_LENGTH = 500;
export const DEFAULT_MAX_REPLY_LENGTH = 4000;
export const DEFAULT_MAX_CONVERSATION_MESSAGES = 30;
