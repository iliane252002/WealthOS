import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { refreshPropertyEstimate } from "@/lib/estimation";

// Recalcule l'estimation de valeur d'un bien (bouton « Actualiser l'estimation »)
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const property = await db.property.findUnique({ where: { id, userId: session.user.id } });
    if (!property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }
    const result = await refreshPropertyEstimate(id);
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  } catch (error) {
    console.error("POST /api/properties/[id]/estimate error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
