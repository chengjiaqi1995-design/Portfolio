import { NextResponse } from "next/server";
import { queryAll, getPositionById, toPositionWithRelations, type ResearchRow } from "@/lib/db";

export async function GET() {
  try {
    const researchList = queryAll<ResearchRow>(
      "SELECT * FROM CompanyResearch ORDER BY updatedAt DESC"
    );

    const result = researchList.map((r) => {
      const posRow = getPositionById(r.positionId);
      return {
        ...r,
        position: posRow ? toPositionWithRelations(posRow) : null,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch research:", error);
    return NextResponse.json(
      { error: "Failed to fetch research" },
      { status: 500 }
    );
  }
}
