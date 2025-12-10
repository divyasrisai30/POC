// app/api/zoho/history/route.ts
import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const DB_FILE = path.join(process.cwd(), "data", "sent_requests.json");

async function readAll() {
  try {
    const raw = await fs.readFile(DB_FILE, "utf8");
    const arr = JSON.parse(raw || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const template_id = url.searchParams.get("template_id");
    const app_id = url.searchParams.get("app_id");
    const limit = Math.min(1000, Number(url.searchParams.get("limit") ?? 100));

    let items = await readAll();
    if (app_id) items = items.filter((i: any) => i.app_id === app_id);
    if (template_id)
      items = items.filter((i: any) => i.template_id === template_id);
    items = items.slice(0, limit);

    return NextResponse.json({ items, count: items.length });
  } catch (err: any) {
    console.error("history GET error", err);
    return NextResponse.json(
      { error: err?.message ?? "Internal" },
      { status: 500 }
    );
  }
}
