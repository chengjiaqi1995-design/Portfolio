import { NextRequest, NextResponse } from "next/server";
import { getDb, queryAll, run, type TradeRow, type TradeItemRow } from "@/lib/db";

export async function GET() {
  try {
    const trades = queryAll<TradeRow>("SELECT * FROM Trade ORDER BY createdAt DESC");

    // Attach items to each trade
    const result = trades.map((trade) => {
      const items = queryAll<TradeItemRow>(
        "SELECT * FROM TradeItem WHERE tradeId = ? ORDER BY id ASC",
        [trade.id]
      );
      return {
        ...trade,
        items: items.map((item) => ({ ...item, unwind: Boolean(item.unwind) })),
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch trades:", error);
    return NextResponse.json(
      { error: "Failed to fetch trades" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const db = getDb();

    const insertTrade = db.transaction(() => {
      const tradeResult = run(
        "INSERT INTO Trade (status, note) VALUES (?, ?)",
        [body.status ?? "pending", body.note ?? ""]
      );
      const tradeId = Number(tradeResult.lastInsertRowid);

      const items = body.items ?? [];
      for (const item of items) {
        run(
          `INSERT INTO TradeItem (tradeId, tickerBbg, name, transactionType, gmvUsdK, unwind, reason, positionId)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            tradeId,
            item.tickerBbg,
            item.name,
            item.transactionType,
            item.gmvUsdK,
            item.unwind ? 1 : 0,
            item.reason ?? "",
            item.positionId ?? null,
          ]
        );
      }

      return tradeId;
    });

    const tradeId = insertTrade();

    // Fetch the created trade with items
    const trade = queryAll<TradeRow>("SELECT * FROM Trade WHERE id = ?", [tradeId])[0];
    const tradeItems = queryAll<TradeItemRow>("SELECT * FROM TradeItem WHERE tradeId = ?", [tradeId]);

    return NextResponse.json(
      { ...trade, items: tradeItems.map((i) => ({ ...i, unwind: Boolean(i.unwind) })) },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create trade:", error);
    return NextResponse.json(
      { error: "Failed to create trade" },
      { status: 500 }
    );
  }
}
