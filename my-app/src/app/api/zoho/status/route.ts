import { NextResponse } from "next/server";

export const runtime = "nodejs";

const ACCOUNTS_BASE =
  process.env.ZOHO_ACCOUNTS_BASE ?? "https://accounts.zoho.com";
const SIGN_BASE = process.env.ZOHO_SIGN_BASE ?? "https://sign.zoho.com";

export async function getAccessToken() {
  if (
    !process.env.ZOHO_CLIENT_ID ||
    !process.env.ZOHO_CLIENT_SECRET ||
    !process.env.ZOHO_REFRESH_TOKEN
  ) {
    throw new Error("Missing Zoho env vars");
  }

  const tokenRes = await fetch(`${ACCOUNTS_BASE}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: process.env.ZOHO_REFRESH_TOKEN!,
      client_id: process.env.ZOHO_CLIENT_ID!,
      client_secret: process.env.ZOHO_CLIENT_SECRET!,
    }),
  });

  const text = await tokenRes.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  if (!tokenRes.ok || !json.access_token) {
    console.error("Zoho token error:", json);
    throw new Error("Failed to get Zoho access token");
  }

  return json.access_token as string;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing id param" }, { status: 400 });
    }

    const accessToken = await getAccessToken();

    // Get request status from Zoho Sign
    const statusRes = await fetch(`${SIGN_BASE}/api/v1/requests/${id}`, {
      method: "GET",
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
      },
    });

    const raw = await statusRes.text();
    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      data = { raw };
    }

    if (!statusRes.ok) {
      return NextResponse.json(
        {
          error: data?.message || "Zoho status lookup failed",
          code: data?.code,
          status: statusRes.status,
          details: data,
        },
        { status: statusRes.status }
      );
    }

    // pass Zoho response straight back to the frontend
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("Status API error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Unexpected error in status endpoint" },
      { status: 500 }
    );
  }
}
