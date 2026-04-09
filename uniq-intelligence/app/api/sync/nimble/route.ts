import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { parseNimbleCompany, parseNimbleDeal } from "@/lib/nimble";
import { toErrorMessage } from "@/lib/to-error-message";

const DEALS_URL = "https://api.nimble.com/api/v1/deals";
const CONTACTS_URL = "https://api.nimble.com/api/v1/contacts/";

async function fetchNimblePaged(
  url: string,
  apiKey: string,
  extraParams: Record<string, string>,
): Promise<unknown[]> {
  const out: unknown[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const u = new URL(url);
    Object.entries(extraParams).forEach(([k, v]) => u.searchParams.set(k, v));
    u.searchParams.set("page", String(page));
    u.searchParams.set("per_page", "100");

    const res = await fetch(u.toString(), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Nimble ${res.status}: ${text.slice(0, 800)}`);
    }

    const json = (await res.json()) as {
      meta?: { pages?: number };
      resources?: unknown[];
    };

    const resources = json.resources;
    if (!Array.isArray(resources)) break;
    out.push(...resources);
    totalPages = json.meta?.pages ?? 1;
    page += 1;
  } while (page <= totalPages);

  return out;
}

export async function GET() {
  const apiKey = process.env.NIMBLE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "NIMBLE_API_KEY is not configured" },
      { status: 500 },
    );
  }

  let supabase;
  try {
    supabase = createSupabaseAdmin();
  } catch (e) {
    return NextResponse.json(
      { error: toErrorMessage(e) || "Supabase config error" },
      { status: 500 },
    );
  }

  try {
    const [dealResources, contactResources] = await Promise.all([
      fetchNimblePaged(DEALS_URL, apiKey, {}),
      fetchNimblePaged(CONTACTS_URL, apiKey, { record_type: "company" }),
    ]);

    const dealRows = dealResources
      .map((d) => parseNimbleDeal(d as Record<string, unknown>))
      .filter((r): r is NonNullable<typeof r> => r != null);

    const companyRows = contactResources
      .map((c) =>
        parseNimbleCompany(c as Parameters<typeof parseNimbleCompany>[0]),
      )
      .filter((r): r is NonNullable<typeof r> => r != null);

    if (dealRows.length > 0) {
      const { error: dealsError } = await supabase.from("pipeline").upsert(
        dealRows.map((r) => ({
          nimble_deal_id: r.nimble_deal_id,
          title: r.title,
          value: r.value,
          stage: r.stage,
          status: r.status,
        })),
        { onConflict: "nimble_deal_id" },
      );
      if (dealsError) throw dealsError;
    }

    if (companyRows.length > 0) {
      const { error: companiesError } = await supabase.from("companies").upsert(
        companyRows.map((r) => ({
          nimble_id: r.nimble_id,
          name: r.name,
        })),
        { onConflict: "nimble_id" },
      );
      if (companiesError) throw companiesError;
    }

    return NextResponse.json({
      synced_deals: dealRows.length,
      synced_companies: companyRows.length,
    });
  } catch (e) {
    const message = toErrorMessage(e);
    console.error("[api/sync/nimble]", message, e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
