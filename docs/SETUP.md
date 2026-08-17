# Setting up a new project

Target: an hour or two, most of it Supabase/Telegram/WhatsApp app setup, not
code.

## 1. Create the repo

Clone this repo (or a template made from it) into the new project, `npm ci`.

## 2. Create the Supabase project

By hand, in the Supabase dashboard — deliberately not scripted: the
Management API needs org/billing access that's fragile and only used once
per project.

## 3. Configure

Copy `chassis.config.example.ts` to `chassis.config.ts` and fill in the real
brand facts, locales, booking link, and chat tuning. Run `npm run typecheck`
— `satisfies ChatChassisConfig` catches a wrong shape immediately.

## 4. Apply the schema

`supabase link` to the new project, then `supabase db push` — applies
`supabase/migrations/*.sql` (admins/is_admin, chat_leads, chat_unanswered,
chat_faq, chat_rate_limits). If the project already has `admins`/`is_admin()`
from another chassis, skip `0001_admins.sql`.

## 5. Create the first admin user

Manual, for the same reason: the Supabase Auth Admin API needs a
service-role key and is a one-time action, not worth scripting. In the
dashboard: Authentication → add user, then insert a matching row into
`public.admins` via the SQL editor.

## 6. Write your knowledge

Edit `src/chat-knowledge.ts` — replace the placeholder body with the real
business facts, hours, prices, and hard rules. Run `npm run verify`
(conformance tests) to check it returns a non-empty prompt for every
configured locale.

## 7. Write your copy

Edit `src/chat-copy/<locale>.ts` for every locale in `chassis.config.ts`.
`npm run verify` checks every key is present.

## 8. Wire in the widget

`app/demo/page.tsx` is a worked example — copy its `ChatWidget` usage into
wherever your real layout should mount it (usually a root layout, so it
appears on every page).

## 9. Env vars

`.env.example` → `.env.local`. `ANTHROPIC_API_KEY` and the three Supabase
vars are required; `TELEGRAM_*` and `WHATSAPP_*` are each independently
optional — an unconfigured channel just no-ops with a console warning, it
never breaks the chat reply itself.

## 10. Register WhatsApp templates (optional)

If using WhatsApp notifications, register `chat_lead` and `chat_unanswered`
templates in Meta Business Manager — see docs/OPERATIONS.md for the
parameter tables.

## 11. Verify end-to-end

`npm run typecheck && npm run lint && npm test && npm run verify`, then by
hand: open `/demo`, ask a question the FAQ doesn't cover, confirm
`flag_unanswered` fires (row appears in `chat_unanswered`, Telegram/WhatsApp
notified if configured), give a name+phone and confirm `submit_lead` does
the same into `chat_leads`.

## What's deliberately out of scope

The marketing site (everything outside `app/api/chat` and `app/demo`), an
admin panel for reviewing/actioning `chat_leads`/`chat_unanswered`/`chat_faq`
(review them in the Supabase dashboard, or build a panel of your own at
`admin.basePath`), and payments (never a chat concern).
