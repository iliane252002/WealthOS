import { NextRequest, NextResponse } from "next/server";
import { syncInvestmentPrices } from "@/lib/market";

// Tâche quotidienne : récupère les cours de clôture de toutes les positions cotées.
// Vercel Cron appelle la route en GET avec « Authorization: Bearer <CRON_SECRET> ».
function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return (
    req.headers.get("authorization") === `Bearer ${secret}` ||
    req.headers.get("x-cron-secret") === secret
  );
}

async function run(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const report = await syncInvestmentPrices();
  return NextResponse.json(report);
}

export const GET = run;
export const POST = run;
