import { createHash } from "node:crypto";
import { createAdminClient } from "../supabase/admin";

export type RateLimitVerdict = { ok: true } | { ok: false; retryAfter: number };

/**
 * Self-contained, single-bucket limiter — deliberately simpler than the
 * source project's shared multi-bucket rate limiter (which also served
 * booking/availability/admin-login buckets from one table). Bundling that in
 * would make this chassis depend on infrastructure only a booking chassis
 * needs. If a project runs chat-chassis alongside a booking chassis that
 * already has its own bucketed limiter, prefer that one and drop this file
 * + its migration instead — see docs/OPERATIONS.md.
 */
export function hashCaller(request: Request, salt: string): string {
  // Vercel appends the real client IP last; anything a caller sets themselves
  // is prepended, so take the final entry.
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",").pop()?.trim() || "unknown";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

/**
 * Counts one call against the caller's window and says whether it may
 * proceed, via a single Postgres function so two requests arriving together
 * cannot both read the same count and both be allowed.
 *
 * Fails open: if the counter is unreachable the call goes through, so a
 * broken limiter cannot take the chat widget down with it.
 */
export async function checkRateLimit(
  callerHash: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitVerdict> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    warnUnconfiguredOnce();
    return { ok: true };
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .rpc("bump_chat_rate_limit", {
        p_hash: callerHash,
        p_limit: limit,
        p_window_seconds: windowSeconds,
      })
      .single<{ allowed: boolean; retry_after: number }>();

    if (error) {
      console.error("bump_chat_rate_limit rpc failed", error);
      return { ok: true };
    }

    if (data?.allowed === false) {
      return { ok: false, retryAfter: Math.max(1, data.retry_after) };
    }

    return { ok: true };
  } catch (error) {
    console.error("rate limit unavailable", error);
    return { ok: true };
  }
}

let warned = false;
function warnUnconfiguredOnce(): void {
  if (warned) return;
  warned = true;
  console.warn("SUPABASE_SERVICE_ROLE_KEY not set — chat rate limiting is disabled.");
}
