/**
 * Minimal Telegram Bot API client over `fetch`.
 *
 * Never throws and no-ops with a warning when the environment isn't
 * configured — every caller here is a *notification* about work that
 * already succeeded (a lead was saved, a question was logged). A visitor's
 * chat reply must never fail because the business's phone is unreachable.
 */

const API_BASE = "https://api.telegram.org/bot";

/** Escapes the three characters Telegram's HTML parse mode treats as markup. */
export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function telegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

export async function sendTelegramMessage(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const target = process.env.TELEGRAM_CHAT_ID;

  if (!token || !target) {
    console.warn("TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID not set — skipping Telegram message");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: target,
        text,
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
      }),
      // A hung Telegram endpoint must never hold up the caller — this is a
      // best-effort notification, not something anything else waits on.
      signal: AbortSignal.timeout(3000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`Telegram responded ${res.status}`, body);
    }
  } catch (error) {
    console.error("telegram.send failed", error);
  }
}
