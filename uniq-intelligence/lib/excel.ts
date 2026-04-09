/** Excel serial (days since 1899-12-30) → ISO date yyyy-mm-dd */
export function excelSerialToIsoDate(serial: number): string {
  const ms = Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}

export function parseCellDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return excelSerialToIsoDate(value);
  }
  const s = String(value).trim();
  if (!s) return null;
  const t = Date.parse(s);
  if (!Number.isNaN(t)) {
    return new Date(t).toISOString().slice(0, 10);
  }
  const n = Number(s.replace(/,/g, ""));
  if (Number.isFinite(n) && n > 20000) {
    return excelSerialToIsoDate(n);
  }
  return null;
}

export function parseCellNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const n = Number(String(value).replace(/,/g, "").replace(/\s/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function parseCellInt(value: unknown): number | null {
  const n = parseCellNumber(value);
  if (n == null) return null;
  return Math.round(n);
}
