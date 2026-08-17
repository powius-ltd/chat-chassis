"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatCopy, Locale } from "../../contracts/chat-copy";

type Turn = { role: "user" | "assistant"; content: string };
type Status = "idle" | "sending" | "error" | "rateLimited" | "limitReached";

/** Once dismissed (closed or the chat is opened), the teaser never shows again on this device. */
const TEASER_DISMISSED_KEY = "chat-teaser-dismissed";
const TEASER_DELAY_MS = 6000;

export type ChatWidgetProps = {
  locale: Locale;
  t: ChatCopy;
  enabled: boolean;
  maxMessageLength: number;
  maxConversationMessages: number;
  phoneDisplay: string;
  telLink: string;
  /** Base `sms:` URI, no query string — the widget appends `?body=` itself. */
  smsLinkBase: string;
  /** A single literal URL the assistant is instructed to hand out verbatim — only this exact string is ever turned into a link. */
  bookingLinkUrl: string;
  bookingLinkLabel: string;
};

/**
 * Floating question assistant. Talks to `/api/chat` (see
 * `engine/chat/handler.ts`), streaming the reply in as newline-delimited
 * JSON. Nothing is persisted client-side beyond this component's state —
 * the conversation is gone when the tab closes, which is why the whole
 * history is posted with each turn.
 *
 * Styling is intentionally plain, generic Tailwind (neutral palette, no
 * custom design tokens) — every class is meant to be overridden by a
 * project's own design system. See docs/CONTRACTS.md.
 */
