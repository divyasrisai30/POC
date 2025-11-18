// app/api/zoho/upload/route.ts

import { NextResponse } from "next/server";
import { verifyZohoUser, getZohoAccessToken } from "../../auth";

export const runtime = "nodejs";
const SIGN_BASE = process.env.ZOHO_SIGN_BASE ?? "https://sign.zoho.com";

export async function POST(req: Request) {

  try {
    console.log("=== Zoho Sign Upload Request ===");
    const formDataIn = await req.formData();
    const file = formDataIn.get("file") as File | null;
    const dataStr = formDataIn.get('data') as string | null;
    
    console.log("File:", file ? { name: file.name, size: file.size, type: file.type } : "null");
    if (dataStr) {
      try {
        const parsedData = JSON.parse(dataStr);
        console.log("Payload structure:", {
          hasRequests: !!parsedData.requests,
          requestName: parsedData.requests?.request_name,
          actionsCount: parsedData.requests?.actions?.length || 0,
        });
      } catch (e) {
        console.log("Payload (raw):", dataStr.substring(0, 200));
      }
    }

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (!dataStr) {
      return NextResponse.json({ error: 'No data payload provided' }, { status: 400 });
    }
    console.log()

   
  
    // 2) Upload file to Zoho Sign — pass original File (keeps name & type)
    const out = new FormData();
    out.append("file", file, file.name);
    out.append("data", dataStr); 

    const accessToken = await getZohoAccessToken();
    console.log("Using Zoho access token (first 12):", accessToken.slice(0, 12));

    const uploadRes = await fetch(`${SIGN_BASE}/api/v1/requests`, {
      method: "POST",
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        // DO NOT set Content-Type manually; fetch sets the boundary
      },
      body: out,
    });

    // Parse response
    const raw = await uploadRes.text();
    const reqId = uploadRes.headers.get("x-request-id") || uploadRes.headers.get("x-zoho-request-id") || null;

    console.log("Zoho upload response status:", uploadRes.status, uploadRes.statusText);
    console.log("Zoho raw response:", raw);

    if (!uploadRes.ok) {
      let errorData: any;
      try {
        errorData = JSON.parse(raw);
      } catch {
        errorData = { raw };
      }

      return NextResponse.json(
        {
          error: errorData?.message || "Zoho create request failed",
          message: errorData?.message,
          code: errorData?.code,
          status: uploadRes.status,
          requestId: reqId,
          details: errorData,
          endpoint: `${SIGN_BASE}/api/v1/requests`
        },
        { status: uploadRes.status }
      );
    }

    // Success - parse and return the response
    let uploadData: any;
    try {
      uploadData = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse Zoho response", raw },
        { status: 500 }
      );
    }

    return NextResponse.json(uploadData);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Unexpected error" }, { status: 500 });
  }
}
