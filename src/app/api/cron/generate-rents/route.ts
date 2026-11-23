import { NextRequest, NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron";
import { syncRents } from "@/lib/rents";

// Tâche quotidienne : crée les échéances du mois pour tous les baux actifs
// et passe en retard celles qui sont dépassées.
async function run(req: NextRequest) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json(await syncRents());
}

export const GET = run;
export const POST = run;
