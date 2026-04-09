import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import {
  buildTrainingImportSignature,
  parseTrainingSheetRows,
} from "@/lib/training-sheet";
import { toErrorMessage } from "@/lib/to-error-message";

/** Org account whose “shared with me” list contains the workbook (override via env). */
const DEFAULT_SHARED_WITH_ME_USER =
  "uniqdanismanlik@uniqdanismanlik.onmicrosoft.com";

type GraphDriveItem = {
  id?: string;
  name?: string;
  parentReference?: { driveId?: string };
  remoteItem?: {
    id?: string;
    name?: string;
    parentReference?: { driveId?: string };
  };
};

async function getGraphAccessToken(): Promise<string> {
  const tenant = process.env.MICROSOFT_TENANT_ID;
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

  if (!tenant || !clientId || !clientSecret) {
    throw new Error(
      "Missing MICROSOFT_TENANT_ID, MICROSOFT_CLIENT_ID, or MICROSOFT_CLIENT_SECRET",
    );
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const res = await fetch(
    `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    },
  );

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Token ${res.status}: ${t.slice(0, 500)}`);
  }

  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("No access_token in token response");
  return json.access_token;
}

/** Resolve driveId + itemId for workbook API (shared items often use remoteItem). */
function extractDriveAndItemIds(item: GraphDriveItem): {
  driveId: string;
  itemId: string;
} | null {
  const remote = item.remoteItem;
  if (remote?.id && remote.parentReference?.driveId) {
    return { driveId: remote.parentReference.driveId, itemId: remote.id };
  }
  if (item.id && item.parentReference?.driveId) {
    return { driveId: item.parentReference.driveId, itemId: item.id };
  }
  if (remote?.id && item.parentReference?.driveId) {
    return { driveId: item.parentReference.driveId, itemId: remote.id };
  }
  return null;
}

async function fetchSharedWithMePage(
  token: string,
  userUpn: string,
  nextUrl: string | null,
): Promise<{ items: GraphDriveItem[]; nextLink: string | null }> {
  const url =
    nextUrl ??
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userUpn)}/drive/sharedWithMe`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Graph sharedWithMe ${res.status}: ${t.slice(0, 800)}`);
  }

  const json = (await res.json()) as {
    value?: GraphDriveItem[];
    "@odata.nextLink"?: string;
  };

  return {
    items: json.value ?? [],
    nextLink: json["@odata.nextLink"] ?? null,
  };
}

async function findDataAnalizFromSharedWithMe(
  token: string,
  userUpn: string,
): Promise<{ driveId: string; itemId: string; name: string }> {
  let nextLink: string | null = null;
  const collected: GraphDriveItem[] = [];

  do {
    const { items, nextLink: nl } = await fetchSharedWithMePage(
      token,
      userUpn,
      nextLink,
    );
    collected.push(...items);
    nextLink = nl;
  } while (nextLink);

  const match =
    collected.find(
      (i) =>
        i.name &&
        /Data_analiz/i.test(i.name) &&
        /\.(xlsx|xlsm|xlsb|xls)$/i.test(i.name),
    ) ?? collected.find((i) => i.name && /Data_analiz/i.test(i.name));

  if (!match) {
    throw new Error(
      `No file matching "Data_analiz" in sharedWithMe for ${userUpn} (${collected.length} items)`,
    );
  }

  const ids = extractDriveAndItemIds(match);
  if (!ids) {
    throw new Error(
      'Found "Data_analiz" in sharedWithMe but could not resolve driveId/itemId (missing remoteItem/parentReference)',
    );
  }

  return {
    driveId: ids.driveId,
    itemId: ids.itemId,
    name: match.remoteItem?.name ?? match.name ?? "Data_analiz",
  };
}

async function getDataWorksheetUsedRange(
  token: string,
  driveId: string,
  itemId: string,
): Promise<unknown[][]> {
  const base = `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}/workbook/worksheets`;
  const urls = [
    `${base}/data/usedRange`,
    `${base}('data')/usedRange`,
  ];

  let lastStatus = 0;
  let lastBody = "";

  for (const url of urls) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (res.ok) {
      const json = (await res.json()) as { values?: unknown[][] };
      return json.values ?? [];
    }
    lastStatus = res.status;
    lastBody = await res.text();
  }

  throw new Error(
    `Graph usedRange (data) ${lastStatus}: ${lastBody.slice(0, 500)}`,
  );
}

