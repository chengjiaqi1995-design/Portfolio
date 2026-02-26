import { NextResponse } from "next/server";
import { queryAll, type ImportHistoryRow } from "@/lib/db";

export async function GET() {
  try {
    const history = queryAll<ImportHistoryRow>(
      "SELECT * FROM ImportHistory ORDER BY createdAt DESC LIMIT 50"
    );
    return NextResponse.json(history);
  } catch (error) {
    console.error("Failed to fetch import history:", error);
    return NextResponse.json(
      { error: "Failed to fetch import history" },
      { status: 500 }
    );
  }
}
