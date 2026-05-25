import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const filename = id;
    
    // Security check
    if (!filename.endsWith(".mp4") || filename.includes("/") || filename.includes("..")) {
      return new NextResponse("Invalid file", { status: 400 });
    }

    const publicVideosDir = path.join(process.cwd(), "public", "videos");
    const videoPath = path.join(publicVideosDir, filename);

    try {
      await fs.access(videoPath);
      await fs.unlink(videoPath);
      return new NextResponse("Deleted", { status: 200 });
    } catch {
      return new NextResponse("Video not found", { status: 404 });
    }
  } catch (error: any) {
    console.error("Failed to delete video:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
