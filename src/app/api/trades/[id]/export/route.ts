import { NextRequest, NextResponse } from "next/server";
import { queryOne, queryAll, type TradeRow, type TradeItemRow } from "@/lib/db";
import * as XLSX from "xlsx";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const trade = queryOne<TradeRow>("SELECT * FROM Trade WHERE id = ?", [parseInt(id)]);

    if (!trade) {
      return NextResponse.json({ error: "Trade not found" }, { status: 404 });
    }

    const items = queryAll<TradeItemRow>(
      "SELECT * FROM TradeItem WHERE tradeId = ? ORDER BY id ASC",
      [trade.id]
    );

    const rows = items.map((item) => ({
      "BBG Ticker": item.tickerBbg,
      "Name": item.name,
      "Transaction Type": item.transactionType,
      "GMV (USD k)": item.gmvUsdK,
      "Unwind": item.unwind ? "Yes" : "No",
      "Reason": item.reason,
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);

    ws["!cols"] = [
      { wch: 20 },
      { wch: 25 },
      { wch: 18 },
      { wch: 15 },
      { wch: 10 },
      { wch: 40 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Trade");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const fileName = `trade-${trade.id}-${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("Failed to export trade:", error);
    return NextResponse.json({ error: "Failed to export trade" }, { status: 500 });
  }
}
