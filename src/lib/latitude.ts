import { parse } from "csv-parse/sync";

export type LatitudeRow = { occurred_on: string; description: string; amount_minor: number; currency: "AUD"; source_transaction_key: string };
export type ParsedLatitudeRow = Omit<LatitudeRow, "source_transaction_key"> & { external_id: string | null };

function parseAmount(value: string): number {
  const trimmed = value.trim();
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(trimmed)) throw new Error("Amount must be a signed decimal with at most two places.");
  const [whole, decimal = ""] = trimmed.split(".");
  const negative = whole.startsWith("-");
  const cents = Number(whole.replace("-", "")) * 100 + Number(decimal.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents === 0) throw new Error("Amount is invalid or zero.");
  return negative ? -cents : cents;
}

export function parseLatitudeCsv(input: string): ParsedLatitudeRow[] {
  const records = parse(input, { columns: true, bom: true, skip_empty_lines: true, trim: true, relax_quotes: false }) as Record<string, string>[];
  if (!records.length || records.length > 5000) throw new Error("CSV must contain 1 to 5000 transactions.");
  const keys = Object.keys(records[0]);
  if (!["date", "description", "amount"].every((key) => keys.includes(key))) throw new Error("CSV needs date, description, and amount columns.");
  return records.map((record, index) => {
    const date = record.date?.trim();
    const description = record.description?.trim();
    const currency = (record.currency || "AUD").toUpperCase();
    const parsedDate = new Date(`${date}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) throw new Error(`Row ${index + 2}: use a valid YYYY-MM-DD date.`);
    if (!description || description.length > 500) throw new Error(`Row ${index + 2}: description is required (max 500 characters).`);
    if (currency !== "AUD") throw new Error(`Row ${index + 2}: only AUD is supported in this first import.`);
    return { occurred_on: date, description, amount_minor: parseAmount(record.amount ?? ""), currency: "AUD", external_id: record.external_id?.trim() || null };
  });
}
