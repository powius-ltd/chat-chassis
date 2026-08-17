# Operating a deployed project

## When something looks wrong

**A visitor's message got no reply / a 502.** Check `ANTHROPIC_API_KEY` is
set (a missing key 503s before any Anthropic call, logged as
`ANTHROPIC_API_KEY not set`). Check the server logs for `chat failed` (the
error came back before the first token — usually a bad API key or an
Anthropic outage) vs. `chat failed mid-stream` (the connection dropped after
streaming had already started — the visitor saw a partial reply). Both are
non-fatal to future requests.

**The model stayed silent.** Logged as `chat: model stayed silent even with
tools off` — Haiku-class models occasionally end a turn with zero content
blocks right after a tool result. `engine/chat/run.ts` retries once
automatically (`mustSpeak`); this log line means even the retry produced
nothing, which should be rare enough to be worth investigating if it
recurs.

**`flag_unanswered`/`submit_lead` isn't notifying.** Check
`TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` or `WHATSAPP_TOKEN`/
`WHATSAPP_PHONE_NUMBER_ID`/`WHATSAPP_STUDIO_TO` are set — an unconfigured
channel warns to the console and silently no-ops, it never surfaces to the
visitor. Confirm the row landed in `chat_unanswered`/`chat_leads` regardless
(the DB write happens before the notification, and a notification failure
never rolls it back).

**Rate limiting isn't working / everyone is allowed through.** Check
`SUPABASE_SERVICE_ROLE_KEY` is set — without it, `engine/chat/rate-limit.ts`
warns once and fails open by design (an unreachable counter must never take
the widget down). If it's set and still failing open, check
`bump_chat_rate_limit` exists (`0005_chat_rate_limits.sql` applied) and the
service-role key has execute on it.

## Config vs. data — where to make a change

| You want to change... | Edit |
|---|---|
| Business hours, prices, hard rules | `src/chat-knowledge.ts` |
| Widget copy (any locale) | `src/chat-copy/<locale>.ts` |
| FAQ shown to the assistant | `chat_faq` table (an admin panel to edit this is out of scope here — see docs/SETUP.md) |
| Brand name, phone, booking link, chat tuning (model, token/round caps, rate limit) | `chassis.config.ts` |
| Adding a locale | `chassis.config.ts`'s `locales` + a new `src/chat-copy/<locale>.ts` + a locale branch in `src/chat-knowledge.ts` |
| Anything under `engine/` | Don't, except the two documented exceptions in docs/CONTRACTS.md |

## Rotating secrets

`SUPABASE_SERVICE_ROLE_KEY` doubles as the chat rate limiter's IP-hashing
salt (`engine/chat/handler.ts` passes it to `hashCaller`) — rotating it just
resets everyone's rate-limit window, which is harmless.

## WhatsApp templates to register

Meta only allows pre-approved templates for business-initiated messages.
Register these two in Business Manager (names must match
`engine/whatsapp/notify.ts`'s `WHATSAPP_TEMPLATES`):

**`chat_lead`** — body: `New question from the website chat. Name: {{1}}. Phone: {{2}}. Language: {{3}}. Question: {{4}}.`

**`chat_unanswered`** — body: `Website chat couldn't answer: {{1}}. Language: {{2}}. The visitor was given the phone number.`

Both are plain-text bodies (no buttons/media) — the simplest category to get
approved. `engine/whatsapp/client.ts`'s `templateParam()` sanitizes every
value (Meta rejects newlines/tabs/4+ consecutive spaces and empty strings)
before it's sent.

## Running alongside another chassis

If a project uses this chassis next to another one that ships the same
pieces: keep one `engine/supabase/{server,admin}.ts` and one
`engine/telegram/client.ts`, merge the Telegram/WhatsApp `notify.ts` files'
exports into one, and apply only one `admins`/`is_admin()` migration —
running both will fail on the duplicate `create table public.admins`.
