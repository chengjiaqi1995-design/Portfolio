import { NextRequest, NextResponse } from "next/server";
import { getAum, queryAll, queryOne, run, type NameMappingRow, type PositionRow } from "@/lib/db";
import * as XLSX from "xlsx";

export async function POST(request: NextRequest) {
  try {
    const AUM = getAum();
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

    // Get all name mappings for matching
    const nameMappings = queryAll<NameMappingRow>("SELECT * FROM NameMapping");
    const nameMap = new Map(nameMappings.map((m) => [m.bbgName.toLowerCase(), m]));

    // Reset all existing active positions to 0 (watchlist state) before import.
    // This prevents ghost positions (sold stocks not in the new file) from accumulating and causing duplicate calculations.
    run(`UPDATE Position SET longShort = '/', positionAmount = 0, positionWeight = 0 WHERE longShort IN ('long', 'short')`);

    let total = 0;
    let matched = 0;
    let created = 0;
    let updated = 0;
    const unmatched: { bbgName: string }[] = [];

    for (const row of rows) {
      const bbgName = String(row["Underlying_Description"] ?? "").trim();
      const tickerBbg = String(row["BB Yellow Key"] ?? "").trim();
      const riskCountry = String(row["First Risk Country"] ?? "").trim();
      const gicIndustry = String(row["First GIC industry"] ?? "").trim();
      const exchangeCountry = String(row["First exchange country"] ?? "").trim();

      // Skip empty rows, "Total" summary rows, and the grand total row
      if (!tickerBbg || tickerBbg === "Total") continue;
      if (bbgName === "Total" || bbgName.startsWith("Applied filters")) continue;

      total++;

      // STRICTLY use Latest NMV. 
      // Many times Excel column headers have hidden spaces like "Latest NMV " or " Latest NMV".
      // We explicitly search the object keys to find the one that includes "latest nmv", case insensitive.
      let nmvRaw: unknown = "0";
      for (const key of Object.keys(row)) {
        if (key.toLowerCase().includes("latest nmv")) {
          nmvRaw = row[key];
          break;
        }
      }

      // If absolutely no 'Latest NMV' variation is found, we fall back ONLY to the oldest format "NMV excl Cash & FX"
      // We NEVER fall back to "Avg NMV" as that causes mathematical errors.
      if (nmvRaw === "0") {
        for (const key of Object.keys(row)) {
          if (key.toLowerCase().includes("nmv excl cash")) {
            nmvRaw = row[key];
            break;
          }
        }
      }

      const nmvExclCash = parseFloat(String(nmvRaw).replace(/,/g, ''));

      const mapping = nameMap.get(bbgName.toLowerCase());
      const chineseName = mapping ? mapping.chineseName : "";

      if (mapping) {
        matched++;
      } else if (!unmatched.some((u) => u.bbgName === bbgName)) {
        unmatched.push({ bbgName });
      }

      let longShort = "/";
      if (nmvExclCash > 0) longShort = "long";
      else if (nmvExclCash < 0) longShort = "short";

      const positionAmount = Math.abs(nmvExclCash);
      const positionWeight = positionAmount / AUM;
      const market = riskCountry;

      run(
        `INSERT INTO Position (
           tickerBbg, nameEn, nameCn, market, longShort, positionAmount, positionWeight, 
           gicIndustry, exchangeCountry, createdAt, updatedAt
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
         ON CONFLICT(tickerBbg) DO UPDATE SET
           nameEn = excluded.nameEn,
           nameCn = excluded.nameCn,
           market = excluded.market,
           longShort = excluded.longShort,
           positionAmount = excluded.positionAmount,
           positionWeight = excluded.positionWeight,
           gicIndustry = excluded.gicIndustry,
           exchangeCountry = excluded.exchangeCountry,
           updatedAt = datetime('now')`,
        [
          tickerBbg, bbgName, chineseName, market, longShort, positionAmount, positionWeight,
          gicIndustry, exchangeCountry
        ]
      );
      // We assume it's an update for logic simplicity, though it could be new
      updated++;
    }

    // Create import history record
    run(
      "INSERT INTO ImportHistory (importType, fileName, recordCount, newCount, updatedCount) VALUES (?, ?, ?, ?, ?)",
      ["positions", file.name, total, created, updated]
    );

    return NextResponse.json({ total, matched, unmatched, created, updated });
  } catch (error) {
    console.error("Failed to import positions:", error);
    return NextResponse.json(
      { error: "Failed to import positions" },
      { status: 500 }
    );
  }
}
