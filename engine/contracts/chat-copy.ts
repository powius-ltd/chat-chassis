/**
 * The chat widget's own copy contract — deliberately NOT the source
 * project's whole-site `Dictionary` type. That version bundled every page's
 * copy into one type, which meant the chat widget depended on a monolith it
 * only used ~17 keys of. `ChatCopy` is scoped to exactly what
 * `engine/components/chat/ChatWidget.tsx` renders.
 *
 * A consuming project writes one `src/chat-copy/<locale>.ts` per configured
 * locale, each `satisfies ChatCopy`. See `docs/CONTRACTS.md`.
 */
export type Locale = string;

export type ChatCopy = {
  /** Header shown when the widget is open. */
  heading: string;
  subheading: string;
  /** First assistant bubble shown on open, before any user message. */
  greeting: string;
  /** Text on the closed-state teaser bubble. */
  teaser: string;
  /** Quick-reply suggestion chips shown alongside the greeting. */
  suggestions: string[];
  placeholder: string;
  send: string;
  thinking: string;
  error: string;
  rateLimited: string;
  limitReached: string;
  /** Small print under the input ("AI can make mistakes" style copy). */
  disclaimer: string;
  callCta: string;
  textCta: string;
  textMessage: string;
  /** Accessible label for the floating launcher button. */
  bubbleLabel: string;
  dismissTeaser: string;
};
