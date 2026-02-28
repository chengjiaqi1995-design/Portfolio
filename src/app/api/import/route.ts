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

    // Debug: capture the actual column headers from Excel
    const excelColumns = rows.length > 0 ? Object.keys(rows[0]) : [];
    const debugSamples: { ticker: string; gic: string; exchange: string; risk: string }[] = [];

    // Helper: find a column value by case-insensitive substring match on the key
    function findColumn(row: Record<string, unknown>, ...keywords: string[]): string {
      for (const key of Object.keys(row)) {
        const lk = key.toLowerCase().trim();
        if (keywords.every(kw => lk.includes(kw.toLowerCase()))) {
          return String(row[key] ?? "").trim();
        }
      }
      return "";
    }

    let total = 0;
    let matched = 0;
    let created = 0;
    let updated = 0;
    const unmatched: { bbgName: string }[] = [];
    const zeroNmvTickers: { ticker: string; nmvRaw: string; nmvParsed: number }[] = [];
    // Track tickers that already have valid NMV data — prevents a later duplicate row 
    // (with missing NMV columns) from overwriting correct position data back to zero.
    const importedWithNmv = new Set<string>();

    for (const row of rows) {
      const bbgName = findColumn(row, "underlying") || String(row["Underlying_Description"] ?? "").trim();
      const tickerBbg = findColumn(row, "yellow key") || findColumn(row, "bb yellow") || String(row["BB Yellow Key"] ?? "").trim();
      const riskCountry = findColumn(row, "risk country");
      const gicIndustry = findColumn(row, "gic", "industry");
      const exchangeCountry = findColumn(row, "exchange", "country");
      const pnlRaw = findColumn(row, "pnl") || findColumn(row, "p&l") || findColumn(row, "unrealized");
      const pnl = parseFloat(pnlRaw.replace(/,/g, '')) || 0;

      // Skip empty rows, "Total" summary rows, and the grand total row
      if (!tickerBbg || tickerBbg === "Total") continue;
      if (bbgName === "Total" || bbgName.startsWith("Applied filters")) continue;

      total++;

      // Collect debug samples (first 3 rows) to verify column matching
      if (debugSamples.length < 3) {
        debugSamples.push({ ticker: tickerBbg, gic: gicIndustry, exchange: exchangeCountry, risk: riskCountry });
      }

      // STRICTLY use Latest NMV. 
      // Many times Excel column headers have hidden spaces like "Latest NMV " or " Latest NMV".
      // We explicitly search the object keys to find the one that includes "latest nmv", case insensitive.
      let nmvRaw: unknown = "0";
      let nmvColumnName = "(not found)";
      for (const key of Object.keys(row)) {
        if (key.toLowerCase().includes("latest nmv")) {
          nmvRaw = row[key];
          nmvColumnName = key;
          break;
        }
      }

      // If absolutely no 'Latest NMV' variation is found, we fall back ONLY to the oldest format "NMV excl Cash & FX"
      // We NEVER fall back to "Avg NMV" as that causes mathematical errors.
      if (nmvRaw === "0") {
        for (const key of Object.keys(row)) {
          if (key.toLowerCase().includes("nmv excl cash")) {
            nmvRaw = row[key];
            nmvColumnName = key;
            break;
          }
        }
      }

      // Try broader NMV fallback — match any column containing just "nmv" (but not "avg")
      if (nmvRaw === "0") {
        for (const key of Object.keys(row)) {
          const lk = key.toLowerCase();
          if (lk.includes("nmv") && !lk.includes("avg")) {
            nmvRaw = row[key];
            nmvColumnName = key;
            break;
          }
        }
      }

      const nmvExclCash = parseFloat(String(nmvRaw).replace(/,/g, ''));

      // Skip duplicate rows: if this ticker was already imported with valid NMV,
      // don't let a second row (with missing NMV columns) overwrite it back to zero.
      if ((isNaN(nmvExclCash) || nmvExclCash === 0) && importedWithNmv.has(tickerBbg)) {
        continue;
      }

      // Read Avg NMV to determine long/short direction for closed positions (Latest NMV = 0)
      let avgNmv = 0;
      for (const key of Object.keys(row)) {
        if (key.toLowerCase().includes("avg nmv")) {
          avgNmv = parseFloat(String(row[key]).replace(/,/g, '')) || 0;
          break;
        }
      }

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
      // When Latest NMV is 0 (closed position), use Avg NMV to determine direction
      else if (nmvExclCash === 0 && avgNmv !== 0) {
        longShort = avgNmv > 0 ? "long" : "short";
      }

      const positionAmount = Math.abs(nmvExclCash);
      const positionWeight = positionAmount / AUM;
      const market = riskCountry;

      // Track zero-NMV positions for debugging
      if (isNaN(nmvExclCash) || nmvExclCash === 0) {
        zeroNmvTickers.push({ ticker: tickerBbg, nmvRaw: String(nmvRaw), nmvParsed: nmvExclCash });
      }

      run(
        `INSERT INTO Position (
           tickerBbg, nameEn, nameCn, market, longShort, positionAmount, positionWeight, 
           gicIndustry, exchangeCountry, pnl, createdAt, updatedAt
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
         ON CONFLICT(tickerBbg) DO UPDATE SET
           nameEn = excluded.nameEn,
           nameCn = excluded.nameCn,
           market = excluded.market,
           longShort = excluded.longShort,
           positionAmount = excluded.positionAmount,
           positionWeight = excluded.positionWeight,
           gicIndustry = excluded.gicIndustry,
           exchangeCountry = excluded.exchangeCountry,
           pnl = excluded.pnl,
           updatedAt = datetime('now')`,
        [
          tickerBbg, bbgName, chineseName, market, longShort, positionAmount, positionWeight,
          gicIndustry, exchangeCountry, pnl
        ]
      );

      // Remember tickers that have valid NMV so duplicate rows don't overwrite them
      if (!isNaN(nmvExclCash) && nmvExclCash !== 0) {
        importedWithNmv.add(tickerBbg);
      }
      // We assume it's an update for logic simplicity, though it could be new
      updated++;
    }

    // Create import history record
    run(
      "INSERT INTO ImportHistory (importType, fileName, recordCount, newCount, updatedCount) VALUES (?, ?, ?, ?, ?)",
      ["positions", file.name, total, created, updated]
    );

    return NextResponse.json({ total, matched, unmatched, created, updated, excelColumns, debugSamples, zeroNmvTickers });
  } catch (error) {
    console.error("Failed to import positions:", error);
    return NextResponse.json(
      { error: "Failed to import positions" },
      { status: 500 }
    );
  }
}
