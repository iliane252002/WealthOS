import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getRequisition } from "@/lib/gocardless";

// GoCardless redirects here after user authorises bank access
// URL contains: ?ref=<requisitionId>&error=...
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ref = searchParams.get("ref");
  const error = searchParams.get("error");

  const baseUrl = process.env.AUTH_URL || "http://localhost:3000";

  if (error || !ref) {
    return NextResponse.redirect(`${baseUrl}/settings?banking=error`);
  }

  try {
    // GoCardless sends the requisitionId as "ref"
    const connection = await db.bankConnection.findUnique({
      where: { requisitionId: ref },
    });

    if (!connection) {
      return NextResponse.redirect(`${baseUrl}/settings?banking=error&reason=notfound`);
    }

    // Fetch the requisition to get the account IDs
    const requisition = await getRequisition(ref);

    await db.bankConnection.update({
      where: { id: connection.id },
      data: {
        accountIds: JSON.stringify(requisition.accounts || []),
        status: requisition.accounts?.length > 0 ? "ACTIVE" : "ERROR",
      },
    });

    return NextResponse.redirect(`${baseUrl}/settings?banking=success`);
  } catch (err) {
    console.error("Banking callback error:", err);
    return NextResponse.redirect(`${baseUrl}/settings?banking=error`);
  }
}
