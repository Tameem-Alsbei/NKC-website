import { describe, expect, it } from "vitest";
import { escapeCsvCell, toCsv } from "@/lib/csv";

describe("escapeCsvCell", () => {
  it("neutralizes spreadsheet formulas", () => {
    expect(escapeCsvCell("=HYPERLINK(\"http://evil\")")).toBe(`"'=HYPERLINK(""http://evil"")"`);
    expect(escapeCsvCell("+1 614 555 0101")).toBe("'+1 614 555 0101");
    expect(escapeCsvCell("-2+3")).toBe("'-2+3");
    expect(escapeCsvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(escapeCsvCell("\tcmd")).toBe("'\tcmd");
  });

  it("quotes separators, quotes and newlines", () => {
    expect(escapeCsvCell("Haddad, Layla")).toBe('"Haddad, Layla"');
    expect(escapeCsvCell('She said "hi"')).toBe('"She said ""hi"""');
    expect(escapeCsvCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("leaves plain values and numbers alone", () => {
    expect(escapeCsvCell("Layla")).toBe("Layla");
    expect(escapeCsvCell(-25)).toBe("-25");
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(true)).toBe("true");
  });
});

describe("toCsv", () => {
  it("adds a BOM and CRLF line endings", () => {
    expect(toCsv(["a", "b"], [["1", "2"]])).toBe("﻿a,b\r\n1,2\r\n");
  });
});
