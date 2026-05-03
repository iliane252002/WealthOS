import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const connections = await db.bankConnection.findMany({
    where: { userId: session.user.id },
    include: {
      transactions: {
        orderBy: { bookingDate: "desc" },
        take: 1,
      },
      _count: { select: { transactions: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(connections);
}

export async function DELETE() {
  // Delete all connections for the user (implemented per-connection in [id] route)
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ error: "Use DELETE /api/banking/connections/[id]" }, { status: 400 });
}
