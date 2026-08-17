import { ChatWidget } from "@/engine/components/chat/ChatWidget";
import { CONFIG, COPY } from "@/engine/registry";

/**
 * Worked example of mounting `ChatWidget` — every prop it needs comes from
 * `CONFIG`/`COPY`, nothing is hardcoded here. A real project's page(s)
 * render this the same way, with `locale` coming from wherever that
 * project resolves the current locale.
 */
export default function DemoPage() {
  const locale = CONFIG.defaultLocale;
  const t = COPY[locale];

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-xl font-semibold">Chat widget demo</h1>
      <p className="mt-2 text-neutral-600">
        Click the bubble in the bottom-right corner. Requires ANTHROPIC_API_KEY and Supabase env
        vars to actually answer — see .env.example.
      </p>

      <ChatWidget
        locale={locale}
        t={t}
        enabled
        maxMessageLength={CONFIG.chat.maxMessageLength}
        maxConversationMessages={CONFIG.chat.maxConversationMessages}
        phoneDisplay={CONFIG.brand.phoneDisplay}
        telLink={CONFIG.brand.telLink}
        smsLinkBase={CONFIG.brand.smsLink}
        bookingLinkUrl={CONFIG.booking.linkUrl}
        bookingLinkLabel={CONFIG.booking.linkLabel}
      />
    </main>
  );
}
