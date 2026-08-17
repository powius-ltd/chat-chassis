import { describe, expect, it, beforeEach } from "vitest";
import { vi } from "vitest";
import type { ChatChassisConfig } from "../../config";

const mocks = vi.hoisted(() => ({
  insert: vi.fn(async () => ({ error: null as { message: string } | null })),
  after: vi.fn((fn: () => void | Promise<void>) => {
    void fn();
  }),
  notifyUnansweredQuestion: vi.fn(async () => {}),
  notifyChatLead: vi.fn(async () => {}),
}));

vi.mock("../../supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: vi.fn(() => ({ insert: mocks.insert })),
  })),
}));

vi.mock("next/server", () => ({
  after: mocks.after,
}));

const { runChatTool } = await import("../../chat/tools");
type ToolContext = import("../../chat/tools").ToolContext;

const CONFIG = { brand: { noun: "the studio", phoneDisplay: "(555) 555-0100" } } as ChatChassisConfig;
const notifiers = {
  notifyUnansweredQuestion: mocks.notifyUnansweredQuestion,
  notifyChatLead: mocks.notifyChatLead,
};

function freshCtx(): ToolContext {
  return { locale: "en", resolved: false };
}

beforeEach(() => {
  mocks.insert.mockClear();
  mocks.after.mockClear();
  mocks.notifyUnansweredQuestion.mockClear();
  mocks.notifyChatLead.mockClear();
  mocks.insert.mockResolvedValue({ error: null });
});

describe("runChatTool: unknown tool", () => {
  it("returns an error result rather than throwing", async () => {
    const result = await runChatTool("not_a_real_tool", {}, freshCtx(), CONFIG, notifiers);
    expect(result.isError).toBe(true);
    expect(result.content).toContain("Unknown tool");
  });
});

describe("runChatTool: flag_unanswered", () => {
  it("rejects a missing question", async () => {
    const result = await runChatTool("flag_unanswered", {}, freshCtx(), CONFIG, notifiers);
    expect(result.isError).toBe(true);
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.after).not.toHaveBeenCalled();
  });

  it("rejects a whitespace-only question", async () => {
    const result = await runChatTool(
      "flag_unanswered",
      { question: "   " },
      freshCtx(),
      CONFIG,
      notifiers,
    );
    expect(result.isError).toBe(true);
  });

  it("inserts into chat_unanswered and defers the notification via after()", async () => {
    const ctx = freshCtx();
    const result = await runChatTool(
      "flag_unanswered",
      { question: "Do you sell gift cards?" },
      ctx,
      CONFIG,
      notifiers,
    );

    expect(result.isError).toBe(false);
    expect(mocks.insert).toHaveBeenCalledWith({
      locale: "en",
      question: "Do you sell gift cards?",
    });
    expect(mocks.after).toHaveBeenCalledTimes(1);
    expect(mocks.notifyUnansweredQuestion).toHaveBeenCalledWith({
      question: "Do you sell gift cards?",
      locale: "en",
    });
    expect(ctx.resolved).toBe(true);
  });

  it("still notifies even when the chat_unanswered insert fails", async () => {
    mocks.insert.mockResolvedValueOnce({ error: { message: "db down" } });
    const ctx = freshCtx();
    const result = await runChatTool("flag_unanswered", { question: "Parking?" }, ctx, CONFIG, notifiers);

    expect(result.isError).toBe(false);
    expect(mocks.after).toHaveBeenCalledTimes(1);
    expect(ctx.resolved).toBe(true);
  });

  it("never fires a second notification for an already-resolved conversation", async () => {
    const ctx: ToolContext = { locale: "en", resolved: true };
    const result = await runChatTool("flag_unanswered", { question: "Anything?" }, ctx, CONFIG, notifiers);

    expect(result.isError).toBe(false);
    expect(result.content).toContain("Already notified");
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.after).not.toHaveBeenCalled();
  });
});

describe("runChatTool: submit_lead", () => {
  it("rejects when name, phone, or question is missing", async () => {
    const result = await runChatTool(
      "submit_lead",
      { name: "Jane", phone: "" },
      freshCtx(),
      CONFIG,
      notifiers,
    );
    expect(result.isError).toBe(true);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("saves the lead and defers the notification once all three fields are present", async () => {
    const ctx = freshCtx();
    const result = await runChatTool(
      "submit_lead",
      { name: "Jane Doe", phone: "555-0100", question: "Can you do a bridal package?" },
      ctx,
      CONFIG,
      notifiers,
    );

    expect(result.isError).toBe(false);
    expect(mocks.insert).toHaveBeenCalledWith({
      locale: "en",
      name: "Jane Doe",
      phone: "555-0100",
      question: "Can you do a bridal package?",
    });
    expect(mocks.after).toHaveBeenCalledTimes(1);
    expect(mocks.notifyChatLead).toHaveBeenCalledWith({
      name: "Jane Doe",
      phone: "555-0100",
      question: "Can you do a bridal package?",
      locale: "en",
    });
    expect(ctx.resolved).toBe(true);
  });

  it("does not defer a notification and reports an error when the insert fails", async () => {
    mocks.insert.mockResolvedValueOnce({ error: { message: "db down" } });
    const ctx = freshCtx();
    const result = await runChatTool(
      "submit_lead",
      { name: "Jane", phone: "555-0100", question: "Hi" },
      ctx,
      CONFIG,
      notifiers,
    );

    expect(result.isError).toBe(true);
    expect(mocks.after).not.toHaveBeenCalled();
    expect(ctx.resolved).toBe(false);
  });

  it("only one of flag_unanswered / submit_lead ever resolves a conversation", async () => {
    const ctx = freshCtx();
    await runChatTool("flag_unanswered", { question: "Q1" }, ctx, CONFIG, notifiers);
    // flag_unanswered's own chat_unanswered insert.
    expect(mocks.insert).toHaveBeenCalledTimes(1);
    expect(mocks.after).toHaveBeenCalledTimes(1);

    const second = await runChatTool(
      "submit_lead",
      { name: "Jane", phone: "555-0100", question: "Q2" },
      ctx,
      CONFIG,
      notifiers,
    );

    // Already resolved by flag_unanswered — submit_lead must not insert into
    // chat_leads or notify again; the call count stays exactly where it was.
    expect(second.isError).toBe(false);
    expect(mocks.insert).toHaveBeenCalledTimes(1);
    expect(mocks.after).toHaveBeenCalledTimes(1);
  });
});
