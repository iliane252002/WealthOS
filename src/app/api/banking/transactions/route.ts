import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const matchStatus = searchParams.get("matchStatus"); // UNMATCHED | MATCHED | IGNORED

  const transactions = await db.bankTransaction.findMany({
    where: {
      connection: { userId: session.user.id },
      ...(matchStatus ? { matchStatus } : {}),
    },
    include: {
      connection: { select: { institutionName: true } },
    },
    orderBy: { bookingDate: "desc" },
    take: 100,
  });

  return NextResponse.json(transactions);
}

// Manually match or ignore a transaction
export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { transactionId, action, rentEventId } = await request.json();
  // action: "match" | "ignore"

  const tx = await db.bankTransaction.findUnique({
    where: { id: transactionId },
    include: { connection: true },
  });

  if (!tx || tx.connection.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (action === "ignore") {
    await db.bankTransaction.update({
      where: { id: transactionId },
      data: { matchStatus: "IGNORED" },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "match" && rentEventId) {
    const today = new Date().toISOString().slice(0, 10);

    await db.bankTransaction.update({
      where: { id: transactionId },
      data: { matchStatus: "MATCHED", rentEventId },
    });

    await db.rentEvent.update({
      where: { id: rentEventId },
      data: {
        status: "PAID",
        paidAmount: tx.amount,
        paidDate: tx.bookingDate || today,
        notes: `Matched via bank transaction (${tx.debtorName || "unknown"})`,
      },
    });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
