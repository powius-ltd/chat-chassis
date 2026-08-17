import type { ChatCopy } from "@/engine/contracts/chat-copy";

export default {
  heading: "Questions?",
  subheading: "We usually reply in seconds.",
  greeting: "Hi! Ask me anything about our services, hours, or pricing.",
  teaser: "Have a question?",
  suggestions: ["What are your hours?", "How much is a haircut?"],
  placeholder: "Type a message…",
  send: "Send",
  thinking: "Thinking…",
  error: "Something went wrong. Please try again or reach us directly.",
  rateLimited: "You've sent a lot of messages — please try again in a bit.",
  limitReached: "This conversation has reached its limit. Please reach us directly.",
  disclaimer: "This assistant can make mistakes. Please double-check important details.",
  callCta: "Call",
  textCta: "Text us",
  textMessage: "Hi, I have a question.",
  bubbleLabel: "Open chat",
  dismissTeaser: "Dismiss",
} satisfies ChatCopy;
