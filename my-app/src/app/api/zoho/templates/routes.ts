import { NextResponse } from "next/server";

const SIGN_BASE = process.env.ZOHO_SIGN_BASE ?? "https://sign.zoho.com";
// TODO: replace with your token management logic
const ACCESS_TOKEN = process.env.ZOHO_ACCESS_TOKEN!;

export const runtime = "nodejs";

export async function GET() {
  try {
    if (!ACCESS_TOKEN) {
      return NextResponse.json(
        { error: "Missing ZOHO_ACCESS_TOKEN env var" },
        { status: 500 }
      );
    }

    // Page config – adjust as needed
    const pageContext = {
      page_context: {
        row_count: 100,
        start_index: 1,
        search_columns: {},
        sort_column: "created_time",
        sort_order: "DESC",
      },
    };

    const url = new URL("/api/v1/templates", SIGN_BASE);

    // data must be URL-encoded JSON
    url.searchParams.set("data", JSON.stringify(pageContext));

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Zoho-oauthtoken ${ACCESS_TOKEN}`,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Zoho templates error:", res.status, text);
      return NextResponse.json(
        { error: "Failed to fetch templates from Zoho", details: text },
        { status: res.status }
      );
    }

    const json = await res.json();

    // Zoho returns { code: 0, templates: [ ... ] }
    const templates = json.templates ?? [];

    return NextResponse.json({ templates });
  } catch (err: any) {
    console.error("Templates API error:", err);
    return NextResponse.json(
      { error: "Unexpected error while fetching templates" },
      { status: 500 }
    );
  }
}
