// app/api/zoho/save-sent/route.ts
import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const DB_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DB_DIR, "sent_requests.json");

async function ensureFile() {
  try {
    await fs.mkdir(DB_DIR, { recursive: true });
    await fs.access(DB_FILE);
  } catch {
    await fs.writeFile(DB_FILE, "[]", "utf8");
  }
}

export async function GET(req: NextRequest) {
  return NextResponse.json({ error: "Checking the path" }, { status: 200 });
}

export async function POST(req: NextRequest) {
  console.log("=====called save sent =======");
  try {
    const body = await req.json().catch(() => null);
    if (!body || !body.template_id) {
      return NextResponse.json(
        { error: "template_id required" },
        { status: 400 }
      );
    }

    await ensureFile();
    const raw = await fs.readFile(DB_FILE, "utf8");
    let arr: any[] = [];
    try {
      arr = JSON.parse(raw || "[]");
      if (!Array.isArray(arr)) arr = [];
    } catch {
      arr = [];
    }

    const entry = {
      id: uuidv4(),
      app_id: body.app_id ?? "app1",
      user_id: body.user_id ?? null,
      template_id: body.template_id,
      template_name: body.template_name ?? null,
      timestamp: new Date().toISOString(),
      zoho_request_id:
        body.zoho_request_id ?? body.zoho_response?.request_id ?? null,
      zoho_status: body.zoho_status ?? body.zoho_response?.status ?? "unknown",
      request_payload: body.request_payload ?? null,
      zoho_response: body.zoho_response ?? null,
    };

    // newest-first
    arr.unshift(entry);
    await fs.writeFile(DB_FILE, JSON.stringify(arr, null, 2), "utf8");

    return NextResponse.json({ ok: true, entry }, { status: 201 });
  } catch (err: any) {
    console.error("save-sent error", err);
    return NextResponse.json(
      { error: err?.message ?? "Internal" },
      { status: 500 }
    );
  }
}
