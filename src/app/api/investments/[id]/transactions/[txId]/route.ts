import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateTransactionSchema } from "@/lib/validators/transaction";
import { computePosition, recomputeInvestment } from "@/lib/transactions";
import { syncInvestmentPrices } from "@/lib/market";

type Params = { params: Promise<{ id: string; txId: string }> };

async function findOwned(userId: string, id: string, txId: string) {
  const investment = await db.investment.findUnique({ where: { id, userId } });
  if (!investment) return null;
  const tx = await db.investmentTransaction.findUnique({ where: { id: txId } });
  if (!tx || tx.investmentId !== id) return null;
  return { investment, tx };
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id, txId } = await params;
    const owned = await findOwned(session.user.id, id, txId);
    if (!owned) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    const parsed = updateTransactionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const all = await db.investmentTransaction.findMany({ where: { investmentId: id } });
    const check = computePosition(all.map((t) => (t.id === txId ? { ...t, ...parsed.data } : t)));
    if (check.error) {
      return NextResponse.json({ error: check.error }, { status: 400 });
    }

    const tx = await db.investmentTransaction.update({ where: { id: txId }, data: parsed.data });
    await recomputeInvestment(id);
    if (owned.investment.ticker) await syncInvestmentPrices(session.user.id, id).catch(() => null);
    return NextResponse.json(tx);
  } catch (error) {
    console.error("PUT /api/investments/[id]/transactions/[txId] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id, txId } = await params;
    const owned = await findOwned(session.user.id, id, txId);
    if (!owned) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    const all = await db.investmentTransaction.findMany({ where: { investmentId: id } });
    if (all.length <= 1) {
      return NextResponse.json(
        { error: "Une position garde au moins une opération. Supprimez la position elle-même." },
        { status: 400 }
      );
    }
    const check = computePosition(all.filter((t) => t.id !== txId));
    if (check.error) {
      return NextResponse.json({ error: check.error }, { status: 400 });
    }

    await db.investmentTransaction.delete({ where: { id: txId } });
    await recomputeInvestment(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/investments/[id]/transactions/[txId] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
