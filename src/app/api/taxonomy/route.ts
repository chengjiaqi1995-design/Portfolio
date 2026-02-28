import { NextRequest, NextResponse } from "next/server";
import { queryAll, queryOne, run, type TaxonomyRow } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    let sql = "SELECT * FROM Taxonomy";
    const params: unknown[] = [];

    if (type) {
      sql += " WHERE type = ?";
      params.push(type);
    }

    sql += " ORDER BY type ASC, sortOrder ASC, name ASC";

    const taxonomies = queryAll<TaxonomyRow>(sql, params);

    // Build nested structure with children and parent
    const byId = new Map(taxonomies.map((t) => [t.id, t]));
    const result = taxonomies.map((t) => ({
      ...t,
      children: taxonomies.filter((c) => c.parentId === t.id),
      parent: t.parentId ? byId.get(t.parentId) || null : null,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch taxonomies:", error);
    return NextResponse.json(
      { error: "Failed to fetch taxonomies" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const result = run(
      "INSERT INTO Taxonomy (type, name, parentId, sortOrder, createdAt, updatedAt) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))",
      [body.type, body.name, body.parentId ?? null, body.sortOrder ?? 0]
    );

    const created = queryOne<TaxonomyRow>("SELECT * FROM Taxonomy WHERE id = ?", [
      Number(result.lastInsertRowid),
    ]);

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Failed to create taxonomy:", error);
    return NextResponse.json(
      { error: "Failed to create taxonomy" },
      { status: 500 }
    );
  }
}
