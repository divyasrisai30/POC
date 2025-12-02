import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/app/api/zoho/status/route";

const ZOHO_BASE_TEMPLATE = "https://sign.zoho.com/api/v1/templates";
const ZOHO_OAUTH_TOKEN = await getAccessToken();

export async function POST(req: NextRequest) {
  console.log("============Post call to send Data======");
  try {
    const body = await req.json();
    const editable = body?.editable;

    if (!editable) {
      return NextResponse.json(
        { error: "Missing editable payload" },
        { status: 400 }
      );
    }

    if (!editable.template_id) {
      return NextResponse.json(
        { error: "Missing template_id" },
        { status: 400 }
      );
    }

    const payload = {
      templates: {
        request_name: editable.template_name ?? "Created from template",
        field_data: {
          field_text_data: {},
          field_boolean_data: {},
          field_date_data: {},
        },
        actions: editable.actions.map((a: any) => ({
          action_id: a.action_id,
          action_type: a.action_type ?? "SIGN",
          recipient_name: a.recipient_name ?? "",
          role: a.role ?? "",
          recipient_email: a.recipient_email ?? "",
          recipient_phonenumber: "",
          recipient_countrycode: "",
          private_notes: "",
          verify_recipient: !!a.verify_recipient,
          verification_type: "EMAIL",
        })),
        notes: "",
      },
    };

    const encodedBody = `data=${encodeURIComponent(
      JSON.stringify(payload)
    )}&is_quicksend=true`;

    /* ----------------------
       Call Zoho Sign API
    ----------------------- */
    const zohoResp = await fetch(
      `${ZOHO_BASE_TEMPLATE}/${editable.template_id}/createdocument`,
      {
        method: "POST",
        headers: {
          Authorization: `Zoho-oauthtoken ${getAccessToken}`,
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body: encodedBody,
      }
    );

    const text = await zohoResp.text();

    // Try parsing Zoho response as JSON
    try {
      const parsed = JSON.parse(text);
      return NextResponse.json(parsed, { status: zohoResp.status });
    } catch {
      // If Zoho returned plain text
      return new NextResponse(text, { status: zohoResp.status });
    }
  } catch (err: any) {
    console.error("Zoho createdocument error:", err);
    return NextResponse.json(
      { error: err.message ?? "Internal error" },
      { status: 500 }
    );
  }
}
