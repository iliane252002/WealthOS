import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateComplianceSchema } from "@/lib/validators/compliance";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect("/login");
  const { id } = await params;

  const body = await request.json();
  const parsed = updateComplianceSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const item = await db.complianceItem.update({ where: { id }, data: parsed.data });
  return NextResponse.json(item);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect("/login");
  const { id } = await params;

  await db.complianceItem.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
