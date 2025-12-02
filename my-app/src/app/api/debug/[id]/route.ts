import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "../../zoho/status/route";

export async function GET(req: NextRequest) {
  const templateId = req.nextUrl.pathname.split("/").pop(); // or req.nextUrl.searchParams.get('id')
  if (!templateId)
    return NextResponse.json({ error: "missing template id" }, { status: 400 });

  const ZOHO_OAUTH_TOKEN = getAccessToken();

  try {
    const zohoResp = await fetch(
      `https://sign.zoho.com/api/v1/templates/${encodeURIComponent(
        templateId
      )}`,
      {
        headers: {
          Authorization: `Zoho-oauthtoken ${ZOHO_OAUTH_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    const text = await zohoResp.text();
    // Try to parse JSON safely
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }

    console.log("=== Zoho template fetch response ===");
    console.log(json);
    if (typeof json === "object" && json?.templates?.actions) {
      const actSummary = json.templates.actions.map((a: any) => ({
        action_id: a.action_id,
        role: a.role,
        action_type: a.action_type,
        recipient_name: a.recipient_name ?? null,
      }));
      console.log("Template actions:", JSON.stringify(actSummary, null, 2));
    } else {
      console.log("Full response:", text);
    }

    return NextResponse.json(
      { ok: true, actions: json.templates?.actions ?? null },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Error fetching template:", err);
    return NextResponse.json(
      { error: err.message ?? "unknown" },
      { status: 500 }
    );
  }
}
