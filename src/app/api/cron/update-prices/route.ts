import { NextRequest, NextResponse } from "next/server";
import { syncInvestmentPrices } from "@/lib/market";
import { db } from "@/lib/db";
import { refreshPropertyEstimate } from "@/lib/estimation";
import { cronAuthorized } from "@/lib/cron";

// Tâche quotidienne : récupère les cours de clôture de toutes les positions cotées,
// et actualise une fois par mois l'estimation des biens dont la valeur n'est pas saisie.

async function run(req: NextRequest) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const report = await syncInvestmentPrices();

  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const stale = await db.property.findMany({
    where: { currentValue: null, OR: [{ estimatedAt: null }, { estimatedAt: { lt: monthAgo } }] },
    select: { id: true },
    take: 5, // limite par passage pour rester dans le temps d'exécution
  });
  let estimates = 0;
  for (const p of stale) {
    const r = await refreshPropertyEstimate(p.id).catch(() => null);
    if (r?.ok) estimates++;
  }

  return NextResponse.json({ ...report, estimates, estimatesChecked: stale.length });
}

export const GET = run;
export const POST = run;
