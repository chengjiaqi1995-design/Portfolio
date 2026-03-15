import { NextRequest, NextResponse } from "next/server";
import { queryOne, run, type TaxonomyRow } from "@/lib/db";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const fields: string[] = [];
    const values: unknown[] = [];

    if (body.name !== undefined) { fields.push("name = ?"); values.push(body.name); }
    if (body.parentId !== undefined) { fields.push("parentId = ?"); values.push(body.parentId); }
    if (body.sortOrder !== undefined) { fields.push("sortOrder = ?"); values.push(body.sortOrder); }

    if (fields.length > 0) {
      fields.push("updatedAt = datetime('now')");
      values.push(parseInt(id));
      run(`UPDATE Taxonomy SET ${fields.join(", ")} WHERE id = ?`, values);
    }

    const updated = queryOne<TaxonomyRow>("SELECT * FROM Taxonomy WHERE id = ?", [parseInt(id)]);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update taxonomy:", error);
    return NextResponse.json(
      { error: "Failed to update taxonomy" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const taxonomyId = parseInt(id);
    const force = request.nextUrl.searchParams.get("force") === "true";

    // Check if any positions reference this taxonomy
    const sectorCount = queryOne<{ c: number }>("SELECT COUNT(*) as c FROM Position WHERE sectorId = ?", [taxonomyId])?.c || 0;
    const themeCount = queryOne<{ c: number }>("SELECT COUNT(*) as c FROM Position WHERE themeId = ?", [taxonomyId])?.c || 0;
    const topdownCount = queryOne<{ c: number }>("SELECT COUNT(*) as c FROM Position WHERE topdownId = ?", [taxonomyId])?.c || 0;
    const totalReferences = sectorCount + themeCount + topdownCount;

    if (totalReferences > 0 && !force) {
      return NextResponse.json(
        {
          error: `${totalReferences} 个持仓引用了此分类`,
          references: { sector: sectorCount, theme: themeCount, topdown: topdownCount },
          totalReferences,
        },
        { status: 409 }
      );
    }

    // If force, unbind all positions referencing this taxonomy first
    if (totalReferences > 0 && force) {
      if (sectorCount > 0) run("UPDATE Position SET sectorId = NULL WHERE sectorId = ?", [taxonomyId]);
      if (themeCount > 0) run("UPDATE Position SET themeId = NULL WHERE themeId = ?", [taxonomyId]);
      if (topdownCount > 0) run("UPDATE Position SET topdownId = NULL WHERE topdownId = ?", [taxonomyId]);
    }

    run("DELETE FROM Taxonomy WHERE id = ?", [taxonomyId]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete taxonomy:", error);
    return NextResponse.json(
      { error: "Failed to delete taxonomy" },
      { status: 500 }
    );
  }
}
