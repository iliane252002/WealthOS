import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { syncInvestmentPrices } from "@/lib/market";

// Mise à jour des cours à la demande (bouton « Mettre à jour les cours »)
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const report = await syncInvestmentPrices(session.user.id);
    return NextResponse.json(report);
  } catch (error) {
    console.error("POST /api/investments/sync error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
