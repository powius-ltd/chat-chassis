# Contracts

The chassis (`engine/`) has exactly two external dependencies on a consuming
project, plus one config file. Everything else it needs is generic.

## 1. `SystemPromptBuilder` (`engine/contracts/chat-knowledge.ts`)

```ts
export type SystemPromptCtx = { faqLines: string[] };
export type SystemPromptBuilder = (
  locale: Locale,
  ctx: SystemPromptCtx,
) => Promise<string> | string;
```

A project implements this once, in `src/chat-knowledge.ts`, exporting
`buildSystemPrompt` of this type. This is where a business's real hours,
service list, prices, and "hard rules" (what the assistant may and may
never claim) go.

**Notes:**

- `ctx.faqLines` is filled in by the chassis (`engine/chat/handler.ts` reads
  active `chat_faq` rows before calling your builder) — you don't need your
  own Supabase read for that part, just decide where in the prompt those
  lines go.
- There is no generic prompt template to extend. A prompt for "front-desk
  assistant at a spa" and one for "concierge at a dental clinic" don't share
  enough structure to templatize without hiding more than it reveals. Write
  yours from the annotated placeholder in `src/chat-knowledge.ts`: hours,
  services and prices, hard rules (what the assistant must never claim), and
  tone.
- `npm run verify` (the `conformance` test project) checks that
  `buildSystemPrompt` returns a non-empty string for every configured locale
  and actually includes the given `faqLines`.

## 2. `ChatCopy` (`engine/contracts/chat-copy.ts`)

A ~17-key type covering exactly what `engine/components/chat/ChatWidget.tsx`
renders — not a whole-site dictionary. A project writes one
`src/chat-copy/<locale>.ts` per configured locale, each `satisfies ChatCopy`,
and re-exports them all from `src/chat-copy/index.ts` as
`Record<Locale, ChatCopy>`.

**Why it's this narrow:** the source project's chat widget depended on that
site's entire `Dictionary` type (meta, nav, hero, services, booking, chat,
footer, …) for the ~17 keys it actually used. That's a whole-site-copy
dependency for a widget that should be droppable into any project — so this
chassis defines its own contract instead of asking a project to satisfy a
site-wide dictionary shape it may not even have yet.

`npm run verify` checks every configured locale has a copy file and every
key is present and non-empty.

## 3. `chassis.config.ts` — not a contract, but the third input

`engine/config.ts` defines `ChatChassisConfig` and `validateConfig()`
(called once, at import time, from `engine/registry.ts`) — a misconfigured
project fails loudly at startup with every problem listed at once, not one
cryptic error at a time.

## What deliberately has no contract

- `engine/components/chat/ChatWidget.tsx`'s styling. It ships with plain,
  generic Tailwind (neutral palette) and BEM-ish class name hooks
  (`chat-widget__bubble`, `chat-widget__panel`, `chat-widget__teaser`) meant
  to be overridden by a project's own design system — not covered by a
  type, since visual design isn't a type-checkable contract.
- The Telegram/WhatsApp message wording in `engine/telegram/notify.ts` /
  `engine/whatsapp/notify.ts` — hardcoded English, not covered by
  `ChatCopy`. These are internal notifications to the business, not visitor
  copy, and don't need localizing. A documented, deliberate exception — not
  an oversight.
