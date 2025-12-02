import { NextResponse } from "next/server";

export const runtime = "nodejs";

const ACCOUNTS_BASE =
  process.env.ZOHO_ACCOUNTS_BASE ?? "https://accounts.zoho.com"; // match your DC
const SIGN_BASE = process.env.ZOHO_SIGN_BASE ?? "https://sign.zoho.com";

const CLIENT_ID = process.env.ZOHO_CLIENT_ID;
const CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.ZOHO_REFRESH_TOKEN;

let cachedToken: string | null = null;
let tokenExpiry = 0;

function checkEnvironmetalVariables() {
  if (!process.env.ZOHO_CLIENT_ID) {
    return NextResponse.json(
      {
        error: "Missing client id",
        details: {
          ZOHO_CLIENT_ID: !!process.env.ZOHO_CLIENT_ID,
          ZOHO_CLIENT_SECRET: !!process.env.ZOHO_CLIENT_SECRET,
          ZOHO_REFRESH_TOKEN: !!process.env.ZOHO_REFRESH_TOKEN,
        },
      },
      { status: 500 }
    );
  }
  if (
    !process.env.ZOHO_CLIENT_ID ||
    !process.env.ZOHO_CLIENT_SECRET ||
    !process.env.ZOHO_REFRESH_TOKEN
  ) {
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
}

export async function getZohoAccessToken(): Promise<string> {
  checkEnvironmetalVariables();

  const now = Date.now();
  if (cachedToken && now < tokenExpiry) {
    return cachedToken;
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

  console.log("Zoho tokenRes status:", tokenRes.status);

  const tokenText = await tokenRes.text();
  console.log("Zoho tokenRes status text:", tokenText);
  let tokenData: any;
  try {
    tokenData = JSON.parse(tokenText);
  } catch {
    tokenData = { raw: tokenText };
  }

  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(
      `Failed to refresh Zoho access token: ${tokenRes.status} ${JSON.stringify(
        tokenData
      )}`
    );
  }

  cachedToken = tokenData.access_token as string;
  console.log("accessToken", cachedToken);

  tokenExpiry = now + 55 * 60 * 1000;

  return cachedToken;
}

export async function verifyZohoUser(accessToken: string) {
  const whoRes = await fetch(`${ACCOUNTS_BASE}/oauth/user/info`, {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  });
  const whoText = await whoRes.text();
  console.log("ACCOUNTS whoami:", whoRes.status, whoText);

  const selfRes = await fetch(`${SIGN_BASE}/api/v1/users/self`, {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  });

  const selfBody = await selfRes.text();
  console.log("user/self", selfRes.status, selfBody);

  let selfData: any;
  try {
    selfData = JSON.parse(selfBody);
  } catch {
    selfData = { raw: selfBody };
  }

  if (!selfRes.ok) {
    if (selfData?.code === 9004) {
      console.warn(
        "Warning: Account not found in Zoho Sign (9004). This might still work for creating requests."
      );
      console.warn(
        "Solution: Sign up/activate Zoho Sign account at https://sign.zoho.com"
      );
    } else {
      return NextResponse.json(
        {
          error: "Zoho auth/DC/org issue",
          message: selfData?.message || "Failed to verify Zoho Sign account",
          code: selfData?.code,
          status: selfRes.status,
          raw: selfBody,
          endpoint: `${SIGN_BASE}/api/v1/users/self`,
          guidance:
            selfData?.code === 9004
              ? "Account not found in Zoho Sign. Please sign up at https://sign.zoho.com"
              : undefined,
        },
        { status: 500 }
      );
    }
  } else {
    console.log(
      "Zoho Sign account verified:",
      selfData?.users?.[0]?.email || selfData?.email
    );
  }
}
