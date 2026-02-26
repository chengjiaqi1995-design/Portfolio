import { NextRequest, NextResponse } from "next/server";
import { getAum, getDb, queryAll, queryOne, run, type TradeRow, type TradeItemRow, type PositionRow, type SnapshotRow } from "@/lib/db";

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

    const items = queryAll<TradeItemRow>("SELECT * FROM TradeItem WHERE tradeId = ?", [trade.id]);
    const snapshot = queryOne<SnapshotRow>("SELECT * FROM Snapshot WHERE tradeId = ?", [trade.id]);

    return NextResponse.json({
      ...trade,
      items: items.map((i) => ({ ...i, unwind: Boolean(i.unwind) })),
      snapshot: snapshot || null,
    });
  } catch (error) {
    console.error("Failed to fetch trade:", error);
    return NextResponse.json({ error: "Failed to fetch trade" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tradeId = parseInt(id);
    const body = await request.json();

    // If status is changing to "executed", apply the trade
    if (body.status === "executed") {
      const trade = queryOne<TradeRow>("SELECT * FROM Trade WHERE id = ?", [tradeId]);
      if (!trade) {
        return NextResponse.json({ error: "Trade not found" }, { status: 404 });
      }
      if (trade.status === "executed") {
        return NextResponse.json({ error: "Trade already executed" }, { status: 400 });
      }

      const items = queryAll<TradeItemRow>("SELECT * FROM TradeItem WHERE tradeId = ?", [tradeId]);

      const AUM = getAum();
      const db = getDb();
      const executeTrade = db.transaction(() => {
        for (const item of items) {
          const position = queryOne<PositionRow>(
            "SELECT * FROM Position WHERE tickerBbg = ?",
            [item.tickerBbg]
          );
          if (!position) continue;

          let newAmount = position.positionAmount;
          if (item.unwind) {
            newAmount = 0;
          } else if (item.transactionType === "buy") {
            newAmount += item.gmvUsdK * 1000;
          } else if (item.transactionType === "sell") {
            newAmount -= item.gmvUsdK * 1000;
          }

          const newWeight = newAmount / AUM;
          run(
            "UPDATE Position SET positionAmount = ?, positionWeight = ?, updatedAt = datetime('now') WHERE id = ?",
            [newAmount, newWeight, position.id]
          );
        }

        // Create snapshot
        const allPositions = queryAll<PositionRow>("SELECT * FROM Position");
        run(
          "INSERT INTO Snapshot (tradeId, positionsJson, note) VALUES (?, ?, ?)",
          [tradeId, JSON.stringify(allPositions), `Snapshot after executing trade #${tradeId}`]
        );

        // Update trade status
        run(
          "UPDATE Trade SET status = 'executed', executedAt = datetime('now') WHERE id = ?",
          [tradeId]
        );
      });

      executeTrade();

      // Return updated trade
      const updatedTrade = queryOne<TradeRow>("SELECT * FROM Trade WHERE id = ?", [tradeId]);
      const updatedItems = queryAll<TradeItemRow>("SELECT * FROM TradeItem WHERE tradeId = ?", [tradeId]);
      const snapshot = queryOne<SnapshotRow>("SELECT * FROM Snapshot WHERE tradeId = ?", [tradeId]);

      return NextResponse.json({
        ...updatedTrade,
        items: updatedItems.map((i) => ({ ...i, unwind: Boolean(i.unwind) })),
        snapshot,
      });
    }

    // Normal status/note update
    const fields: string[] = [];
    const values: unknown[] = [];

    if (body.status !== undefined) { fields.push("status = ?"); values.push(body.status); }
    if (body.note !== undefined) { fields.push("note = ?"); values.push(body.note); }

    if (fields.length > 0) {
      values.push(tradeId);
      run(`UPDATE Trade SET ${fields.join(", ")} WHERE id = ?`, values);
    }

    const updatedTrade = queryOne<TradeRow>("SELECT * FROM Trade WHERE id = ?", [tradeId]);
    const updatedItems = queryAll<TradeItemRow>("SELECT * FROM TradeItem WHERE tradeId = ?", [tradeId]);

    return NextResponse.json({
      ...updatedTrade,
      items: updatedItems.map((i) => ({ ...i, unwind: Boolean(i.unwind) })),
    });
  } catch (error) {
    console.error("Failed to update trade:", error);
    return NextResponse.json({ error: "Failed to update trade" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tradeId = parseInt(id);

    const db = getDb();
    const deleteTrade = db.transaction(() => {
      run("DELETE FROM TradeItem WHERE tradeId = ?", [tradeId]);
      run("DELETE FROM Snapshot WHERE tradeId = ?", [tradeId]);
      run("DELETE FROM Trade WHERE id = ?", [tradeId]);
    });

    deleteTrade();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete trade:", error);
    return NextResponse.json({ error: "Failed to delete trade" }, { status: 500 });
  }
}
