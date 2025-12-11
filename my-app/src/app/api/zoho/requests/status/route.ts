// app/api/zoho/requests/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getZohoAccessToken } from "@/app/api/auth"; // optional helper

const ZOHO_BASE = "https://sign.zoho.com/api/v1/requests";

function getTokenFallback() {
  return process.env.ZOHO_OAUTH_TOKEN ?? null;
}

export async function GET(req: NextRequest) {
  try {
    const idsParam = req.nextUrl.searchParams.get("ids") ?? "";
    if (!idsParam) {
      return NextResponse.json(
        { ok: false, error: "ids query param required (comma separated)" },
        { status: 400 }
      );
    }
    const ids = idsParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!ids.length) {
      return NextResponse.json(
        { ok: false, error: "no ids provided" },
        { status: 400 }
      );
    }

    // get token (use your helper if available)
    const token =
      (typeof getZohoAccessToken === "function"
        ? await getZohoAccessToken()
        : null) ?? getTokenFallback();
    if (!token) {
      console.error("Missing Zoho token");
      return NextResponse.json(
        { ok: false, error: "server missing zoho token" },
        { status: 500 }
      );
    }

    // fetch statuses in parallel, but keep it simple. For heavy usage you may want to limit concurrency.
    const fetches = ids.map(async (id) => {
      try {
        const res = await fetch(`${ZOHO_BASE}/${encodeURIComponent(id)}`, {
          headers: { Authorization: `Zoho-oauthtoken ${token}` },
        });
        const text = await res.text();
        let json = null;
        try {
          json = JSON.parse(text);
        } catch {
          json = null;
        }

        const status =
          json?.request_status ??
          json?.requests?.request_status ??
          json?.requests?.status ??
          json?.status ??
          (res.status === 200 ? "ok" : `http_${res.status}`);

        const actions = json?.actions ?? json?.requests?.actions ?? null;

        return {
          id,
          ok: true,
          status,
          actions,
          raw: json ?? text,
          httpStatus: res.status,
        };
      } catch (e: any) {
        return { id, ok: false, error: e?.message ?? "fetch error" };
      }
    });

    const results = await Promise.all(fetches);
    const map: Record<string, any> = {};
    for (const r of results) map[r.id] = r;

    return NextResponse.json({ ok: true, results: map }, { status: 200 });
  } catch (err: any) {
    console.error("requests/status error", err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? "internal" },
      { status: 500 }
    );
  }
}