async function ensureCompanyId(
  supabase: SupabaseClient,
  name: string | null,
  rowIndex: number,
  errors: string[],
): Promise<string | null> {
  if (!name?.trim()) {
    errors.push(`Satır ${rowIndex}: Şirket adı boş`);
    return null;
  }
  const trimmed = name.trim();

  const { data: found, error: selErr } = await supabase
    .from("companies")
    .select("id")
    .eq("name", trimmed)
    .maybeSingle();

  if (selErr) {
    errors.push(`Satır ${rowIndex}: şirket sorgusu — ${selErr.message}`);
    return null;
  }
  if (found?.id) return found.id as string;

  const { data: inserted, error: insErr } = await supabase
    .from("companies")
    .insert({ name: trimmed, nimble_id: null })
    .select("id")
    .single();

  if (insErr) {
    errors.push(`Satır ${rowIndex}: şirket oluşturma "${trimmed}" — ${insErr.message}`);
    return null;
  }
  return inserted.id as string;
}

async function ensureTrainerId(
  supabase: SupabaseClient,
  name: string | null,
  rowIndex: number,
  errors: string[],
): Promise<string | null> {
  if (!name?.trim()) {
    errors.push(`Satır ${rowIndex}: Danışman adı boş`);
    return null;
  }
  const trimmed = name.trim();

  const { data: found, error: selErr } = await supabase
    .from("trainers")
    .select("id")
    .eq("name", trimmed)
    .maybeSingle();

  if (selErr) {
    errors.push(`Satır ${rowIndex}: danışman sorgusu — ${selErr.message}`);
    return null;
  }
  if (found?.id) return found.id as string;

  const { data: inserted, error: insErr } = await supabase
    .from("trainers")
    .insert({ name: trimmed })
    .select("id")
    .single();

  if (insErr) {
    errors.push(`Satır ${rowIndex}: danışman oluşturma "${trimmed}" — ${insErr.message}`);
    return null;
  }
  return inserted.id as string;
}

export async function GET() {
  const errors: string[] = [];
  let synced = 0;

  const sharedWithMeUser =
    process.env.MICROSOFT_GRAPH_SHARED_WITH_ME_USER?.trim() ||
    DEFAULT_SHARED_WITH_ME_USER;

  let supabase;
  try {
    supabase = createSupabaseAdmin();
  } catch (e) {
    const message = toErrorMessage(e) || "Supabase config error";
    return NextResponse.json({ synced: 0, errors: [message] }, { status: 500 });
  }

  try {
    const token = await getGraphAccessToken();
    const { driveId, itemId } = await findDataAnalizFromSharedWithMe(
      token,
      sharedWithMeUser,
    );
    const values = await getDataWorksheetUsedRange(token, driveId, itemId);

    const parsed = parseTrainingSheetRows(values);

    if (parsed.length === 0) {
      return NextResponse.json({ synced: 0, errors: [] });
    }

    for (let i = 0; i < parsed.length; i++) {
      const row = parsed[i]!;
      const rowNum = i + 2;

      const companyId = await ensureCompanyId(
        supabase,
        row.company_name,
        rowNum,
        errors,
      );
      const trainerId = await ensureTrainerId(
        supabase,
        row.trainer_name,
        rowNum,
        errors,
      );

      if (!companyId || !trainerId) {
        continue;
      }

      const importSignature = buildTrainingImportSignature(
        row,
        companyId,
        trainerId,
      );

      const payload = {
        company_id: companyId,
        trainer_id: trainerId,
        training_name: row.training_name,
        start_date: row.start_date,
        end_date: row.end_date,
        training_days: row.training_days,
        location: row.location,
        participant_count: row.participant_count,
        status: row.status,
        training_fee_tl: row.training_fee_tl,
        trainer_share_tl: row.trainer_share_tl,
        invoice_status: row.invoice_status,
        invoice_number: row.invoice_number,
        invoice_date: row.invoice_date,
        year: row.year,
        month: row.month,
        import_signature: importSignature,
      };

      const { error } = await supabase.from("trainings").upsert(payload, {
        onConflict: "import_signature",
      });

      if (error) {
        errors.push(`Satır ${rowNum}: kayıt — ${error.message}`);
        continue;
      }

      synced += 1;
    }

    return NextResponse.json({ synced, errors });
  } catch (e) {
    const message = toErrorMessage(e);
    console.error("[api/sync/onedrive]", message, e);
    errors.push(message);
    return NextResponse.json({ synced, errors }, { status: 500 });
  }
}
