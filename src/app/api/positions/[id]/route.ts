import { NextRequest, NextResponse } from "next/server";
import { getPositionById, queryAll, queryOne, run, toPositionWithRelations, type NameMappingRow, type PositionRow, type ResearchRow } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const row = getPositionById(parseInt(id));

    if (!row) {
      return NextResponse.json(
        { error: "Position not found" },
        { status: 404 }
      );
    }

    const position = toPositionWithRelations(row);

    const research = queryAll<ResearchRow>(
      "SELECT * FROM CompanyResearch WHERE positionId = ?",
      [parseInt(id)]
    );
    const nameMappings = queryAll<NameMappingRow>(
      "SELECT * FROM NameMapping WHERE positionId = ?",
      [parseInt(id)]
    );

    return NextResponse.json({ ...position, research, nameMappings });
  } catch (error) {
    console.error("Failed to fetch position:", error);
    return NextResponse.json(
      { error: "Failed to fetch position" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const fields: string[] = [];
    const values: unknown[] = [];

    const allowed = [
      "tickerBbg", "nameEn", "nameCn", "market", "sectorId", "themeId", "topdownId",
      "priority", "longShort", "marketCapLocal", "marketCapRmb", "profit2025",
      "pe2026", "pe2027", "priceTag", "positionAmount", "positionWeight", "marketCapDate",
    ];

    for (const key of allowed) {
      if (body[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(body[key]);
      }
    }

    if (fields.length > 0) {
      fields.push("updatedAt = datetime('now')");
      values.push(parseInt(id));
      run(`UPDATE Position SET ${fields.join(", ")} WHERE id = ?`, values);

      // Propagate priority/taxonomy changes to all positions with the same tickerBbg
      const propagateFields = ["priority", "sectorId", "themeId", "topdownId"];
      const propFields: string[] = [];
      const propValues: unknown[] = [];
      for (const key of propagateFields) {
        if (body[key] !== undefined) {
          propFields.push(`${key} = ?`);
          propValues.push(body[key]);
        }
      }
      if (propFields.length > 0) {
        const pos = queryOne<PositionRow>("SELECT tickerBbg FROM Position WHERE id = ?", [parseInt(id)]);
        if (pos) {
          propFields.push("updatedAt = datetime('now')");
          propValues.push(pos.tickerBbg, parseInt(id));
          run(`UPDATE Position SET ${propFields.join(", ")} WHERE tickerBbg = ? AND id != ?`, propValues);
        }
      }
    }

    const updated = getPositionById(parseInt(id));
    return NextResponse.json(updated ? toPositionWithRelations(updated) : {});
  } catch (error) {
    console.error("Failed to update position:", error);
    return NextResponse.json(
      { error: "Failed to update position" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    run("DELETE FROM Position WHERE id = ?", [parseInt(id)]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete position:", error);
    return NextResponse.json(
      { error: "Failed to delete position" },
      { status: 500 }
    );
  }
}
