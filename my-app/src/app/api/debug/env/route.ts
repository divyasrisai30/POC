import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ZOHO_CLIENT_ID: !!process.env.ZOHO_CLIENT_ID,
    ZOHO_CLIENT_SECRET: !!process.env.ZOHO_CLIENT_SECRET,
    ZOHO_REFRESH_TOKEN: !!process.env.ZOHO_REFRESH_TOKEN,
    ZOHO_ACCOUNTS_BASE: process.env.ZOHO_ACCOUNTS_BASE,
    ZOHO_SIGN_BASE: process.env.ZOHO_SIGN_BASE,
  });
}