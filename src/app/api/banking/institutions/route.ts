import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listInstitutions } from "@/lib/gocardless";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const institutions = await listInstitutions("FR");
    // Return top French banks sorted by name, filter out obscure ones
    return NextResponse.json(institutions);
  } catch (error) {
    console.error("Failed to list institutions:", error);
    return NextResponse.json({ error: "Failed to fetch banks" }, { status: 500 });
  }
}
