/**
 * CSV generation for admin exports.
 *
 * Spreadsheet apps execute cells that start with = + - @ (and tab/CR) as
 * formulas, which can be abused ("CSV injection"). Such cells are prefixed
 * with an apostrophe so they are always treated as text, following the OWASP
 * recommendation. Cells are quoted when they contain separators or quotes.
 */
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

export type CsvValue = string | number | boolean | null | undefined;

export function escapeCsvCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (typeof value === "string" && FORMULA_TRIGGER.test(text)) text = `'${text}`;
  if (/[",\r\n]/.test(text) || text !== text.trim()) {
    text = `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/** Builds a CSV document (UTF-8 BOM + CRLF line endings, which Excel expects). */
export function toCsv(headers: readonly string[], rows: readonly (readonly CsvValue[])[]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(","));
  return `﻿${lines.join("\r\n")}\r\n`;
}
