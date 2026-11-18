import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

// Modules proposés pendant le parcours de bienvenue
const ONBOARDING_MODULES = ["EXPENSES", "WORKS", "UTILITIES", "LEGAL"] as const;

const finishSchema = z.object({
  modules: z.array(z.enum(ONBOARDING_MODULES)),
});

// Termine le parcours : enregistre les modules choisis
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const parsed = finishSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const userId = session.user.id;
    const chosen = new Set(parsed.data.modules);

    await db.$transaction([
      ...ONBOARDING_MODULES.map((module) =>
        db.userModule.upsert({
          where: { userId_module: { userId, module } },
          create: { userId, module, isActive: chosen.has(module) },
          update: { isActive: chosen.has(module) },
        })
      ),
      db.user.update({ where: { id: userId }, data: { onboardedAt: new Date() } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/onboarding error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
