import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import {
  buildTrainingImportSignature,
  parseTrainingSheetRows,
} from "@/lib/training-sheet";

const GRAPH_OWNER_EMAIL = "uniqegitim@outlook.com";

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

function userBaseUrl(email: string): string {
  return `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(email)}`;
}

async function findDataAnalizWorkbook(
  token: string,
  email: string,
): Promise<{ id: string; name: string }> {
  const base = userBaseUrl(email);
  const searchUrl = `${base}/drive/root/search(q='Data_analiz')`;
  const res = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Graph search ${res.status}: ${t.slice(0, 500)}`);
  }

  const json = (await res.json()) as {
    value?: Array<{ id?: string; name?: string }>;
  };
  const items = json.value ?? [];

  const match =
    items.find(
      (i) =>
        i.name &&
        /Data_analiz/i.test(i.name) &&
        /\.(xlsx|xlsm|xlsb|xls)$/i.test(i.name),
    ) ?? items.find((i) => i.name && /Data_analiz/i.test(i.name));

  if (!match?.id || !match.name) {
    throw new Error(
      'No Excel workbook matching "Data_analiz" found in OneDrive search results',
    );
  }

  return { id: match.id, name: match.name };
}

async function getDataWorksheetUsedRange(
  token: string,
  email: string,
  itemId: string,
): Promise<unknown[][]> {
  const base = userBaseUrl(email);
  const urls = [
    `${base}/drive/items/${itemId}/workbook/worksheets/data/usedRange`,
    `${base}/drive/items/${itemId}/workbook/worksheets('data')/usedRange`,
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

  let supabase;
  try {
    supabase = createSupabaseAdmin();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Supabase config error";
    return NextResponse.json({ synced: 0, errors: [message] }, { status: 500 });
  }

  try {
    const token = await getGraphAccessToken();
    const workbook = await findDataAnalizWorkbook(token, GRAPH_OWNER_EMAIL);
    const values = await getDataWorksheetUsedRange(
      token,
      GRAPH_OWNER_EMAIL,
      workbook.id,
    );

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
    const message = e instanceof Error ? e.message : "OneDrive sync failed";
    errors.push(message);
    return NextResponse.json({ synced, errors }, { status: 500 });
  }
}
