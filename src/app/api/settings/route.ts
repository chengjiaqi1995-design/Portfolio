import { NextRequest, NextResponse } from "next/server";
import { queryOne, queryAll, run } from "@/lib/db";

export async function GET() {
  const rows = queryAll<{ key: string, value: string }>("SELECT key, value FROM AppSettings WHERE key IN ('aum', 'ai_api_key', 'ai_model', 'ai_base_url', 'ai_providers')");

  const settings: Record<string, any> = { aum: 10_000_000 };

  for (const r of rows) {
    if (r.key === 'aum') {
      settings.aum = parseFloat(r.value);
    } else if (r.key === 'ai_providers') {
      try {
        settings.ai_providers = JSON.parse(r.value);
      } catch {
        settings.ai_providers = null;
      }
    } else {
      settings[r.key] = r.value;
    }
  }

  return NextResponse.json(settings);
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    // Begin transaction for saving settings
    const db = require('@/lib/db').getDb();
    const saveMany = db.transaction((updates: { key: string, value: string }[]) => {
      const stmt = db.prepare("INSERT OR REPLACE INTO AppSettings (key, value) VALUES (?, ?)");
      for (const { key, value } of updates) {
        stmt.run(key, value);
      }
    });

    const updates = [];
    if (typeof body.aum === "number" && body.aum > 0) {
      updates.push({ key: 'aum', value: String(body.aum) });
    }
    if (typeof body.ai_api_key === "string") {
      updates.push({ key: 'ai_api_key', value: body.ai_api_key });
    }
    if (typeof body.ai_model === "string") {
      updates.push({ key: 'ai_model', value: body.ai_model });
    }
    if (typeof body.ai_base_url === "string") {
      updates.push({ key: 'ai_base_url', value: body.ai_base_url });
    }
    if (body.ai_providers && typeof body.ai_providers === "object") {
      updates.push({ key: 'ai_providers', value: JSON.stringify(body.ai_providers) });
    }

    if (updates.length > 0) {
      saveMany(updates);
    }

    // Read back all
    const rows = queryAll<{ key: string, value: string }>("SELECT key, value FROM AppSettings WHERE key IN ('aum', 'ai_api_key', 'ai_model', 'ai_base_url', 'ai_providers')");
    const settings: Record<string, any> = { aum: 10_000_000 };
    for (const r of rows) {
      if (r.key === 'aum') {
        settings.aum = parseFloat(r.value);
      } else if (r.key === 'ai_providers') {
        try {
          settings.ai_providers = JSON.parse(r.value);
        } catch {
          settings.ai_providers = null;
        }
      } else {
        settings[r.key] = r.value;
      }
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Failed to update settings:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
