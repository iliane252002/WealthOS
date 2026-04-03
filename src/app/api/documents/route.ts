import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const createDocumentSchema = z.object({
  propertyId: z.string().optional(),
  lotId: z.string().optional(),
  name: z.string().min(1, "Document name is required"),
  category: z
    .enum([
      "LEASE_CONTRACT",
      "INSURANCE",
      "TAX",
      "INVOICE",
      "PHOTO",
      "DIAGNOSTIC",
      "RECEIPT",
      "OTHER",
    ])
    .default("OTHER"),
  fileUrl: z.string().min(1, "File URL is required"),
  fileType: z.string().min(1),
  fileSize: z.number().int().positive(),
  description: z.string().optional(),
  tags: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("propertyId");
    const lotId = searchParams.get("lotId");
    const category = searchParams.get("category");
    const search = searchParams.get("search");

    const where: Record<string, unknown> = {
      userId: session.user.id,
    };

    if (propertyId) where.propertyId = propertyId;
    if (lotId) where.lotId = lotId;
    if (category) where.category = category;
    if (search) {
      where.name = { contains: search, mode: "insensitive" };
    }

    const documents = await db.document.findMany({
      where,
      include: {
        property: { select: { id: true, name: true } },
        lot: { select: { id: true, label: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(documents);
  } catch (error) {
    console.error("GET /api/documents error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createDocumentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // Verify property belongs to user if provided
    if (parsed.data.propertyId) {
      const property = await db.property.findUnique({
        where: { id: parsed.data.propertyId, userId: session.user.id },
      });
      if (!property) {
        return NextResponse.json({ error: "Property not found" }, { status: 404 });
      }
    }

    const document = await db.document.create({
      data: {
        ...parsed.data,
        userId: session.user.id,
      },
    });

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    console.error("POST /api/documents error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
