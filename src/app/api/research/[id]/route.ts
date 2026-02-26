import { NextRequest, NextResponse } from "next/server";
import { queryOne, run, getPositionById, toPositionWithRelations, type ResearchRow, type PositionRow } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const research = queryOne<ResearchRow>(
      "SELECT * FROM CompanyResearch WHERE id = ?",
      [parseInt(id)]
    );

    if (!research) {
      return NextResponse.json({ error: "Research not found" }, { status: 404 });
    }

    const posRow = getPositionById(research.positionId);

    return NextResponse.json({
      ...research,
      position: posRow ? toPositionWithRelations(posRow) : null,
    });
  } catch (error) {
    console.error("Failed to fetch research:", error);
    return NextResponse.json({ error: "Failed to fetch research" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const allowed = [
      "strategy", "tam", "competition", "valueProposition", "longTermFactors",
      "outlook3to5y", "businessQuality", "trackingData", "valuation",
      "revenueDownstream", "revenueProduct", "revenueCustomer", "profitSplit",
      "leverage", "peerComparison", "costStructure", "equipment", "notes",
    ];

    const fields: string[] = [];
    const values: unknown[] = [];

    for (const key of allowed) {
      if (body[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(body[key]);
      }
    }

    if (fields.length > 0) {
      fields.push("updatedAt = datetime('now')");
      values.push(parseInt(id));
      run(`UPDATE CompanyResearch SET ${fields.join(", ")} WHERE id = ?`, values);
    }

    const updated = queryOne<ResearchRow>("SELECT * FROM CompanyResearch WHERE id = ?", [parseInt(id)]);
    const posRow = updated ? getPositionById(updated.positionId) : null;

    return NextResponse.json({
      ...updated,
      position: posRow ? toPositionWithRelations(posRow) : null,
    });
  } catch (error) {
    console.error("Failed to update research:", error);
    return NextResponse.json({ error: "Failed to update research" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const positionId = parseInt(id);
    const body = await request.json();

    const position = queryOne<PositionRow>("SELECT * FROM Position WHERE id = ?", [positionId]);
    if (!position) {
      return NextResponse.json({ error: "Position not found" }, { status: 404 });
    }

    const existing = queryOne<ResearchRow>(
      "SELECT * FROM CompanyResearch WHERE positionId = ?",
      [positionId]
    );
    if (existing) {
      return NextResponse.json(
        { error: "Research already exists for this position. Use PUT to update." },
        { status: 409 }
      );
    }

    const result = run(
      `INSERT INTO CompanyResearch (positionId, strategy, tam, competition, valueProposition,
        longTermFactors, outlook3to5y, businessQuality, trackingData, valuation,
        revenueDownstream, revenueProduct, revenueCustomer, profitSplit,
        leverage, peerComparison, costStructure, equipment, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        positionId,
        body.strategy ?? "", body.tam ?? "", body.competition ?? "",
        body.valueProposition ?? "", body.longTermFactors ?? "", body.outlook3to5y ?? "",
        body.businessQuality ?? "", body.trackingData ?? "", body.valuation ?? "",
        body.revenueDownstream ?? "", body.revenueProduct ?? "", body.revenueCustomer ?? "",
        body.profitSplit ?? "", body.leverage ?? "", body.peerComparison ?? "",
        body.costStructure ?? "", body.equipment ?? "", body.notes ?? "",
      ]
    );

    const created = queryOne<ResearchRow>("SELECT * FROM CompanyResearch WHERE id = ?", [
      Number(result.lastInsertRowid),
    ]);
    const posRow = getPositionById(positionId);

    return NextResponse.json(
      { ...created, position: posRow ? toPositionWithRelations(posRow) : null },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create research:", error);
    return NextResponse.json({ error: "Failed to create research" }, { status: 500 });
  }
}
