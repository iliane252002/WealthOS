import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createExpenseSchema } from "@/lib/validators/expense";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect("/login");

  const { searchParams } = new URL(request.url);
  const propertyId = searchParams.get("propertyId");
  const lotId = searchParams.get("lotId");
  const category = searchParams.get("category");

  const where: Record<string, unknown> = { userId: session.user.id };
  if (propertyId) where.propertyId = propertyId;
  if (lotId) where.lotId = lotId;
  if (category) where.category = category;

  const expenses = await db.expense.findMany({
    where,
    include: { property: { select: { id: true, name: true } }, lot: { select: { id: true, label: true } } },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(expenses);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect("/login");

  const body = await request.json();
  const parsed = createExpenseSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const expense = await db.expense.create({
    data: { ...parsed.data, userId: session.user.id },
  });

  return NextResponse.json(expense, { status: 201 });
}
