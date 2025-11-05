// app/api/zoho/upload/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const ACCOUNTS_BASE = process.env.ZOHO_ACCOUNTS_BASE ?? "https://accounts.zoho.com"; // match your DC
const SIGN_BASE = process.env.ZOHO_SIGN_BASE ?? "https://sign.zoho.com";             // same DC as above

export async function POST(req: Request) {

  try {
    console.log("Post Call--------------------");
    const formDataIn = await req.formData();
    const file = formDataIn.get("file") as File | null;
    const dataStr = formDataIn.get('data') as string | null;
    // console.log(dataStr);

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

    //1. the backend-minted token belongs to a different user
    const selfBody = await selfRes.text();
    console.log("user/self", selfRes.status, selfBody)
    if (!selfRes.ok) {
  return NextResponse.json(
    {
      error: "Zoho auth/DC/org issue",
      status: selfRes.status,
      raw: selfBody,
      endpoint: `${SIGN_BASE}/api/v1/users/self`,
    },
    { status: 500 }
  );
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

    // after you get `uploadRes`
   const raw = await uploadRes.text();
const reqId = uploadRes.headers.get("x-request-id") || uploadRes.headers.get("x-zoho-request-id") || null;

if (!uploadRes.ok) {
  return NextResponse.json(
    {
      error: "Zoho create request failed",
      status: uploadRes.status,
      requestId: reqId,
      raw,
      endpoint: `${SIGN_BASE}/api/v1/requests`
    },
    { status: 500 }
  );
}


    // const uploadText = await uploadRes.text();
    console.log("Zoho raw response:", raw); // ← see exact error payload


    console.log("Upload status:", uploadRes.status, uploadRes.statusText);

    // const uploadText = await uploadRes.text();
    let uploadData: any;
    try { uploadData = JSON.parse(raw); } catch { uploadData = { raw: raw }; }

    // if (!uploadRes.ok) {
    //   return NextResponse.json(
    //     { error: "Zoho upload failed", status: uploadRes.status, details: uploadData },
    //     { status: 500 }
    //   );
    // }

    // const fileId = uploadData?.files?.[0]?.file_id;
    // return NextResponse.json({ success: true, zohoFileId: fileId, zohoResponse: uploadData });
    return NextResponse.json(JSON.parse(raw));
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Unexpected error" }, { status: 500 });
  }
}
