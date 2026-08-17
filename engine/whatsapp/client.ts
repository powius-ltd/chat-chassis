/**
 * Minimal WhatsApp Cloud API client over `fetch`.
 *
 * Same posture as `engine/telegram/client.ts`: never throws, no-ops with a
 * warning when unconfigured. WhatsApp does not let a business send
 * arbitrary text to someone who hasn't messaged it in the last 24 hours, so
 * everything here goes out as a pre-approved *template* — the shape of each
 * message lives in Meta's Business Manager, only its parameters live here.
 * See `docs/OPERATIONS.md` for the template bodies to register.
 */

const API_VERSION = "v23.0";
const API_BASE = "https://graph.facebook.com";
const DEFAULT_TEMPLATE_LANG = "en_US";

export function whatsappConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

/** Comma-separated recipient numbers, E.164 without the leading `+`. */
export function studioWhatsAppNumbers(): string[] {
  return (process.env.WHATSAPP_STUDIO_TO ?? "")
    .split(",")
    .map((entry) => entry.replace(/\D/g, ""))
    .filter((entry) => entry.length > 0);
}

/**
 * Meta rejects the whole message if a parameter contains a newline, a tab,
 * or four consecutive spaces, and rejects empty strings outright — so every
 * optional field collapses to a visible placeholder rather than vanishing.
 */
export function templateParam(value: string | null | undefined): string {
  const cleaned = (value ?? "").replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim();
  return cleaned.length > 0 ? cleaned : "—";
}

type SendTemplateInput = {
  name: string;
  params: string[];
  to?: string[];
  language?: string;
};

export async function sendWhatsAppTemplate({
  name,
  params,
  to,
  language,
}: SendTemplateInput): Promise<boolean> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const recipients = to ?? studioWhatsAppNumbers();

  if (!token || !phoneNumberId || recipients.length === 0) {
    console.warn(`WhatsApp env not set — skipping template "${name}"`);
    return false;
  }

  const lang = language ?? process.env.WHATSAPP_TEMPLATE_LANG ?? DEFAULT_TEMPLATE_LANG;
  const url = `${API_BASE}/${API_VERSION}/${phoneNumberId}/messages`;

  const results = await Promise.allSettled(
    recipients.map(async (recipient) => {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        // A hung Meta endpoint must never hold up the caller.
        signal: AbortSignal.timeout(3000),
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: recipient,
          type: "template",
          template: {
            name,
            language: { code: lang },
            components: params.length
              ? [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }]
              : [],
          },
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error(`WhatsApp responded ${res.status}`, { template: name, body });
        return false;
      }

      return true;
    }),
  );

  return results.every((result) => result.status === "fulfilled" && result.value);
}
