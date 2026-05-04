import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const roomSchema = z.object({
  name: z.string(),
  condition: z.string(), // EXCELLENT | BON | USAGE | MAUVAIS
  notes: z.string().optional(),
});

const edlSchema = z.object({
  lotId: z.string().min(1),
  leaseId: z.string().optional(),
  type: z.enum(["ENTREE", "SORTIE"]),
  date: z.string().min(1),
  notes: z.string().optional(),
  rooms: z.array(roomSchema).optional(),
  status: z.enum(["DRAFT", "COMPLETED"]).default("DRAFT"),
});

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const lotId = searchParams.get("lotId");

  const edls = await db.etatDesLieux.findMany({
    where: {
      userId: session.user.id,
      ...(lotId ? { lotId } : {}),
    },
    include: {
      lot: { select: { id: true, label: true, property: { select: { id: true, name: true } } } },
    },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(edls);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = edlSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Verify lot belongs to user
  const lot = await db.lot.findUnique({
    where: { id: parsed.data.lotId },
    include: { property: { select: { userId: true } } },
  });
  if (!lot || lot.property.userId !== session.user.id) {
    return NextResponse.json({ error: "Lot not found" }, { status: 404 });
  }

  const edl = await db.etatDesLieux.create({
    data: { ...parsed.data, userId: session.user.id },
  });

  return NextResponse.json(edl, { status: 201 });
}
