import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createUtilitySchema } from "@/lib/validators/utility";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect("/login");

  const { searchParams } = new URL(request.url);
  const lotId = searchParams.get("lotId");
  const type = searchParams.get("type");

  const where: Record<string, unknown> = {};
  if (lotId) where.lotId = lotId;
  if (type) where.type = type;

  // Only return utilities for lots the user owns
  const utilities = await db.utility.findMany({
    where: {
      ...where,
      lot: { property: { userId: session.user.id } },
    },
    include: { lot: { select: { id: true, label: true, property: { select: { id: true, name: true } } } } },
    orderBy: { period: "desc" },
  });

  return NextResponse.json(utilities);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect("/login");

  const body = await request.json();
  const parsed = createUtilitySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Verify lot ownership
  const lot = await db.lot.findFirst({
    where: { id: parsed.data.lotId, property: { userId: session.user.id } },
  });
  if (!lot) return NextResponse.json({ error: "Lot not found" }, { status: 404 });

  const utility = await db.utility.create({ data: parsed.data });
  return NextResponse.json(utility, { status: 201 });
}
