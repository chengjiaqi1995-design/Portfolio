import { NextRequest, NextResponse } from "next/server";
import { queryOne, run } from "@/lib/db";

export async function GET() {
  const row = queryOne<{ value: string }>("SELECT value FROM AppSettings WHERE key = 'aum'");
  const aum = row ? parseFloat(row.value) : 10_000_000;
  return NextResponse.json({ aum });
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    if (typeof body.aum === "number" && body.aum > 0) {
      run("INSERT OR REPLACE INTO AppSettings (key, value) VALUES ('aum', ?)", [String(body.aum)]);
    }
    const row = queryOne<{ value: string }>("SELECT value FROM AppSettings WHERE key = 'aum'");
    const aum = row ? parseFloat(row.value) : 10_000_000;
    return NextResponse.json({ aum });
  } catch (error) {
    console.error("Failed to update settings:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
