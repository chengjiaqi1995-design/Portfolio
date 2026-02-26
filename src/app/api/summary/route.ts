import { NextResponse } from "next/server";
import { getPortfolioSummary } from "@/lib/db";

export async function GET() {
  try {
    const summary = getPortfolioSummary();
    return NextResponse.json(summary);
  } catch (error) {
    console.error("Failed to compute portfolio summary:", error);
    return NextResponse.json(
      { error: "Failed to compute portfolio summary" },
      { status: 500 }
    );
  }
}
