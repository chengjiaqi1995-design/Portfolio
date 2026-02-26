import { NextRequest, NextResponse } from "next/server";
import { getAllPositions, run, getPositionById, toPositionWithRelations } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const longShort = searchParams.get("longShort") || undefined;
    const search = searchParams.get("search") || undefined;

    const rows = getAllPositions({ longShort, search });
    const positions = rows.map(toPositionWithRelations);

    return NextResponse.json(positions);
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
