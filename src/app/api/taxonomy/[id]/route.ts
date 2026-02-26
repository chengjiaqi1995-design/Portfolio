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
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const taxonomyId = parseInt(id);

    // Check if any positions reference this taxonomy
    const sectorCount = queryOne<{ c: number }>("SELECT COUNT(*) as c FROM Position WHERE sectorId = ?", [taxonomyId])?.c || 0;
    const themeCount = queryOne<{ c: number }>("SELECT COUNT(*) as c FROM Position WHERE themeId = ?", [taxonomyId])?.c || 0;
    const topdownCount = queryOne<{ c: number }>("SELECT COUNT(*) as c FROM Position WHERE topdownId = ?", [taxonomyId])?.c || 0;
    const totalReferences = sectorCount + themeCount + topdownCount;

    if (totalReferences > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete: ${totalReferences} position(s) still reference this taxonomy item`,
          references: { sector: sectorCount, theme: themeCount, topdown: topdownCount },
        },
        { status: 409 }
      );
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
