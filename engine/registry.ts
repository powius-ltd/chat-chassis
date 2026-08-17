import config from "@/chassis.config";
import { validateConfig } from "./config";
import { buildSystemPrompt } from "@/src/chat-knowledge";
import { chatCopy } from "@/src/chat-copy";

/**
 * The one enjection point: a single module with static imports, no DI
 * framework, no React context, no provider tree. Everything under
 * `engine/` that needs project facts or the project's own knowledge/copy
 * implementations imports `CONFIG`/`KNOWLEDGE`/`COPY` from here rather than
 * reaching into `@/chassis.config` or `@/src/*` directly.
 */

validateConfig(config);

export const CONFIG = config;
export const KNOWLEDGE = buildSystemPrompt;
export const COPY = chatCopy;
