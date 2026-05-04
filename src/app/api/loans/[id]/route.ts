import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const updateLoanSchema = z.object({
  lenderName: z.string().optional(),
  originalAmount: z.number().positive().optional(),
  interestRate: z.number().min(0).optional(),
  durationMonths: z.number().int().positive().optional(),
  startDate: z.string().optional(),
  monthlyPayment: z.number().positive().optional(),
  notes: z.string().optional(),
});

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const existing = await db.loan.findUnique({ where: { id, userId: session.user.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.loan.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json();
  const parsed = updateLoanSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const existing = await db.loan.findUnique({ where: { id, userId: session.user.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const loan = await db.loan.update({ where: { id }, data: parsed.data });
  return NextResponse.json(loan);
}
