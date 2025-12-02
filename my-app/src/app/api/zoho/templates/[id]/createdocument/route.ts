import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "../../../status/route";

const ZOHO_BASE = "https://sign.zoho.com/api/v1/templates";

type Editable = {
  template_id: string;
  template_name?: string;
  actions?: Array<{
    action_id: string;
    action_type?: string;
    recipient_name?: string;
    recipient_email?: string;
    role?: string;
    verify_recipient?: boolean;
    verification_type?: string;
  }>;
  // optional prefill maps
  field_text_data?: Record<string, string>;
  field_boolean_data?: Record<string, boolean>;
  field_date_data?: Record<string, string>;
};

async function parseBody(req: NextRequest) {
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    return { type: "json", parsed: await req.json() };
  }
  if (ct.includes("application/x-www-form-urlencoded")) {
    const text = await req.text();
    const params = new URLSearchParams(text);
    const data = params.get("data") ?? "";
    const is_quicksend = params.get("is_quicksend") ?? "false";
    let parsedData: any = null;
    try {
      parsedData = JSON.parse(decodeURIComponent(data));
    } catch (e) {
      parsedData = null;
    }
    return { type: "form", rawText: text, parsedData, is_quicksend };
  }
  // fallback: raw text
  const txt = await req.text();
  return { type: "text", rawText: txt };
}

function buildZohoPayloadFromEditable(editable: Editable) {
  return {
    templates: {
      request_name: editable.template_name ?? "Created from template",
      field_data: {
        field_text_data: editable.field_text_data ?? {},
        field_boolean_data: editable.field_boolean_data ?? {},
        field_date_data: editable.field_date_data ?? {},
      },
      actions: (editable.actions ?? []).map((a) => ({
        action_id: String(a.action_id),
        action_type: a.action_type ?? "SIGN",
        recipient_name: a.recipient_name ?? "",
        role: a.role ?? "",
        recipient_email: a.recipient_email ?? "",
        recipient_phonenumber: "",
        recipient_countrycode: "",
        private_notes: "",
        verify_recipient: !!a.verify_recipient,
        verification_type:
          a.verification_type ?? (a.verify_recipient ? "EMAIL" : undefined),
        delivery_mode: "EMAIL",
      })),
      notes: "",
    },
  };
}

export async function POST(req: NextRequest) {
  try {
    // parse body (supports JSON or form-encoded)
    const parsed = await parseBody(req);

    // extract template id reliably from path: /api/zoho/templates/<id>/createdocument
    const parts = req.nextUrl.pathname.split("/").filter(Boolean); // removes empty segments
    // parts example: ["api","zoho","templates","<id>","createdocument"]
    const templateIdFromPath =
      parts.length >= 2 ? parts[parts.length - 2] : null;
    const templateId = templateIdFromPath
      ? decodeURIComponent(templateIdFromPath)
      : null;

    console.log("[createDocument] route hit; content-type type:", parsed.type);
    console.log("[createDocument] templateIdFromPath:", templateId);

    if (!templateId) {
      return NextResponse.json(
        { error: "Could not determine template id from path" },
        { status: 400 }
      );
    }

    const token = await getAccessToken();
    if (!token) {
      console.error("[createDocument] Missing ZOHO_OAUTH_TOKEN in environment");
      return NextResponse.json(
        { error: "Server not configured: missing Zoho token" },
        { status: 500 }
      );
    }

    // If client sent JSON editable object -> build payload server-side
    if (parsed.type === "json") {
      const body = parsed.parsed;
      const editable: Editable | undefined = body?.editable;
      if (!editable) {
        return NextResponse.json(
          { error: "Missing editable object in JSON body" },
          { status: 400 }
        );
      }
      // ensure template_id present (if not, fallback to path)
      if (!editable.template_id) {
        editable.template_id = templateId;
      }
      if (!editable.template_id) {
        return NextResponse.json(
          { error: "Missing template_id in editable" },
          { status: 400 }
        );
      }

      // build Zoho payload
      const payload = buildZohoPayloadFromEditable(editable);
      console.log(
        "[createDocument] Built payload.preview actions:",
        (payload.templates.actions || []).map((a: any) => a.action_id)
      );
      const encoded = `data=${encodeURIComponent(
        JSON.stringify(payload)
      )}&is_quicksend=true`;

      // forward to Zoho
      const zohoResp = await fetch(
        `${ZOHO_BASE}/${encodeURIComponent(
          editable.template_id
        )}/createdocument`,
        {
          method: "POST",
          headers: {
            Authorization: `Zoho-oauthtoken ${token}`,
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          },
          body: encoded,
        }
      );

      const text = await zohoResp.text();
      // log short preview for debug
      console.log(
        `[createDocument] Zoho response status=${
          zohoResp.status
        } bodyPreview=${text.slice(0, 300)}`
      );

      try {
        const parsedResp = JSON.parse(text);
        return NextResponse.json(parsedResp, { status: zohoResp.status });
      } catch {
        return new NextResponse(text, { status: zohoResp.status });
      }
    }

    // If client already sent a form-encoded `data=...&is_quicksend=true`
    if (parsed.type === "form" && parsed.rawText) {
      // you can optionally validate parsedData here
      // forward the raw text as-is to Zoho using path templateId
      const zohoResp = await fetch(
        `${ZOHO_BASE}/${encodeURIComponent(templateId)}/createdocument`,
        {
          method: "POST",
          headers: {
            Authorization: `Zoho-oauthtoken ${token}`,
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          },
          body: parsed.rawText,
        }
      );

      const text = await zohoResp.text();
      console.log(
        `[createDocument] Zoho (form-forward) status=${
          zohoResp.status
        } bodyPreview=${text.slice(0, 300)}`
      );
      try {
        return NextResponse.json(JSON.parse(text), { status: zohoResp.status });
      } catch {
        return new NextResponse(text, { status: zohoResp.status });
      }
    }

    // unsupported content type -> ask client to send JSON
    return NextResponse.json(
      {
        error:
          "Unsupported content type. Send application/json with { editable } or form-urlencoded data.",
      },
      { status: 400 }
    );
  } catch (err: any) {
    console.error("Zoho createdocument error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Internal error" },
      { status: 500 }
    );
  }
}
