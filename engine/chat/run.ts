import Anthropic from "@anthropic-ai/sdk";
import type { ChatChassisConfig } from "../config";
import type { Locale } from "../contracts/chat-copy";
import type { SystemPromptBuilder } from "../contracts/chat-knowledge";
import { chatTools, runChatTool, type ChatNotifiers, type ToolContext } from "./tools";
import type { ChatTurn } from "./parse";

let cached: Anthropic | null = null;

function client(): Anthropic {
  // Reads ANTHROPIC_API_KEY from the environment. Cached because a new client
  // per request would build a fresh connection pool every time.
  cached ??= new Anthropic();
  return cached;
}

/**
 * Runs one visitor turn to completion, executing any tools the model asks
 * for along the way, and yielding assistant text as it streams in — so the
 * visitor sees the first words within a few hundred milliseconds instead of
 * staring at "thinking…" until the whole (possibly multi-round) turn
 * finishes.
 *
 * Every round is streamed, tool rounds included: a system prompt that puts
 * the tool decision first gives the model no reason to write anything before
 * a tool call, so in practice a tool-calling round never has text to leak —
 * and on the rare turn where it does, showing it is a visible-progress
 * improvement over a silent drop, not a regression.
 *
 * The conversation is never stored: `messages` arrives from the caller on
 * every request and is thrown away when this returns. Nothing here trusts
 * that history — `parseBody` validates it before this runs, and every tool
 * argument is re-checked in `runChatTool`.
 *
 * The system prompt is deliberately not cache-controlled by default: below
 * ~4096 tokens (Haiku 4.5's minimum cacheable prefix) a `cache_control`
 * breakpoint silently does nothing. Re-measure with
 * `messages.countTokens()` once a project's prompt (business facts + FAQ)
 * grows past that before adding one.
 */
export async function* runChat({
  config,
  buildSystemPrompt,
  faqLines,
  notifiers,
  locale,
  messages,
}: {
  config: ChatChassisConfig;
  buildSystemPrompt: SystemPromptBuilder;
  faqLines: string[];
  notifiers: ChatNotifiers;
  locale: Locale;
  messages: ChatTurn[];
}): AsyncGenerator<string, void, undefined> {
  const anthropic = client();
  const system = await buildSystemPrompt(locale, { faqLines });
  const tools = chatTools(config);
  const ctx: ToolContext = { locale, resolved: false };

  const working: Anthropic.MessageParam[] = messages.map((turn) => ({
    role: turn.role,
    content: turn.content,
  }));

  // Set once the model has ended a turn without saying anything; from then
  // on tools are off so it has no choice but to answer.
  let mustSpeak = false;

  for (let round = 0; round < config.chat.maxToolRounds; round++) {
    const lastRound = round === config.chat.maxToolRounds - 1;
    // On the final round the model must speak rather than reach for another
    // tool, so the visitor always gets a reply instead of a spinner.
    const toolsOff = mustSpeak || lastRound;

    const stream = anthropic.messages.stream({
      model: config.chat.model,
      max_tokens: config.chat.maxTokens,
      system,
      tools,
      ...(toolsOff ? { tool_choice: { type: "none" as const } } : {}),
      messages: working,
    });

    let yieldedAny = false;
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yieldedAny = true;
        yield event.delta.text;
      }
    }
    const response = await stream.finalMessage();

    if (response.stop_reason !== "tool_use") {
      if (yieldedAny) return;

      // The model sometimes ends a turn with zero content blocks right after
      // a tool result — it has done the work and simply says nothing.
      // Re-ask from the same history rather than failing the request;
      // `working` is untouched, and an empty assistant turn cannot be
      // appended anyway.
      if (toolsOff) {
        console.error("chat: model stayed silent even with tools off", {
          round,
          stopReason: response.stop_reason,
        });
        return;
      }
      mustSpeak = true;
      continue;
    }

    working.push({ role: "assistant", content: response.content });

    // Every tool_result for a turn goes back in a single user message —
    // splitting them across messages teaches the model to stop calling
    // tools in parallel.
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      const outcome = await runChatTool(block.name, block.input, ctx, config, notifiers);
      results.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: outcome.content,
        is_error: outcome.isError,
      });
    }

    working.push({ role: "user", content: results });
  }

  // Unreachable in practice: the last round forbids tools, so it always
  // returns above.
}
