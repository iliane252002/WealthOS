import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createComplianceSchema } from "@/lib/validators/compliance";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect("/login");

  const { searchParams } = new URL(request.url);
  const propertyId = searchParams.get("propertyId");
  const lotId = searchParams.get("lotId");

  const where: Record<string, unknown> = {};
  if (propertyId) where.propertyId = propertyId;
  if (lotId) where.lotId = lotId;

  const items = await db.complianceItem.findMany({
    where: {
      ...where,
      OR: [
        { property: { userId: session.user.id } },
        { lot: { property: { userId: session.user.id } } },
      ],
    },
    include: {
      property: { select: { id: true, name: true } },
      lot: { select: { id: true, label: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(items);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect("/login");

  const body = await request.json();
  const parsed = createComplianceSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const item = await db.complianceItem.create({ data: parsed.data });
  return NextResponse.json(item, { status: 201 });
}
