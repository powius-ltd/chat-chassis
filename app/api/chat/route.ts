export { POST } from "@/engine/chat/handler";

/** Up to config.chat.maxToolRounds rounds plus a streamed final answer can run past Vercel's default. */
export const maxDuration = 30;
