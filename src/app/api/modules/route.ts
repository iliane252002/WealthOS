import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const ALL_MODULES = ["EXPENSES", "WORKS", "UTILITIES", "LEGAL", "ADVANCED_DOCS"];

// GET: list user's modules with their active status
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect("/login");

  const userModules = await db.userModule.findMany({
    where: { userId: session.user.id },
  });

  const moduleMap = Object.fromEntries(userModules.map((m) => [m.module, m.isActive]));

  const modules = ALL_MODULES.map((mod) => ({
    module: mod,
    isActive: moduleMap[mod] ?? false,
  }));

  return NextResponse.json(modules);
}

// PUT: toggle a module
export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect("/login");

  const { module, isActive } = await request.json();

  if (!ALL_MODULES.includes(module)) {
    return NextResponse.json({ error: "Invalid module" }, { status: 400 });
  }

  const result = await db.userModule.upsert({
    where: { userId_module: { userId: session.user.id, module } },
    create: { userId: session.user.id, module, isActive },
    update: { isActive },
  });

  return NextResponse.json(result);
}
