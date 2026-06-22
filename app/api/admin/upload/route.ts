import { NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp",
  "image/gif", "image/svg+xml", "image/avif",
]);

const ALLOWED_DOWNLOAD_TYPES = new Set([
  "application/pdf",
  "application/zip", "application/x-zip-compressed",
  "application/x-rar-compressed", "application/vnd.rar",
  "application/octet-stream",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
]);

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;   // 10 MB
const MAX_DOWNLOAD_SIZE = 100 * 1024 * 1024; // 100 MB

export async function POST(req: Request) {
  const data = await req.formData();
  const file = data.get("file") as File;
  const type = (data.get("type") as string) || "image"; // "image" | "download"

  if (!file) {
    return NextResponse.json({ error: "No file" }, { status: 400 });
  }

  if (type === "download") {
    if (file.size > MAX_DOWNLOAD_SIZE) {
      return NextResponse.json({ error: "File too large (max 100MB)" }, { status: 400 });
    }
    // For downloads allow all non-dangerous types; block executables
    const blockedExts = new Set([".exe", ".bat", ".cmd", ".sh", ".ps1", ".vbs", ".js", ".msi"]);
    const ext = path.extname(file.name).toLowerCase();
    if (blockedExts.has(ext)) {
      return NextResponse.json({ error: "File type not allowed" }, { status: 400 });
    }
  } else {
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      return NextResponse.json({ error: "File type not allowed" }, { status: 400 });
    }
    if (file.size > MAX_IMAGE_SIZE) {
      return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
    }
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const ext = path.extname(file.name).toLowerCase().replace(/[^.a-z0-9]/g, "") || (type === "download" ? ".bin" : ".jpg");
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  const filePath = path.join(process.cwd(), "public/uploads", fileName);

  await writeFile(filePath, buffer);

  return NextResponse.json({ url: `/uploads/${fileName}` });
}
