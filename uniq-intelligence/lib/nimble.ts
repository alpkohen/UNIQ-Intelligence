type NimbleFields = Record<string, Array<{ value?: unknown; label?: string }>>;

function firstFieldValue(
  fields: NimbleFields | undefined,
  ...names: string[]
): string | null {
  if (!fields) return null;
  for (const name of names) {
    const arr = fields[name];
    if (Array.isArray(arr) && arr[0] && arr[0].value != null) {
      return String(arr[0].value);
    }
  }
  return null;
}

export function parseNimbleCompany(contact: {
  id?: string;
  record_type?: string;
  fields?: NimbleFields;
}): { nimble_id: string; name: string } | null {
  if (contact.record_type !== "company" || !contact.id) return null;
  const name =
    firstFieldValue(contact.fields, "company name") ??
    firstFieldValue(contact.fields, "Company Name") ??
    "Unnamed company";
  return { nimble_id: contact.id, name };
}

export function parseNimbleDeal(deal: Record<string, unknown>): {
  nimble_deal_id: string;
  title: string;
  value: number | null;
  stage: string | null;
  status: string | null;
} | null {
  const id = deal.id != null ? String(deal.id) : "";
  if (!id) return null;

  let title =
    (typeof deal.name === "string" && deal.name) ||
    (typeof deal.title === "string" && deal.title) ||
    "";

  let value: number | null = null;
  let stage: string | null = null;
  let status: string | null = null;

  const rawValue = deal.amount ?? deal.value ?? deal.deal_value;
  if (typeof rawValue === "number") value = rawValue;
  else if (typeof rawValue === "string" && rawValue.trim() !== "") {
    const n = Number(rawValue.replace(/,/g, ""));
    value = Number.isFinite(n) ? n : null;
  }

  if (typeof deal.stage === "string") stage = deal.stage;
  else if (typeof deal.pipeline_stage === "string") stage = deal.pipeline_stage;
  else if (typeof deal.stage_name === "string") stage = deal.stage_name;

  if (typeof deal.status === "string") status = deal.status;
  else if (typeof deal.deal_status === "string") status = deal.deal_status;

  const fields = deal.fields as NimbleFields | undefined;
  if (fields) {
    title =
      firstFieldValue(fields, "deal name", "Deal Name", "name") || title;
    if (value == null) {
      const v = firstFieldValue(fields, "amount", "value", "Amount");
      if (v) {
        const n = Number(String(v).replace(/,/g, ""));
        if (Number.isFinite(n)) value = n;
      }
    }
    stage =
      stage ??
      firstFieldValue(fields, "stage", "Stage", "pipeline stage") ??
      null;
    status =
      status ?? firstFieldValue(fields, "status", "Status") ?? null;
  }

  if (!title) title = `Deal ${id}`;

  return { nimble_deal_id: id, title, value, stage, status };
}