export function ChatWidget({
  locale,
  t,
  enabled,
  maxMessageLength,
  maxConversationMessages,
  phoneDisplay,
  telLink,
  smsLinkBase,
  bookingLinkUrl,
  bookingLinkLabel,
}: ChatWidgetProps) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [showTeaser, setShowTeaser] = useState(false);
  // True once the assistant's reply has started streaming in — separate
  // from `status === "sending"` (which covers the whole turn) so the
  // "thinking…" indicator disappears the moment there's a growing message
  // bubble to show instead, rather than sitting next to it for the rest of
  // the stream.
  const [streaming, setStreaming] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled) return;
    if (localStorage.getItem(TEASER_DISMISSED_KEY)) return;

    const timer = window.setTimeout(() => setShowTeaser(true), TEASER_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [enabled]);

  function dismissTeaser() {
    setShowTeaser(false);
    localStorage.setItem(TEASER_DISMISSED_KEY, "1");
  }

  useEffect(() => {
    if (!open) return;

    const trigger = bubbleRef.current;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    inputRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      trigger?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    logEndRef.current?.scrollIntoView({ block: "end" });
  }, [turns, status, open]);

  if (!enabled) return null;

  const locked = status === "limitReached" || turns.length >= maxConversationMessages;
  const busy = status === "sending";

  async function send(question: string) {
    const trimmed = question.trim().slice(0, maxMessageLength);
    if (!trimmed || busy || locked) return;

    const next: Turn[] = [...turns, { role: "user", content: trimmed }];
    setTurns(next);
    setInput("");
    setStatus("sending");
    setStreaming(false);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locale, messages: next }),
      });

      if (!response.ok) {
        const { code } = (await response.json().catch(() => ({}))) as { code?: string };
        setStatus(
          code === "rate_limited"
            ? "rateLimited"
            : code === "limit_reached"
              ? "limitReached"
              : "error",
        );
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        setStatus("error");
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";
      let started = false;
      let sawError = false;
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while (!streamDone && (newlineIndex = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (!line) continue;

          const frame = JSON.parse(line) as { type: string; text?: string };
          if (frame.type === "delta" && frame.text) {
            assistantText += frame.text;
            if (!started) {
              started = true;
              setStreaming(true);
              setTurns([...next, { role: "assistant", content: assistantText }]);
            } else {
              const text = assistantText;
              setTurns((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: "assistant", content: text };
                return copy;
              });
            }
          } else if (frame.type === "error") {
            sawError = true;
          } else if (frame.type === "done") {
            streamDone = true;
          }
        }
      }

      if (!assistantText) {
        setStatus("error");
        return;
      }
      setStatus(sawError ? "error" : "idle");
    } catch {
      setStatus("error");
    }
  }

  const notice =
    status === "error"
      ? t.error
      : status === "rateLimited"
        ? t.rateLimited
        : locked
          ? t.limitReached
          : null;

  return (
    <>
      {showTeaser && !open && (
        <div
          role="status"
          className="chat-widget__teaser fixed bottom-6 right-[4.75rem] z-40 flex max-w-[15rem] items-start gap-2 rounded-2xl rounded-br-sm border border-neutral-300 bg-white/90 py-3 pl-4 pr-3 shadow-2xl sm:right-[5.25rem]"
        >
          <p className="text-sm leading-snug text-neutral-900">{t.teaser}</p>
          <button
            type="button"
            onClick={dismissTeaser}
            aria-label={t.dismissTeaser}
            className="-mr-1 -mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
          >
            <CloseIcon size={12} />
          </button>
        </div>
      )}

      <button
        ref={bubbleRef}
        type="button"
        onClick={() => {
          setOpen((wasOpen) => !wasOpen);
          dismissTeaser();
        }}
        aria-label={t.bubbleLabel}
        aria-expanded={open}
        aria-controls="chat-panel"
        className="chat-widget__bubble fixed bottom-5 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full border-2 border-neutral-900 bg-white text-neutral-900 shadow-lg transition-colors hover:bg-neutral-900 hover:text-white sm:right-6"
      >
        {open ? <CloseIcon /> : <ChatIcon />}
      </button>

      {open && (
        <div
          ref={panelRef}
          id="chat-panel"
          role="dialog"
          aria-label={t.heading}
          className="chat-widget__panel fixed bottom-24 right-4 z-40 flex max-h-[min(32rem,calc(100dvh-9rem))] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl sm:right-6 sm:w-[24rem]"
        >
          <header className="border-b border-neutral-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-neutral-900">{t.heading}</h2>
            <p className="mt-0.5 text-xs text-neutral-500">{t.subheading}</p>
          </header>

          <div
            aria-live="polite"
            className="flex-1 space-y-3 overflow-y-auto px-5 py-4 text-[0.9rem]"
          >
            <Bubble role="assistant">{t.greeting}</Bubble>

            {turns.map((turn, i) => (
              <Bubble key={i} role={turn.role}>
                {turn.role === "assistant" ? (
                  <AssistantText
                    text={turn.content}
                    bookingLinkUrl={bookingLinkUrl}
                    bookingLinkLabel={bookingLinkLabel}
                    onNavigate={() => setOpen(false)}
                  />
                ) : (
                  turn.content
                )}
              </Bubble>
            ))}

            {busy && !streaming && (
              <p className="text-xs italic text-neutral-500">{t.thinking}</p>
            )}

            {notice && (
              <div className="rounded-xl bg-neutral-100 px-3.5 py-3 text-neutral-700">
                <p>{notice}</p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <a
                    href={telLink}
                    className="inline-flex min-h-[38px] items-center rounded-full border border-neutral-300 px-4 text-xs font-medium tracking-wide text-neutral-900 transition-colors hover:bg-neutral-900 hover:text-white"
                  >
                    {t.callCta} {phoneDisplay}
                  </a>
                  <a
                    href={`${smsLinkBase}?body=${encodeURIComponent(t.textMessage)}`}
                    className="inline-flex min-h-[38px] items-center rounded-full border border-neutral-300 px-4 text-xs font-medium tracking-wide text-neutral-900 transition-colors hover:bg-neutral-900 hover:text-white"
                  >
                    {t.textCta}
                  </a>
                </div>
              </div>
            )}

            {turns.length === 0 && !busy && (
              <div className="flex flex-wrap gap-2 pt-1">
                {t.suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => void send(suggestion)}
                    className="rounded-full border border-neutral-200 px-3.5 py-2 text-left text-xs text-neutral-600 transition-colors hover:border-neutral-400 hover:text-neutral-900"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}

            <div ref={logEndRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
            className="border-t border-neutral-200 px-5 py-4"
          >
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={maxMessageLength}
                disabled={locked}
                placeholder={t.placeholder}
                aria-label={t.placeholder}
                className="min-w-0 flex-1 rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-[0.9rem] text-neutral-900 placeholder:text-neutral-400 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={busy || locked || !input.trim()}
                className="shrink-0 rounded-full bg-neutral-900 px-4 py-2.5 text-xs font-medium tracking-wide text-white transition-colors hover:bg-neutral-700 disabled:opacity-40"
              >
                {t.send}
              </button>
            </div>
            <p className="mt-2.5 text-[0.7rem] leading-snug text-neutral-500">{t.disclaimer}</p>
          </form>
        </div>
      )}
    </>
  );
}

function Bubble({ role, children }: { role: Turn["role"]; children: React.ReactNode }) {
  const mine = role === "user";
  return (
    <div className={mine ? "flex justify-end" : "flex justify-start"}>
      <div
        // pre-line: the model writes the odd paragraph break, and collapsing
        // those turns a readable answer into a wall of text.
        className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 ${
          mine ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-900"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * A character that would mean the path we matched is part of a longer URL
 * rather than a link of its own. Punctuation the model might wrap the path
 * in — a backtick, a quote, a bracket — is deliberately *not* in this set,
 * so a stray bit of markdown does not silently cost the visitor their link.
 */
const INSIDE_URL = /[A-Za-z0-9/.:?=&%_-]/;

/**
 * The panel renders plain text, and the system prompt tells the model to
 * write plain text. Models drift into markdown anyway, and a literal `**`
 * or backtick in the middle of an answer looks broken, so the common
 * emphasis markers are dropped on the way in.
 */
function stripMarkdown(text: string): string {
  return text.replace(/`/g, "").replace(/\*\*(.+?)\*\*/g, "$1");
}

function AssistantText({
  text,
  bookingLinkUrl,
  bookingLinkLabel,
  onNavigate,
}: {
  text: string;
  bookingLinkUrl: string;
  bookingLinkLabel: string;
  onNavigate: () => void;
}) {
  const clean = stripMarkdown(text);
  const bookingLinkPattern = new RegExp(bookingLinkUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
  const nodes: React.ReactNode[] = [];
  let cursor = 0;

  for (const match of clean.matchAll(bookingLinkPattern)) {
    const start = match.index;

    // Without this, the booking URL's tail as part of some other, longer
    // URL would be lifted out of the middle of that URL and turned into a
    // link.
    if (start > 0 && INSIDE_URL.test(clean[start - 1])) continue;

    if (start > cursor) nodes.push(<span key={cursor}>{clean.slice(cursor, start)}</span>);

    const href = match[0];
    nodes.push(
      <a
        key={start}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onNavigate}
        className="font-medium text-neutral-900 underline decoration-2 underline-offset-4"
      >
        {bookingLinkLabel}
      </a>,
    );
    cursor = start + href.length;
  }

  if (cursor < clean.length) nodes.push(<span key={cursor}>{clean.slice(cursor)}</span>);

  return <>{nodes}</>;
}

function ChatIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M3 8.5C3 5.9 5.5 3.8 10 3.8s7 2.1 7 4.7-2.5 4.7-7 4.7c-.6 0-1.2 0-1.7-.1L4.6 15l.7-2.5C3.9 11.6 3 10.2 3 8.5z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
