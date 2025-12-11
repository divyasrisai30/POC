/**
 * predefined:
 * `NextResponse` lets you return HTTP responses inside App Router routes.
 * `getZohoAccessToken()` is your custom function that retrieves a valid Zoho OAuth token from your server (so keys are not exposed to the client).
 *
 * Working based on ID.
 *
 */
import { NextResponse } from "next/server";
import { getZohoAccessToken } from "@/app/api/auth";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const token = await getZohoAccessToken();
  if (!token) {
    return NextResponse.json(
      { error: "Missing ZOHO_ACCESS_TOKEN" },
      { status: 500 }
    );
  }

  console.log("====id that is being called====", id);

  const upstream = await fetch(
    `https://sign.zoho.com/api/v1/templates/${encodeURIComponent(id)}`,
    {
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
    }
  );

  const text = await upstream.text();
  const contentType =
    upstream.headers.get("content-type") ?? "application/json";

  return new NextResponse(text, {
    status: upstream.status,
    headers: { "content-type": contentType },
  });
}
