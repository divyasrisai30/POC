import { getZohoAccessToken } from "@/app/api/auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  if (!id) {
    return NextResponse.json({ error: "Missing request id" }, { status: 400 });
  }

  try {
    const accessToken = await getZohoAccessToken();

    // Zoho API: completion certificate
    const zohoRes = await fetch(
      `https://sign.zoho.com/api/v1/requests/${id}/completioncertificate`,
      {
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
        },
      }
    );

    if (!zohoRes.ok) {
      const text = await zohoRes.text();
      return NextResponse.json(
        { error: "Failed to fetch certificate", details: text },
        { status: zohoRes.status }
      );
    }

    const blob = await zohoRes.arrayBuffer();

    return new NextResponse(blob, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="certificate-${id}.pdf"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}
