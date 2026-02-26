import { NextRequest, NextResponse } from "next/server";
import { queryOne, run, type NameMappingRow } from "@/lib/db";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const fields: string[] = [];
    const values: unknown[] = [];

    if (body.bbgName !== undefined) { fields.push("bbgName = ?"); values.push(body.bbgName); }
    if (body.chineseName !== undefined) { fields.push("chineseName = ?"); values.push(body.chineseName); }
    if (body.positionId !== undefined) { fields.push("positionId = ?"); values.push(body.positionId); }

    if (fields.length > 0) {
      fields.push("updatedAt = datetime('now')");
      values.push(parseInt(id));
      run(`UPDATE NameMapping SET ${fields.join(", ")} WHERE id = ?`, values);
    }

    const updated = queryOne<NameMappingRow>("SELECT * FROM NameMapping WHERE id = ?", [parseInt(id)]);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update name mapping:", error);
    return NextResponse.json(
      { error: "Failed to update name mapping" },
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
    run("DELETE FROM NameMapping WHERE id = ?", [parseInt(id)]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete name mapping:", error);
    return NextResponse.json(
      { error: "Failed to delete name mapping" },
      { status: 500 }
    );
  }
}
