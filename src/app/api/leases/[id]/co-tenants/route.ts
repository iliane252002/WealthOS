import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// POST: add a co-tenant to a lease
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: leaseId } = await params;
  const { tenantId } = await request.json();

  // Verify lease belongs to user
  const lease = await db.lease.findUnique({
    where: { id: leaseId },
    include: { lot: { include: { property: { select: { userId: true } } } } },
  });
  if (!lease || lease.lot.property.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const co = await db.leaseCoTenant.upsert({
    where: { leaseId_tenantId: { leaseId, tenantId } },
    create: { id: crypto.randomUUID(), leaseId, tenantId },
    update: {},
  });

  return NextResponse.json(co, { status: 201 });
}

// DELETE: remove a co-tenant from a lease
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: leaseId } = await params;
  const { tenantId } = await request.json();

  const lease = await db.lease.findUnique({
    where: { id: leaseId },
    include: { lot: { include: { property: { select: { userId: true } } } } },
  });
  if (!lease || lease.lot.property.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.leaseCoTenant.deleteMany({ where: { leaseId, tenantId } });
  return NextResponse.json({ success: true });
}
