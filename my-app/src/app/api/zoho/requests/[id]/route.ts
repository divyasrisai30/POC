// server-side: app/api/zoho/requests/[id]/route.ts (example)
import { NextResponse } from "next/server";
import { getZohoAccessToken } from "@/app/api/auth";

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const token = await getZohoAccessToken();
  if (!token) return NextResponse.json({ error: "no token" }, { status: 500 });

  const res = await fetch(
    `https://sign.zoho.com/api/v1/requests/${encodeURIComponent(id)}`,
    {
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
    }
  );

  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  if (!res.ok) {
    return NextResponse.json(
      { ok: false, status: res.status, raw: text, parsed: json },
      { status: 500 }
    );
  }

  // normalize important fields for client
  const r = json?.requests ?? json ?? {};
  const normalized = {
    overallStatus: r.request_status ?? r.status ?? null,
    signPercentage: r.sign_percentage ?? null,
    timestamps: {
      created: r.created_time ?? null,
      modified: r.modified_time ?? null,
      action: r.action_time ?? null,
    },
    recipients: (r.actions ?? []).map((a: any) => ({
      id: a.action_id,
      name: a.recipient_name,
      email: a.recipient_email,
      status: a.action_status ?? a.status ?? null,
      order: a.signing_order ?? null,
      fields: a.fields ?? [],
    })),
    raw: r,
  };

  return NextResponse.json({ ok: true, zoho: normalized });
}
