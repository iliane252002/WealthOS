import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const ALLOWED_TYPES: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_TYPES[file.type]) {
      return NextResponse.json(
        { error: "Unsupported file type", allowedTypes: Object.keys(ALLOWED_TYPES) },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Vercel Blob in production, local filesystem in dev
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const { put } = await import("@vercel/blob");
      const blob = await put(`wealthos/${session.user.id}/${Date.now()}-${file.name}`, file, {
        access: "public",
      });
      return NextResponse.json({
        url: blob.url,
        type: file.type,
        size: file.size,
        name: file.name,
      });
    }

    // Local dev: save to /uploads folder
    const { writeFile, mkdir } = await import("node:fs/promises");
    const { join, extname } = await import("node:path");
    const { randomUUID } = await import("node:crypto");

    const uploadDir = join(process.cwd(), "uploads");
    await mkdir(uploadDir, { recursive: true });

    const ext = extname(file.name) || ALLOWED_TYPES[file.type];
    const uniqueName = `${randomUUID()}${ext}`;
    const filePath = join(uploadDir, uniqueName);
    const arrayBuffer = await file.arrayBuffer();
    await writeFile(filePath, Buffer.from(arrayBuffer));

    return NextResponse.json({
      url: `/api/uploads/${uniqueName}`,
      type: file.type,
      size: file.size,
      name: file.name,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
}
