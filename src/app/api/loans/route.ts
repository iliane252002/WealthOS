import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createLoanSchema = z.object({
  propertyId: z.string().min(1),
  lenderName: z.string().optional(),
  originalAmount: z.number().positive(),
  interestRate: z.number().min(0),
  durationMonths: z.number().int().positive(),
  startDate: z.string().min(1),
  monthlyPayment: z.number().positive().optional(),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const propertyId = searchParams.get("propertyId");

  const loans = await db.loan.findMany({
    where: {
      userId: session.user.id,
      ...(propertyId ? { propertyId } : {}),
    },
    include: { property: { select: { id: true, name: true } } },
    orderBy: { startDate: "desc" },
  });

  return NextResponse.json(loans);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = createLoanSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Verify property belongs to user
  const property = await db.property.findUnique({
    where: { id: parsed.data.propertyId, userId: session.user.id },
  });
  if (!property) return NextResponse.json({ error: "Property not found" }, { status: 404 });

  // Calculate monthly payment if not provided
  let monthlyPayment = parsed.data.monthlyPayment;
  if (!monthlyPayment) {
    const r = parsed.data.interestRate / 12 / 100;
    const n = parsed.data.durationMonths;
    const P = parsed.data.originalAmount;
    if (r === 0) {
      monthlyPayment = P / n;
    } else {
      monthlyPayment = (P * r) / (1 - Math.pow(1 + r, -n));
    }
  }

  const loan = await db.loan.create({
    data: {
      ...parsed.data,
      monthlyPayment,
      userId: session.user.id,
    },
  });

  return NextResponse.json(loan, { status: 201 });
}
