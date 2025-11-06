// Debug endpoint to test Zoho Sign API connectivity
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const ACCOUNTS_BASE = process.env.ZOHO_ACCOUNTS_BASE ?? "https://accounts.zoho.com";
const SIGN_BASE = process.env.ZOHO_SIGN_BASE ?? "https://sign.zoho.com";

export async function GET() {
  const debugInfo: any = {
    timestamp: new Date().toISOString(),
    environment: {
      ZOHO_CLIENT_ID: !!process.env.ZOHO_CLIENT_ID ? "✓ Set" : "✗ Missing",
      ZOHO_CLIENT_SECRET: !!process.env.ZOHO_CLIENT_SECRET ? "✓ Set" : "✗ Missing",
      ZOHO_REFRESH_TOKEN: !!process.env.ZOHO_REFRESH_TOKEN ? "✓ Set" : "✗ Missing",
      ZOHO_ACCOUNTS_BASE: process.env.ZOHO_ACCOUNTS_BASE || "Using default: https://accounts.zoho.com",
      ZOHO_SIGN_BASE: process.env.ZOHO_SIGN_BASE || "Using default: https://sign.zoho.com",
    },
    endpoints: {
      accounts_base: ACCOUNTS_BASE,
      sign_base: SIGN_BASE,
    },
    tests: {} as any,
  };

  // Test 1: Check if we can get an access token
  if (process.env.ZOHO_CLIENT_ID && process.env.ZOHO_CLIENT_SECRET && process.env.ZOHO_REFRESH_TOKEN) {
    try {
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

      const tokenText = await tokenRes.text();
      let tokenData: any;
      try {
        tokenData = JSON.parse(tokenText);
      } catch {
        tokenData = { raw: tokenText };
      }

      debugInfo.tests.tokenRefresh = {
        status: tokenRes.status,
        success: tokenRes.ok && !!tokenData.access_token,
        hasAccessToken: !!tokenData.access_token,
        error: tokenData.error || tokenData.message || null,
        scopes: tokenData.scope || null,
        apiDomain: tokenData.api_domain || null,
      };

      // Test 2: If we got a token, test the Sign API
      if (tokenData.access_token) {
        const accessToken = tokenData.access_token;

        // Test user info endpoint
        try {
          const whoRes = await fetch(`${ACCOUNTS_BASE}/oauth/user/info`, {
            headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
          });
          const whoText = await whoRes.text();
          let whoData: any;
          try {
            whoData = JSON.parse(whoText);
          } catch {
            whoData = { raw: whoText };
          }

          debugInfo.tests.userInfo = {
            status: whoRes.status,
            success: whoRes.ok,
            email: whoData.Email || whoData.email || null,
            error: whoData.error || whoData.message || null,
          };
        } catch (err: any) {
          debugInfo.tests.userInfo = {
            error: err.message,
          };
        }

        // Test Sign API self endpoint
        try {
          const selfRes = await fetch(`${SIGN_BASE}/api/v1/users/self`, {
            headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
          });
          const selfText = await selfRes.text();
          let selfData: any;
          try {
            selfData = JSON.parse(selfText);
          } catch {
            selfData = { raw: selfText };
          }

          debugInfo.tests.signSelf = {
            status: selfRes.status,
            success: selfRes.ok,
            email: selfData?.users?.[0]?.email || selfData?.email || null,
            firstName: selfData?.users?.[0]?.first_name || selfData?.first_name || null,
            error: selfData?.message || selfData?.error || null,
            code: selfData?.code || null,
            rawResponse: selfText,
          };

          // Add helpful guidance for error code 9004
          if (selfData?.code === 9004) {
            debugInfo.tests.signSelf.guidance = {
              issue: "Account not found in Zoho Sign",
              solution: [
                "1. Sign up for Zoho Sign at https://sign.zoho.com (if you haven't already)",
                "2. Ensure the email used for your Zoho API Developer account matches your Zoho Sign account email",
                "3. Activate your Zoho Sign account by logging in at least once",
                "4. Note: The API might still work for creating requests even if /users/self fails"
              ]
            };
          }
        } catch (err: any) {
          debugInfo.tests.signSelf = {
            error: err.message,
          };
        }
      }
    } catch (err: any) {
      debugInfo.tests.tokenRefresh = {
        error: err.message,
      };
    }
  } else {
    debugInfo.tests.tokenRefresh = {
      error: "Missing required environment variables",
    };
  }

  return NextResponse.json(debugInfo, { status: 200 });
}

