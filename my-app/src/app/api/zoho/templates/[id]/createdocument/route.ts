// app/api/zoho/templates/[id]/createdocument/route.ts
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

// Build an absolute internal save URL. Prefer env var; fallback to request origin; fallback to localhost.
function getInternalSaveUrl(req: NextRequest) {
  const base =
    process.env.INTERNAL_BASE_URL?.replace(/\/$/, "") ?? req?.nextUrl?.origin;
  if (!base) {
    // development fallback
    return "http://localhost:3000/api/zoho/save-sent";
  }
  return `${base}/api/zoho/save-sent`;
}

// Save historyEntry to internal API. Logs result, swallows errors.
async function saveHistory(req: NextRequest, historyEntry: any) {
  const finalSaveUrl = getInternalSaveUrl(req);
  try {
    const saveResp = await fetch(finalSaveUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(historyEntry),
    });
    const body = await saveResp.text().catch(() => "");
    console.log(
      "[save-sent] status=",
      saveResp.status,
      "bodyPreview=",
      body.slice(0, 300)
    );
  } catch (err) {
    console.warn("[save-sent] failed:", err);
  }
}

// Build a consistent history entry. Accepts both JSON-branch and form-branch inputs.
function makeHistoryEntry(params: {
  template_id: string | null;
  template_name?: string | null;
  app_id?: string;
  user_id?: string | null;
  parsedResp?: any;
  zohoRespStatus?: number | null;
  request_payload?: any;
  zoho_response?: any;
}) {
  const {
    template_id,
    template_name = null,
    app_id = "app1",
    user_id = null,
    parsedResp = null,
    zohoRespStatus = null,
    request_payload = null,
    zoho_response = null,
  } = params;

  return {
    template_id,
    template_name,
    app_id,
    user_id,
    timestamp: new Date().toISOString(),
    zoho_request_id:
      parsedResp?.request_id ?? parsedResp?.requests?.request_id ?? null,
    zoho_status:
      parsedResp?.status ??
      parsedResp?.requests?.status ??
      (zohoRespStatus !== null ? String(zohoRespStatus) : "unknown"),
    request_payload: request_payload ?? null,
    zoho_response: zoho_response ?? parsedResp ?? null,
  };
}

/* ---------- END helpers ---------- */

export async function POST(req: NextRequest) {
  try {
    const parsed = await parseBody(req);

    // derive templateId from path
    const parts = req.nextUrl.pathname.split("/").filter(Boolean);
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

    /* ---------------- JSON branch ---------------- */
    if (parsed.type === "json") {
      const body = parsed.parsed;
      const editable: Editable | undefined = body?.editable;
      if (!editable) {
        return NextResponse.json(
          { error: "Missing editable object in JSON body" },
          { status: 400 }
        );
      }
      if (!editable.template_id) editable.template_id = templateId;
      if (!editable.template_id) {
        return NextResponse.json(
          { error: "Missing template_id in editable" },
          { status: 400 }
        );
      }

      const payload = buildZohoPayloadFromEditable(editable);
      const encoded = `data=${encodeURIComponent(
        JSON.stringify(payload)
      )}&is_quicksend=true`;

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
      console.log(
        `[createDocument] Zoho response status=${
          zohoResp.status
        } bodyPreview=${text.slice(0, 300)}`
      );

      let parsedResp: any = null;
      try {
        parsedResp = JSON.parse(text);
      } catch {
        parsedResp = null;
      }

      // build & save history (JSON branch)
      const historyEntry = makeHistoryEntry({
        template_id: editable.template_id,
        template_name: editable.template_name ?? null,
        parsedResp,
        zohoRespStatus: zohoResp.status,
        request_payload: payload,
        zoho_response: parsedResp ?? text,
      });

      // call save once (helper handles absolute url + errors)
      await saveHistory(req, historyEntry);

      if (parsedResp)
        return NextResponse.json(parsedResp, { status: zohoResp.status });
      return new NextResponse(text, { status: zohoResp.status });
    }

    /* ---------------- form-forward branch ---------------- */
    if (parsed.type === "form" && parsed.rawText) {
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

      let parsedResp: any = null;
      try {
        parsedResp = JSON.parse(text);
      } catch {
        parsedResp = null;
      }

      const historyEntry = makeHistoryEntry({
        template_id: templateId,
        template_name: parsed.parsedData?.templates?.template_name ?? null,
        parsedResp,
        zohoRespStatus: zohoResp.status,
        request_payload: parsed.parsedData ?? { raw: parsed.rawText },
        zoho_response: parsedResp ?? text,
      });

      await saveHistory(req, historyEntry);

      if (parsedResp)
        return NextResponse.json(parsedResp, { status: zohoResp.status });
      return new NextResponse(text, { status: zohoResp.status });
    }

    // unsupported content
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
