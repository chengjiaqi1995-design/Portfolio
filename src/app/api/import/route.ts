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

    let total = 0;
    let matched = 0;
    let created = 0;
    let updated = 0;
    const unmatched: { bbgName: string }[] = [];

    for (const row of rows) {
      const bbgName = String(row["Underlying_Description"] ?? "").trim();
      const tickerBbg = String(row["BB Yellow Key"] ?? "").trim();
      const riskCountry = String(row["First Risk Country"] ?? "").trim();

      // Skip empty rows, "Total" summary rows, and the grand total row
      if (!tickerBbg || tickerBbg === "Total") continue;
      if (bbgName === "Total" || bbgName.startsWith("Applied filters")) continue;

      total++;

      // Support both old format ("NMV excl Cash & FX") and new format ("Latest NMV" / "Avg NMV")
      const nmvRaw = row["NMV excl Cash & FX"] ?? row["Latest NMV"] ?? row["Avg NMV"] ?? "0";
      const nmvExclCash = parseFloat(String(nmvRaw));

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

      // Try to find existing position by tickerBbg
      const existing = queryOne<PositionRow>(
        "SELECT * FROM Position WHERE tickerBbg = ?",
        [tickerBbg]
      );

      if (existing) {
        run(
          `UPDATE Position SET nameEn = ?, nameCn = ?, market = ?, longShort = ?,
           positionAmount = ?, positionWeight = ?, updatedAt = datetime('now')
           WHERE id = ?`,
          [
            bbgName || existing.nameEn,
            chineseName || existing.nameCn,
            market || existing.market,
            longShort,
            positionAmount,
            positionWeight,
            existing.id,
          ]
        );
        updated++;
      } else {
        run(
          `INSERT INTO Position (tickerBbg, nameEn, nameCn, market, longShort, positionAmount, positionWeight, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
          [tickerBbg, bbgName, chineseName, market, longShort, positionAmount, positionWeight]
        );
        created++;
      }
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
