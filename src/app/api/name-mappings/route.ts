import { NextRequest, NextResponse } from "next/server";
import { queryAll, queryOne, run, type NameMappingRow } from "@/lib/db";

export async function GET() {
  try {
    const mappings = queryAll<NameMappingRow>(
      "SELECT * FROM NameMapping ORDER BY bbgName ASC"
    );

    return NextResponse.json(mappings);
  } catch (error) {
    console.error("Failed to fetch name mappings:", error);
    return NextResponse.json(
      { error: "Failed to fetch name mappings" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const result = run(
      "INSERT INTO NameMapping (bbgName, chineseName, positionId) VALUES (?, ?, ?)",
      [body.bbgName, body.chineseName, body.positionId ?? null]
    );

    const created = queryOne<NameMappingRow>("SELECT * FROM NameMapping WHERE id = ?", [
      Number(result.lastInsertRowid),
    ]);

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Failed to create name mapping:", error);
    return NextResponse.json(
      { error: "Failed to create name mapping" },
      { status: 500 }
    );
  }
}
