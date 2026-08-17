# chat-chassis

A reusable AI front-desk chat widget for Next.js sites. Drop it into a
project, write two small files describing your business, and you get a
streaming chat assistant that answers visitors' questions, captures leads,
and tells you about every question it couldn't answer.

Everything business-specific lives in one config file and two implementation
files. The engine itself is meant to be used as-is, not edited.

## What it does

- **Streaming chat replies.** An Anthropic-powered assistant answers from
  facts you supply — no invented hours, prices, or policies.
- **Lead capture.** When a visitor gives a name and phone number, the
  assistant calls a `submit_lead` tool that writes the lead to Supabase and
  notifies you.
- **Unanswered-question feedback loop.** When the assistant can't answer, it
  calls `flag_unanswered`, which records the question and notifies you. You
  add the answer to the `chat_faq` table, and every later conversation is
  answered from it — the assistant gets better without a code change.
- **Notifications.** Telegram and WhatsApp, each independently optional. An
  unconfigured channel no-ops with a console warning; it never breaks a chat
  reply.
- **Multi-language.** Your locales, your copy, one system prompt per locale.
- **Abuse limits.** Per-visitor rate limiting, message/reply length caps, and
  a conversation-length cap, all tunable in config.

## What it isn't

Three things are deliberately out of scope, so you know what you still have
to build:

- **No admin panel.** The `chat_leads`, `chat_unanswered`, and `chat_faq`
  tables ship with the schema, but there is no UI for them — review and edit
  them in the Supabase dashboard, or build your own panel at
  `admin.basePath`.
- **No marketing site.** Only `/demo`, a worked example of mounting the
  widget. You mount it into your own layout.
- **No payments or booking.** The assistant points visitors at your booking
  link; it never takes a booking or a payment itself.

## Requirements

- Node.js 20+
- A Supabase project (Postgres + Auth)
- An Anthropic API key
- Optional: a Telegram bot, and/or WhatsApp Cloud API access

## Install

```bash
git clone https://github.com/powius-ltd/chat-chassis.git my-project
cd my-project
npm ci
```

Then:

1. **Configure.** Copy `chassis.config.example.ts` to `chassis.config.ts` and
   fill in the real brand facts, locales, booking link, and chat tuning.
   `npm run typecheck` catches a wrong shape immediately.
2. **Apply the schema.** `supabase link` to your project, then
   `supabase db push` — this applies `supabase/migrations/*.sql` (admins,
   chat_leads, chat_unanswered, chat_faq, chat_rate_limits).
3. **Set env vars.** Copy `.env.example` to `.env.local`.
   `ANTHROPIC_API_KEY` and the three Supabase vars are required; the
   `TELEGRAM_*` and `WHATSAPP_*` groups are each optional.
4. **Write your knowledge.** Edit `src/chat-knowledge.ts` — replace the
   placeholder with your real hours, services, prices, and hard rules.
5. **Write your copy.** Edit `src/chat-copy/<locale>.ts` for every locale in
   your config.
6. **Mount the widget.** `app/demo/page.tsx` shows the `ChatWidget` usage;
   copy it into your root layout so the widget appears on every page.
7. **Verify.** `npm run verify` checks that every locale has a non-empty
   system prompt and a complete copy set. Then `npm run dev` and try
   `/demo` by hand.

Full walkthrough, including the manual Supabase and WhatsApp setup steps:
**[docs/SETUP.md](docs/SETUP.md)**.

## Project layout

| Path | What it is |
| --- | --- |
| `engine/` | The chassis. Use as-is; don't edit. |
| `src/chat-knowledge.ts` | **You write this.** The assistant's business knowledge (system prompt). |
| `src/chat-copy/*.ts` | **You write this.** The widget's UI copy, one file per locale. |
| `chassis.config.ts` | **You write this.** Brand, locales, booking link, chat tuning, admin path. |
| `supabase/migrations/` | The chat engine's schema — generic and seed-free. |
| `app/api/chat/route.ts` | The chat endpoint. |
| `app/demo/page.tsx` | Worked example of mounting the widget. |

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | ESLint |
| `npm test` | Unit tests |
| `npm run verify` | Conformance tests — checks your knowledge and copy against the contracts |

## Docs

- **[docs/SETUP.md](docs/SETUP.md)** — setting up a new project, start to finish.
- **[docs/CONTRACTS.md](docs/CONTRACTS.md)** — the two things you implement, in detail.
- **[docs/OPERATIONS.md](docs/OPERATIONS.md)** — running a deployed project: troubleshooting, WhatsApp template bodies, where to make a given change.

## Notes

Extracted from a production site's chat widget, then made generic: no
business's real hours, prices, or rules ship here — `src/chat-knowledge.ts`
is an annotated placeholder instead.

The chassis is self-contained on purpose. It ships its own
`engine/supabase/{server,admin}.ts`, `engine/telegram/client.ts`, and its own
single-bucket rate limiter, so it can be dropped into a project on its own.
If your project runs another chassis that defines the same pieces, dedupe the
Supabase/Telegram clients and apply only one `admins`/`is_admin()` migration —
see docs/OPERATIONS.md.

Comments in the code that compare against "the source project" record why a
decision went the way it did. They're historical rationale, not pointers to
code you can open.
