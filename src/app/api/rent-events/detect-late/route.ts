import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { syncRents } from "@/lib/rents";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { late, created } = await syncRents(session.user.id);
  return NextResponse.json({ updated: late + created });
}
