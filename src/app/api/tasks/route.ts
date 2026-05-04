import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const taskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).default("TODO"),
  dueDate: z.string().optional(),
  propertyId: z.string().optional(),
  lotId: z.string().optional(),
  tenantId: z.string().optional(),
  contractorId: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const propertyId = searchParams.get("propertyId");

  const tasks = await db.task.findMany({
    where: {
      userId: session.user.id,
      ...(status ? { status } : {}),
      ...(propertyId ? { propertyId } : {}),
    },
    include: {
      property: { select: { id: true, name: true } },
      lot: { select: { id: true, label: true } },
      tenant: { select: { id: true, firstName: true, lastName: true } },
      contractor: { select: { id: true, name: true, trade: true } },
    },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(tasks);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = taskSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const task = await db.task.create({
    data: { ...parsed.data, userId: session.user.id },
    include: {
      property: { select: { id: true, name: true } },
      lot: { select: { id: true, label: true } },
      contractor: { select: { id: true, name: true, trade: true } },
    },
  });

  return NextResponse.json(task, { status: 201 });
}
