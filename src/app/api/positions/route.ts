import { NextRequest, NextResponse } from "next/server";
import { getAllPositions, run, getPositionById, toPositionWithRelations } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const longShort = searchParams.get("longShort") || undefined;
    const search = searchParams.get("search") || undefined;

    const rows = getAllPositions({ longShort, search });
    const positions = rows.map(toPositionWithRelations);

    // --- Merge positions by company (nameEn) ---
    const companyMap = new Map<string, typeof positions[0]>();

    for (const pos of positions) {
      const key = pos.nameEn || pos.tickerBbg;
      const signedNmv = pos.longShort === "long" ? pos.positionAmount : -pos.positionAmount;

      if (companyMap.has(key)) {
        const existing = companyMap.get(key)!;
        // Sum signed NMV
        const existingSignedNmv = existing.longShort === "long" ? existing.positionAmount : -existing.positionAmount;
        const mergedNmv = existingSignedNmv + signedNmv;

        existing.tickerBbg = existing.tickerBbg + " / " + pos.tickerBbg;
        existing.positionAmount = Math.abs(mergedNmv);
        existing.longShort = mergedNmv > 0 ? "long" : mergedNmv < 0 ? "short" : "/";
        existing.positionWeight = existing.positionAmount; // Will be recalculated by frontend

        // Keep first non-null taxonomy assignments
        if (!existing.sectorId && pos.sectorId) { existing.sectorId = pos.sectorId; existing.sector = pos.sector; }
        if (!existing.themeId && pos.themeId) { existing.themeId = pos.themeId; existing.theme = pos.theme; }
        if (!existing.topdownId && pos.topdownId) { existing.topdownId = pos.topdownId; existing.topdown = pos.topdown; }
        if (!existing.gicIndustry && pos.gicIndustry) existing.gicIndustry = pos.gicIndustry;
        if (!existing.exchangeCountry && pos.exchangeCountry) existing.exchangeCountry = pos.exchangeCountry;
        if (!existing.nameCn && pos.nameCn) existing.nameCn = pos.nameCn;
      } else {
        companyMap.set(key, { ...pos });
      }
    }

    const mergedPositions = [...companyMap.values()];

    return NextResponse.json(mergedPositions);
  } catch (error) {
    console.error("Failed to fetch positions:", error);
    return NextResponse.json(
      { error: "Failed to fetch positions" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const result = run(
      `INSERT INTO Position (tickerBbg, nameEn, nameCn, market, sectorId, themeId, topdownId,
        priority, longShort, marketCapLocal, marketCapRmb, profit2025, pe2026, pe2027,
        priceTag, positionAmount, positionWeight)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        body.tickerBbg,
        body.nameEn ?? "",
        body.nameCn ?? "",
        body.market ?? "",
        body.sectorId ?? null,
        body.themeId ?? null,
        body.topdownId ?? null,
        body.priority ?? "",
        body.longShort ?? "/",
        body.marketCapLocal ?? 0,
        body.marketCapRmb ?? 0,
        body.profit2025 ?? 0,
        body.pe2026 ?? 0,
        body.pe2027 ?? 0,
        body.priceTag ?? "",
        body.positionAmount ?? 0,
        body.positionWeight ?? 0,
      ]
    );

    const created = getPositionById(Number(result.lastInsertRowid));
    return NextResponse.json(created ? toPositionWithRelations(created) : { id: result.lastInsertRowid }, { status: 201 });
  } catch (error) {
    console.error("Failed to create position:", error);
    return NextResponse.json(
      { error: "Failed to create position" },
      { status: 500 }
    );
  }
}
