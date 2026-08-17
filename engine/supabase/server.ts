import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client for Server Components, Server Actions, and Route
 * Handlers. Reads/writes the session via the Next.js `cookies()` API — do
 * not reuse this across a request boundary, create one per call (per
 * Supabase's own guidance for `@supabase/ssr`).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // A Server Component can't set cookies (no response to attach
            // them to) — fine as long as something upstream refreshes the
            // session on every request that needs it.
          }
        },
      },
    },
  );
}
