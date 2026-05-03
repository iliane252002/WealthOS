import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createRequisition } from "@/lib/gocardless";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { institutionId, institutionName } = await request.json();
    if (!institutionId) return NextResponse.json({ error: "institutionId required" }, { status: 400 });

    const baseUrl = process.env.AUTH_URL || "http://localhost:3000";
    const redirectUrl = `${baseUrl}/api/banking/callback`;

    const requisition = await createRequisition(
      institutionId,
      redirectUrl,
      `wealthos-${session.user.id}-${Date.now()}`
    );

    // Store the pending connection
    await db.bankConnection.create({
      data: {
        userId: session.user.id,
        institutionId,
        institutionName: institutionName || institutionId,
        requisitionId: requisition.id,
        accountIds: "[]",
        status: "PENDING",
      },
    });

    return NextResponse.json({ redirectUrl: requisition.link });
  } catch (error) {
    console.error("Banking connect error:", error);
    return NextResponse.json({ error: "Failed to initiate bank connection" }, { status: 500 });
  }
}
