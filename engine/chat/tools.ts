import type Anthropic from "@anthropic-ai/sdk";
import { after } from "next/server";
import type { ChatChassisConfig } from "../config";
import { createClient } from "../supabase/server";
import type { Locale } from "../contracts/chat-copy";

export function chatTools(config: ChatChassisConfig): Anthropic.Tool[] {
  const noun = config.brand.noun;
  return [
    {
      name: "flag_unanswered",
      description:
        `Call this when the visitor declined to leave contact details (or you already asked once and ` +
        `they did not give both a name and a phone number) for a question that is not in the facts you ` +
        `were given. Telling the visitor to phone ${noun} does NOT replace this call — ${noun} learns an ` +
        `answer is missing only from this tool, and that is how its knowledge gets fixed. Call it at ` +
        `most once per conversation, then reply to the visitor yourself with the phone number.`,
      input_schema: {
        type: "object",
        properties: {
          question: {
            type: "string",
            description: "The visitor's question, in their own words, as one sentence.",
          },
        },
        required: ["question"],
      },
    },
    {
      name: "submit_lead",
      description:
        `Call this once a visitor has given you BOTH their name and a phone number so ${noun} can call ` +
        `them back — either because their question was not answerable from your facts, or because they ` +
        `directly asked to be called, texted, or connected with a person (even if you already answered ` +
        `their question). Do not call it on a guess — only after they have actually provided both. Call ` +
        `it at most once per conversation.`,
      input_schema: {
        type: "object",
        properties: {
          name: { type: "string", description: "The visitor's name, as they gave it." },
          phone: { type: "string", description: "The visitor's phone number, as they gave it." },
          question: {
            type: "string",
            description: "The visitor's original question, in their own words, as one sentence.",
          },
        },
        required: ["name", "phone", "question"],
      },
    },
  ];
}

/**
 * State that has to survive across tool calls within one request: the
 * once-per-conversation cap on notifications. Without it a confused model
 * can call `flag_unanswered` or `submit_lead` on every turn and turn the
 * business's Telegram into a firehose. Whichever of the two fires first for
 * a conversation sets this, and the other checks it.
 */
export type ToolContext = {
  locale: Locale;
  resolved: boolean;
};

type ToolOutcome = { content: string; isError: boolean };

export type ChatNotifiers = {
  notifyUnansweredQuestion: (args: { question: string; locale: Locale }) => void | Promise<void>;
  notifyChatLead: (args: {
    name: string;
    phone: string;
    question: string;
    locale: Locale;
  }) => void | Promise<void>;
};

/**
 * Runs one tool call. Model output is untrusted input: every argument is
 * re-validated here, and a bad argument comes back as an error result the
 * model can recover from rather than an exception that kills the turn.
 */
export async function runChatTool(
  name: string,
  input: unknown,
  ctx: ToolContext,
  config: ChatChassisConfig,
  notifiers: ChatNotifiers,
): Promise<ToolOutcome> {
  try {
    switch (name) {
      case "flag_unanswered":
        return await flagUnanswered(input, ctx, config, notifiers);
      case "submit_lead":
        return await submitLead(input, ctx, notifiers);
      default:
        return { content: `Unknown tool: ${name}`, isError: true };
    }
  } catch (error) {
    console.error(`chat tool ${name} failed`, error);
    return {
      content: `That lookup failed. Tell the visitor to call ${config.brand.noun}.`,
      isError: true,
    };
  }
}

async function flagUnanswered(
  input: unknown,
  ctx: ToolContext,
  config: ChatChassisConfig,
  notifiers: ChatNotifiers,
): Promise<ToolOutcome> {
  // The tool result is the last thing the model reads before it writes, and
  // it sometimes leans on it almost verbatim — so it spells out the reply,
  // including the number, rather than just acknowledging the call.
  const nextStep =
    `Now reply to the visitor: say you do not have that detail, and give them ` +
    `${config.brand.phoneDisplay} to call or text.`;

  if (ctx.resolved) {
    return { content: `Already notified about this conversation. ${nextStep}`, isError: false };
  }

  const raw = input as { question?: unknown };
  const question = typeof raw.question === "string" ? raw.question.trim().slice(0, 400) : "";
  if (!question) {
    return { content: "`question` is required.", isError: true };
  }

  // Persisted so the gap shows up somewhere other than a Telegram scroll —
  // this table is exactly the input a chat_faq admin editor needs. A save
  // failure still lets the notification through; losing the row is better
  // than losing the only signal that an answer is missing.
  const supabase = await createClient();
  const { error } = await supabase
    .from("chat_unanswered")
    .insert({ locale: ctx.locale, question });
  if (error) {
    console.error("chat_unanswered insert failed", error);
  }

  ctx.resolved = true;
  // Deferred to after the HTTP response streams out: the visitor's reply
  // shouldn't wait on notification round-trips, and this is a best-effort
  // notification that never affects what gets said to them.
  after(() => notifiers.notifyUnansweredQuestion({ question, locale: ctx.locale }));

  return { content: `${noun(config)} will be notified. ${nextStep}`, isError: false };
}

async function submitLead(
  input: unknown,
  ctx: ToolContext,
  notifiers: ChatNotifiers,
): Promise<ToolOutcome> {
  const nextStep = "Now tell the visitor you will call or text them back soon.";

  if (ctx.resolved) {
    return { content: `Already notified about this conversation. ${nextStep}`, isError: false };
  }

  const raw = input as { name?: unknown; phone?: unknown; question?: unknown };
  const name = typeof raw.name === "string" ? raw.name.trim().slice(0, 100) : "";
  const phone = typeof raw.phone === "string" ? raw.phone.trim().slice(0, 30) : "";
  const question = typeof raw.question === "string" ? raw.question.trim().slice(0, 400) : "";
  if (!name || !phone || !question) {
    return { content: "`name`, `phone`, and `question` are all required.", isError: true };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("chat_leads")
    .insert({ locale: ctx.locale, name, phone, question });

  if (error) {
    console.error("chat_leads insert failed", error);
    return {
      content:
        "Saving that failed. Call `flag_unanswered` instead and give the visitor the phone number.",
      isError: true,
    };
  }

  ctx.resolved = true;
  // Deferred to after the HTTP response streams out — see flagUnanswered above.
  after(() => notifiers.notifyChatLead({ name, phone, question, locale: ctx.locale }));

  return { content: `Notified. ${nextStep}`, isError: false };
}

function noun(config: ChatChassisConfig): string {
  const n = config.brand.noun;
  return n.charAt(0).toUpperCase() + n.slice(1);
}
