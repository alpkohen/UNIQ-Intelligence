import { createClient } from "@supabase/supabase-js";

const ENV_VARS_USED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

export function createSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const missing: string[] = [];
  if (!url?.trim()) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceRoleKey?.trim()) missing.push("SUPABASE_SERVICE_ROLE_KEY");

  if (missing.length > 0) {
    console.error("[createSupabaseAdmin] Supabase admin env check failed.");
    console.error(
      "[createSupabaseAdmin] Env variable names used by this client:",
      ENV_VARS_USED.join(", "),
    );
    for (const name of ENV_VARS_USED) {
      const raw = process.env[name];
      const set = typeof raw === "string" && raw.trim().length > 0;
      console.error(
        `[createSupabaseAdmin]   ${name}: ${set ? "set" : "MISSING or empty"}`,
      );
    }
    console.error(
      "[createSupabaseAdmin] Missing required variable(s):",
      missing.join(", "),
    );

    throw new Error(
      `Supabase admin client: missing required environment variable(s): ${missing.join(", ")}. ` +
        `(Checked: ${ENV_VARS_USED.join(", ")})`,
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
