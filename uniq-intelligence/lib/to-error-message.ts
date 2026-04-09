/**
 * Normalizes thrown values (including Supabase PostgrestError-like objects) for API responses.
 */
export function toErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;

  if (typeof e === "string") return e;

  if (e !== null && typeof e === "object") {
    const o = e as Record<string, unknown>;
    if (typeof o.message === "string") {
      const parts = [o.message];
      if (typeof o.details === "string" && o.details) parts.push(o.details);
      if (typeof o.hint === "string" && o.hint) parts.push(`hint: ${o.hint}`);
      if (typeof o.code === "string" && o.code) parts.push(`code: ${o.code}`);
      return parts.join(" — ");
    }
  }

  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}
