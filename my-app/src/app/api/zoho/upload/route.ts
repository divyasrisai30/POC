// app/api/zoho/upload/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const ACCOUNTS_BASE = process.env.ZOHO_ACCOUNTS_BASE ?? "https://accounts.zoho.com"; // match your DC
const SIGN_BASE = process.env.ZOHO_SIGN_BASE ?? "https://sign.zoho.com";             // same DC as above

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


    // Quick env sanity check
    if (!process.env.ZOHO_CLIENT_ID || !process.env.ZOHO_CLIENT_SECRET || !process.env.ZOHO_REFRESH_TOKEN) {
      return NextResponse.json(
        {
          error: "Missing env",
          details: {
            ZOHO_CLIENT_ID: !!process.env.ZOHO_CLIENT_ID,
            ZOHO_CLIENT_SECRET: !!process.env.ZOHO_CLIENT_SECRET,
            ZOHO_REFRESH_TOKEN: !!process.env.ZOHO_REFRESH_TOKEN,
          },
        },
        { status: 500 }
      );
    }

    // 1) Get access token via refresh_token
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

    console.log("Zoho tokenRes status:", tokenRes.status);

    const tokenText = await tokenRes.text();
    console.log("Zoho tokenRes status text:", tokenText);
    let tokenData: any;
    try { tokenData = JSON.parse(tokenText); } catch { tokenData = { raw: tokenText }; }

    if (!tokenRes.ok || !tokenData.access_token) {
      return NextResponse.json(
        { error: "Failed to get access token", details: tokenData, status: tokenRes.status },
        { status: 500 }
      );
    }

    const accessToken: string = tokenData.access_token;
    console.log("accessToken", accessToken);


//######Debug#########
    const whoRes = await fetch(`${ACCOUNTS_BASE}/oauth/user/info`, {
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` }
    });
    const whoText = await whoRes.text();
    console.log("ACCOUNTS whoami:", whoRes.status, whoText);

    // Optional: see scopes & api_domain in token response if present
    // console.log("tokenJson.api_domain:", tokenJson?.api_domain);
    // console.log("tokenJson.scope:", tokenJson?.scope);
    // console.log("token prefix:", accessToken.slice(0, 12));

// #############################

    const selfRes = await fetch(`${SIGN_BASE}/api/v1/users/self`, {
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    });

  //#############Debug selfRef
  /**1. the backend-minted token belongs to a different user than the one in your screenshot,
   * 2. or the refresh token in .env is missing Zoho Sign scopes,
   * 3. or the DC is mismatched (less likely here; you’re on .com). */
  
    //Printing the selfRes
    // console.log("selfRes", selfRes)
    // if (!selfRes.ok) {
    //   return NextResponse.json(
    //     { error: "Zoho auth/DC/org issue", status: selfRes.status, raw: await selfRes.text() },
    //     { status: 500 }
    //   );
    // }

    // Check user/self endpoint - but don't fail if it returns 9004 (account not found)
    // This can happen if the account hasn't been activated in Zoho Sign yet
    const selfBody = await selfRes.text();
    console.log("user/self", selfRes.status, selfBody);
    
    let selfData: any;
    try {
      selfData = JSON.parse(selfBody);
    } catch {
      selfData = { raw: selfBody };
    }

    if (!selfRes.ok) {
      // Error 9004 means account not found - this might still work for creating requests
      if (selfData?.code === 9004) {
        console.warn("Warning: Account not found in Zoho Sign (9004). This might still work for creating requests.");
        console.warn("Solution: Sign up/activate Zoho Sign account at https://sign.zoho.com");
        // Continue anyway - the API might still work
      } else {
        // For other errors, return error
        return NextResponse.json(
          {
            error: "Zoho auth/DC/org issue",
            message: selfData?.message || "Failed to verify Zoho Sign account",
            code: selfData?.code,
            status: selfRes.status,
            raw: selfBody,
            endpoint: `${SIGN_BASE}/api/v1/users/self`,
            guidance: selfData?.code === 9004 
              ? "Account not found in Zoho Sign. Please sign up at https://sign.zoho.com"
              : undefined,
          },
          { status: 500 }
        );
      }
    } else {
      console.log("Zoho Sign account verified:", selfData?.users?.[0]?.email || selfData?.email);
    }

    // 2) Upload file to Zoho Sign — pass original File (keeps name & type)
    const out = new FormData();
    out.append("file", file, file.name);
    out.append("data", dataStr); 

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
