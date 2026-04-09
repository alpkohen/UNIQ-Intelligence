import { createHash } from "crypto";
import {
  parseCellDate,
  parseCellInt,
  parseCellNumber,
} from "@/lib/excel";

/** Raw row parsed from Excel (headers in first row). */
export type ParsedTrainingRow = {
  company_name: string | null;
  trainer_name: string | null;
  training_name: string | null;
  start_date: string | null;
  end_date: string | null;
  training_days: number | null;
  location: string | null;
  participant_count: number | null;
  status: string | null;
  training_fee_tl: number | null;
  trainer_share_tl: number | null;
  invoice_status: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  year: number | null;
  month: number | null;
};

type HeaderKey = keyof ParsedTrainingRow;

/** Multiple possible header labels (after normalizeHeader) for the same field. */
const HEADER_ALIASES: { matches: string[]; key: HeaderKey }[] = [
  { matches: ["ŞİRKET ADI"], key: "company_name" },
  { matches: ["DANIŞMAN ADI"], key: "trainer_name" },
  { matches: ["EĞİTİM ADI"], key: "training_name" },
  { matches: ["BAŞLANGIÇ TARİHİ"], key: "start_date" },
  { matches: ["BİTİŞ TARİHİ"], key: "end_date" },
  {
    matches: [
      "EĞİTİM GÜN SAYISI",
      "EĞİTİM GÜN SAYISI BI İÇİN GÜN SAYISI",
      "EĞİTİM GÜN SAYISI BI için GÜN SAYISI",
    ],
    key: "training_days",
  },
  { matches: ["EĞİTİM YERİ"], key: "location" },
  { matches: ["EĞİTİM KİŞİ SAYISI"], key: "participant_count" },
  { matches: ["DURUM"], key: "status" },
  { matches: ["EĞİTİM BEDELİ (TL)"], key: "training_fee_tl" },
  { matches: ["DANIŞMAN PAYI (TL.)", "DANIŞMAN PAYI (TL)"], key: "trainer_share_tl" },
  { matches: ["FATURA DURUMU"], key: "invoice_status" },
  { matches: ["FATURA NUMARASI"], key: "invoice_number" },
  { matches: ["FATURA TARİHİ"], key: "invoice_date" },
  { matches: ["YIL"], key: "year" },
  { matches: ["AY2", "AY"], key: "month" },
];

function normalizeHeader(s: string): string {
  return s
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleUpperCase("tr-TR");
}

function cellText(v: unknown): string | null {
  if (v == null || v === "") return null;
  return String(v).trim() || null;
}

function resolveColumnMap(headerRow: string[]): Map<HeaderKey, number> {
  const normalized = headerRow.map((c) => normalizeHeader(String(c ?? "")));
  const colIndex = new Map<HeaderKey, number>();

  for (const { matches, key } of HEADER_ALIASES) {
    for (const m of matches) {
      const target = normalizeHeader(m);
      const idx = normalized.findIndex((h) => h === target);
      if (idx >= 0) {
        colIndex.set(key, idx);
        break;
      }
    }
  }

  return colIndex;
}

export function parseTrainingSheetRows(values: unknown[][]): ParsedTrainingRow[] {
  if (!values.length) return [];

  const headerRow = values[0].map((c) => String(c ?? ""));
  const colIndex = resolveColumnMap(headerRow);
  const out: ParsedTrainingRow[] = [];

  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (!Array.isArray(row)) continue;

    const get = (key: HeaderKey) => {
      const idx = colIndex.get(key);
      if (idx == null || idx >= row.length) return null;
      return row[idx];
    };

    const rawStart = get("start_date");
    const rawEnd = get("end_date");
    const rawInvoiceDate = get("invoice_date");

    const base: ParsedTrainingRow = {
      company_name: cellText(get("company_name")),
      trainer_name: cellText(get("trainer_name")),
      training_name: cellText(get("training_name")),
      start_date: parseCellDate(rawStart),
      end_date: parseCellDate(rawEnd),
      training_days: parseCellNumber(get("training_days")),
      location: cellText(get("location")),
      participant_count: parseCellInt(get("participant_count")),
      status: cellText(get("status")),
      training_fee_tl: parseCellNumber(get("training_fee_tl")),
      trainer_share_tl: parseCellNumber(get("trainer_share_tl")),
      invoice_status: cellText(get("invoice_status")),
      invoice_number: cellText(get("invoice_number")),
      invoice_date: parseCellDate(rawInvoiceDate),
      year: parseCellInt(get("year")),
      month: parseCellInt(get("month")),
    };

    if (
      !base.company_name &&
      !base.training_name &&
      !base.start_date &&
      !base.end_date
    ) {
      continue;
    }

    out.push(base);
  }

  return out;
}

export function buildTrainingImportSignature(
  row: ParsedTrainingRow,
  companyId: string,
  trainerId: string,
): string {
  const payload = JSON.stringify({
    company_id: companyId,
    trainer_id: trainerId,
    training_name: row.training_name,
    start_date: row.start_date,
    end_date: row.end_date,
    location: row.location,
    invoice_number: row.invoice_number,
  });
  return createHash("sha256").update(payload, "utf8").digest("hex");
}
