import { CONFIG, KNOWLEDGE } from "../registry";
import { notifiers } from "../notify";
import { createClient } from "../supabase/server";
import { checkRateLimit, hashCaller } from "./rate-limit";
import { parseBody } from "./parse";
import { runChat } from "./run";

/**
 * The chat POST handler as a factory rather than a bare function, so
 * `app/api/chat/route.ts` in a consuming project stays a one-line
 * re-export: `export { POST } from "@/engine/chat/handler";` — see
 * docs/SETUP.md.
 */
export async function POST(request: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY not set — chat is unavailable");
    return Response.json({ code: "unconfigured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ code: "bad_request" }, { status: 400 });
  }

  const parsed = parseBody(body, CONFIG.locales, {
    maxConversationMessages: CONFIG.chat.maxConversationMessages,
    maxMessageLength: CONFIG.chat.maxMessageLength,
    maxReplyLength: CONFIG.chat.maxReplyLength,
  });
  if ("code" in parsed) {
    return Response.json({ code: parsed.code }, { status: parsed.status });
  }

  const callerHash = hashCaller(request, process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");
  const verdict = await checkRateLimit(
    callerHash,
    CONFIG.chat.messagesPerWindow,
    CONFIG.chat.windowSeconds,
  );
  if (!verdict.ok) {
    return Response.json(
      { code: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(verdict.retryAfter) } },
    );
  }

  const supabase = await createClient();
  const { data: faqRows } = await supabase
    .from("chat_faq")
    .select("question, answer")
    .eq("active", true)
    .order("sort_order");
  const faqLines = (faqRows ?? []).map((row) => `${row.question} — ${row.answer}`);

  const generator = runChat({
    config: CONFIG,
    buildSystemPrompt: KNOWLEDGE,
    faqLines,
    notifiers,
    locale: parsed.locale,
    messages: parsed.messages,
  });

  // Pull the first chunk before committing to a 200: this is the only
  // point where we can still fail the request with a real status code
  // instead of an error frame inside an already-open stream.
  let first: IteratorResult<string, void>;
  try {
    first = await generator.next();
  } catch (error) {
    console.error("chat failed", error);
    return Response.json({ code: "upstream" }, { status: 502 });
  }

  if (first.done) {
    console.error("chat produced an empty reply");
    return Response.json({ code: "upstream" }, { status: 502 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (frame: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(frame)}\n`));

      send({ type: "delta", text: first.value });

      try {
        for (;;) {
          const next = await generator.next();
          if (next.done) break;
          send({ type: "delta", text: next.value });
        }
        send({ type: "done" });
      } catch (error) {
        console.error("chat failed mid-stream", error);
        send({ type: "error", code: "upstream" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8" },
  });
}
