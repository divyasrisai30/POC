import { NextRequest, NextResponse } from "next/server";
import { getZohoAccessToken } from "@/app/api/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Missing request id" }, { status: 400 });
  }

  console.log("GET REQUEST: document download Id", id);

  try {
    const accessToken = await getZohoAccessToken();

    const zohoRes = await fetch(
      `https://sign.zoho.com/api/v1/requests/${id}/pdf`,
      {
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
        },
      }
    );

    if (!zohoRes.ok) {
      const text = await zohoRes.text();
      return NextResponse.json(
        { error: "Failed to fetch signed document", id, details: text },
        { status: zohoRes.status }
      );
    }

    const blob = await zohoRes.arrayBuffer();

    return new NextResponse(blob, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="signed-document-${id}.pdf"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}
